/**
 * Vision worker (design §5.3–5.5, phase 2). Owns every ONNX Runtime session so
 * model loading and inference never block the page:
 *  - segment:   floor matte + automatic horizon (SegFormer/EfficientViT ADE20K)
 *  - depth:     Depth Anything V2 → plane-consistency occlusion refinement
 *  - sam-embed: SlimSAM image encoder (once per photo)
 *  - sam-click: SlimSAM prompt decoder (per click, milliseconds)
 */
import * as ort from 'onnxruntime-web/webgpu';
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.jsep.wasm?url';
import mjsUrl from 'onnxruntime-web/ort-wasm-simd-threaded.jsep.mjs?url';
import { guidedFilter, resizeMap, sharpenMatte } from './mask/guidedFilter';
import { keepMajorComponents } from './mask/cleanup';
import { estimateHorizon, type HorizonEstimate } from './geometry/vanishing';
import { refineWithDepth } from './geometry/depthPlane';
import { loadModelBuffer } from './models';

export type Backend = 'webgpu' | 'wasm';

export interface SegmentRequest {
  type: 'segment';
  id: number;
  modelUrl: string;
  tensor: Float32Array;
  box: { size: number; ox: number; oy: number; nw: number; nh: number };
  lum: Float32Array;
  width: number;
  height: number;
  includeRug: boolean;
}
export interface DepthRequest {
  type: 'depth';
  id: number;
  modelUrl: string;
  /** Variant used when WebGPU is unavailable (integer quantisation runs far faster on WASM). */
  wasmModelUrl?: string;
  tensor: Float32Array;
  dw: number;
  dh: number;
  alpha: Float32Array;
  width: number;
  height: number;
  focal: number;
}
export interface SamEmbedRequest {
  type: 'sam-embed';
  id: number;
  encoderUrl: string;
  decoderUrl: string;
  tensor: Float32Array;
  /** Identifies the photo so stale embeddings are never reused. */
  photoToken: number;
}
export interface SamClickRequest {
  type: 'sam-click';
  id: number;
  photoToken: number;
  /** Points in the 1024 SAM frame with labels (1 = floor, 0 = not floor). */
  points: { x: number; y: number; label: number }[];
}
export type WorkerRequest = SegmentRequest | DepthRequest | SamEmbedRequest | SamClickRequest;

export interface SegmentResult {
  type: 'result';
  id: number;
  alpha: Float32Array;
  coverage: number;
  horizon: HorizonEstimate | null;
  backend: Backend;
  timings: { load: number; infer: number; refine: number; horizon: number };
}
export interface DepthResult {
  type: 'depth-result';
  id: number;
  alpha: Float32Array;
  planarity: number;
  removed: number;
  backend: Backend;
  timings: { load: number; infer: number; fit: number };
}
export interface SamEmbedResult { type: 'sam-embed-result'; id: number; backend: Backend; timings: { load: number; infer: number } }
export interface SamClickResult {
  type: 'sam-click-result';
  id: number;
  /** 256×256 mask over the padded 1024 frame, values 0..1. */
  mask: Float32Array;
  size: number;
  iou: number;
  ms: number;
}
export type SegmentProgress = { type: 'progress'; id: number; stage: 'download' | 'session' | 'infer' | 'refine' | 'horizon' | 'fit'; loaded?: number; total?: number };
export type SegmentError = { type: 'error'; id: number; message: string };
export type WorkerMessage = SegmentResult | DepthResult | SamEmbedResult | SamClickResult | SegmentProgress | SegmentError;

const FLOOR = 3, RUG = 28;
interface WorkerScope {
  postMessage(message: WorkerMessage, transfer?: Transferable[]): void;
  addEventListener(type: 'message', listener: (event: MessageEvent<WorkerRequest>) => void): void;
  crossOriginIsolated: boolean;
  navigator: Navigator;
}
const scope = self as unknown as WorkerScope;

ort.env.wasm.wasmPaths = { wasm: wasmUrl, mjs: mjsUrl };
ort.env.wasm.numThreads = scope.crossOriginIsolated ? Math.min(4, scope.navigator.hardwareConcurrency || 1) : 1;

interface Loaded { session: ort.InferenceSession; backend: Backend; loadMs: number }
const sessions = new Map<string, Promise<Loaded>>();

