import { sitePath } from '../../sitePath';
import { products } from '../../data/products';
import type { ProductConfig } from '../../types';
import { floorFrame, homographyFromQuad, invert, multiply, rotationTowards, scaled, type Mat3, type Point } from './geometry/homography';
import type { HorizonEstimate } from './geometry/vanishing';
import { createFloorRenderer, defaultRenderParams, type FloorRenderer } from './render/FloorRenderer';
import { computeShading } from './render/shading';
import { buildPlankAtlas, disposePlankAtlases, type PlankAtlas } from './texture/plankAtlas';
import { SAMPLE_ROOMS, LEGACY_SAMPLE_ROOMS, roomAlphaPath, type SampleRoom } from './rooms';
import type { FloorPattern } from './texture/layout';
import { decodeImage, depthTensor, letterboxTensor, samTensor, toWorkingCanvas } from './prepare';
import { luminanceOf, resizeMap } from './mask/guidedFilter';
import { DEPTH, DEPTH_WASM, FLOOR_SEGMENTATION, SAM_DECODER, SAM_ENCODER, resolveModelUrl } from './models';
import type { DepthRequest, SamClickRequest, SamEmbedRequest, SegmentRequest, WorkerMessage } from './vision.worker';
import { track } from './analytics';

/**
 * Photo-based floor visualizer (design doc phases 0–1). Everything runs in the
 * browser: a segmentation worker finds the floor in uploaded photos, a planar
 * homography (from the detected horizon or user adjustments) places the
 * product's procedural planks, and FloorRenderer composites them with the
 * photo's own shading. Sample rooms use precomputed mattes. Manual tools
 * (brush, horizon, plank scale, four corners) cover whatever the model misses.
 */
type Crop = { x: number; y: number; width: number; height: number };
type MaskSource = 'precomputed' | 'polygon' | 'quad' | 'auto' | 'none';
export type Stage = 'idle' | 'scanning' | 'auto' | 'manual';
export type Tool = 'none' | 'brush-add' | 'brush-erase' | 'horizon' | 'click-add' | 'click-erase';
export type DepthStatus = 'idle' | 'running' | 'done' | 'failed';
export type SamStatus = 'idle' | 'embedding' | 'ready' | 'failed';

export interface FloorVisualizerDiagnostics {
  pattern: FloorPattern;
  sourceWidth: number;
  sourceHeight: number;
  canUndo: boolean;
  canRedo: boolean;
  frame: Crop;
  display: Crop;
  ready: boolean;
  failed: boolean;
  disposed: boolean;
  room: number;
  finish: number;
  view: number;
  compare: boolean;
  comparePosition: number;
  uploaded: boolean;
  floorCorners: number;
  floorSelected: boolean;
  width: number;
  height: number;
  renderer: 'webgl2' | 'cpu';
  maskSource: MaskSource;
  rotation: number;
  atlasMs: number;
  renderMs: number;
  stage: Stage;
  tool: Tool;
  coverage: number;
  horizonY: number;
  horizonConfidence: number;
  cameraHeight: number;
  backend: 'webgpu' | 'wasm' | null;
  segmentMs: number;
  segmentTimings: { load: number; infer: number; refine: number; horizon: number } | null;
  modelProgress: number;
  scanError: string | null;
  depth: { status: DepthStatus; planarity: number; removed: number; ms: number; error: string | null };
  sam: { status: SamStatus; points: number; ms: number; error: string | null };
}

export interface FloorVisualizerOptions {
  imageUrl?: string;
  /** Product ids (from products.json) in the order of the colour picker. */
  productIds?: string[];
  renderer?: 'auto' | 'cpu';
  /** Set false to skip automatic segmentation and go straight to the four-corner tool. */
  autoDetect?: boolean;
  onHint?: (message: string) => void;
  onChange?: (state: FloorVisualizerDiagnostics) => void;
}

interface Scene {
  key: string;
  width: number;
  height: number;
  alpha: HTMLCanvasElement;
  alphaMap: Float32Array;
  shade: HTMLCanvasElement;
  tint: HTMLCanvasElement | null;
  meanRGB: [number, number, number];
  Hinv: Mat3;
  rotation: number;
  maskSource: MaskSource;
  maskTop: number;
}

interface Upload { canvas: HTMLCanvasElement; token: number; lum: Float32Array | null }

const DEFAULT_PRODUCTS = ['light-natural-oak', 'warm-taupe-oak', 'golden-honey-oak', 'whitewashed-ash-oak', 'greige-oak', 'dark-walnut-brown'];
/** Physical extent assumed for a user-picked floor quad: 3 m wide, 2 m deep. */
const QUAD_METRES: [number, number] = [3, 2];
const VIEWS = [[1, .5, .5], [1.14, .18, .54], [1.14, .83, .54], [1.30, .50, .62], [1.8, .32, .57], [2.1, .78, .98]];
const UPLOAD_FOCAL = .85;
const DEFAULT_CAMERA_HEIGHT = 1.4;
const MIN_COVERAGE = .03;
const PURPLE: [number, number, number] = [128, 99, 152];

const clampIndex = (value: number, maximum: number): number => Number.isFinite(value) ? Math.min(maximum, Math.max(0, Math.round(value))) : 0;
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const surface = (width = 1, height = 1): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
};
const context = (canvas: HTMLCanvasElement, readFrequently = false): CanvasRenderingContext2D => {
  const ctx = canvas.getContext('2d', readFrequently ? { willReadFrequently: true } : undefined);
  if (!ctx) throw new Error('เบราว์เซอร์นี้ไม่รองรับการแสดงภาพห้อง');
  return ctx;
};
const tracePath = (ctx: CanvasRenderingContext2D, points: Point[], width: number, height: number): void => {
  points.forEach((point, index) => index === 0 ? ctx.moveTo(point.x * width, point.y * height) : ctx.lineTo(point.x * width, point.y * height));
  ctx.closePath();
};
const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function orderedQuad(points: Point[]): Point[] | null {
  const center = points.reduce((sum, p) => ({ x: sum.x + p.x / 4, y: sum.y + p.y / 4 }), { x: 0, y: 0 });
  const sorted = [...points].sort((a, b) => Math.atan2(a.y - center.y, a.x - center.x) - Math.atan2(b.y - center.y, b.x - center.x));
  let first = 0;
  sorted.forEach((p, index) => { if (p.x + p.y < sorted[first].x + sorted[first].y) first = index; });
  const quad = [...sorted.slice(first), ...sorted.slice(0, first)];
  let area = 0;
  let orientation = 0;
  for (let index = 0; index < 4; index++) {
    const a = quad[index], b = quad[(index + 1) % 4], c = quad[(index + 2) % 4];
    area += a.x * b.y - b.x * a.y;
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < .001 || (orientation && Math.sign(cross) !== orientation)) return null;
    orientation = Math.sign(cross);
  }
  return Math.abs(area) < .025 ? null : quad;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

/** Statistics of a matte: coverage, top edge and a centroid biased towards the near floor. */
function maskStats(alpha: Float32Array, width: number, height: number): { coverage: number; top: number; anchor: Point } {
  let sum = 0, sx = 0, sy = 0, top = height;
  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      const a = alpha[y * width + x];
      if (a > .5) { rowSum += a; sx += a * x; }
    }
    if (rowSum > width * .01 && y < top) top = y;
    sum += rowSum;
    sy += rowSum * y;
  }
  if (!sum) return { coverage: 0, top: 1, anchor: { x: .5, y: .85 } };
  const cy = sy / sum / height;
  // Bias the anchor below the centroid so the texture origin sits on unambiguous floor.
  return { coverage: sum / alpha.length, top: top / height, anchor: { x: sx / sum / width, y: Math.min(.97, cy + (1 - cy) * .35) } };
}

export class FloorVisualizer {
  readonly canvas: HTMLCanvasElement;
  readonly ready: Promise<void>;
  private readonly options: FloorVisualizerOptions;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly prototype = new Image();
  private readonly original = surface();
  private readonly current = surface();
  private readonly renderer: FloorRenderer;
  private readonly productList: ProductConfig[];
  private readonly alphaImages = new Map<number, Promise<HTMLImageElement | null>>();
  private readonly alphaLoaded = new Map<number, HTMLImageElement | null>();
  private readonly roomImages = new Map<number, Promise<HTMLImageElement | null>>();
  private readonly roomLoaded = new Map<number, HTMLImageElement | null>();
  private readonly materialPhotos = new Map<string, HTMLImageElement>();
  private readonly observer?: ResizeObserver;
  private scene: Scene | null = null;
  private inputsKey = '';
  private photo: Upload | null = null;
  private uploadToken = 0;
  private worker: Worker | null = null;
  private workerBroken = false;
  private scanId = 0;
  private scanWatchdog = 0;
  private scanFrame = 0;
  private scanStarted = 0;
  private revealUntil = 0;
  private stage: Stage = 'idle';
  private tool: Tool = 'none';
  private brushSize = 28;
  private painting: 'add' | 'erase' | null = null;
  private draggingHorizon = false;
  private autoMask: Float32Array | null = null;
  private horizonEstimate: HorizonEstimate | null = null;
  private horizonY = .45;
  private cameraHeight = DEFAULT_CAMERA_HEIGHT;
  private coverage = 0;
  private backend: 'webgpu' | 'wasm' | null = null;
  private segmentMs = 0;
  private segmentTimings: FloorVisualizerDiagnostics['segmentTimings'] = null;
  private plankScaleTouched = false;
  private depthId = 0;
  private depthState: FloorVisualizerDiagnostics['depth'] = { status: 'idle', planarity: 0, removed: 0, ms: 0, error: null };
  private depthStarted = 0;
  private samEmbedId = 0;
  private samClickId = 0;
  private samState: FloorVisualizerDiagnostics['sam'] = { status: 'idle', points: 0, ms: 0, error: null };
  private samFrame: { scale: number; nw: number; nh: number } | null = null;
  private samPoints: { x: number; y: number; label: number }[] = [];
  private samBaseAlpha: Float32Array | null = null;
  private modelProgress = 0;
  private scanError: string | null = null;
  private loadComplete = false;
  private failed = false;
  private disposed = false;
  private room = 0;
  private finish = 0;
  private pattern: FloorPattern = 'straight';
  private maskHistory: Uint8Array[] = [];
  private maskFuture: Uint8Array[] = [];
  private lastPaintPoint: Point | null = null;
  private view = 0;
  private compare = false;
  private comparePosition = .5;
  private dragging = false;
  private rotationOverride: number | null = null;
  private points: Point[] = [];
  private quad: Point[] | null = null;
  private keyboardPoint: Point = { x: .2, y: .75 };
  private keyboardActive = false;
  private frame: Crop = { x: 0, y: 0, width: 1, height: 1 };
  private display: Crop = { x: 0, y: 0, width: 1, height: 1 };
  private atlasMs = 0;
  private renderMs = 0;

