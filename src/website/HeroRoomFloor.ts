import { getProduct } from '../data/products';
import { sitePath } from '../sitePath';

const IMAGE_URL = sitePath('/room/references/room-original.webp');
const REFERENCE_WIDTH = 1672;
const REFERENCE_HEIGHT = 941;
const FINISH_IDS = ['light-natural-oak', 'warm-taupe-oak', 'golden-honey-oak', 'whitewashed-ash-oak', 'greige-oak', 'dark-walnut-brown'] as const;

// This silhouette is specific to the supplied room photograph. Follow the
// skirting, curtains, pot, sofa and coffee-table bases, leaving their pixels
// untouched. The photographed floor's grain, seams and lighting are retained.
const FLOOR_EDGE = [
  [0, 510], [694, 430], [695, 422], [709, 422], [719, 417],
  [726, 407], [737, 406], [748, 405], [758, 405], [775, 408],
  [781, 413], [794, 417], [814, 418], [831, 414], [842, 408],
  [859, 407], [882, 407], [890, 414], [900, 421], [918, 424],
  [936, 430], [956, 433], [982, 431], [1086, 428], [1190, 425],
  [1258, 423], [1285, 417], [1309, 417], [1328, 418],
  [1329, 467], [1343, 474], [1367, 478], [1398, 478],
  [1401, 496], [1424, 508], [1463, 515], [1507, 520],
  [1556, 519], [1600, 514], [1634, 508], [1658, 501], [1672, 494],
  [1672, 941], [0, 941],
] as const;

export interface HeroRoomFloorDiagnostics {
  ready: boolean;
  failed: boolean;
  disposed: boolean;
  from: number;
  to: number;
  mix: number;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  maskedPixels: number;
  cachedFinishes: number;
}

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function getContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('ไม่สามารถแสดงสีพื้นห้องในเบราว์เซอร์นี้ได้');
  return ctx;
}

const clamp = (value: number, maximum = 1): number => Math.min(maximum, Math.max(0, Number.isFinite(value) ? value : 0));
const finishIndex = (value: number): number => Math.round(clamp(value, FINISH_IDS.length - 1));
const linear = (value: number): number => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
const palette = (id: typeof FINISH_IDS[number]): number[] => {
  const hex = getProduct(id).surface.palette.base.replace('#', '');
  return [0, 2, 4].map(offset => linear(parseInt(hex.slice(offset, offset + 2), 16) / 255));
};

/** Deterministic, floor-only colour transitions over the supplied room photo. */
export class HeroRoomFloor {
  readonly ready: Promise<void>;
  private readonly canvas = makeCanvas(1, 1);
  private readonly ctx: CanvasRenderingContext2D;
  private readonly observer: ResizeObserver;
  private readonly image = new Image();
  private readonly cache: (HTMLCanvasElement | undefined)[] = [];
  private source: ImageData | null = null;
  private mask: Uint8Array | null = null;
  private idle = 0;
  private loaded = false;
  private failed = false;
  private disposed = false;
  private from = 0;
  private to = 0;
  private mix = 0;
  private maskedPixels = 0;
  private previousBackground: string;

  constructor(private readonly host: HTMLElement) {
    this.ctx = getContext(this.canvas);
    this.previousBackground = host.style.background;
    host.style.background = `url("${IMAGE_URL}") center / cover no-repeat`;
    this.canvas.className = 'hero-room-floor-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.canvas.style.cssText = 'display:block;width:100%;height:100%;pointer-events:none;visibility:hidden;';
    host.append(this.canvas);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.resize();
    this.image.decoding = 'async';
    this.ready = new Promise<void>((resolve, reject) => {
      this.image.onload = () => {
        if (this.disposed) { resolve(); return; }
        try {
          this.prepare();
          this.loaded = true;
          this.canvas.style.visibility = 'visible';
          this.render();
          resolve();
        } catch (error) {
          this.failed = true;
          this.canvas.style.visibility = 'hidden';
          reject(error);
        }
      };
      this.image.onerror = () => {
        if (this.disposed) { resolve(); return; }
        this.failed = true;
        this.canvas.style.visibility = 'hidden';
        reject(new Error('ไม่สามารถโหลดภาพห้องตัวอย่างได้'));
      };
      this.image.src = IMAGE_URL;
    });
  }

  setBlend(from: number, to: number, mix: number): void {
    if (this.disposed) return;
    const nextFrom = finishIndex(from), nextTo = finishIndex(to), nextMix = clamp(mix);
    if (this.from === nextFrom && this.to === nextTo && this.mix === nextMix) return;
    this.from = nextFrom;
    this.to = nextTo;
    this.mix = nextMix;
    this.render();
  }

  get diagnostics(): HeroRoomFloorDiagnostics {
    return {
      ready: this.loaded, failed: this.failed, disposed: this.disposed,
      from: this.from, to: this.to, mix: this.mix,
      width: this.canvas.width, height: this.canvas.height,
      sourceWidth: this.image.naturalWidth, sourceHeight: this.image.naturalHeight,
      maskedPixels: this.maskedPixels, cachedFinishes: this.cache.filter(Boolean).length,
    };
  }

