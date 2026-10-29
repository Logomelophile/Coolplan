import { sitePath } from '../sitePath';
import { icon } from './shared';

/**
 * "ผลงานจริง" showcase: a horizontal gallery of framed project photographs that
 * glides left as the visitor scrolls (desktop: pinned viewport, scroll-linked;
 * touch / reduced motion: a native snap scroller). Motion is all transform-only
 * and eased with a per-frame lerp so it feels weighty rather than jittery.
 */
export interface ShowcaseItem {
  image: string;
  title: string;
  detail: string;
  orientation: 'portrait' | 'landscape';
}

export const SHOWCASE_ITEMS: ShowcaseItem[] = [
  { image: '/website/showcase/cafe-herringbone.webp', title: 'คาเฟ่ลายก้างปลา', detail: 'มุมนั่งริมกระจก · ลายก้างปลากับแสงธรรมชาติ', orientation: 'portrait' },
  { image: '/website/showcase/office-meeting.webp', title: 'Office · ห้องประชุม', detail: 'พื้นที่ทำงานและห้องประชุม · พื้นลายก้างปลา', orientation: 'landscape' },
  { image: '/website/showcase/narasiri-light.webp', title: 'บ้านเดี่ยว @ Narasiri', detail: 'ห้องนั่งเล่น · SPC ลายก้างปลาโทนอ่อน', orientation: 'landscape' },
  { image: '/website/showcase/cafe-herringbone-top.webp', title: 'คาเฟ่เดียวกัน · อีกมุม', detail: 'มุมสูงเห็นแนวปูพื้นและพื้นที่นั่ง', orientation: 'portrait' },
  { image: '/website/showcase/office-lounge.webp', title: 'Office · มุมพักผ่อน', detail: 'อีกมุมของพื้นที่ทำงานเดียวกัน', orientation: 'landscape' },
  { image: '/website/showcase/narasiri-dark.webp', title: 'บ้านเดี่ยว @ Narasiri', detail: 'มุมรับแขก · ลายก้างปลาโทนเข้ม', orientation: 'landscape' },
  { image: '/website/showcase/chevron-hall.webp', title: 'ทางเดินลายเชฟรอน', detail: 'โถงทางเดินโทนโอ๊คอ่อน · ลายเชฟรอนรับแสงธรรมชาติ', orientation: 'portrait' },
  { image: '/website/showcase/pethotel-herringbone.webp', title: 'Pet Hotel @ พัฒนาการ', detail: 'ห้องพักสัตว์เลี้ยง · ก้างปลาโทนโอ๊ค ทำความสะอาดง่าย', orientation: 'landscape' },
  { image: '/website/showcase/stair-railing.webp', title: 'Staircase Flooring', detail: 'หุ้มขั้นบันไดพร้อมจมูกบันไดเข้าชุด', orientation: 'landscape' },
  { image: '/website/showcase/narasiri-stairs.webp', title: 'บันไดโค้ง @ Narasiri', detail: 'ขั้นบันไดโค้งตามราวเหล็กดัด', orientation: 'landscape' },
];

