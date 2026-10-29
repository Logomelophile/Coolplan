import { sitePath } from '../sitePath';
import { motionPreference } from './motionPreference';
import { COMPANY } from './catalog';
import { ExperienceIntro, type IntroDiagnostics } from './experienceDashboard';
export { ExperienceIntro } from './experienceDashboard';
export type { IntroDiagnostics } from './experienceDashboard';

/**
 * The "experience" run that follows the pinned floor story:
 *  1. #experience-intro  – two readable lines and a dashboard linked to page scroll
 *  2. #featured          – three real project photo stories and an installation warranty story
 *  3. #trust             – animated rings / counters, partner marquee and ticking check marks
 */
const reduced = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

interface FeaturedPhoto { image: string; alt: string; caption: string }
interface FeaturedProject {
  id: string; eyebrow: string; title: string; subtitle: string; text: string; chips: string[]; photos: FeaturedPhoto[];
}

export const FEATURED: FeaturedProject[] = [
  {
    id: 'cafe', eyebrow: 'CAFÉ / HERRINGBONE', title: 'คาเฟ่ลายก้างปลา',
    subtitle: 'จังหวะของไม้ ในทุกมุมของร้าน',
    text: 'แสงริมกระจก โต๊ะไม้ และพื้นก้างปลาสีน้ำตาล สองมุมในคาเฟ่เดียวกันที่เล่าบรรยากาศของร้าน ผ่านจังหวะลายปูที่มองเห็นได้ทั้งในระดับสายตาและจากมุมสูง',
    chips: ['พื้นที่คาเฟ่', 'ลายก้างปลา', 'ภาพผลงานจริง'],
    photos: [
      { image: '/website/showcase/cafe-herringbone.webp', alt: 'มุมที่นั่งริมกระจกในคาเฟ่ พื้นลายก้างปลาสีน้ำตาลและเก้าอี้ไม้', caption: 'มุมที่นั่งริมกระจก' },
      { image: '/website/showcase/cafe-herringbone-top.webp', alt: 'ภาพจากมุมสูงของคาเฟ่เดียวกัน เห็นจังหวะพื้นก้างปลาระหว่างโต๊ะและเก้าอี้', caption: 'จังหวะลายปูจากมุมสูง' },
    ],
  },
  {
    id: 'office', eyebrow: 'OFFICE / WORKSPACE', title: 'Office',
    subtitle: 'พื้นเดียวกัน เชื่อมทุกมุมทำงาน',
    text: 'จากโต๊ะประชุมถึงมุมนั่งพัก พื้นลายไม้ช่วยเชื่อมพื้นที่ทำงานเข้าด้วยกัน เก็บสองมุมของออฟฟิศเดียวกันไว้ให้เห็นทั้งภาพรวมและบรรยากาศที่ต่างออกไปในแต่ละมุม',
    chips: ['พื้นที่ทำงาน', 'ห้องประชุม', 'มุมนั่งพัก'],
    photos: [
      { image: '/website/showcase/office-meeting.webp', alt: 'ห้องประชุมออฟฟิศ ตู้บิลต์อินสีน้ำเงินและพื้นลายไม้', caption: 'มุมห้องประชุม' },
      { image: '/website/showcase/office-lounge.webp', alt: 'มุมนั่งพักอีกด้านในออฟฟิศเดียวกันกับห้องประชุม', caption: 'อีกมุมของออฟฟิศเดียวกัน' },
    ],
  },
  {
    id: 'narasiri', eyebrow: 'RESIDENTIAL / NARASIRI', title: 'บ้านเดี่ยว @ Narasiri',
    subtitle: 'รายละเอียดที่ต่อเนื่อง จากห้องถึงบันได',
    text: 'พื้นก้างปลาโทนอ่อน โทนเข้ม และรายละเอียดบันไดในบ้านเดี่ยว Narasiri ภาพจากหน้างานที่ชวนมองพื้นใกล้ขึ้น ทั้งลายไม้ แนวปู และความรู้สึกของแต่ละพื้นที่',
    chips: ['บ้านพักอาศัย', 'พื้นสองโทน', 'รายละเอียดบันได'],
    photos: [
      { image: '/website/showcase/narasiri-light.webp', alt: 'พื้นลายก้างปลาโทนอ่อนในบ้านเดี่ยวโครงการ Narasiri', caption: 'ลายก้างปลาโทนอ่อน' },
      { image: '/website/showcase/narasiri-dark.webp', alt: 'พื้นลายก้างปลาโทนเข้มริมหน้าต่างในบ้านเดี่ยว Narasiri', caption: 'ลายก้างปลาโทนเข้ม' },
      { image: '/website/showcase/narasiri-stairs.webp', alt: 'รายละเอียดขั้นบันไดลายไม้และราวบันไดในบ้านเดี่ยว Narasiri', caption: 'รายละเอียดบันได' },
    ],
  },
];

