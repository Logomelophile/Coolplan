import { sitePath } from '../sitePath';

/** Photo-based room preview. All image processing stays inside the browser. */
type Point = { x: number; y: number };
type Crop = { x: number; y: number; width: number; height: number };

export interface RoomPreviewDiagnostics {
  ready: boolean;
  failed: boolean;
  disposed: boolean;
  room: number;
  finish: number;
  view: number;
  compare: boolean;
  uploaded: boolean;
  floorCorners: number;
  floorSelected: boolean;
  width: number;
  height: number;
}

export interface RoomPreviewOptions {
  imageUrl?: string;
  onHint?: (message: string) => void;
  onChange?: (state: RoomPreviewDiagnostics) => void;
}

const MAIN: Crop = { x: 563, y: 976, width: 494, height: 238 };
const ROOMS: Crop[] = [MAIN, ...[207, 351, 496, 641, 786, 931].map(x => ({ x, y: 733, width: 130, height: 104 }))];
const SWATCHES: Crop[] = [
  { x: 76, y: 979, width: 132, height: 86 },
  { x: 228, y: 978, width: 139, height: 89 },
  { x: 385, y: 978, width: 139, height: 89 },
  { x: 73, y: 1123, width: 137, height: 89 },
  { x: 229, y: 1123, width: 137, height: 89 },
  { x: 385, y: 1123, width: 139, height: 89 },
];
const COLORS = ['#c8b493', '#b4a185', '#bb9d75', '#bba889', '#aaa69f', '#897258'];
const normalized = (pairs: number[][]): Point[] => pairs.map(([x, y]) => ({ x, y }));

// Conservative hand-drawn masks belong to these particular reference photos.
// Uploaded photos always require the user to identify an unobstructed floor patch.
const FLOOR_MASKS: Point[][] = [
  normalized([[0, .705], [.079, .651], [.106, .642], [.124, .658], [.147, .659], [.170, .646], [.181, .665], [.697, .667], [.725, .657], [.747, .663], [.775, .650], [.842, .665], [.867, .691], [.886, .714], [1, .791], [1, 1], [0, 1]]),
  normalized([[0, .85], [.15, .81], [.24, .88], [.77, .88], [.86, .83], [1, .88], [1, 1], [0, 1]]),
  normalized([[0, .86], [.15, .76], [.56, .69], [.72, .76], [1, .90], [1, 1], [0, 1]]),
  normalized([[.17, .80], [.31, .70], [.50, .70], [.64, .80], [.84, 1], [.07, 1]]),
  normalized([[0, .93], [.21, .93], [.25, .98], [.81, .98], [.91, .88], [1, .91], [1, 1], [0, 1]]),
  normalized([[.08, .84], [.27, .83], [.34, .90], [.71, .90], [.83, .80], [.93, .86], [1, 1], [0, 1]]),
  normalized([[.14, .80], [.25, .73], [.32, .75], [.33, .87], [.73, .87], [.74, .75], [.83, .78], [1, 1], [0, 1]]),
];
const TABLE_HOLE = normalized([[.331, .617], [.358, .597], [.409, .587], [.528, .592], [.610, .617], [.646, .642], [.646, .681], [.618, .705], [.616, .802], [.579, .824], [.548, .820], [.514, .815], [.497, .805], [.467, .820], [.426, .818], [.405, .797], [.397, .778], [.374, .778], [.372, .709], [.357, .696], [.337, .673]]);

const clampIndex = (value: number, maximum: number): number => Number.isFinite(value) ? Math.min(maximum, Math.max(0, Math.round(value))) : 0;
const surface = (width = 1, height = 1): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
};
const context = (canvas: HTMLCanvasElement): CanvasRenderingContext2D => {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('เบราว์เซอร์นี้ไม่รองรับการแสดงภาพห้อง');
  return ctx;
};
const path = (ctx: CanvasRenderingContext2D, points: Point[], width: number, height: number): void => {
  points.forEach((point, index) => index === 0 ? ctx.moveTo(point.x * width, point.y * height) : ctx.lineTo(point.x * width, point.y * height));
  ctx.closePath();
};

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