export interface ShowcaseDiagnostics {
  mode: 'pinned' | 'scroller';
  progress: number;
  active: number;
  frames: number;
  trackX: number;
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export class Showcase {
  private readonly track: HTMLElement;
  private readonly sticky: HTMLElement;
  private readonly frames: HTMLElement[] = [];
  private readonly abort = new AbortController();
  private readonly observer: IntersectionObserver | null = null;
  private readonly mode: 'pinned' | 'scroller';
  private readonly reduced: boolean;
  private raf = 0;
  private inView = false;
  private progress = 0;
  private current = 0;
  private target = 0;
  private overflow = 0;
  private lastInput = 0;
  private active = 0;
  private disposed = false;

  constructor(private readonly section: HTMLElement) {
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse = typeof matchMedia === 'function' && matchMedia('(hover: none), (pointer: coarse)').matches;
    this.reduced = reduced;
    this.mode = reduced || coarse ? 'scroller' : 'pinned';
    this.sticky = section.querySelector<HTMLElement>('.showcase-sticky')!;
    this.track = section.querySelector<HTMLElement>('.showcase-track')!;
    section.classList.add(this.mode === 'pinned' ? 'is-pinned' : 'is-scroller');
    section.classList.toggle('is-reduced', reduced);
    this.build();
    const signal = this.abort.signal;
    section.querySelector('#showcase-prev')?.addEventListener('click', () => this.step(-1), { signal });
    section.querySelector('#showcase-next')?.addEventListener('click', () => this.step(1), { signal });
    if (this.mode === 'pinned') {
      window.addEventListener('scroll', this.onScroll, { passive: true, signal });
      window.addEventListener('resize', this.measure, { signal });
      if (typeof IntersectionObserver !== 'undefined') {
        this.observer = new IntersectionObserver(entries => {
          this.inView = entries.some(entry => entry.isIntersecting);
          if (this.inView) this.loop();
        }, { rootMargin: '20% 0px' });
        this.observer.observe(section);
      } else { this.inView = true; this.loop(); }
      this.measure();
      this.onScroll();
    } else {
      this.track.addEventListener('scroll', this.onTrackScroll, { passive: true, signal });
      this.onTrackScroll();
    }
    this.frames.forEach(frame => frame.classList.add('is-ready'));
  }

  get diagnostics(): ShowcaseDiagnostics {
    return { mode: this.mode, progress: this.progress, active: this.active, frames: this.frames.length, trackX: this.current };
  }

  private build(): void {
    this.track.replaceChildren();
    SHOWCASE_ITEMS.forEach((item, index) => {
      const frame = document.createElement('figure');
      frame.className = `showcase-frame is-${item.orientation}`;
      frame.style.setProperty('--i', String(index));
      frame.setAttribute('role', 'listitem');
      const mat = document.createElement('div');
      mat.className = 'showcase-mat';
      const img = document.createElement('img');
      img.src = sitePath(item.image);
      img.alt = `${item.title} · ${item.detail}`;
      img.loading = index < 3 ? 'eager' : 'lazy';
      img.decoding = 'async';
      mat.append(img);
      const caption = document.createElement('figcaption');
      const number = document.createElement('span');
      number.className = 'showcase-number';
      number.textContent = String(index + 1).padStart(2, '0');
      const title = document.createElement('strong');
      title.textContent = item.title;
      const detail = document.createElement('span');
      detail.className = 'showcase-detail';
      detail.textContent = item.detail;
      caption.append(number, title, detail);
      frame.append(mat, caption);
      this.track.append(frame);
      this.frames.push(frame);
    });
    const counter = this.section.querySelector('#showcase-counter');
    if (counter) counter.textContent = `01 / ${String(this.frames.length).padStart(2, '0')}`;
  }

  /** Pinned mode: the section is as tall as the viewport plus the track overflow, so one scrolled pixel moves the track one pixel. */
  private measure = (): void => {
    if (this.disposed) return;
    const padding = parseFloat(getComputedStyle(this.track).paddingLeft) || 0;
    this.overflow = Math.max(0, this.track.scrollWidth - this.sticky.clientWidth + padding);
    this.section.style.setProperty('--showcase-scroll', `${Math.round(this.overflow)}px`);
    this.onScroll();
  };

  private onScroll = (): void => {
    const rect = this.section.getBoundingClientRect();
    const total = this.section.offsetHeight - this.sticky.clientHeight;
    this.progress = total > 0 ? clamp(-rect.top / total, 0, 1) : 0;
    this.target = -this.progress * this.overflow;
    this.lastInput = performance.now();
    if (this.inView) this.loop();
  };

  private loop = (): void => {
    cancelAnimationFrame(this.raf);
    const tick = (): void => {
      if (this.disposed) return;
      const now = performance.now();
      // Weighty follow: ease towards the scroll target; a gentle breathing drift keeps it alive when idle.
      const idle = clamp((now - this.lastInput - 900) / 1500, 0, 1);
      const drift = this.reduced ? 0 : Math.sin(now / 1700) * 10 * idle;
      const goal = this.target + drift;
      this.current += (goal - this.current) * .11;
      if (Math.abs(goal - this.current) < .05) this.current = goal;
      this.apply();
      const settled = Math.abs(goal - this.current) < .06 && idle >= 1 && this.reduced;
      if (this.inView && !settled) this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  };

  private apply(): void {
    this.track.style.transform = `translate3d(${this.current.toFixed(2)}px,0,0)`;
    this.section.style.setProperty('--p', this.progress.toFixed(4));
    const center = this.sticky.clientWidth / 2;
    let best = 0, bestDistance = Infinity;
    this.frames.forEach((frame, index) => {
      const rect = frame.getBoundingClientRect();
      const d = (rect.left + rect.width / 2 - center) / Math.max(1, this.sticky.clientWidth);
      frame.style.setProperty('--d', clamp(d, -1.2, 1.2).toFixed(4));
      if (Math.abs(d) < bestDistance) { bestDistance = Math.abs(d); best = index; }
    });
    this.setActive(best);
    const bar = this.section.querySelector<HTMLElement>('#showcase-progress-bar');
    if (bar) bar.style.transform = `scaleX(${this.progress.toFixed(4)})`;
  }

  private onTrackScroll = (): void => {
    const max = Math.max(1, this.track.scrollWidth - this.track.clientWidth);
    this.progress = clamp(this.track.scrollLeft / max, 0, 1);
    this.section.style.setProperty('--p', this.progress.toFixed(4));
    const bar = this.section.querySelector<HTMLElement>('#showcase-progress-bar');
    if (bar) bar.style.transform = `scaleX(${this.progress.toFixed(4)})`;
    const center = this.track.scrollLeft + this.track.clientWidth / 2;
    let best = 0, bestDistance = Infinity;
    this.frames.forEach((frame, index) => {
      const d = Math.abs(frame.offsetLeft + frame.offsetWidth / 2 - center);
      if (d < bestDistance) { bestDistance = d; best = index; }
    });
    this.setActive(best);
  };

  private setActive(index: number): void {
    if (index === this.active && this.frames[index]?.classList.contains('is-active')) return;
    this.active = index;
    this.frames.forEach((frame, i) => frame.classList.toggle('is-active', i === index));
    const counter = this.section.querySelector('#showcase-counter');
    if (counter) counter.textContent = `${String(index + 1).padStart(2, '0')} / ${String(this.frames.length).padStart(2, '0')}`;
  }

  /** Previous/next controls: scroll by one frame in either mode. */
  private step(direction: 1 | -1): void {
    const next = clamp(this.active + direction, 0, this.frames.length - 1);
    const frame = this.frames[next];
    if (!frame) return;
    if (this.mode === 'scroller') {
      this.track.scrollTo({ left: frame.offsetLeft - (this.track.clientWidth - frame.offsetWidth) / 2, behavior: this.reduced ? 'auto' : 'smooth' });
      return;
    }
    const frameCenter = frame.offsetLeft + frame.offsetWidth / 2;
    const wanted = clamp((frameCenter - this.sticky.clientWidth / 2) / Math.max(1, this.overflow), 0, 1);
    const total = this.section.offsetHeight - this.sticky.clientHeight;
    const top = this.section.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + wanted * total, behavior: this.reduced ? 'auto' : 'smooth' });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.abort.abort();
    this.observer?.disconnect();
  }
}

export function mountShowcase(section: HTMLElement | null): Showcase | null {
  if (!section) return null;
  const prev = section.querySelector('#showcase-prev'), next = section.querySelector('#showcase-next');
  if (prev && !prev.innerHTML.trim()) prev.innerHTML = icon('arrow');
  if (next && !next.innerHTML.trim()) next.innerHTML = icon('arrow');
  return new Showcase(section);
}