const INSTALLATION_PHOTOS: FeaturedPhoto[] = [
  { image: '/website/showcase/installation-prep.webp', alt: 'ช่าง COOLPLAN กำลังเตรียมและติดตั้งพื้นในหน้างานจริง', caption: 'เตรียมหน้างาน' },
  { image: '/website/showcase/installation-team.webp', alt: 'ทีมช่างกำลังทำงานติดตั้งพื้นลายไม้', caption: 'ลงมือด้วยทีมช่าง' },
  { image: '/website/showcase/installation-room.webp', alt: 'ภาพงานติดตั้งพื้นภายในห้องโดยทีมช่าง COOLPLAN', caption: 'ใส่ใจในทุกพื้นที่' },
];

export interface FeaturedDiagnostics {
  id: string; progress: number; photos: number; visible: boolean; animating: boolean;
  selectedPhoto: number | null; dragging: boolean; offsets: { x: number; y: number }[];
}

interface PhotoOffset { x: number; y: number }
interface PhotoDrag { index: number; pointerId: number; startX: number; startY: number; origin: PhotoOffset }

/** Scroll motion and a bounded, draggable photo desk. Frames stop when settled or offscreen. */
class FeaturedStoryMotion {
  private readonly abort = new AbortController();
  private reducedMotion = false;
  private readonly cards: HTMLElement[];
  private readonly media: HTMLElement;
  private readonly offsets: PhotoOffset[];
  private readonly resizeObserver: ResizeObserver | null;
  private readonly observer: IntersectionObserver | null;
  private selectedPhoto: number | null = null;
  private drag: PhotoDrag | null = null;
  private visible = false;
  private progress = 0;
  private target = 0;
  private raf = 0;
  private dirty = true;
  private disposed = false;