function progress(id: number, stage: SegmentProgress['stage'], loaded?: number, total?: number): void {
  scope.postMessage({ type: 'progress', id, stage, loaded, total });
}

async function getSession(modelUrl: string, id: number, preferGpu = true): Promise<Loaded> {
  const cached = sessions.get(modelUrl);
  if (cached) return cached;
  const pending = (async (): Promise<Loaded> => {
    const started = performance.now();
    const buffer = await loadModelBuffer(modelUrl, (loaded, total) => progress(id, 'download', loaded, total));
    progress(id, 'session');
    const hasWebGPU = preferGpu && 'gpu' in scope.navigator && Boolean((scope.navigator as unknown as { gpu?: unknown }).gpu);
    if (hasWebGPU) {
      try {
        const session = await ort.InferenceSession.create(buffer.slice(0), { executionProviders: ['webgpu'], graphOptimizationLevel: 'all' });
        return { session, backend: 'webgpu', loadMs: performance.now() - started };
      } catch { /* WebGPU adapter refused the model: fall back to WASM */ }
    }
    const session = await ort.InferenceSession.create(buffer, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
    return { session, backend: 'wasm', loadMs: performance.now() - started };
  })();
  sessions.set(modelUrl, pending);
  pending.catch(() => sessions.delete(modelUrl));
  return pending;
}

// ------------------------------------------------------------------ segment

async function segment(request: SegmentRequest): Promise<void> {
  const { id, box, width, height } = request;
  const { session, backend, loadMs } = await getSession(request.modelUrl, id);
  progress(id, 'infer');
  const inferStarted = performance.now();
  const output = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', request.tensor, [1, 3, box.size, box.size]) });
  const logits = output[session.outputNames[0]];
  const [, classes, lh, lw] = logits.dims as number[];
  const values = logits.data as Float32Array;
  const plane = lw * lh;
  const prob = new Float32Array(plane);
  for (let i = 0; i < plane; i++) {
    let max = -Infinity;
    for (let c = 0; c < classes; c++) max = Math.max(max, values[c * plane + i]);
    let sum = 0, floor = 0;
    for (let c = 0; c < classes; c++) {
      const e = Math.exp(values[c * plane + i] - max);
      sum += e;
      if (c === FLOOR || (request.includeRug && c === RUG)) floor += e;
    }
    prob[i] = floor / sum;
  }
  const inferMs = performance.now() - inferStarted;
  progress(id, 'refine');
  const refineStarted = performance.now();
  const rx = Math.round(box.ox * lw / box.size), ry = Math.round(box.oy * lh / box.size);
  const rw = Math.max(1, Math.round(box.nw * lw / box.size)), rh = Math.max(1, Math.round(box.nh * lh / box.size));
  const cropped = new Float32Array(rw * rh);
  for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) cropped[y * rw + x] = prob[Math.min(lh - 1, y + ry) * lw + Math.min(lw - 1, x + rx)];
  const coarse = resizeMap(cropped, rw, rh, width, height);
  const filtered = guidedFilter(request.lum, coarse, width, height, { radius: Math.max(4, Math.round(width * .006)), epsilon: 2e-3 });
  const alpha = keepMajorComponents(sharpenMatte(filtered, .4, .6), width, height);
  let coverage = 0;
  for (let i = 0; i < alpha.length; i++) coverage += alpha[i];
  coverage /= alpha.length;
  const refineMs = performance.now() - refineStarted;
  progress(id, 'horizon');
  const horizonStarted = performance.now();
  let horizon: HorizonEstimate | null = null;
  try { horizon = coverage > .02 ? estimateHorizon(request.lum, alpha, width, height) : null; } catch { horizon = null; }
  const result: SegmentResult = {
    type: 'result', id, alpha, coverage, horizon, backend,
    timings: { load: Math.round(loadMs), infer: Math.round(inferMs), refine: Math.round(refineMs), horizon: Math.round(performance.now() - horizonStarted) },
  };
  scope.postMessage(result, [alpha.buffer]);
}

// -------------------------------------------------------------------- depth