/** Inverse homography with bilinear sampling: no tessellation seams. */
function warpTexture(texture: HTMLCanvasElement, destination: HTMLCanvasElement, quad: Point[]): void {
  const [p0, p1, p2, p3] = quad;
  const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y, dy3 = p0.y - p1.y + p2.y - p3.y;
  const denominator = dx1 * dy2 - dx2 * dy1;
  const g = Math.abs(denominator) > 1e-8 ? (dx3 * dy2 - dx2 * dy3) / denominator : 0;
  const h = Math.abs(denominator) > 1e-8 ? (dx1 * dy3 - dx3 * dy1) / denominator : 0;
  const a = p1.x - p0.x + g * p1.x, b = p3.x - p0.x + h * p3.x;
  const d = p1.y - p0.y + g * p1.y, e = p3.y - p0.y + h * p3.y;
  const c = p0.x, f = p0.y;
  const inverse = [e - f * h, c * h - b, b * f - c * e, f * g - d, a - c * g, c * d - a * f, d * h - e * g, b * g - a * h, a * e - b * d];
  const target = context(destination), width = destination.width, height = destination.height;
  const input = context(texture).getImageData(0, 0, texture.width, texture.height).data;
  const result = target.createImageData(width, height), output = result.data;
  const minX = Math.max(0, Math.floor(Math.min(...quad.map(p => p.x))));
  const minY = Math.max(0, Math.floor(Math.min(...quad.map(p => p.y))));
  const maxX = Math.min(width, Math.ceil(Math.max(...quad.map(p => p.x))));
  const maxY = Math.min(height, Math.ceil(Math.max(...quad.map(p => p.y))));
  for (let y = minY; y < maxY; y++) for (let x = minX; x < maxX; x++) {
    const px = x + .5, py = y + .5;
    const z = inverse[6] * px + inverse[7] * py + inverse[8];
    if (Math.abs(z) < 1e-8) continue;
    const u = (inverse[0] * px + inverse[1] * py + inverse[2]) / z;
    const v = (inverse[3] * px + inverse[4] * py + inverse[5]) / z;
    if (u < 0 || u > 1 || v < 0 || v > 1) continue;
    const tx = u * (texture.width - 1), ty = v * (texture.height - 1);
    const sx = Math.floor(tx), sy = Math.floor(ty), fx = tx - sx, fy = ty - sy;
    const left = (sy * texture.width + sx) * 4;
    const right = (sy * texture.width + Math.min(sx + 1, texture.width - 1)) * 4;
    const below = (Math.min(sy + 1, texture.height - 1) * texture.width + sx) * 4;
    const diagonal = (Math.min(sy + 1, texture.height - 1) * texture.width + Math.min(sx + 1, texture.width - 1)) * 4;
    const index = (y * width + x) * 4;
    for (let channel = 0; channel < 3; channel++) {
      output[index + channel] = (input[left + channel] * (1 - fx) + input[right + channel] * fx) * (1 - fy) + (input[below + channel] * (1 - fx) + input[diagonal + channel] * fx) * fy;
    }
    output[index + 3] = 255;
  }
  target.putImageData(result, 0, 0);
}

export class RoomPreview {
  readonly canvas: HTMLCanvasElement;
  readonly ready: Promise<void>;
  private readonly options: RoomPreviewOptions;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly prototype = new Image();
  private readonly original = surface();
  private readonly current = surface();
  private readonly warped = surface();
  private readonly textures = new Map<number, HTMLCanvasElement>();
  private readonly observer?: ResizeObserver;
  private uploadImage: HTMLImageElement | null = null;
  private uploadUrl: string | null = null;
  private uploadToken = 0;
  private loadComplete = false;
  private failed = false;
  private disposed = false;
  private room = 0;
  private finish = 0;
  private view = 0;
  private compare = false;
  private points: Point[] = [];
  private quad: Point[] | null = null;
  private keyboardPoint: Point = { x: .2, y: .75 };
  private keyboardActive = false;
  private frame: Crop = { x: 0, y: 0, width: 1, height: 1 };
  private display: Crop = { x: 0, y: 0, width: 1, height: 1 };