  constructor(private readonly host: HTMLElement, options: FloorVisualizerOptions = {}) {
    this.options = options;
    const ids = options.productIds ?? DEFAULT_PRODUCTS;
    this.productList = ids.map(id => {
      const product = products.find(candidate => candidate.id === id);
      if (!product) throw new Error(`ไม่พบสินค้า ${id} ใน products.json`);
      return product;
    });
    this.renderer = createFloorRenderer(options.renderer ?? 'auto');
    this.canvas = surface();
    this.canvas.className = 'room-preview-canvas';
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', 'ภาพตัวอย่างห้องและสีพื้น');
    this.canvas.tabIndex = 0;
    Object.assign(this.canvas.style, { display: 'block', width: '100%', height: '100%', objectFit: 'contain', touchAction: 'pan-y' });
    this.ctx = context(this.canvas);
    this.host.append(this.canvas);
    this.canvas.addEventListener('click', this.onClick);
    this.canvas.addEventListener('keydown', this.onKeyDown);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerUp);
    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(this.resize);
      this.observer.observe(host);
    } else window.addEventListener('resize', this.resize);
    this.resize();
    const source = options.imageUrl ? new Promise<boolean>(resolve => {
      this.prototype.onload = () => resolve(true);
      this.prototype.onerror = () => resolve(false);
      this.prototype.src = options.imageUrl!;
    }) : this.roomImage(0).then(Boolean);
    const materials = Promise.all(this.productList.map(async product => {
      const index = DEFAULT_PRODUCTS.indexOf(product.id);
      if (index < 0) return;
      const image = await loadImage(sitePath(`/v2/assets/finish-${index + 1}.webp`));
      if (image && !this.disposed) this.materialPhotos.set(product.id, image);
    }));
    this.ready = Promise.all([source, this.alphaImage(0), materials]).then(([loaded]) => {
      if (this.disposed) return;
      this.loadComplete = loaded;
      this.failed = !loaded;
      if (loaded) {
        this.rebuild();
        this.hint('เลือกสีและลายปู แล้วลองหมุนลายหรือเปรียบเทียบกับภาพเดิมได้');
        this.warmAtlases();
        SAMPLE_ROOMS.forEach((_, index) => { if (index) { void this.roomImage(index); void this.alphaImage(index); } });
      } else this.hint('โหลดภาพห้องไม่สำเร็จ กรุณาลองใหม่หรืออัปโหลดภาพของคุณ');
      this.emit();
    });
  }

  get diagnostics(): FloorVisualizerDiagnostics {
    return {
      pattern: this.pattern, sourceWidth: this.original.width, sourceHeight: this.original.height,
      canUndo: this.maskHistory.length > 0, canRedo: this.maskFuture.length > 0,
      frame: { ...this.frame }, display: { ...this.display },
      ready: this.loadComplete || Boolean(this.photo), failed: this.failed, disposed: this.disposed,
      room: this.room, finish: this.finish, view: this.view, compare: this.compare, comparePosition: this.comparePosition,
      uploaded: Boolean(this.photo), floorCorners: this.points.length, floorSelected: Boolean(this.scene),
      width: this.canvas.width, height: this.canvas.height, renderer: this.renderer.kind,
      maskSource: this.scene?.maskSource ?? 'none', rotation: this.scene?.rotation ?? 0,
      atlasMs: this.atlasMs, renderMs: this.renderMs,
      stage: this.stage, tool: this.tool, coverage: this.coverage, horizonY: this.horizonY,
      horizonConfidence: this.horizonEstimate?.confidence ?? 0, cameraHeight: this.cameraHeight,
      backend: this.backend, segmentMs: this.segmentMs, segmentTimings: this.segmentTimings, modelProgress: this.modelProgress, scanError: this.scanError,
      depth: { ...this.depthState }, sam: { ...this.samState, points: this.samPoints.length },
    };
  }

  getDiagnostics(): FloorVisualizerDiagnostics { return this.diagnostics; }
  get productName(): string { return `${this.productList[this.finish].name}`; }
  /** The uploaded photo at working resolution (null for sample rooms). */
  get photoCanvas(): HTMLCanvasElement | null { return this.photo?.canvas ?? null; }

  setRoom(index: number): void {
    if (this.disposed) return;
    this.clearUpload();
    this.room = clampIndex(index, SAMPLE_ROOMS.length - 1);
    this.view = 0;
    this.rotationOverride = null;
    this.scene = null;
    void this.roomImage(this.room);
    this.rebuild();
    this.hint('เลือกสีพื้นเพื่อดูบรรยากาศในห้องตัวอย่าง');
    this.emit();
  }

  setFinish(index: number): void {
    if (this.disposed) return;
    this.finish = clampIndex(index, this.productList.length - 1);
    this.rebuild();
    if (this.stage === 'manual' && !this.quad) this.cornerHint();
    this.emit();
  }

  setPattern(pattern: FloorPattern): void {
    if (this.disposed || !['straight', 'herringbone'].includes(pattern)) return;
    if (this.tool !== 'none') this.setTool('none');
    this.pattern = pattern;
    this.renderScene();
    this.draw();
    this.emit();
  }

  private maskSnapshot(): Uint8Array {
    const alpha = this.scene!.alphaMap, result = new Uint8Array(alpha.length);
    for (let i = 0; i < alpha.length; i++) result[i] = Math.round(alpha[i] * 255);
    return result;
  }

  private restoreMask(snapshot: Uint8Array): void {
    if (!this.scene || snapshot.length !== this.scene.alphaMap.length) return;
    const ctx = context(this.scene.alpha), image = ctx.createImageData(this.scene.width, this.scene.height);
    for (let i = 0; i < snapshot.length; i++) {
      image.data[i * 4] = image.data[i * 4 + 1] = image.data[i * 4 + 2] = snapshot[i];
      image.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    this.finishPaint();
  }

  undoMask(): void {
    if (!this.scene || !this.maskHistory.length) return;
    this.maskFuture.push(this.maskSnapshot());
    this.restoreMask(this.maskHistory.pop()!);
  }

  redoMask(): void {
    if (!this.scene || !this.maskFuture.length) return;
    this.maskHistory.push(this.maskSnapshot());
    this.restoreMask(this.maskFuture.pop()!);
  }

  setCompare(enabled: boolean): void {
    if (this.disposed) return;
    if (enabled && this.tool !== 'none') this.setTool('none');
    this.compare = Boolean(enabled);
    this.draw();
    this.emit();
  }

  setComparePosition(position: number): void {
    if (this.disposed) return;
    this.comparePosition = clamp(position, 0, 1);
    this.draw();
    this.emit();
  }

  setView(index: number): void {
    if (this.disposed) return;
    this.view = clampIndex(index, VIEWS.length - 1);
    this.draw();
    this.emit();
  }

  /** Plank direction in radians; `rotate()` toggles between the scene default and +90°. */
  setRotation(radians: number | null): void {
    if (this.disposed) return;
    this.rotationOverride = radians;
    this.refreshFrame();
    this.emit();
  }

  rotate(): void {
    const base = this.defaultRotation();
    const current = this.rotationOverride ?? base;
    const delta = ((current - base) % Math.PI + Math.PI) % Math.PI;
    this.setRotation(Math.abs(delta) < .01 || Math.abs(delta - Math.PI) < .01 ? base + Math.PI / 2 : base);
  }

  setTool(tool: Tool): void {
    if (this.disposed) return;
    const previous = this.tool;
    const editable = Boolean(this.scene) && this.stage !== 'scanning';
    this.tool = editable && (tool.startsWith('brush') || tool === 'none' || this.stage === 'auto') ? tool : 'none';
    this.canvas.style.touchAction = this.tool.startsWith('brush') || this.tool === 'horizon' ? 'none' : 'pan-y';
    if (previous !== this.tool && (previous.startsWith('click') || this.tool.startsWith('click'))) {
      // Each click session (add or erase) starts from the matte as it is now.
      this.samPoints = [];
      this.samBaseAlpha = this.scene ? this.scene.alphaMap.slice() : null;
    }
    this.canvas.style.cursor = this.tool.startsWith('brush') || this.tool.startsWith('click') ? 'crosshair' : this.tool === 'horizon' ? 'ns-resize' : (this.stage === 'manual' && !this.quad ? 'crosshair' : '');
    if (this.tool === 'brush-add') this.hint('ระบายบริเวณที่เป็นพื้นแต่ยังไม่ถูกเลือก · ลากบนภาพ');
    else if (this.tool === 'brush-erase') this.hint('ระบายบริเวณที่ไม่ใช่พื้นเพื่อเอาออก · ลากบนภาพ');
    else if (this.tool === 'horizon') this.hint('ลากเส้นประขึ้นลงให้ตรงกับระดับสายตา (เส้นขอบฟ้า) แล้วแผ่นจะเอียงตามห้อง');
    else if (this.tool === 'click-add') { this.hint('แตะบริเวณพื้นที่ยังไม่ถูกเลือก AI จะเติมให้ทั้งบริเวณ · แตะเพิ่มได้หลายจุด'); this.ensureSamEmbedding(); }
    else if (this.tool === 'click-erase') { this.hint('แตะวัตถุที่ทับอยู่บนพื้น (โต๊ะ เก้าอี้ พรม) AI จะลบออกจากพื้นทั้งชิ้น'); this.ensureSamEmbedding(); }
    this.draw();
    this.emit();
  }

  /** Depth-based occlusion refinement (design §5.5 C3). Automatic on WebGPU; on demand elsewhere. */
  refineWithDepth(): void {
    if (this.disposed || this.stage !== 'auto' || !this.photo || !this.scene || this.depthState.status === 'running') return;
    const worker = this.ensureWorker();
    if (!worker) { this.depthState = { ...this.depthState, status: 'failed', error: 'worker unavailable' }; this.emit(); return; }
    const id = ++this.depthId;
    this.depthState = { status: 'running', planarity: 0, removed: 0, ms: 0, error: null };
    this.depthStarted = performance.now();
    this.hint('กำลังประเมินความลึกเพื่อแยกวัตถุที่วางบนพื้น…');
    this.emit();
    try {
      const { tensor, width, height } = depthTensor(this.photo.canvas, DEPTH.inputSize);
      const request: DepthRequest = {
        type: 'depth', id, modelUrl: resolveModelUrl(DEPTH), wasmModelUrl: resolveModelUrl(DEPTH_WASM), tensor, dw: width, dh: height,
        alpha: this.scene.alphaMap.slice(), width: this.scene.width, height: this.scene.height, focal: UPLOAD_FOCAL,
      };
      worker.postMessage(request, [request.tensor.buffer, request.alpha.buffer]);
    } catch (error) {
      this.depthState = { ...this.depthState, status: 'failed', error: error instanceof Error ? error.message : String(error) };
      this.emit();
    }
  }

  private ensureSamEmbedding(): void {
    if (!this.photo || this.samState.status === 'ready' || this.samState.status === 'embedding') return;
    const worker = this.ensureWorker();
    if (!worker) { this.samState = { ...this.samState, status: 'failed', error: 'worker unavailable' }; this.emit(); return; }
    const id = ++this.samEmbedId;
    this.samState = { status: 'embedding', points: 0, ms: 0, error: null };
    this.hint('กำลังเตรียม AI สำหรับแก้ขอบ (ครั้งแรกใช้เวลาสักครู่)…');
    this.emit();
    try {
      const { tensor, scale, nw, nh } = samTensor(this.photo.canvas, SAM_ENCODER.inputSize);
      this.samFrame = { scale, nw, nh };
      const request: SamEmbedRequest = { type: 'sam-embed', id, encoderUrl: resolveModelUrl(SAM_ENCODER), decoderUrl: resolveModelUrl(SAM_DECODER), tensor, photoToken: this.photo.token };
      worker.postMessage(request, [request.tensor.buffer]);
    } catch (error) {
      this.samState = { ...this.samState, status: 'failed', error: error instanceof Error ? error.message : String(error) };
      this.emit();
    }
  }

  private samClick(image: Point): void {
    if (!this.photo || !this.samFrame || !this.scene) return;
    if (this.samState.status !== 'ready') { this.ensureSamEmbedding(); this.hint('รอสักครู่ กำลังเตรียม AI สำหรับแก้ขอบ…'); return; }
    const worker = this.ensureWorker();
    if (!worker) return;
    if (!this.samBaseAlpha) this.samBaseAlpha = this.scene.alphaMap.slice();
    this.samPoints.push({ x: image.x * this.samFrame.scale, y: image.y * this.samFrame.scale, label: 1 });
    const id = ++this.samClickId;
    const request: SamClickRequest = { type: 'sam-click', id, photoToken: this.photo.token, points: [...this.samPoints] };
    worker.postMessage(request);
    this.emit();
  }

  private applySamMask(mask: Float32Array, size: number): void {
    const scene = this.scene, frame = this.samFrame, base = this.samBaseAlpha;
    if (!scene || !frame || !base) return;
    // The 256² mask covers the padded 1024 frame; the photo occupies the top-left nw×nh.
    const cw = Math.max(1, Math.round(frame.nw * size / 1024)), ch = Math.max(1, Math.round(frame.nh * size / 1024));
    const cropped = new Float32Array(cw * ch);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) cropped[y * cw + x] = mask[Math.min(size - 1, y) * size + Math.min(size - 1, x)];
    const full = resizeMap(cropped, cw, ch, scene.width, scene.height);
    const next = new Float32Array(base.length);
    const erase = this.tool === 'click-erase';
    for (let i = 0; i < next.length; i++) {
      const m = Math.min(1, Math.max(0, (full[i] - .35) / .3));
      next[i] = erase ? base[i] * (1 - m) : Math.max(base[i], m);
    }
    this.applyAlphaMap(next);
  }

  /** Replaces the matte (brush, SAM or depth result), refreshes shading and re-renders. */
  private applyAlphaMap(map: Float32Array): void {
    const scene = this.scene;
    if (!scene || map.length !== scene.alphaMap.length) return;
    scene.alphaMap = map;
    const image = context(scene.alpha, true).createImageData(scene.width, scene.height);
    for (let i = 0; i < map.length; i++) {
      const v = Math.round(map[i] * 255);
      image.data[i * 4] = image.data[i * 4 + 1] = image.data[i * 4 + 2] = v;
      image.data[i * 4 + 3] = 255;
    }
    context(scene.alpha, true).putImageData(image, 0, 0);
    scene.tint = null;
    const stats = maskStats(map, scene.width, scene.height);
    this.coverage = stats.coverage;
    scene.maskTop = stats.top;
    const photo = context(this.original, true).getImageData(0, 0, scene.width, scene.height).data;
    const shading = computeShading(photo, map, scene.width, scene.height);
    const shadeImage = context(scene.shade).createImageData(scene.width, scene.height);
    shadeImage.data.set(shading.rgba);
    context(scene.shade).putImageData(shadeImage, 0, 0);
    scene.meanRGB = shading.meanRGB;
    this.inputsKey = '';
    this.rebuild();
    this.emit();
  }

  setBrushSize(pixels: number): void { this.brushSize = clamp(pixels, 6, 120); }

  setHorizon(horizonY: number): void {
    if (this.disposed || this.stage !== 'auto') return;
    const top = this.scene?.maskTop ?? 1;
    this.horizonY = clamp(horizonY, .02, Math.max(.05, top - .02));
    this.refreshFrame();
    this.emit();
  }

  /** Camera height in metres (0.6–2.4): larger values make planks smaller. */
  setPlankScale(cameraHeight: number): void {
    if (this.disposed) return;
    this.plankScaleTouched = true;
    this.cameraHeight = clamp(cameraHeight, .6, 2.4);
    this.refreshFrame();
    this.emit();
  }

  /** Restores the model's matte after brush edits. */
  resetMask(): void {
    if (this.disposed || !this.scene) return;
    this.maskHistory = []; this.maskFuture = [];
    this.samPoints = [];
    this.samBaseAlpha = null;
    this.depthState = { status: 'idle', planarity: 0, removed: 0, ms: 0, error: null };
    this.scene = null;
    this.rebuild();
    this.hint('คืนค่าขอบพื้นเริ่มต้นแล้ว');
    this.emit();
  }

  /** Switches an upload to the manual four-corner tool. */
  useManualCorners(): void {
    if (this.disposed || !this.photo) return;
    this.cancelScan();
    this.stage = 'manual';
    this.tool = 'none';
    this.points = [];
    this.quad = null;
    this.compare = false;
    this.keyboardActive = false;
    this.keyboardPoint = { x: .2, y: .75 };
    this.canvas.style.cursor = 'crosshair';
    this.canvas.setAttribute('role', 'application');
    this.canvas.setAttribute('aria-label', 'เลือก 4 มุมของพื้นที่พื้นซึ่งไม่มีเฟอร์นิเจอร์บัง ใช้ลูกศรเลื่อนจุดและ Enter เพื่อเลือก กด Backspace เพื่อลบจุดล่าสุด หรือ Escape เพื่อเลือกใหม่');
    this.scene = null;
    this.rebuild();
    this.cornerHint();
    this.emit();
  }

  /** Runs automatic detection again (after a manual detour or a failed attempt). */
  rescan(): void {
    if (this.disposed || !this.photo) return;
    this.points = [];
    this.quad = null;
    this.startScan();
  }

  async upload(file: File): Promise<void> {
    if (this.disposed) throw new Error('ตัวแสดงผลนี้ถูกปิดแล้ว');
    const type = file.type || '';
    const name = file.name?.toLowerCase() ?? '';
    const heic = /\.hei[cf]$/.test(name) || /hei[cf]/.test(type);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(type) && !heic) throw new Error('กรุณาเลือกไฟล์ JPG, PNG, WebP หรือ HEIC');
    if (file.size === 0 || file.size > 20 * 1024 * 1024) throw new Error('กรุณาเลือกภาพที่มีขนาดไม่เกิน 20 MB');
    const token = ++this.uploadToken;
    let source: ImageBitmap | HTMLImageElement;
    try {
      source = await decodeImage(file);
    } catch (error) {
      if (heic) throw new Error('เบราว์เซอร์นี้เปิดไฟล์ HEIC ไม่ได้ กรุณาส่งออกเป็น JPG ก่อน (iPhone: ตั้งค่ากล้อง > รูปแบบ > เข้ากันได้มากที่สุด)');
      throw error;
    }
    if (this.disposed || token !== this.uploadToken) return;
    const canvas = toWorkingCanvas(source);
    if ('close' in source) source.close();
    this.cancelScan();
    this.photo = { canvas, token, lum: null };
    this.maskHistory = []; this.maskFuture = []; this.lastPaintPoint = null;
    this.canvas.style.touchAction = 'pan-y';
    this.points = [];
    this.quad = null;
    this.keyboardActive = false;
    this.keyboardPoint = { x: .2, y: .75 };
    this.view = 0;
    this.compare = false;
    this.rotationOverride = null;
    this.cameraHeight = DEFAULT_CAMERA_HEIGHT;
    this.plankScaleTouched = false;
    this.tool = 'none';
    this.scene = null;
    this.canvas.setAttribute('role', 'application');
    if (this.options.autoDetect === false) {
      this.useManualCorners();
      return;
    }
    this.startScan();
  }

  resetUpload(): void {
    if (this.disposed) return;
    this.clearUpload();
    this.view = 0;
    this.rebuild();
    this.hint('กลับสู่ภาพห้องตัวอย่างแล้ว');
    this.emit();
  }

  /** The current composite at working resolution with a small product caption, as an image blob. */
  async exportImage(type: 'image/png' | 'image/jpeg' = 'image/jpeg'): Promise<Blob> {
    const width = this.current.width, height = this.current.height;
    const out = surface(width, height);
    const ctx = context(out);
    ctx.drawImage(this.current, 0, 0);
    const unit = Math.max(1, width / 800);
    const product = this.productList[this.finish];
    const label = `COOLPLAN · ${product.name} · ${this.pattern === 'herringbone' ? 'ลายก้างปลา' : 'ลายตรง'}`;
    ctx.font = `600 ${13 * unit}px "Noto Sans Thai", sans-serif`;
    const textWidth = ctx.measureText(label).width;
    const padding = 10 * unit;
    ctx.fillStyle = 'rgba(39,33,31,.68)';
    ctx.fillRect(width - textWidth - padding * 3, height - 30 * unit - padding, textWidth + padding * 2, 30 * unit);
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, width - textWidth - padding * 2, height - 15 * unit - padding);
    return new Promise<Blob>((resolve, reject) => out.toBlob(blob => blob ? resolve(blob) : reject(new Error('สร้างไฟล์ภาพไม่สำเร็จ')), type, .92));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelScan();
    this.worker?.terminate();
    this.worker = null;
    this.clearUpload();
    this.observer?.disconnect();
    window.removeEventListener('resize', this.resize);
    this.canvas.removeEventListener('click', this.onClick);
    this.canvas.removeEventListener('keydown', this.onKeyDown);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerUp);
    this.canvas.remove();
    this.renderer.dispose();
    disposePlankAtlases();
    this.roomLoaded.clear(); this.roomImages.clear(); this.materialPhotos.clear();
    this.alphaLoaded.clear(); this.alphaImages.clear();
    this.scene = null;
    this.original.width = this.current.width = this.canvas.width = 1;
    this.original.height = this.current.height = this.canvas.height = 1;
  }

  // ---------------------------------------------------------------- scanning

  private ensureWorker(): Worker | null {
    if (this.worker || this.workerBroken) return this.worker;
    try {
      this.worker = new Worker(new URL('./vision.worker.ts', import.meta.url), { type: 'module' });
      this.worker.addEventListener('message', this.onWorkerMessage);
      this.worker.addEventListener('error', event => {
        this.workerBroken = true;
        this.failScan(`โมเดลตรวจจับพื้นทำงานไม่ได้ (${event.message || 'worker error'})`);
      });
    } catch (error) {
      this.workerBroken = true;
      this.scanError = error instanceof Error ? error.message : String(error);
      return null;
    }
    return this.worker;
  }

  private startScan(): void {
    const upload = this.photo;
    if (!upload) return;
    const worker = this.ensureWorker();
    this.stage = 'scanning';
    this.tool = 'none';
    this.scanError = null;
    this.modelProgress = 0;
    this.autoMask = null;
    this.horizonEstimate = null;
    this.depthState = { status: 'idle', planarity: 0, removed: 0, ms: 0, error: null };
    this.samState = { status: 'idle', points: 0, ms: 0, error: null };
    this.samPoints = [];
    this.samBaseAlpha = null;
    this.samFrame = null;
    this.scene = null;
    this.canvas.style.cursor = 'progress';
    this.canvas.setAttribute('aria-label', 'กำลังตรวจหาพื้นในภาพของคุณ');
    this.rebuild();
    this.emit();
    if (!worker) { this.failScan(this.scanError ?? 'เบราว์เซอร์นี้ไม่รองรับการตรวจจับอัตโนมัติ'); return; }
    this.hint('กำลังสแกนหาพื้นในภาพของคุณ…');
    const id = ++this.scanId;
    this.scanStarted = performance.now();
    try {
      const { tensor, box } = letterboxTensor(upload.canvas, FLOOR_SEGMENTATION.inputSize);
      const pixels = context(upload.canvas, true).getImageData(0, 0, upload.canvas.width, upload.canvas.height).data;
      const lum = luminanceOf(pixels, upload.canvas.width, upload.canvas.height);
      upload.lum = lum;
      const request: SegmentRequest = {
        type: 'segment', id, modelUrl: resolveModelUrl(FLOOR_SEGMENTATION), tensor, box,
        lum: lum.slice(), width: upload.canvas.width, height: upload.canvas.height, includeRug: true,
      };
      worker.postMessage(request, [request.tensor.buffer, request.lum.buffer]);
    } catch (error) {
      this.failScan(error instanceof Error ? error.message : String(error));
      return;
    }
    this.armWatchdog(30000);
    this.animateScan();
  }

  private armWatchdog(ms: number): void {
    clearTimeout(this.scanWatchdog);
    this.scanWatchdog = window.setTimeout(() => this.failScan('การตรวจจับใช้เวลานานเกินไป'), ms);
  }

  private cancelScan(): void {
    clearTimeout(this.scanWatchdog);
    cancelAnimationFrame(this.scanFrame);
    this.scanId++;
  }

  private animateScan = (): void => {
    if (this.disposed || this.stage !== 'scanning') return;
    this.draw();
    if (!reducedMotion()) this.scanFrame = requestAnimationFrame(this.animateScan);
  };

  private onWorkerMessage = (event: MessageEvent<WorkerMessage>): void => {
    const message = event.data;
    if (this.disposed) return;
    if (message.type === 'depth-result' || (message.id === this.depthId && this.depthState.status === 'running' && (message.type === 'error' || message.type === 'progress'))) {
      if (message.type === 'progress') return;
      if (message.type === 'error') { this.depthState = { ...this.depthState, status: 'failed', error: message.message }; this.hint(`ประเมินความลึกไม่สำเร็จ: ${message.message}`); this.emit(); return; }
      if (message.id !== this.depthId || this.stage !== 'auto') return;
      this.depthState = { status: 'done', planarity: message.planarity, removed: message.removed, ms: Math.round(performance.now() - this.depthStarted), error: null };
      track({ name: 'visualizer_depth', status: 'done', ms: this.depthState.ms, removed: message.removed });
      if (message.planarity > .3) {
        this.applyAlphaMap(message.alpha);
        this.hint(message.removed > .005
          ? `แยกวัตถุบนพื้นด้วยความลึกแล้ว (ตัดออก ${Math.round(message.removed * 100)}% ของพื้น)`
          : 'ตรวจด้วยความลึกแล้ว ขอบพื้นเดิมสอดคล้องกับระนาบพื้นดีอยู่แล้ว');
      } else this.hint('ความลึกที่ประเมินได้ไม่สอดคล้องกับระนาบเดียว จึงคงขอบเดิมไว้');
      this.emit();
      return;
    }
    if (message.type === 'sam-embed-result' || (message.id === this.samEmbedId && this.samState.status === 'embedding' && (message.type === 'error' || message.type === 'progress'))) {
      if (message.type === 'progress') return;
      if (message.type === 'error') { this.samState = { ...this.samState, status: 'failed', error: message.message }; this.hint(`เตรียม AI แก้ขอบไม่สำเร็จ: ${message.message} · ใช้แปรงแทนได้`); this.emit(); return; }
      if (message.id !== this.samEmbedId) return;
      this.samState = { status: 'ready', points: 0, ms: message.timings.infer, error: null };
      track({ name: 'visualizer_sam', action: 'embed', ms: message.timings.infer });
      if (this.tool.startsWith('click')) this.hint(this.tool === 'click-add' ? 'พร้อมแล้ว แตะบริเวณพื้นที่ต้องการเพิ่ม' : 'พร้อมแล้ว แตะวัตถุที่ต้องการลบออกจากพื้น');
      this.emit();
      return;
    }
    if (message.type === 'sam-click-result' || (message.id === this.samClickId && message.type === 'error')) {
      if (message.type === 'error') { this.samState = { ...this.samState, error: message.message }; this.hint(`แก้ขอบไม่สำเร็จ: ${message.message}`); this.emit(); return; }
      if (message.id !== this.samClickId || this.stage !== 'auto') return;
      this.samState = { ...this.samState, ms: message.ms, error: null };
      this.applySamMask(message.mask, message.size);
      return;
    }
    if (message.id !== this.scanId || this.stage !== 'scanning') return;
    if (message.type === 'progress') {
      if (message.stage === 'download' && message.total) this.modelProgress = message.loaded! / message.total;
      else if (message.stage !== 'download') this.modelProgress = 1;
      this.armWatchdog(message.stage === 'download' ? 30000 : 20000);
      if (reducedMotion()) this.draw();
      this.emit();
      return;
    }
    clearTimeout(this.scanWatchdog);
    if (message.type === 'error') { this.failScan(message.message); return; }
    this.backend = message.backend;
    this.segmentMs = Math.round(performance.now() - this.scanStarted);
    this.segmentTimings = message.timings;
    this.coverage = message.coverage;
    if (message.coverage < MIN_COVERAGE) {
      this.failScan('ไม่พบพื้นในภาพ ลองถ่ายให้เห็นพื้นมากขึ้น หรือเลือกมุมพื้นเอง', false);
      return;
    }
    this.autoMask = message.alpha;
    this.horizonEstimate = message.horizon;
    const stats = maskStats(message.alpha, this.photo!.canvas.width, this.photo!.canvas.height);
    const fallback = Math.min(.45, Math.max(.08, stats.top - .08));
    this.horizonY = message.horizon && message.horizon.confidence >= .25 && message.horizon.horizonY > 0 && message.horizon.horizonY < stats.top
      ? message.horizon.horizonY : fallback;
    if (!this.plankScaleTouched) this.cameraHeight = this.autoCameraHeight(message.alpha, this.photo!.canvas.width, this.photo!.canvas.height, stats);
    this.stage = 'auto';
    this.canvas.style.cursor = '';
    this.canvas.setAttribute('aria-label', 'ภาพห้องของคุณพร้อมพื้นใหม่ ใช้เครื่องมือด้านล่างเพื่อปรับขอบหรือมุมมอง');
    this.revealUntil = reducedMotion() ? 0 : performance.now() + 900;
    this.scene = null;
    this.rebuild();
    const confident = Boolean(message.horizon && message.horizon.confidence >= .25);
    this.hint(confident
      ? `พบพื้น ${Math.round(message.coverage * 100)}% ของภาพแล้ว เปลี่ยนสี หมุนลาย หรือเปรียบเทียบได้ · ถ้าขอบไม่ตรงใช้ "ปรับขอบ"`
      : `พบพื้น ${Math.round(message.coverage * 100)}% ของภาพแล้ว แต่ประเมินมุมกล้องได้ไม่แน่ใจ ลองใช้ "ปรับมุมมอง" เลื่อนเส้นขอบฟ้าให้ตรงระดับสายตา`);
    this.emit();
    track({ name: 'visualizer_scan', stage: 'auto', ms: this.segmentMs, backend: this.backend, coverage: message.coverage, horizonConfidence: message.horizon?.confidence ?? 0, error: null });
    if (this.revealUntil) this.animateReveal();
    // With a GPU the depth pass costs well under a second: run it unprompted.
    if (message.backend === 'webgpu') this.refineWithDepth();
  };

  private animateReveal = (): void => {
    if (this.disposed) return;
    this.draw();
    if (performance.now() < this.revealUntil) requestAnimationFrame(this.animateReveal);
  };

  private failScan(message: string, isError = true): void {
    if (this.disposed || !this.photo) return;
    clearTimeout(this.scanWatchdog);
    cancelAnimationFrame(this.scanFrame);
    this.scanError = isError ? message : null;
    track({ name: 'visualizer_scan', stage: 'manual', ms: Math.round(performance.now() - this.scanStarted), backend: this.backend, coverage: this.coverage, horizonConfidence: 0, error: isError ? message : null });
    this.useManualCorners();
    this.hint(`${message} · ${isError ? 'สลับเป็นโหมดเลือกมุมพื้นเอง: ' : ''}เลือก 4 มุมของพื้นที่พื้นซึ่งไม่มีเฟอร์นิเจอร์บัง (0/4)`);
  }

  // ---------------------------------------------------------------- helpers

  private clearUpload(): void {
    this.cancelScan();
    this.uploadToken++;
    this.photo = null;
    this.stage = 'idle';
    this.tool = 'none';
    this.maskHistory = []; this.maskFuture = []; this.lastPaintPoint = null;
    this.canvas.style.touchAction = 'pan-y';
    this.autoMask = null;
    this.horizonEstimate = null;
    this.scanError = null;
    this.points = [];
    this.quad = null;
    this.keyboardActive = false;
    this.canvas.style.cursor = '';
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', 'ภาพตัวอย่างห้องและสีพื้น');
  }

  private hint(message: string): void { this.options.onHint?.(message); }
  private emit(): void { this.options.onChange?.(this.diagnostics); }
  private cornerHint(): void {
    this.hint(`เลือก 4 มุมของพื้นที่พื้นซึ่งไม่มีเฟอร์นิเจอร์บัง (${this.points.length}/4) เริ่มจากซ้ายบน วนตามเข็มนาฬิกา · ใช้ลูกศรและ Enter ได้ · Backspace ลบจุด · Escape เริ่มใหม่`);
  }

  /**
   * Without depth there is no absolute scale, so assume the visible floor spans
   * roughly 4 m from the bottom edge to the 85th-percentile row of the matte and
   * pick the camera height that makes it so (design §5.5: scale is the one knob
   * the user can still adjust with "ขนาดแผ่น").
   */
  private autoCameraHeight(alpha: Float32Array, width: number, height: number, stats: { top: number; anchor: Point }): number {
    const rows: number[] = [];
    for (let y = 0; y < height; y++) {
      let count = 0;
      for (let x = 0; x < width; x += 4) if (alpha[y * width + x] > .5) count++;
      if (count * 4 > width * .05) rows.push(y);
    }
    if (rows.length < 10) return DEFAULT_CAMERA_HEIGHT;
    const far = rows[Math.floor(rows.length * .15)] / height, near = rows[rows.length - 1] / height;
    const horizonY = clamp(this.horizonY, .02, Math.max(.05, stats.top - .02));
    const unit = floorFrame({ width, height, horizonY, focal: UPLOAD_FOCAL, anchor: stats.anchor, cameraHeight: 1, rotation: 0 });
    if (!unit) return DEFAULT_CAMERA_HEIGHT;
    const project = (y: number): Point | null => {
      const w = unit.Hinv[6] * stats.anchor.x * width + unit.Hinv[7] * y * height + unit.Hinv[8];
      if (w <= 1e-6) return null;
      return { x: (unit.Hinv[0] * stats.anchor.x * width + unit.Hinv[1] * y * height + unit.Hinv[2]) / w, y: (unit.Hinv[3] * stats.anchor.x * width + unit.Hinv[4] * y * height + unit.Hinv[5]) / w };
    };
    const a = project(near), b = project(Math.max(far, horizonY + .06));
    if (!a || !b) return DEFAULT_CAMERA_HEIGHT;
    const spanAtUnitHeight = Math.hypot(a.x - b.x, a.y - b.y);
    if (!Number.isFinite(spanAtUnitHeight) || spanAtUnitHeight < 1e-3) return DEFAULT_CAMERA_HEIGHT;
    return clamp(4 / spanAtUnitHeight, .7, 2.2);
  }

  private get sampleRoom(): SampleRoom {
    return (this.options.imageUrl ? LEGACY_SAMPLE_ROOMS : SAMPLE_ROOMS)[this.room];
  }

  private roomImage(index: number): Promise<HTMLImageElement | null> {
    if (this.options.imageUrl) return Promise.resolve(null);
    let pending = this.roomImages.get(index);
    if (!pending) {
      const path = SAMPLE_ROOMS[index].image;
      pending = (path ? loadImage(sitePath(path)) : Promise.resolve(null)).then(image => {
        if (this.disposed) return null;
        this.roomLoaded.set(index, image);
        if (this.loadComplete && !this.photo && this.room === index) {
          if (image) { this.scene = null; this.rebuild(); }
          else this.hint('โหลดห้องนี้ไม่สำเร็จ กรุณาเลือกห้องอื่นหรือลองใหม่');
          this.emit();
        }
        return image;
      });
      this.roomImages.set(index, pending);
    }
    return pending;
  }

  private defaultRotation(): number {
    if (!this.photo) return this.sampleRoom.floor.rotation;
    if (this.stage === 'auto' && this.horizonEstimate?.vanishingPoint && this.horizonEstimate.confidence >= .25 && this.scene) {
      const vp = this.horizonEstimate.vanishingPoint;
      if (vp.x > -.5 && vp.x < 1.5) {
        return rotationTowards({ width: this.scene.width, height: this.scene.height, horizonY: this.horizonY, focal: UPLOAD_FOCAL, anchor: { x: .5, y: .9 } }, { x: vp.x * this.scene.width, y: vp.y * this.scene.height });
      }
    }
    return Math.PI / 2;
  }

  private alphaImage(index: number): Promise<HTMLImageElement | null> {
    let pending = this.alphaImages.get(index);
    if (!pending) {
      const path = this.options.imageUrl ? `/website/rooms/room-${index}-alpha.png` : roomAlphaPath(index);
      pending = (path ? loadImage(sitePath(path)) : Promise.resolve(null)).then(image => {
        this.alphaLoaded.set(index, image);
        if (image && !this.disposed && !this.photo && this.room === index && this.scene?.maskSource === 'polygon') {
          this.scene = null;
          this.rebuild();
          this.emit();
        }
        return image;
      });
      this.alphaImages.set(index, pending);
    }
    return pending;
  }

  private warmAtlases(): void {
    const pending = this.productList.map((_, index) => index).filter(index => index !== this.finish);
    const step = (): void => {
      if (this.disposed || !pending.length) return;
      const started = performance.now();
      const product = this.productList[pending.shift()!];
      buildPlankAtlas(product, { photo: this.materialPhotos.get(product.id) });
      this.atlasMs = Math.max(this.atlasMs, performance.now() - started);
      schedule();
    };
    const schedule = (): void => {
      if (typeof requestIdleCallback === 'function') requestIdleCallback(() => step(), { timeout: 2000 });
      else setTimeout(step, 250);
    };
    schedule();
  }

  private resize = (): void => {
    if (this.disposed) return;
    const rect = this.host.getBoundingClientRect();
    const width = Math.max(1, rect.width || 494), height = Math.max(1, rect.height || width * 238 / 494);
    const scale = Math.min(window.devicePixelRatio || 1, 2, 1800 / Math.max(width, height));
    this.canvas.width = Math.max(1, Math.round(width * scale));
    this.canvas.height = Math.max(1, Math.round(height * scale));
    this.draw();
  };

  // ---------------------------------------------------------------- input

  private onKeyDown = (event: KeyboardEvent): void => {
    if (this.tool === 'horizon' && ['ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      this.setHorizon(this.horizonY + (event.key === 'ArrowUp' ? -.01 : .01) * (event.shiftKey ? 5 : 1));
      return;
    }
    if (this.compare && !(this.stage === 'manual' && !this.quad) && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      this.setComparePosition(this.comparePosition + (event.key === 'ArrowLeft' ? -.02 : .02));
      return;
    }
    if (!this.photo || this.stage !== 'manual') return;
    if (!this.quad && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      this.keyboardActive = true;
      const step = event.shiftKey ? .05 : .01;
      if (event.key === 'ArrowLeft') this.keyboardPoint.x = Math.max(.01, this.keyboardPoint.x - step);
      if (event.key === 'ArrowRight') this.keyboardPoint.x = Math.min(.99, this.keyboardPoint.x + step);
      if (event.key === 'ArrowUp') this.keyboardPoint.y = Math.max(.01, this.keyboardPoint.y - step);
      if (event.key === 'ArrowDown') this.keyboardPoint.y = Math.min(.99, this.keyboardPoint.y + step);
      if (event.key === 'Enter' || event.key === ' ') this.addPoint({ ...this.keyboardPoint });
      else this.draw();
      return;
    }
    if (!['Backspace', 'Escape', 'Delete'].includes(event.key)) return;
    event.preventDefault();
    this.points = event.key === 'Backspace' ? this.points.slice(0, -1) : [];
    this.quad = null;
    this.canvas.style.cursor = 'crosshair';
    this.scene = null;
    this.rebuild();
    this.cornerHint();
    this.emit();
  };

  private canvasPoint(event: MouseEvent): Point | null {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return { x: (event.clientX - rect.left) * this.canvas.width / rect.width, y: (event.clientY - rect.top) * this.canvas.height / rect.height };
  }

  /** Canvas pixel -> working-image pixel. */
  private toImage(point: Point): Point {
    return {
      x: this.frame.x + (point.x - this.display.x) * this.frame.width / this.display.width,
      y: this.frame.y + (point.y - this.display.y) * this.frame.height / this.display.height,
    };
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (this.disposed) return;
    const point = this.canvasPoint(event);
    if (!point) return;
    if (this.tool.startsWith('brush') && this.scene) {
      event.preventDefault();
      this.maskHistory.push(this.maskSnapshot());
      if (this.maskHistory.length > 8) this.maskHistory.shift();
      this.maskFuture = []; this.lastPaintPoint = null;
      this.painting = this.tool === 'brush-add' ? 'add' : 'erase';
      this.canvas.setPointerCapture(event.pointerId);
      this.paint(this.toImage(point));
      return;
    }
    if (this.stage === 'auto' && this.tool === 'horizon') {
      event.preventDefault();
      this.draggingHorizon = true;
      this.canvas.setPointerCapture(event.pointerId);
      this.setHorizon(this.toImage(point).y / this.original.height);
      return;
    }
    if (!this.compare || (this.stage === 'manual' && !this.quad)) return;
    if (point.x < this.display.x || point.x > this.display.x + this.display.width) return;
    this.dragging = true;
    this.canvas.setPointerCapture(event.pointerId);
    this.setComparePosition((point.x - this.display.x) / this.display.width);
  };

  private onPointerMove = (event: PointerEvent): void => {
    const point = this.canvasPoint(event);
    if (!point) return;
    if (this.painting) { this.paint(this.toImage(point)); return; }
    if (this.draggingHorizon) { this.setHorizon(this.toImage(point).y / this.original.height); return; }
    if (this.dragging) this.setComparePosition((point.x - this.display.x) / this.display.width);
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    if (this.painting) {
      this.painting = null;
      this.lastPaintPoint = null;
      this.finishPaint();
    }
    this.draggingHorizon = false;
    this.dragging = false;
  };

  private onClick = (event: MouseEvent): void => {
    if (this.disposed || !this.photo) return;
    const point = this.canvasPoint(event);
    if (!point || point.x < this.display.x || point.y < this.display.y || point.x > this.display.x + this.display.width || point.y > this.display.y + this.display.height) return;
    const image = this.toImage(point);
    if (this.stage === 'auto' && this.tool.startsWith('click')) { this.samClick(image); return; }
    if (this.stage !== 'manual' || this.quad) return;
    this.keyboardActive = false;
    this.addPoint({ x: image.x / this.original.width, y: image.y / this.original.height });
  };

  private addPoint(point: Point): void {
    if (this.points.some(previous => Math.hypot(previous.x - point.x, previous.y - point.y) < .015)) return;
    this.points.push(point);
    if (this.points.length === 4) {
      this.quad = orderedQuad(this.points);
      if (!this.quad) {
        this.points.pop();
        this.hint('พื้นที่ต้องเป็นสี่เหลี่ยมที่ไม่แคบหรือเว้าเข้าด้านใน กรุณาเลือกมุมสุดท้ายใหม่');
      } else {
        this.points = [...this.quad];
        this.canvas.style.cursor = '';
        this.hint('เลือกพื้นที่พื้นแล้ว เปลี่ยนสีหรือกดเปรียบเทียบได้ · กด Escape บนภาพเพื่อเลือกพื้นที่ใหม่');
      }
    } else this.cornerHint();
    this.scene = null;
    this.rebuild();
    this.emit();
  }

  // ---------------------------------------------------------------- brush

  private paint(image: Point): void {
    const scene = this.scene;
    if (!scene) return;
    const ctx = context(scene.alpha, true);
    const radius = this.brushSize * scene.width / Math.max(1, this.display.width) * (this.canvas.width / Math.max(1, this.canvas.getBoundingClientRect().width || this.canvas.width));
    const value = this.painting === 'add' ? 255 : 0;
    const previous = this.lastPaintPoint ?? image;
    const steps = Math.max(1, Math.ceil(Math.hypot(image.x - previous.x, image.y - previous.y) / Math.max(1, radius * .35)));
    for (let i = 1; i <= steps; i++) {
      const x = previous.x + (image.x - previous.x) * i / steps;
      const y = previous.y + (image.y - previous.y) * i / steps;
      const gradient = ctx.createRadialGradient(x, y, radius * .6, x, y, radius);
      gradient.addColorStop(0, `rgba(${value},${value},${value},1)`);
      gradient.addColorStop(1, `rgba(${value},${value},${value},0)`);
      ctx.fillStyle = gradient;
      ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
    }
    this.lastPaintPoint = image;
    scene.tint = null;
    if (this.renderer.kind === 'webgl2') {
      this.renderer.setAlpha(scene.alpha);
      this.renderScene();
    }
    this.draw();
  }

  private finishPaint(): void {
    const scene = this.scene;
    if (!scene) return;
    const data = context(scene.alpha, true).getImageData(0, 0, scene.width, scene.height).data;
    for (let i = 0; i < scene.alphaMap.length; i++) scene.alphaMap[i] = data[i * 4] / 255;
    const stats = maskStats(scene.alphaMap, scene.width, scene.height);
    this.coverage = stats.coverage;
    scene.maskTop = stats.top;
    const photo = context(this.original, true).getImageData(0, 0, scene.width, scene.height).data;
    const shading = computeShading(photo, scene.alphaMap, scene.width, scene.height);
    const shadeImage = context(scene.shade).createImageData(scene.width, scene.height);
    shadeImage.data.set(shading.rgba);
    context(scene.shade).putImageData(shadeImage, 0, 0);
    scene.meanRGB = shading.meanRGB;
    this.inputsKey = '';
    this.rebuild();
    this.emit();
  }

  // ---------------------------------------------------------------- scene

  /** Draws the source photo into `original` and returns the scene key. */
  private loadOriginal(): string {
    const room = this.sampleRoom, sample = this.options.imageUrl ? null : this.roomLoaded.get(this.room);
    const sourceWidth = this.photo?.canvas.width ?? sample?.naturalWidth ?? room.crop.width;
    const sourceHeight = this.photo?.canvas.height ?? sample?.naturalHeight ?? room.crop.height;
    const scale = this.photo || sample ? 1 : room.scale;
    const width = Math.max(1, Math.round(sourceWidth * scale)), height = Math.max(1, Math.round(sourceHeight * scale));
    const key = this.photo
      ? `upload:${this.photo.token}:${this.stage}:${this.quad ? this.quad.map(p => `${p.x.toFixed(4)},${p.y.toFixed(4)}`).join(';') : 'none'}`
      : `room:${this.room}`;
    if (this.original.width !== width || this.original.height !== height || !this.scene || !this.scene.key.startsWith(key)) {
      this.original.width = this.current.width = width;
      this.original.height = this.current.height = height;
      const base = context(this.original, true);
      base.imageSmoothingQuality = 'high';
      if (this.photo) base.drawImage(this.photo.canvas, 0, 0, width, height);
      else if (sample) base.drawImage(sample, 0, 0, width, height);
      else base.drawImage(this.prototype, room.crop.x, room.crop.y, room.crop.width, room.crop.height, 0, 0, width, height);
    }
    return key;
  }

  private frameFor(width: number, height: number, maskTop: number): { Hinv: Mat3; rotation: number } | null {
    if (this.photo) {
      if (this.stage === 'manual') {
        if (!this.quad) return null;
        const unit = homographyFromQuad(this.quad.map(p => ({ x: p.x * width, y: p.y * height })));
        const size = this.cameraHeight / DEFAULT_CAMERA_HEIGHT;
        const Hinv = unit ? invert(multiply(unit, scaled(1 / (QUAD_METRES[0] * size), 1 / (QUAD_METRES[1] * size)))) : null;
        return Hinv ? { Hinv, rotation: this.rotationOverride ?? Math.PI / 2 } : null;
      }
      const anchor = this.autoMask ? maskStats(this.autoMask, width, height).anchor : { x: .5, y: .9 };
      const horizonY = clamp(this.horizonY, .02, Math.max(.05, maskTop - .02));
      const frame = floorFrame({ width, height, horizonY, focal: UPLOAD_FOCAL, anchor, cameraHeight: this.cameraHeight, rotation: 0 });
      return frame ? { Hinv: frame.Hinv, rotation: this.rotationOverride ?? this.defaultRotation() } : null;
    }
    const room = this.sampleRoom;
    const frame = floorFrame({ width, height, horizonY: room.floor.horizonY, focal: room.floor.focal, anchor: room.floor.anchor, cameraHeight: room.floor.cameraHeight * (this.cameraHeight / DEFAULT_CAMERA_HEIGHT), rotation: 0 });
    return frame ? { Hinv: frame.Hinv, rotation: this.rotationOverride ?? room.floor.rotation } : null;
  }

  /** Recomputes only the homography/rotation (matte and shading untouched) and re-renders. */
  private refreshFrame(): void {
    if (!this.scene) { this.rebuild(); return; }
    const frame = this.frameFor(this.scene.width, this.scene.height, this.scene.maskTop);
    if (!frame) return;
    this.scene.Hinv = frame.Hinv;
    this.scene.rotation = frame.rotation;
    this.renderScene();
    this.draw();
  }

  private buildScene(key: string): Scene | null {
    const width = this.original.width, height = this.original.height;
    const room = this.sampleRoom;
    const alpha = surface(width, height);
    const actx = context(alpha, true);
    actx.fillStyle = '#000';
    actx.fillRect(0, 0, width, height);
    let maskSource: MaskSource = 'none';
    if (this.photo) {
      if (this.stage === 'auto' && this.autoMask) {
        const image = actx.createImageData(width, height);
        for (let i = 0; i < this.autoMask.length; i++) {
          const v = Math.round(this.autoMask[i] * 255);
          image.data[i * 4] = image.data[i * 4 + 1] = image.data[i * 4 + 2] = v;
          image.data[i * 4 + 3] = 255;
        }
        actx.putImageData(image, 0, 0);
        maskSource = 'auto';
      } else if (this.stage === 'manual' && this.quad) {
        actx.save();
        actx.filter = 'blur(0.55px)';
        actx.fillStyle = '#fff';
        actx.beginPath();
        tracePath(actx, this.quad, width, height);
        actx.fill();
        actx.restore();
        maskSource = 'quad';
      } else return null;
    } else {
      const loaded = this.alphaLoaded.get(this.room) ?? null;
      if (loaded) {
        actx.imageSmoothingQuality = 'high';
        actx.drawImage(loaded, 0, 0, width, height);
        maskSource = 'precomputed';
      } else {
        actx.save();
        actx.filter = 'blur(0.55px)';
        actx.fillStyle = '#fff';
        actx.beginPath();
        tracePath(actx, room.polygon, width, height);
        actx.fill();
        actx.restore();
        maskSource = 'polygon';
      }
      actx.fillStyle = '#000';
      for (const hole of room.holes ?? []) {
        actx.beginPath();
        tracePath(actx, hole, width, height);
        actx.fill();
      }
      for (const hole of room.ellipseHoles ?? []) {
        actx.beginPath();
        actx.ellipse(hole.cx * width, hole.cy * height, hole.rx * width, hole.ry * height, 0, 0, Math.PI * 2);
        actx.fill();
      }
    }
    const alphaData = actx.getImageData(0, 0, width, height).data;
    const alphaMap = new Float32Array(width * height);
    for (let i = 0; i < alphaMap.length; i++) alphaMap[i] = alphaData[i * 4] / 255;
    const stats = maskStats(alphaMap, width, height);
    const frame = this.frameFor(width, height, stats.top);
    if (!frame) return null;
    const photo = context(this.original, true).getImageData(0, 0, width, height).data;
    const shading = computeShading(photo, alphaMap, width, height);
    const shade = surface(width, height);
    const shadeImage = context(shade).createImageData(width, height);
    shadeImage.data.set(shading.rgba);
    context(shade).putImageData(shadeImage, 0, 0);
    this.coverage = stats.coverage;
    return { key, width, height, alpha, alphaMap, shade, tint: null, meanRGB: shading.meanRGB, Hinv: frame.Hinv, rotation: frame.rotation, maskSource, maskTop: stats.top };
  }

  private atlas(): PlankAtlas {
    const started = performance.now();
    const product = this.productList[this.finish];
    const atlas = buildPlankAtlas(product, { photo: this.materialPhotos.get(product.id) });
    const elapsed = performance.now() - started;
    if (elapsed > 1) this.atlasMs = elapsed;
    return atlas;
  }

  private renderScene(): void {
    const scene = this.scene;
    if (!scene) return;
    const started = performance.now();
    const atlas = this.atlas();
    const inputsKey = `${scene.key}|${atlas.productId}`;
    if (this.inputsKey !== inputsKey) {
      this.renderer.setInputs({ photo: this.original, alpha: scene.alpha, shade: scene.shade, atlas: atlas.canvas, planks: atlas.planks });
      this.inputsKey = inputsKey;
    }
    const params = defaultRenderParams(scene.Hinv, atlas.plankSize);
    params.pattern = this.pattern;
    if (this.pattern === 'herringbone') params.plankSize = [.72, .12];
    params.rotation = scene.rotation;
    params.meanRGB = scene.meanRGB;
    const rendered = this.renderer.render(params);
    const ctx = context(this.current);
    ctx.drawImage(this.original, 0, 0);
    ctx.drawImage(rendered, 0, 0);
    this.renderMs = performance.now() - started;
  }

  private rebuild(): void {
    if (this.disposed || (!this.loadComplete && !this.photo)) return;
    if (!this.photo && !this.options.imageUrl && !this.roomLoaded.get(this.room)) return;
    const key = this.loadOriginal();
    if (!this.scene || this.scene.key !== key) {
      this.scene = this.buildScene(key);
      this.inputsKey = '';
    }
    if (this.scene) this.renderScene();
    else context(this.current).drawImage(this.original, 0, 0);
    this.draw();
  }

  // ---------------------------------------------------------------- drawing

  private draw(): void {
    if (this.disposed) return;
    const ctx = this.ctx, width = this.canvas.width, height = this.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#ece8e1';
    ctx.fillRect(0, 0, width, height);
    if (!this.loadComplete && !this.photo) return;
    const imageWidth = this.original.width, imageHeight = this.original.height;
    const fullView = this.photo && (this.stage !== 'auto' && !this.quad);
    const [zoom, horizontal, vertical] = fullView ? VIEWS[0] : VIEWS[this.view];
    let cropWidth = imageWidth / zoom, cropHeight = imageHeight / zoom;
    if (!this.photo) {
      const ratio = width / height;
      if (cropWidth / cropHeight > ratio) cropWidth = cropHeight * ratio;
      else cropHeight = cropWidth / ratio;
    }
    this.frame = { x: (imageWidth - cropWidth) * horizontal, y: (imageHeight - cropHeight) * (this.room && this.view === 0 && !this.photo ? .88 : vertical), width: cropWidth, height: cropHeight };
    const scale = this.photo ? Math.min(width / cropWidth, height / cropHeight) : width / cropWidth;
    this.display = { x: (width - cropWidth * scale) / 2, y: (height - cropHeight * scale) / 2, width: cropWidth * scale, height: cropHeight * scale };
    const drawImage = (image: HTMLCanvasElement): void => ctx.drawImage(image, this.frame.x, this.frame.y, this.frame.width, this.frame.height, this.display.x, this.display.y, this.display.width, this.display.height);
    drawImage(this.current);
    if (this.compare && this.scene) this.drawCompare(drawImage);
    if (this.stage === 'scanning') this.drawScanner();
    if (this.scene && (this.tool.startsWith('brush') || (this.stage === 'auto' && (this.tool.startsWith('click') || performance.now() < this.revealUntil)))) this.drawMaskTint(drawImage);
    if (this.stage === 'auto' && this.tool.startsWith('click') && this.samPoints.length && this.samFrame) this.drawSamPoints();
    if (this.stage === 'auto' && this.tool === 'horizon') this.drawHorizon();
    if (this.stage === 'manual' && !this.quad && (this.points.length || this.keyboardActive)) this.drawCorners();
  }

  private drawScanner(): void {
    const ctx = this.ctx, unit = Math.max(1, this.canvas.width / 600);
    const { x, y, width, height } = this.display;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();
    ctx.fillStyle = 'rgba(39,33,31,.18)';
    ctx.fillRect(x, y, width, height);
    if (!reducedMotion()) {
      const t = ((performance.now() - this.scanStarted) % 1800) / 1800;
      const sweep = x + width * t;
      const gradient = ctx.createLinearGradient(sweep - 60 * unit, 0, sweep + 6 * unit, 0);
      gradient.addColorStop(0, 'rgba(128,99,152,0)');
      gradient.addColorStop(.85, 'rgba(128,99,152,.45)');
      gradient.addColorStop(1, 'rgba(255,255,255,.9)');
      ctx.fillStyle = gradient;
      ctx.fillRect(sweep - 60 * unit, y, 66 * unit, height);
    }
    const progress = this.modelProgress;
    const label = progress > 0 && progress < 1 ? `กำลังโหลดโมเดลครั้งแรก ${Math.round(progress * 100)}%` : 'กำลังสแกนหาพื้น…';
    ctx.font = `500 ${12 * unit}px "Noto Sans Thai", sans-serif`;
    const textWidth = ctx.measureText(label).width;
    const bx = x + width / 2 - textWidth / 2 - 14 * unit, by = y + height / 2 - 16 * unit;
    ctx.fillStyle = 'rgba(255,255,255,.94)';
    ctx.beginPath();
    ctx.roundRect(bx, by, textWidth + 28 * unit, 32 * unit, 16 * unit);
    ctx.fill();
    ctx.fillStyle = '#55366e';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + width / 2, by + 16 * unit);
    if (progress > 0 && progress < 1) {
      ctx.fillStyle = 'rgba(128,99,152,.25)';
      ctx.fillRect(bx, by + 30 * unit, textWidth + 28 * unit, 2 * unit);
      ctx.fillStyle = '#806398';
      ctx.fillRect(bx, by + 30 * unit, (textWidth + 28 * unit) * progress, 2 * unit);
    }
    ctx.restore();
  }

  private drawMaskTint(drawImage: (image: HTMLCanvasElement) => void): void {
    const scene = this.scene!;
    if (!scene.tint) {
      const tint = surface(scene.width, scene.height);
      const image = context(tint).createImageData(scene.width, scene.height);
      const data = context(scene.alpha, true).getImageData(0, 0, scene.width, scene.height).data;
      for (let i = 0; i < scene.width * scene.height; i++) {
        image.data[i * 4] = PURPLE[0]; image.data[i * 4 + 1] = PURPLE[1]; image.data[i * 4 + 2] = PURPLE[2];
        image.data[i * 4 + 3] = data[i * 4] * .45;
      }
      context(tint).putImageData(image, 0, 0);
      scene.tint = tint;
    }
    const remaining = this.revealUntil - performance.now();
    this.ctx.save();
    this.ctx.globalAlpha = this.tool.startsWith('brush') ? 1 : clamp(remaining / 500, 0, 1);
    drawImage(scene.tint);
    this.ctx.restore();
  }

  private drawSamPoints(): void {
    const ctx = this.ctx, unit = Math.max(1, this.canvas.width / 600), frame = this.samFrame!;
    ctx.save();
    for (const point of this.samPoints) {
      const x = this.display.x + (point.x / frame.scale - this.frame.x) / this.frame.width * this.display.width;
      const y = this.display.y + (point.y / frame.scale - this.frame.y) / this.frame.height * this.display.height;
      ctx.beginPath();
      ctx.arc(x, y, 7 * unit, 0, Math.PI * 2);
      ctx.fillStyle = this.tool === 'click-erase' ? '#e9773e' : '#806398';
      ctx.fill();
      ctx.lineWidth = 2 * unit;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawHorizon(): void {
    const ctx = this.ctx, unit = Math.max(1, this.canvas.width / 600);
    const y = this.display.y + (this.horizonY * this.original.height - this.frame.y) / this.frame.height * this.display.height;
    ctx.save();
    ctx.setLineDash([8 * unit, 6 * unit]);
    ctx.lineWidth = 2 * unit;
    ctx.strokeStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(this.display.x, y);
    ctx.lineTo(this.display.x + this.display.width, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = '#806398';
    ctx.lineWidth = 1 * unit;
    ctx.stroke();
    const hx = this.display.x + this.display.width / 2;
    ctx.beginPath();
    ctx.arc(hx, y, 14 * unit, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#806398';
    ctx.lineWidth = 2 * unit;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(hx - 5 * unit, y - 3 * unit); ctx.lineTo(hx, y - 8 * unit); ctx.lineTo(hx + 5 * unit, y - 3 * unit);
    ctx.moveTo(hx - 5 * unit, y + 3 * unit); ctx.lineTo(hx, y + 8 * unit); ctx.lineTo(hx + 5 * unit, y + 3 * unit);
    ctx.stroke();
    ctx.font = `500 ${11 * unit}px "Noto Sans Thai", sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(39,33,31,.72)';
    const label = 'เส้นขอบฟ้า (ระดับสายตา)';
    const tw = ctx.measureText(label).width;
    ctx.fillRect(this.display.x + 10 * unit, y - 24 * unit, tw + 12 * unit, 20 * unit);
    ctx.fillStyle = '#fff';
    ctx.fillText(label, this.display.x + 16 * unit, y - 8 * unit);
    ctx.restore();
  }

  private drawCompare(drawImage: (image: HTMLCanvasElement) => void): void {
    const ctx = this.ctx, width = this.canvas.width;
    const divider = this.display.x + this.display.width * this.comparePosition;
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.display.x, this.display.y, divider - this.display.x, this.display.height);
    ctx.clip();
    drawImage(this.original);
    ctx.restore();
    const unit = Math.max(1, width / 600);
    ctx.fillStyle = 'rgba(255,255,255,.95)';
    ctx.fillRect(divider - unit, this.display.y, 2 * unit, this.display.height);
    const cy = this.display.y + this.display.height / 2;
    ctx.beginPath();
    ctx.arc(divider, cy, 15 * unit, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = 'rgba(39,33,31,.25)';
    ctx.lineWidth = unit;
    ctx.stroke();
    ctx.strokeStyle = '#806398';
    ctx.lineWidth = 2 * unit;
    ctx.beginPath();
    ctx.moveTo(divider - 3 * unit, cy - 5 * unit); ctx.lineTo(divider - 7 * unit, cy); ctx.lineTo(divider - 3 * unit, cy + 5 * unit);
    ctx.moveTo(divider + 3 * unit, cy - 5 * unit); ctx.lineTo(divider + 7 * unit, cy); ctx.lineTo(divider + 3 * unit, cy + 5 * unit);
    ctx.stroke();
    ctx.font = `500 ${12 * unit}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const minX = this.display.x + 27 * unit, maxX = this.display.x + this.display.width - 27 * unit;
    const labels: [string, number][] = [['ก่อน', Math.max(minX, divider - 44 * unit)], ['หลัง', Math.min(maxX, divider + 44 * unit)]];
    labels.forEach(([label, x]) => {
      const y = this.display.y + this.display.height - 22 * unit;
      ctx.fillStyle = 'rgba(39,33,31,.72)';
      ctx.fillRect(x - 23 * unit, y - 12 * unit, 46 * unit, 24 * unit);
      ctx.fillStyle = '#fff';
      ctx.fillText(label, x, y);
    });
  }

  private drawCorners(): void {
    const ctx = this.ctx, unit = Math.max(1, this.canvas.width / 600);
    const points = this.points.map(point => ({
      x: this.display.x + (point.x * this.original.width - this.frame.x) / this.frame.width * this.display.width,
      y: this.display.y + (point.y * this.original.height - this.frame.y) / this.frame.height * this.display.height,
    }));
    ctx.save();
    ctx.beginPath();
    points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    ctx.lineWidth = 2 * unit;
    ctx.strokeStyle = '#fff';
    ctx.setLineDash([5 * unit, 4 * unit]);
    ctx.stroke();
    ctx.setLineDash([]);
    points.forEach((point, index) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 10 * unit, 0, Math.PI * 2);
      ctx.fillStyle = '#806398';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `600 ${11 * unit}px sans-serif`;
      ctx.fillText(String(index + 1), point.x, point.y);
    });
    if (this.keyboardActive) {
      const x = this.display.x + this.keyboardPoint.x * this.display.width;
      const y = this.display.y + this.keyboardPoint.y * this.display.height;
      ctx.beginPath();
      ctx.moveTo(x - 15 * unit, y);
      ctx.lineTo(x + 15 * unit, y);
      ctx.moveTo(x, y - 15 * unit);
      ctx.lineTo(x, y + 15 * unit);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 4 * unit;
      ctx.stroke();
      ctx.strokeStyle = '#55366e';
      ctx.lineWidth = 2 * unit;
      ctx.stroke();
    }
    ctx.restore();
  }
}
