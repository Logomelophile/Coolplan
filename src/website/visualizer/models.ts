/**
 * Model registry for the in-browser visualizer. URLs are overridable so the
 * same build can point at a self-hosted file (production) or a CDN (prototype).
 *
 * Override order: URL query `?model-<id>=<url>` → localStorage `coolplan.model.<id>`
 * → Vite env `VITE_MODEL_<ID>` → the default below.
 */
export interface ModelSpec {
  id: string;
  url: string;
  /** Human-readable licence note surfaced in diagnostics and THIRD_PARTY_NOTICES. */
  licence: string;
  /** Whether the default weights may ship in a commercial product as-is. */
  commercial: boolean;
  inputSize: number;
  approxBytes: number;
}

export const FLOOR_SEGMENTATION: ModelSpec = {
  id: 'floor-seg',
  // Prototype weights. Replace with an Apache-2.0 ADE20K model (EfficientViT-Seg export) before release.
  url: 'https://huggingface.co/Xenova/segformer-b0-finetuned-ade-512-512/resolve/main/onnx/model_quantized.onnx',
  licence: 'SegFormer-B0 ADE20K (NVIDIA Source Code License: research/evaluation only) — prototype weights',
  commercial: false,
  inputSize: 512,
  approxBytes: 4_418_863,
};

export const DEPTH: ModelSpec = {
  id: 'depth',
  // q4f16 is the smallest download and fast on WebGPU; WASM has no fp16/q4 kernels, so it uses DEPTH_WASM instead.
  url: 'https://huggingface.co/onnx-community/depth-anything-v2-small/resolve/main/onnx/model_q4f16.onnx',
  licence: 'Depth Anything V2 Small (Apache-2.0)',
  commercial: true,
  inputSize: 518,
  approxBytes: 19_100_000,
};

/** Measured single-thread WASM: q8 ≈ 4–6 s at 518×686 vs ≈ 17 s for q4f16/fp16. */
export const DEPTH_WASM: ModelSpec = {
  id: 'depth-wasm',
  url: 'https://huggingface.co/onnx-community/depth-anything-v2-small/resolve/main/onnx/model_quantized.onnx',
  licence: 'Depth Anything V2 Small (Apache-2.0)',
  commercial: true,
  inputSize: 518,
  approxBytes: 27_260_000,
};

export const SAM_ENCODER: ModelSpec = {
  id: 'sam-encoder',
  url: 'https://huggingface.co/Xenova/slimsam-77-uniform/resolve/main/onnx/vision_encoder_quantized.onnx',
  licence: 'SlimSAM-77 (Apache-2.0)',
  commercial: true,
  inputSize: 1024,
  approxBytes: 8_880_000,
};

export const SAM_DECODER: ModelSpec = {
  id: 'sam-decoder',
  url: 'https://huggingface.co/Xenova/slimsam-77-uniform/resolve/main/onnx/prompt_encoder_mask_decoder_quantized.onnx',
  licence: 'SlimSAM-77 (Apache-2.0)',
  commercial: true,
  inputSize: 1024,
  approxBytes: 4_900_000,
};

const CACHE_NAME = 'coolplan-models-v1';

export function resolveModelUrl(spec: ModelSpec): string {
  try {
    const query = new URLSearchParams(globalThis.location?.search ?? '').get(`model-${spec.id}`);
    if (query) return query;
    const stored = globalThis.localStorage?.getItem(`coolplan.model.${spec.id}`);
    if (stored) return stored;
  } catch { /* no DOM/storage (worker) */ }
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  const override = env?.[`VITE_MODEL_${spec.id.replace(/-/g, '_').toUpperCase()}`];
  return override || spec.url;
}

/** Fetches a model once and keeps it in Cache Storage; falls back to a plain fetch where caches are unavailable. */
export async function loadModelBuffer(url: string, onProgress?: (loaded: number, total: number) => void): Promise<ArrayBuffer> {
  let cache: Cache | null = null;
  try {
    if (typeof caches !== 'undefined') {
      cache = await caches.open(CACHE_NAME);
      const hit = await cache.match(url);
      if (hit) return hit.arrayBuffer();
    }
  } catch { cache = null; }
  const response = await fetch(url, { mode: 'cors' });
  if (!response.ok) throw new Error(`โหลดโมเดลไม่สำเร็จ (${response.status})`);
  const total = Number(response.headers.get('content-length') ?? 0);
  if (!response.body || !onProgress) {
    const buffer = await response.arrayBuffer();
    if (cache) void cache.put(url, new Response(buffer.slice(0), { headers: { 'content-type': 'application/octet-stream' } })).catch(() => undefined);
    return buffer;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    onProgress(loaded, total);
  }
  const buffer = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
  if (cache) void cache.put(url, new Response(buffer.slice().buffer, { headers: { 'content-type': 'application/octet-stream' } })).catch(() => undefined);
  return buffer.buffer;
}