  constructor(private readonly section: HTMLElement, private readonly id: string, initialReduced: boolean) {
    this.cards = Array.from(section.querySelectorAll<HTMLElement>('.featured-photo'));
    this.media = section.querySelector<HTMLElement>('.featured-media')!;
    this.offsets = this.cards.map(() => ({ x: 0, y: 0 }));
    const signal = this.abort.signal;
    window.addEventListener('scroll', this.onScroll, { passive: true, signal });
    window.addEventListener('resize', this.onResize, { signal });
    document.addEventListener('visibilitychange', this.onVisibility, { signal });
    this.cards.forEach((card, index) => {
      card.addEventListener('pointerdown', event => this.startDrag(event, index), { signal });
      card.addEventListener('pointermove', this.moveDrag, { signal });
      card.addEventListener('pointerup', this.endDrag, { signal });
      card.addEventListener('pointercancel', this.endDrag, { signal });
      card.addEventListener('lostpointercapture', this.endDrag, { signal });
      card.addEventListener('focus', () => this.selectPhoto(index), { signal });
      card.addEventListener('keydown', event => this.moveWithKeyboard(event, index), { signal });
      card.addEventListener('dragstart', event => event.preventDefault(), { signal });
    });
    this.resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => this.render());
    this.resizeObserver?.observe(this.media);
    this.cards.forEach(card => this.resizeObserver?.observe(card));
    this.observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
      this.visible = entries.some(entry => entry.isIntersecting);
      if (this.visible) {
        this.section.classList.add('is-visible');
        this.onScroll();
      } else {
        cancelAnimationFrame(this.raf);
        this.raf = 0;
      }
    }, { rootMargin: '10% 0px', threshold: 0 });
    this.observer?.observe(section);
    if (!this.observer) { this.visible = true; section.classList.add('is-visible'); }
    this.setReducedMotion(initialReduced);
  }

  get diagnostics(): FeaturedDiagnostics {
    return { id: this.id, progress: this.progress, photos: this.cards.length, visible: this.visible, animating: this.raf !== 0, selectedPhoto: this.selectedPhoto, dragging: this.drag !== null, offsets: this.offsets.map(offset => ({ ...offset })) };
  }

  private selectPhoto(index: number): void {
    this.selectedPhoto = index;
    this.cards.forEach((card, i) => {
      card.classList.toggle('is-selected', i === index);
      card.setAttribute('aria-pressed', String(i === index));
      card.style.zIndex = String(i === index ? 20 : i + 1);
    });
  }

  private startDrag(event: PointerEvent, index: number): void {
    if (!event.isPrimary || event.button !== 0) return;
    this.selectPhoto(index);
    // A touch tap raises a photograph; native touch scrolling remains available.
    if (event.pointerType === 'touch') return;
    event.preventDefault();
    const card = this.cards[index];
    card.focus({ preventScroll: true });
    this.drag = { index, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin: { ...this.offsets[index] } };
    card.classList.add('is-dragging');
    card.setPointerCapture(event.pointerId);
  }

  private moveDrag = (event: PointerEvent): void => {
    const drag = this.drag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    this.offsets[drag.index] = { x: drag.origin.x + event.clientX - drag.startX, y: drag.origin.y + event.clientY - drag.startY };
    this.render();
  };

  private endDrag = (event: PointerEvent): void => {
    const drag = this.drag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    this.drag = null;
    const card = this.cards[drag.index];
    card.classList.remove('is-dragging');
    if (card.hasPointerCapture(event.pointerId)) card.releasePointerCapture(event.pointerId);
  };

  private moveWithKeyboard(event: KeyboardEvent, index: number): void {
    const direction: Record<string, PhotoOffset> = { ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 } };
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.selectPhoto(index);
      return;
    }
    if (event.key !== 'Home' && !direction[event.key]) return;
    event.preventDefault();
    this.selectPhoto(index);
    if (event.key === 'Home') this.offsets[index] = { x: 0, y: 0 };
    else {
      const step = event.shiftKey ? 30 : 10;
      this.offsets[index].x += direction[event.key].x * step;
      this.offsets[index].y += direction[event.key].y * step;
    }
    this.render();
  }

  private onResize = (): void => { this.render(); this.onScroll(); };

  setReducedMotion(value: boolean): void {
    if (this.disposed) return;
    this.reducedMotion = value;
    this.section.classList.toggle('is-reduced', value);
    if (value) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.section.classList.add('is-visible');
      this.progress = this.target = 1;
      this.render();
    } else this.onScroll();
  }

  private onVisibility = (): void => {
    if (document.hidden) { cancelAnimationFrame(this.raf); this.raf = 0; }
    else this.onScroll();
  };

  private onScroll = (): void => {
    this.dirty = true;
    if (this.disposed || this.reducedMotion || !this.visible || document.hidden || this.raf) return;
    this.raf = requestAnimationFrame(this.tick);
  };

  private tick = (): void => {
    this.raf = 0;
    if (this.disposed || !this.visible || document.hidden || this.reducedMotion) return;
    if (this.dirty) {
      const rect = this.section.getBoundingClientRect();
      const travel = this.section.offsetHeight - window.innerHeight;
      this.target = travel > 0 ? clamp(-rect.top / travel, 0, 1) : clamp((window.innerHeight - rect.top) / (window.innerHeight + rect.height), 0, 1);
      this.dirty = false;
    }
    this.progress += (this.target - this.progress) * .18;
    if (Math.abs(this.target - this.progress) < .0005) this.progress = this.target;
    this.render();
    if (this.progress !== this.target) this.raf = requestAnimationFrame(this.tick);
  };

  private render(): void {
    if (this.disposed) return;
    const p = this.progress;
    const compact = window.innerWidth <= 850;
    const width = this.media.clientWidth, height = this.media.clientHeight;
    this.media.style.setProperty('--media-height', `${height}px`);
    this.section.style.setProperty('--feature-progress', p.toFixed(4));
    this.cards.forEach((card, index) => {
      const t = clamp((p - index * .08) / .72, 0, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      let x = this.reducedMotion ? 0 : (index === 0 ? -10 * p : (index % 2 ? 1 : -1) * 24 * (1 - eased)) * (compact ? .3 : 1);
      let y = this.reducedMotion ? 0 : (index === 0 ? -18 * p : 60 * (1 - eased) - index * 5 * p) * (compact ? .25 : 1);
      const rotate = this.reducedMotion ? 0 : (index === 0 ? -1.5 + 1.5 * p : (index % 2 ? 1 : -1) * (6 - 8 * eased)) * (compact ? .3 : 1);
      // Account for rotation when bounding each photo, including its caption.
      const radians = rotate * Math.PI / 180;
      const extraX = (Math.abs(card.offsetWidth * Math.cos(radians)) + Math.abs(card.offsetHeight * Math.sin(radians)) - card.offsetWidth) / 2;
      const extraY = (Math.abs(card.offsetHeight * Math.cos(radians)) + Math.abs(card.offsetWidth * Math.sin(radians)) - card.offsetHeight) / 2;
      const minX = 8 + extraX - card.offsetLeft, maxX = width - 8 - extraX - card.offsetLeft - card.offsetWidth;
      const minY = 8 + extraY - card.offsetTop, maxY = height - 44 - extraY - card.offsetTop - card.offsetHeight;
      const bound = (value: number, min: number, max: number): number => max >= min ? clamp(value, min, max) : (min + max) / 2;
      x = bound(x, minX, maxX);
      y = bound(y, minY, maxY);
      this.offsets[index].x = bound(x + this.offsets[index].x, minX, maxX) - x;
      this.offsets[index].y = bound(y + this.offsets[index].y, minY, maxY) - y;
      card.style.setProperty('--photo-x', `${x.toFixed(2)}px`);
      card.style.setProperty('--photo-y', `${y.toFixed(2)}px`);
      card.style.setProperty('--photo-angle', `${rotate.toFixed(2)}deg`);
      card.style.setProperty('--drag-x', `${(this.offsets[index].x + (this.reducedMotion ? x : 0)).toFixed(2)}px`);
      card.style.setProperty('--drag-y', `${(this.offsets[index].y + (this.reducedMotion ? y : 0)).toFixed(2)}px`);
      card.style.setProperty('--photo-drift', `${((.5 - p) * (index === 0 ? 18 : 10)).toFixed(2)}px`);
    });
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.abort.abort();
    this.observer?.disconnect();
    this.resizeObserver?.disconnect();
    if (this.drag) {
      const card = this.cards[this.drag.index];
      card.classList.remove('is-dragging');
      if (card.hasPointerCapture(this.drag.pointerId)) card.releasePointerCapture(this.drag.pointerId);
      this.drag = null;
    }
  }
}

