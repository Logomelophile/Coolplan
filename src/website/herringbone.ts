import { sitePath } from '../sitePath';

/**
 * SPC Herringbone section (catalogue 2026, pages 14–15): the pattern lays itself
 * plank by plank as the section scrolls into view, using the selected shade's
 * photograph as the plank material. Hovering or tapping a shade re-lays the floor.
 */
export const HERRINGBONE_SHADES = [
  { code: 'CPW-KH5-735', tone: 'โทนวอลนัทเข้ม', image: '/website/herringbone/kh5-735.webp' },
  { code: 'CPW-KH5-732', tone: 'โทนเทาอุ่น', image: '/website/herringbone/kh5-732.webp' },
  { code: 'CPW-KH5-682', tone: 'โทนน้ำผึ้ง', image: '/website/herringbone/kh5-682.webp' },
  { code: 'CPW-KH5-674', tone: 'โทนเบจอ่อน', image: '/website/herringbone/kh5-674.webp' },
  { code: 'CPW-KH5-110', tone: 'โทนขาวนวล', image: '/website/herringbone/kh5-110.webp' },
  { code: 'CPW-KH5-651', tone: 'โทนเทาอ่อน', image: '/website/herringbone/kh5-651.webp' },
] as const;

export interface HerringboneDiagnostics { shade: string; laid: number; planks: number; visible: boolean }

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export class HerringboneSection {
  private readonly canvas: HTMLCanvasElement;
  private readonly abort = new AbortController();
  private readonly observer: IntersectionObserver | null = null;
  private readonly reduced: boolean;
  private image: HTMLImageElement | null = null;
  private shade: string = HERRINGBONE_SHADES[2].code;
  private planks: { x: number; y: number; horizontal: boolean; seed: number }[] = [];
  private laid = 0;
  private target = 0;
  private visible = false;
  private raf = 0;
  private disposed = false;
  private width = 1;
  private height = 1;

  constructor(private readonly section: HTMLElement) {
    this.reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const stage = section.querySelector<HTMLElement>('.herringbone-stage')!;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'herringbone-canvas';
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', 'ภาพจำลองการปูลายก้างปลาด้วยเฉดสีที่เลือก');
    stage.prepend(this.canvas);
    const signal = this.abort.signal;
    section.querySelectorAll<HTMLButtonElement>('[data-shade]').forEach(button => {
      button.addEventListener('click', () => this.select(button.dataset.shade!), { signal });
      button.addEventListener('pointerenter', () => { if (matchMedia('(hover: hover)').matches) this.select(button.dataset.shade!); }, { signal });
    });
    if (typeof ResizeObserver !== 'undefined') {
      const resize = new ResizeObserver(() => this.layout());
      resize.observe(stage);
      signal.addEventListener('abort', () => resize.disconnect());
    } else window.addEventListener('resize', () => this.layout(), { signal });
    if (typeof IntersectionObserver !== 'undefined') {
      this.observer = new IntersectionObserver(entries => {
        const entry = entries[0];
        this.visible = entry.isIntersecting;
        section.classList.toggle('is-visible', this.visible || section.classList.contains('is-visible'));
        if (this.visible) this.onScroll();
      }, { threshold: [0, .15, .35, .6] });
      this.observer.observe(stage);
      window.addEventListener('scroll', this.onScroll, { passive: true, signal });
    } else { section.classList.add('is-visible'); this.target = 1; }
    this.layout();
    void this.select(this.shade, true);
  }

  get diagnostics(): HerringboneDiagnostics { return { shade: this.shade, laid: this.laid, planks: this.planks.length, visible: this.visible }; }

  async select(code: string, initial = false): Promise<void> {
    const shade = HERRINGBONE_SHADES.find(item => item.code === code);
    if (!shade || this.disposed) return;
    this.shade = shade.code;
    this.section.querySelectorAll<HTMLButtonElement>('[data-shade]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.shade === code)));
    const label = this.section.querySelector('#herringbone-selected');
    if (label) label.textContent = `${shade.code} · ${shade.tone}`;
    const image = new Image();
    image.src = sitePath(shade.image);
    try { await image.decode(); } catch { /* keep previous material */ }
    if (this.disposed || this.shade !== shade.code) return;
    this.image = image;
    if (!initial && !this.reduced) { this.laid = Math.min(this.laid, this.planks.length * .35); }
    this.draw();
    this.animate();
  }

  /**
   * Pre-computes the reveal tiles: the catalogue swatch is itself a photograph of
   * a 45° herringbone floor, so it is shown cover-fitted and revealed plank by
   * plank along a 45° grid that follows the real seams.
   */
  private layout(): void {
    const stage = this.canvas.parentElement!;
    const rect = stage.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.width = Math.max(1, Math.round(rect.width));
    this.height = Math.max(1, Math.round(rect.height));
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    const unit = clamp(this.width / 11, 30, 72); // plank width along the rotated grid
    const length = unit * 5.2;
    const diagonal = Math.hypot(this.width, this.height);
    const planks: typeof this.planks = [];
    // Rotated coordinates (u along +45°, v along -45°), centred on the stage.
    const cols = Math.ceil(diagonal / length) + 2, rows = Math.ceil(diagonal / unit) + 2;
    const cos = Math.cos(-Math.PI / 4), sin = Math.sin(-Math.PI / 4);
    const order = new Map<typeof planks[number], number>();
    for (let r = -rows; r <= rows; r++) for (let c = -cols; c <= cols; c++) {
      const stagger = (r % 2 ? .5 : 0) * length;
      const x = c * length + stagger, y = r * unit;
      // Keep only tiles that touch the stage, and order them by their on-screen position (top-left first).
      const mx = x + length / 2, my = y + unit / 2;
      const sx = this.width / 2 + mx * cos - my * sin, sy = this.height / 2 + mx * sin + my * cos;
      if (sx < -length || sx > this.width + length || sy < -length || sy > this.height + length) continue;
      const plank = { x, y, horizontal: true, seed: ((c * 73856093) ^ (r * 19349663)) >>> 0 };
      planks.push(plank);
      order.set(plank, sx * .8 + sy);
    }
    planks.sort((a, b) => order.get(a)! - order.get(b)!);
    this.planks = planks;
    this.draw();
  }

  /** Cover-fit source rectangle for the stage. */
  private cover(image: HTMLImageElement): [number, number, number, number] {
    const scale = Math.max(this.width / image.naturalWidth, this.height / image.naturalHeight);
    const sw = this.width / scale, sh = this.height / scale;
    return [(image.naturalWidth - sw) / 2, (image.naturalHeight - sh) / 2, sw, sh];
  }

  private onScroll = (): void => {
    if (!this.visible) return;
    const rect = this.canvas.parentElement!.getBoundingClientRect();
    const viewport = window.innerHeight || 1;
    // 0 when the stage top enters the viewport bottom, 1 when its centre reaches 55% of the viewport.
    const progress = clamp((viewport - rect.top) / (viewport * .55 + rect.height / 2), 0, 1);
    this.target = Math.max(this.target, progress);
    this.animate();
  };

  private animate(): void {
    cancelAnimationFrame(this.raf);
    if (this.reduced) { this.laid = this.planks.length; this.draw(); return; }
    const tick = (): void => {
      if (this.disposed) return;
      const goal = this.target * this.planks.length;
      if (this.laid < goal) {
        this.laid = Math.min(goal, this.laid + Math.max(2, this.planks.length / 55));
        this.draw();
        this.raf = requestAnimationFrame(tick);
      }
    };
    this.raf = requestAnimationFrame(tick);
  }

  private draw(): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    const dpr = this.canvas.width / this.width;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.fillStyle = '#e9e2dc';
    ctx.fillRect(0, 0, this.width, this.height);
    const image = this.image;
    const unit = clamp(this.width / 11, 30, 72), length = unit * 5.2;
    const total = Math.floor(this.laid);
    if (image && image.naturalWidth) {
      const [sx, sy, sw, sh] = this.cover(image);
      // Revealed planks: clip to the union of laid tiles in the rotated frame, then draw the photo once.
      ctx.save();
      ctx.translate(this.width / 2, this.height / 2);
      ctx.rotate(-Math.PI / 4);
      ctx.beginPath();
      for (let i = 0; i < Math.min(total, this.planks.length); i++) {
        const plank = this.planks[i];
        ctx.rect(plank.x, plank.y, length + .5, unit + .5);
      }
      ctx.rotate(Math.PI / 4);
      ctx.translate(-this.width / 2, -this.height / 2);
      ctx.clip();
      ctx.drawImage(image, sx, sy, sw, sh, 0, 0, this.width, this.height);
      ctx.restore();
      // The plank being laid right now fades in and casts a soft shadow.
      const current = this.planks[total];
      if (current && this.laid < this.planks.length) {
        const fade = this.laid - total;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(this.width / 2, this.height / 2);
        ctx.rotate(-Math.PI / 4);
        ctx.shadowColor = 'rgba(40,25,30,.35)';
        ctx.shadowBlur = 14 * (1 - fade);
        ctx.shadowOffsetY = 6 * (1 - fade);
        ctx.beginPath();
        ctx.rect(current.x, current.y - (1 - fade) * 10, length + .5, unit + .5);
        ctx.rotate(Math.PI / 4);
        ctx.translate(-this.width / 2, -this.height / 2);
        ctx.clip();
        ctx.drawImage(image, sx, sy, sw, sh, 0, -(1 - fade) * 10, this.width, this.height);
        ctx.restore();
      }
    }
    // Soft vignette so the stage reads as a photograph rather than a texture tile.
    const gradient = ctx.createRadialGradient(this.width * .5, this.height * .45, this.width * .2, this.width * .5, this.height * .5, this.width * .85);
    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    gradient.addColorStop(1, 'rgba(60,40,50,.28)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.abort.abort();
    this.observer?.disconnect();
    this.canvas.remove();
  }
}

export function mountHerringbone(section: HTMLElement | null): HerringboneSection | null {
  if (!section) return null;
  const grid = section.querySelector<HTMLElement>('.herringbone-shades');
  if (grid && !grid.childElementCount) {
    HERRINGBONE_SHADES.forEach((shade, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.shade = shade.code;
      button.setAttribute('aria-pressed', 'false');
      button.style.setProperty('--i', String(index));
      const img = document.createElement('img');
      img.src = sitePath(shade.image);
      img.alt = `${shade.code} ${shade.tone}`;
      img.loading = 'lazy';
      img.decoding = 'async';
      const code = document.createElement('strong');
      code.textContent = shade.code;
      const tone = document.createElement('span');
      tone.textContent = shade.tone;
      button.append(img, code, tone);
      grid.append(button);
    });
  }
  return new HerringboneSection(section);
}