  constructor(private readonly host: HTMLElement, options: RoomPreviewOptions = {}) {
    this.options = options;
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
    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(this.resize);
      this.observer.observe(host);
    } else window.addEventListener('resize', this.resize);
    this.resize();
    this.ready = new Promise<void>(resolve => {
      this.prototype.onload = () => {
        if (!this.disposed) {
          this.loadComplete = true;
          this.textures.clear();
          this.rebuild();
          this.emit();
        }
        resolve();
      };
      this.prototype.onerror = () => {
        if (!this.disposed) {
          this.failed = true;
          this.hint('ไม่สามารถโหลดภาพตัวอย่างได้ กรุณาลองรีเฟรชหน้าเว็บ หรืออัปโหลดภาพห้องของคุณ');
          this.emit();
        }
        resolve();
      };
      this.prototype.src = options.imageUrl ?? sitePath('/website/assets/prototype-home.png');
    });
  }

  get diagnostics(): RoomPreviewDiagnostics {
    return {
      ready: this.loadComplete || Boolean(this.uploadImage), failed: this.failed, disposed: this.disposed,
      room: this.room, finish: this.finish, view: this.view, compare: this.compare,
      uploaded: Boolean(this.uploadImage), floorCorners: this.points.length, floorSelected: Boolean(this.quad),
      width: this.canvas.width, height: this.canvas.height,
    };
  }

  getDiagnostics(): RoomPreviewDiagnostics { return this.diagnostics; }
  getdiagnostics(): RoomPreviewDiagnostics { return this.diagnostics; }

  setRoom(index: number): void {
    if (this.disposed) return;
    this.clearUpload();
    this.room = clampIndex(index, ROOMS.length - 1);
    this.view = 0;
    this.rebuild();
    this.hint('เลือกสีพื้นเพื่อดูบรรยากาศในห้องตัวอย่าง');
    this.emit();
  }

  setFinish(index: number): void {
    if (this.disposed) return;
    this.finish = clampIndex(index, SWATCHES.length - 1);
    this.rebuild();
    if (this.uploadImage && !this.quad) this.cornerHint();
    this.emit();
  }

  setCompare(enabled: boolean): void {
    if (this.disposed) return;
    this.compare = Boolean(enabled);
    this.draw();
    this.emit();
  }

  setView(index: number): void {
    if (this.disposed) return;
    this.view = clampIndex(index, 5);
    this.draw();
    this.emit();
  }

  async upload(file: File): Promise<void> {
    if (this.disposed) throw new Error('ตัวแสดงผลนี้ถูกปิดแล้ว');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('กรุณาเลือกไฟล์ JPG, PNG หรือ WebP');
    if (file.size === 0 || file.size > 20 * 1024 * 1024) throw new Error('กรุณาเลือกภาพที่มีขนาดไม่เกิน 20 MB');
    const token = ++this.uploadToken;
    const url = URL.createObjectURL(file);
    const image = new Image();
    try {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('ไม่สามารถอ่านภาพนี้ได้ กรุณาเลือกภาพอื่น'));
        image.src = url;
      });
      if (!image.naturalWidth || !image.naturalHeight) throw new Error('ภาพนี้ไม่มีขนาดที่ใช้งานได้');
      if (this.disposed || token !== this.uploadToken) return;
      if (this.uploadUrl) URL.revokeObjectURL(this.uploadUrl);
      this.uploadUrl = url;
      this.uploadImage = image;
      this.points = [];
      this.quad = null;
      this.keyboardActive = false;
      this.keyboardPoint = { x: .2, y: .75 };
      this.view = 0;
      this.compare = false;
      this.canvas.style.cursor = 'crosshair';
      this.canvas.setAttribute('role', 'application');
      this.canvas.setAttribute('aria-label', 'เลือก 4 มุมของพื้นที่พื้นซึ่งไม่มีเฟอร์นิเจอร์บัง ใช้ลูกศรเลื่อนจุดและ Enter เพื่อเลือก กด Backspace เพื่อลบจุดล่าสุด หรือ Escape เพื่อเลือกใหม่');
      this.rebuild();
      this.cornerHint();
      this.emit();
    } finally {
      image.onload = null;
      image.onerror = null;
      if (this.uploadUrl !== url) URL.revokeObjectURL(url);
    }
  }

  resetUpload(): void {
    if (this.disposed) return;
    this.clearUpload();
    this.view = 0;
    this.rebuild();
    this.hint('กลับสู่ภาพห้องตัวอย่างแล้ว');
    this.emit();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clearUpload();
    this.observer?.disconnect();
    window.removeEventListener('resize', this.resize);
    this.canvas.removeEventListener('click', this.onClick);
    this.canvas.removeEventListener('keydown', this.onKeyDown);
    this.canvas.remove();
    for (const texture of this.textures.values()) texture.width = texture.height = 1;
    this.textures.clear();
    this.original.width = this.current.width = this.warped.width = this.canvas.width = 1;
    this.original.height = this.current.height = this.warped.height = this.canvas.height = 1;
  }

  private clearUpload(): void {
    this.uploadToken++;
    if (this.uploadUrl) URL.revokeObjectURL(this.uploadUrl);
    this.uploadUrl = null;
    this.uploadImage = null;
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

  private resize = (): void => {
    if (this.disposed) return;
    const rect = this.host.getBoundingClientRect();
    const width = Math.max(1, rect.width || 494), height = Math.max(1, rect.height || width * 238 / 494);
    const scale = Math.min(window.devicePixelRatio || 1, 2, 1800 / Math.max(width, height));
    this.canvas.width = Math.max(1, Math.round(width * scale));
    this.canvas.height = Math.max(1, Math.round(height * scale));
    this.draw();
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    if (!this.uploadImage) return;
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
    this.rebuild();
    this.cornerHint();
    this.emit();
  };

  private onClick = (event: MouseEvent): void => {
    if (this.disposed || !this.uploadImage || this.quad) return;
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = (event.clientX - rect.left) * this.canvas.width / rect.width;
    const y = (event.clientY - rect.top) * this.canvas.height / rect.height;
    if (x < this.display.x || y < this.display.y || x > this.display.x + this.display.width || y > this.display.y + this.display.height) return;
    const point = {
      x: (this.frame.x + (x - this.display.x) * this.frame.width / this.display.width) / this.original.width,
      y: (this.frame.y + (y - this.display.y) * this.frame.height / this.display.height) / this.original.height,
    };
    this.keyboardActive = false;
    this.addPoint(point);
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
    this.rebuild();
    this.emit();
  }

  private texture(): HTMLCanvasElement {
    const cached = this.textures.get(this.finish);
    if (cached) return cached;
    const tile = surface(768, 768), ctx = context(tile), swatch = SWATCHES[this.finish];
    ctx.fillStyle = COLORS[this.finish];
    ctx.fillRect(0, 0, 768, 768);
    for (let column = 0; column < 9; column++) {
      const offset = (column % 3) * 142;
      for (let row = -1; row < 3; row++) {
        const x = column * 86, y = row * 428 + offset;
        if (this.loadComplete) ctx.drawImage(this.prototype, swatch.x + column % 3 * 10, swatch.y, swatch.width - 24, swatch.height, x, y, 86, 428);
        ctx.strokeStyle = 'rgba(65,48,31,.13)';
        ctx.lineWidth = .65;
        ctx.strokeRect(x, y, 86, 428);
      }
    }
    // The image swatches supply genuine grain; no noise is added over furniture.
    this.textures.set(this.finish, tile);
    return tile;
  }

  private rebuild(): void {
    if (this.disposed || (!this.loadComplete && !this.uploadImage)) return;
    const crop = ROOMS[this.room];
    const sourceWidth = this.uploadImage?.naturalWidth ?? crop.width;
    const sourceHeight = this.uploadImage?.naturalHeight ?? crop.height;
    const scale = this.uploadImage ? Math.min(1, 1600 / Math.max(sourceWidth, sourceHeight)) : (this.room ? 4 : 2);
    const width = Math.max(1, Math.round(sourceWidth * scale)), height = Math.max(1, Math.round(sourceHeight * scale));
    this.original.width = this.current.width = this.warped.width = width;
    this.original.height = this.current.height = this.warped.height = height;
    const base = context(this.original);
    if (this.uploadImage) base.drawImage(this.uploadImage, 0, 0, width, height);
    else base.drawImage(this.prototype, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
    const ctx = context(this.current);
    ctx.drawImage(this.original, 0, 0);
    const mask = this.uploadImage ? this.quad : FLOOR_MASKS[this.room];
    if (mask && (this.uploadImage || this.finish !== 0)) {
      const quad = this.uploadImage ? this.quad! : normalized([[-.10, .60], [1.10, .60], [2, 1.10], [-1, 1.10]]);
      warpTexture(this.texture(), this.warped, quad.map(p => ({ x: p.x * width, y: p.y * height })));
      ctx.save();
      ctx.beginPath();
      path(ctx, mask, width, height);
      ctx.clip();
      if (!this.uploadImage && this.room === 0) {
        ctx.beginPath();
        ctx.rect(0, 0, width, height);
        path(ctx, TABLE_HOLE, width, height);
        // Preserve the fullscreen control baked into the supplied reference.
        ctx.moveTo(.941 * width + .037 * width, .902 * height);
        ctx.ellipse(.941 * width, .902 * height, .037 * width, .080 * height, 0, 0, Math.PI * 2);
        ctx.clip('evenodd');
      }
      // Color blend retains the photograph's luminance and contact shadows.
      ctx.globalCompositeOperation = 'color';
      ctx.globalAlpha = .86;
      ctx.fillStyle = COLORS[this.finish];
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = this.finish === 5 ? .45 : this.finish === 4 ? .20 : .18;
      ctx.drawImage(this.warped, 0, 0);
      ctx.globalCompositeOperation = 'soft-light';
      ctx.globalAlpha = this.uploadImage ? .35 : .18;
      ctx.drawImage(this.warped, 0, 0);
      ctx.restore();
    }
    this.draw();
  }

  private draw(): void {
    if (this.disposed) return;
    const ctx = this.ctx, width = this.canvas.width, height = this.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#ece8e1';
    ctx.fillRect(0, 0, width, height);
    if (!this.loadComplete && !this.uploadImage) return;
    const imageWidth = this.original.width, imageHeight = this.original.height;
    const views = [[1, .5, .5], [1.14, .18, .54], [1.14, .83, .54], [1.30, .50, .62], [1.8, .32, .57], [2.1, .78, .98]];
    const [zoom, horizontal, vertical] = this.uploadImage && !this.quad ? views[0] : views[this.view];
    let cropWidth = imageWidth / zoom, cropHeight = imageHeight / zoom;
    if (!this.uploadImage) {
      const ratio = width / height;
      if (cropWidth / cropHeight > ratio) cropWidth = cropHeight * ratio;
      else cropHeight = cropWidth / ratio;
    }
    this.frame = { x: (imageWidth - cropWidth) * horizontal, y: (imageHeight - cropHeight) * (this.room && this.view === 0 ? .88 : vertical), width: cropWidth, height: cropHeight };
    const scale = this.uploadImage ? Math.min(width / cropWidth, height / cropHeight) : width / cropWidth;
    this.display = { x: (width - cropWidth * scale) / 2, y: (height - cropHeight * scale) / 2, width: cropWidth * scale, height: cropHeight * scale };
    const drawImage = (image: HTMLCanvasElement): void => ctx.drawImage(image, this.frame.x, this.frame.y, this.frame.width, this.frame.height, this.display.x, this.display.y, this.display.width, this.display.height);
    drawImage(this.current);
    if (this.compare) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(this.display.x, this.display.y, this.display.width / 2, this.display.height);
      ctx.clip();
      drawImage(this.original);
      ctx.restore();
      const center = this.display.x + this.display.width / 2;
      ctx.fillStyle = 'rgba(255,255,255,.95)';
      ctx.fillRect(center - Math.max(1, width / 600), this.display.y, Math.max(2, width / 300), this.display.height);
      const unit = Math.max(1, width / 600);
      ctx.font = `500 ${12 * unit}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ['ก่อน', 'หลัง'].forEach((label, index) => {
        const x = center + (index ? 1 : -1) * 31 * unit, y = this.display.y + 20 * unit;
        ctx.fillStyle = 'rgba(39,33,31,.72)';
        ctx.fillRect(x - 23 * unit, y - 12 * unit, 46 * unit, 24 * unit);
        ctx.fillStyle = '#fff';
        ctx.fillText(label, x, y);
      });
    }
    if (this.uploadImage && !this.quad && (this.points.length || this.keyboardActive)) this.drawCorners();
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