  getDiagnostics(): HeroRoomFloorDiagnostics { return this.diagnostics; }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.observer.disconnect();
    this.canvas.remove();
    this.canvas.width = this.canvas.height = 1;
    for (const canvas of this.cache) if (canvas) canvas.width = canvas.height = 1;
    this.cache.length = 0;
    if (typeof cancelIdleCallback === 'function') cancelIdleCallback(this.idle); else clearTimeout(this.idle);
    this.host.style.background = this.previousBackground;
  }

  private prepare(): void {
    const width = this.image.naturalWidth, height = this.image.naturalHeight;
    const original = makeCanvas(width, height);
    const originalContext = getContext(original);
    originalContext.drawImage(this.image, 0, 0);
    this.cache[0] = original;
    // Pixel access and the floor mask are deferred: the first paint is the untouched photo.
    this.scheduleIdleFinishes();
  }

  private ensureSource(): void {
    if (this.source && this.mask) return;
    const width = this.image.naturalWidth, height = this.image.naturalHeight;
    const originalContext = getContext(this.cache[0]!);
    const source = originalContext.getImageData(0, 0, width, height);

    // Alpha in this temporary canvas supplies antialiased one-pixel edges;
    // every pixel with zero coverage is copied byte-for-byte from the photo.
    const maskCanvas = makeCanvas(width, height);
    const maskContext = maskCanvas.getContext('2d')!;
    maskContext.scale(width / REFERENCE_WIDTH, height / REFERENCE_HEIGHT);
    maskContext.beginPath();
    FLOOR_EDGE.forEach(([x, y], index) => index ? maskContext.lineTo(x, y) : maskContext.moveTo(x, y));
    maskContext.closePath();
    maskContext.fill();
    const maskPixels = maskContext.getImageData(0, 0, width, height).data;
    const mask = new Uint8Array(width * height);
    for (let p = 0; p < mask.length; p++) {
      mask[p] = maskPixels[p * 4 + 3];
      if (mask[p]) this.maskedPixels++;
    }
    maskCanvas.width = maskCanvas.height = 1;
    this.source = source;
    this.mask = mask;
  }

  private scheduleIdleFinishes(): void {
    const next = (): void => {
      if (this.disposed) return;
      const index = FINISH_IDS.findIndex((_, i) => i > 0 && !this.cache[i]);
      if (index < 0) return;
      this.finishCanvas(index);
      this.scheduleIdleFinishes();
    };
    // No timeout: a forced idle callback would run while the 3D story is still building. True idle only.
    if (typeof requestIdleCallback === 'function') this.idle = requestIdleCallback(next);
    else this.idle = window.setTimeout(next, 1500);
  }

  /** The photo with its floor recoloured to one finish; ~60 ms per finish, built once. */
  private finishCanvas(finish: number): HTMLCanvasElement {
    const cached = this.cache[finish];
    if (cached) return cached;
    this.ensureSource();
    const source = this.source!, mask = this.mask!;
    const width = source.width, height = source.height;

    const srgbToLinear = Float32Array.from({ length: 256 }, (_, i) => linear(i / 255));
    const linearToSrgb = Uint8Array.from({ length: 4096 }, (_, i) => {
      const value = i / 4095;
      return Math.round(255 * (value <= .0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - .055));
    });
    // The supplied photograph already includes a warm daylight white balance.
    // Calibrate against its visible oak rather than the catalog render's RGB,
    // which would push pale ash and greige toward a blue/magenta cast.
    const reference = [211, 187, 161].map(channel => linear(channel / 255));
    {
      const target = makeCanvas(width, height), context = getContext(target);
      const pixels = new ImageData(new Uint8ClampedArray(source.data), width, height);
      const ratio = palette(FINISH_IDS[finish]).map((channel, i) => channel / reference[i]);
      for (let p = 0; p < mask.length; p++) {
        if (!mask[p]) continue;
        const offset = p * 4;
        const red = srgbToLinear[source.data[offset]], green = srgbToLinear[source.data[offset + 1]], blue = srgbToLinear[source.data[offset + 2]];
        const luminance = .2126 * red + .7152 * green + .0722 * blue;
        // Sunlit reflections stay warm and bright on darker wood. Work in
        // linear light, changing diffuse albedo without flattening the grain.
        const reflection = Math.max(0, (luminance - .32) / .68) * .15;
        const coverage = mask[p] / 255;
        for (let channel = 0; channel < 3; channel++) {
          const value = srgbToLinear[source.data[offset + channel]];
          const changed = Math.max(0, value - reflection) * ratio[channel] + reflection;
          // A gentle highlight shoulder avoids clipping away grain when the
          // pale finish catches direct sun.
          const exposed = changed > .75 ? .75 + .25 * (1 - Math.exp(-(changed - .75) / .25)) : changed;
          const mapped = linearToSrgb[Math.round(clamp(exposed) * 4095)];
          pixels.data[offset + channel] = Math.round(source.data[offset + channel] * (1 - coverage) + mapped * coverage);
        }
      }
      context.putImageData(pixels, 0, 0);
      this.cache[finish] = target;
      return target;
    }
  }

  private resize(): void {
    if (this.disposed) return;
    const bounds = this.host.getBoundingClientRect();
    // A photo background does not benefit from allocations above its source
    // resolution. Keep large displays and mobile device-pixel-ratios bounded.
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(2_600_000 / Math.max(1, bounds.width * bounds.height)));
    const width = Math.max(1, Math.round(bounds.width * pixelRatio));
    const height = Math.max(1, Math.round(bounds.height * pixelRatio));
    if (width !== this.canvas.width || height !== this.canvas.height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.render();
  }

  private render(): void {
    if (!this.loaded || this.disposed) return;
    const source = this.finishCanvas(this.from);
    const scale = Math.max(this.canvas.width / source.width, this.canvas.height / source.height);
    const width = source.width * scale, height = source.height * scale;
    const x = (this.canvas.width - width) / 2, y = (this.canvas.height - height) / 2;
    this.ctx.globalAlpha = 1;
    this.ctx.drawImage(source, x, y, width, height);
    if (this.mix > 0 && this.from !== this.to) {
      this.ctx.globalAlpha = this.mix;
      this.ctx.drawImage(this.finishCanvas(this.to), x, y, width, height);
      this.ctx.globalAlpha = 1;
    }
  }
}