async function depth(request: DepthRequest): Promise<void> {
  const { id } = request;
  const hasWebGPU = 'gpu' in scope.navigator && Boolean((scope.navigator as unknown as { gpu?: unknown }).gpu);
  const { session, backend, loadMs } = await getSession(hasWebGPU ? request.modelUrl : request.wasmModelUrl ?? request.modelUrl, id);
  progress(id, 'infer');
  const inferStarted = performance.now();
  const output = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', request.tensor, [1, 3, request.dh, request.dw]) });
  const predicted = output[session.outputNames[0]];
  const dims = predicted.dims as number[];
  const dh = dims[dims.length - 2], dw = dims[dims.length - 1];
  const inferMs = performance.now() - inferStarted;
  progress(id, 'fit');
  const fitStarted = performance.now();
  const refined = refineWithDepth(predicted.data as Float32Array, dw, dh, request.alpha, request.width, request.height, { focal: request.focal });
  const alpha = keepMajorComponents(refined.alpha, request.width, request.height);
  const result: DepthResult = {
    type: 'depth-result', id, alpha, planarity: refined.planarity, removed: refined.removed, backend,
    timings: { load: Math.round(loadMs), infer: Math.round(inferMs), fit: Math.round(performance.now() - fitStarted) },
  };
  scope.postMessage(result, [alpha.buffer]);
}

// ---------------------------------------------------------------------- SAM

let embedding: { photoToken: number; image: ort.Tensor; positional: ort.Tensor; decoderUrl: string } | null = null;

async function samEmbed(request: SamEmbedRequest): Promise<void> {
  const { id } = request;
  const { session, backend, loadMs } = await getSession(request.encoderUrl, id);
  // Warm the decoder in parallel so the first click is instant.
  void getSession(request.decoderUrl, id, false).catch(() => undefined);
  progress(id, 'infer');
  const inferStarted = performance.now();
  const output = await session.run({ pixel_values: new ort.Tensor('float32', request.tensor, [1, 3, 1024, 1024]) });
  embedding = { photoToken: request.photoToken, image: output.image_embeddings, positional: output.image_positional_embeddings, decoderUrl: request.decoderUrl };
  scope.postMessage({ type: 'sam-embed-result', id, backend, timings: { load: Math.round(loadMs), infer: Math.round(performance.now() - inferStarted) } });
}

async function samClick(request: SamClickRequest): Promise<void> {
  const { id } = request;
  if (!embedding || embedding.photoToken !== request.photoToken) throw new Error('ยังไม่ได้เตรียมภาพสำหรับการแก้ขอบ');
  const { session } = await getSession(embedding.decoderUrl, id, false);
  const started = performance.now();
  const n = request.points.length;
  const points = new Float32Array(n * 2), labels = new BigInt64Array(n);
  request.points.forEach((point, index) => { points[index * 2] = point.x; points[index * 2 + 1] = point.y; labels[index] = BigInt(point.label); });
  const output = await session.run({
    image_embeddings: embedding.image,
    image_positional_embeddings: embedding.positional,
    input_points: new ort.Tensor('float32', points, [1, 1, n, 2]),
    input_labels: new ort.Tensor('int64', labels, [1, 1, n]),
  });
  const scores = output.iou_scores.data as Float32Array;
  const masks = output.pred_masks;
  const dims = masks.dims as number[];
  const count = dims[2], size = dims[3];
  let best = 0;
  for (let k = 1; k < count; k++) if (scores[k] > scores[best]) best = k;
  const data = masks.data as Float32Array;
  const mask = new Float32Array(size * size);
  const offset = best * size * size;
  for (let i = 0; i < mask.length; i++) mask[i] = 1 / (1 + Math.exp(-data[offset + i]));
  scope.postMessage({ type: 'sam-click-result', id, mask, size, iou: scores[best], ms: Math.round(performance.now() - started) }, [mask.buffer]);
}

scope.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  if (!request || typeof request !== 'object') return;
  const run = request.type === 'segment' ? segment(request)
    : request.type === 'depth' ? depth(request)
    : request.type === 'sam-embed' ? samEmbed(request)
    : request.type === 'sam-click' ? samClick(request)
    : Promise.resolve();
  run.catch(error => {
    scope.postMessage({ type: 'error', id: request.id, message: error instanceof Error ? error.message : String(error) });
  });
});