export interface TrustDiagnostics { revealed: boolean; counters: number[] }

export class Experience {
  readonly intro: ExperienceIntro | null;
  private readonly abort = new AbortController();
  private readonly motion = motionPreference;
  private readonly observers: IntersectionObserver[] = [];
  private readonly featured: FeaturedStoryMotion[] = [];
  private counters: number[] = [];
  private revealed = false;
  private disposed = false;

  constructor(private readonly root: ParentNode) {
    const intro = root.querySelector<HTMLElement>('#experience-intro');
    this.intro = intro ? new ExperienceIntro(intro) : null;
    this.buildFeatured();
    // One preference event updates every story together, including offscreen stories.
    this.motion.addEventListener('change', this.syncFeaturedMotion, { signal: this.abort.signal });
    this.buildTrust();
  }

  private syncFeaturedMotion = (): void => {
    const value = this.motion.matches;
    this.featured.forEach(story => story.setReducedMotion(value));
  };

  get diagnostics(): { intro: IntroDiagnostics | null; featured: FeaturedDiagnostics[]; trust: TrustDiagnostics } {
    return { intro: this.intro?.diagnostics ?? null, featured: this.featured.map(story => story.diagnostics), trust: { revealed: this.revealed, counters: [...this.counters] } };
  }

  private observe(target: Element, onVisible: () => void, threshold = .3): void {
    if (reduced() || typeof IntersectionObserver === 'undefined') { onVisible(); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { onVisible(); observer.disconnect(); }
    }, { threshold });
    observer.observe(target);
    this.observers.push(observer);
  }

  private buildFeatured(): void {
    const host = this.root.querySelector<HTMLElement>('#featured .featured-list');
    if (!host) return;
    FEATURED.forEach((item, index) => {
      const article = document.createElement('article');
      article.className = `featured-item featured-${item.id}`;
      article.id = `project-${item.id}`;
      article.setAttribute('aria-labelledby', `featured-${item.id}-title`);
      article.style.setProperty('--i', String(index));
      article.innerHTML = `<div class="featured-stage"><div class="featured-copy"><div class="featured-kicker"><span class="featured-index" aria-hidden="true">0${index + 1}</span><span class="featured-eyebrow">${item.eyebrow}</span></div><h3 id="featured-${item.id}-title">${item.title}</h3><p class="featured-subtitle">${item.subtitle}</p><p class="featured-description">${item.text}</p><div class="featured-chips">${item.chips.map(chip => `<span>${chip}</span>`).join('')}</div><div class="featured-scroll-note" aria-hidden="true"><span></span>เลื่อนชมเรื่องราวของพื้น</div></div><div class="featured-media featured-media-${item.photos.length}" aria-label="ภาพผลงาน ${item.title}">${this.photoMarkup(item.photos)}<div class="featured-photo-count" aria-hidden="true"><span>${String(item.photos.length).padStart(2, '0')}</span><span>คลิกค้างเพื่อลากรูป</span></div></div><div class="featured-story-progress" aria-hidden="true"><span></span></div></div>`;
      host.append(article);
      this.featured.push(new FeaturedStoryMotion(article, item.id, this.motion.matches));
    });
    const warranty = document.createElement('section');
    warranty.className = 'featured-warranty';
    warranty.id = 'installation-warranty';
    warranty.setAttribute('aria-labelledby', 'installation-warranty-title');
    warranty.innerHTML = `<div class="featured-stage"><div class="featured-copy"><span class="featured-eyebrow">OUR CRAFT / OUR PROMISE</span><div class="warranty-years" aria-hidden="true"><strong>10</strong><span>ปี<br><small>INSTALLATION WARRANTY</small></span></div><h3 id="installation-warranty-title">รับประกันการติดตั้ง 10 ปี</h3><p class="warranty-promise">เปลี่ยนให้ฟรี<span aria-hidden="true">↗</span></p><p class="featured-description">เบื้องหลังพื้นที่สวย คือทีมช่างที่ลงมือทำจริง<br>และความตั้งใจดูแลงานที่ส่งมอบ</p><p class="warranty-detail">สอบถามรายละเอียดการรับประกันกับทีมงาน</p></div><div class="featured-media featured-media-3" aria-label="ภาพทีมช่างติดตั้งพื้น COOLPLAN">${this.photoMarkup(INSTALLATION_PHOTOS)}<div class="featured-photo-count" aria-hidden="true"><span>CPW</span><span>คลิกค้างเพื่อลากรูป</span></div></div><div class="featured-story-progress" aria-hidden="true"><span></span></div></div>`;
    host.append(warranty);
    this.featured.push(new FeaturedStoryMotion(warranty, 'warranty', this.motion.matches));
  }

  private photoMarkup(photos: FeaturedPhoto[]): string {
    return photos.map((photo, index) => `<figure class="featured-photo featured-photo-${index + 1}" tabindex="0" role="button" aria-pressed="false" aria-label="${photo.caption} · คลิกค้างเพื่อลากรูป ใช้ปุ่มลูกศรเพื่อขยับ และ Home เพื่อคืนตำแหน่ง"><div class="featured-photo-image"><img src="${sitePath(photo.image)}" alt="${photo.alt}" loading="lazy" decoding="async" draggable="false" width="960" height="960" /></div><figcaption><span>${String(index + 1).padStart(2, '0')}</span>${photo.caption}</figcaption></figure>`).join('');
  }

  private buildTrust(): void {
    const section = this.root.querySelector<HTMLElement>('#trust');
    if (!section) return;
    const rings = section.querySelectorAll<HTMLElement>('.trust-ring');
    this.counters = Array.from(rings, () => 0);
    const marquee = section.querySelector<HTMLElement>('.trust-marquee-track');
    if (marquee) {
      const items = [...COMPANY.partners.map(partner => `${partner.name} · ${partner.sqm.toLocaleString('th-TH')} ตร.ม.`), ...COMPANY.portfolio.map(item => `${item} ตร.ม.`)];
      marquee.innerHTML = [...items, ...items].map(text => `<span>${text}</span>`).join('');
    }
    this.observe(section, () => {
      this.revealed = true;
      section.classList.add('is-visible');
      rings.forEach((ring, index) => this.animateRing(ring, index));
      section.querySelectorAll<HTMLElement>('.trust-check').forEach((check, index) => {
        check.style.setProperty('--i', String(index));
        setTimeout(() => check.classList.add('is-checked'), reduced() ? 0 : 500 + index * 260);
      });
    }, .25);
  }

  /** Counts a ring's number up and sweeps its arc, eased, over ~1.6 s. */
  private animateRing(ring: HTMLElement, index: number): void {
    const target = Number(ring.dataset.value ?? 0);
    const fill = Number(ring.dataset.fill ?? 1);
    const number = ring.querySelector<HTMLElement>('strong');
    const arc = ring.querySelector<SVGCircleElement>('circle.trust-ring-arc');
    const circumference = arc ? 2 * Math.PI * Number(arc.getAttribute('r')) : 0;
    const format = (value: number): string => `${Math.round(value).toLocaleString('th-TH')}${ring.dataset.suffix ?? ''}`;
    if (reduced()) {
      if (number) number.textContent = format(target);
      if (arc) arc.style.strokeDashoffset = String(circumference * (1 - fill));
      this.counters[index] = target;
      return;
    }
    const started = performance.now() + index * 180;
    const duration = 1600;
    const step = (now: number): void => {
      if (this.disposed) return;
      const t = clamp((now - started) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      if (number) number.textContent = format(target * eased);
      if (arc) arc.style.strokeDashoffset = String(circumference * (1 - fill * eased));
      this.counters[index] = target * eased;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.intro?.dispose();
    this.featured.forEach(story => story.dispose());
    this.abort.abort();
    this.observers.forEach(observer => observer.disconnect());
  }
}

export function mountExperience(root: ParentNode = document): Experience | null {
  if (!root.querySelector('#experience-intro') && !root.querySelector('#featured') && !root.querySelector('#trust')) return null;
  return new Experience(root);
}
