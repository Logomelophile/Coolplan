import { sitePath } from '../sitePath';
import { COMPANY } from './catalog';

/**
 * The "experience" run that follows the pinned floor story:
 *  1. #experience-intro  – a blank, pinned panel where three storytelling lines
 *     type themselves in as the visitor scrolls (time keeps them moving when idle)
 *  2. #featured          – two spotlight projects, copy on the left, photo revealed on the right
 *  3. #trust             – animated rings / counters, partner marquee and ticking check marks
 */
const reduced = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export const INTRO_LINES = [
  { lead: 'ตั้งแต่ปี 2005', text: 'เราปูพื้นมาแล้วกว่า 175,900 ตารางเมตร' },
  { lead: 'จากคอนโดและบ้านพัก', text: 'ถึงโรงแรม ธนาคาร และโชว์รูมรถยนต์ชั้นนำ' },
  { lead: 'ทุกตารางเมตรคือความไว้วางใจ', text: 'ที่เราตั้งใจส่งมอบด้วยทีมช่างของเราเอง' },
];

export interface IntroDiagnostics { progress: number; typed: number; total: number }

export class ExperienceIntro {
  private readonly sticky: HTMLElement;
  private readonly lines: { lead: HTMLElement; text: HTMLElement; total: number }[] = [];
  private readonly counter: HTMLElement | null;
  private readonly abort = new AbortController();
  private readonly observer: IntersectionObserver | null = null;
  private readonly total: number;
  private visible = false;
  private visibleSince = 0;
  private progress = 0;
  private typed = -1;
  private raf = 0;
  private disposed = false;

  constructor(private readonly section: HTMLElement) {
    this.sticky = section.querySelector<HTMLElement>('.experience-sticky')!;
    const list = section.querySelector<HTMLElement>('.experience-lines')!;
    INTRO_LINES.forEach((line, index) => {
      const row = document.createElement('p');
      row.className = 'experience-line';
      row.style.setProperty('--i', String(index));
      const lead = document.createElement('span');
      lead.className = 'experience-lead';
      const text = document.createElement('span');
      text.className = 'experience-text';
      row.append(lead, text);
      list.append(row);
      this.lines.push({ lead, text, total: line.lead.length + line.text.length });
    });
    this.total = this.lines.reduce((sum, line) => sum + line.total, 0);
    this.counter = section.querySelector<HTMLElement>('.experience-counter strong');
    if (reduced()) {
      section.classList.add('is-reduced');
      this.render(1);
      return;
    }
    const signal = this.abort.signal;
    window.addEventListener('scroll', this.onScroll, { passive: true, signal });
    if (typeof IntersectionObserver !== 'undefined') {
      this.observer = new IntersectionObserver(entries => {
        this.visible = entries.some(entry => entry.isIntersecting);
        if (this.visible) { this.visibleSince = this.visibleSince || performance.now(); this.loop(); }
      }, { rootMargin: '10% 0px' });
      this.observer.observe(section);
    } else { this.visible = true; this.loop(); }
    this.onScroll();
  }

  get diagnostics(): IntroDiagnostics { return { progress: this.progress, typed: this.typed, total: this.total }; }

  private onScroll = (): void => {
    const rect = this.section.getBoundingClientRect();
    const total = this.section.offsetHeight - this.sticky.clientHeight;
    const scrolled = total > 0 ? clamp(-rect.top / total, 0, 1) : 1;
    this.progress = Math.max(this.progress, scrolled);
    if (this.visible) this.loop();
  };

  private loop = (): void => {
    cancelAnimationFrame(this.raf);
    const tick = (): void => {
      if (this.disposed) return;
      // Idle visitors still get the story: time contributes once the panel has been in view a moment.
      const idle = this.visibleSince ? clamp((performance.now() - this.visibleSince - 600) / 7000, 0, 1) : 0;
      const target = Math.max(this.progress, idle);
      const typedTarget = Math.round(target * this.total);
      if (typedTarget > this.typed) {
        this.typed = Math.min(typedTarget, this.typed + Math.max(1, Math.round(this.total / 160)));
        this.render(this.typed / this.total);
        this.raf = requestAnimationFrame(tick);
      } else if (this.visible && this.typed < this.total) this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  };

  private render(fraction: number): void {
    let remaining = Math.round(fraction * this.total);
    this.lines.forEach((line, index) => {
      const source = INTRO_LINES[index];
      const leadCount = clamp(remaining, 0, source.lead.length);
      const textCount = clamp(remaining - source.lead.length, 0, source.text.length);
      line.lead.textContent = source.lead.slice(0, leadCount);
      line.text.textContent = source.text.slice(0, textCount);
      const row = line.lead.parentElement!;
      row.classList.toggle('is-typing', remaining > 0 && remaining < line.total);
      row.classList.toggle('is-done', remaining >= line.total);
      row.classList.toggle('is-pending', remaining <= 0);
      remaining -= line.total;
    });
    this.section.style.setProperty('--p', fraction.toFixed(4));
    if (this.counter) this.counter.textContent = Math.round(COMPANY.totalSqm * clamp(fraction * 1.4, 0, 1)).toLocaleString('th-TH');
    this.typed = Math.round(fraction * this.total);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.abort.abort();
    this.observer?.disconnect();
  }
}

export const FEATURED = [
  {
    eyebrow: 'RESIDENTIAL · 2026 EDITION',
    title: 'บ้านเดี่ยว @ Narasiri',
    text: 'ห้องนั่งเล่นและห้องรับแขกปูลายก้างปลา SPC สองโทน ให้พื้นเป็นงานศิลปะที่เข้ากับผนังบัวและกระจกบานสูง ทีมช่างเราวางแนวก้างปลาให้วิ่งเข้าหาแสงจากสวน พร้อมเก็บงานรอยต่อประตูและบันไดโค้งในชุดเดียวกัน',
    chips: ['SPC Herringbone 5 มม.', 'สองโทนในบ้านเดียว', 'เก็บงานบันไดโค้ง'],
    image: '/website/showcase/narasiri-light.webp',
    alt: 'ห้องนั่งเล่นบ้านเดี่ยวโครงการ Narasiri ปูพื้นลายก้างปลาโทนอ่อน',
  },
  {
    eyebrow: 'STAIRCASE FLOORING',
    title: 'บันไดที่สวยเท่าพื้นห้อง',
    text: 'งานบันไดคือจุดที่พื้นส่วนใหญ่มักสะดุด เราหุ้มลูกตั้ง ลูกนอน และจมูกบันไดด้วยวัสดุชุดเดียวกับพื้นห้อง ทั้งบ้านพัก โครงการ และโรงแรม ให้สายตาไหลต่อเนื่องจากชั้นล่างถึงชั้นบนโดยไม่เห็นรอยต่อ',
    chips: ['จมูกบันไดเข้าชุด', 'ลูกตั้ง–ลูกนอนชุดเดียวกัน', 'บ้าน คอนโด โรงแรม'],
    image: '/website/showcase/stair-railing.webp',
    alt: 'บันไดหุ้มพื้น SPC ลายไม้พร้อมจมูกบันไดเข้าชุด',
  },
];

export interface TrustDiagnostics { revealed: boolean; counters: number[] }

export class Experience {
  readonly intro: ExperienceIntro | null;
  private readonly abort = new AbortController();
  private readonly observers: IntersectionObserver[] = [];
  private counters: number[] = [];
  private revealed = false;
  private disposed = false;

  constructor(private readonly root: ParentNode) {
    const intro = root.querySelector<HTMLElement>('#experience-intro');
    this.intro = intro ? new ExperienceIntro(intro) : null;
    this.buildFeatured();
    this.buildTrust();
  }

  get diagnostics(): { intro: IntroDiagnostics | null; trust: TrustDiagnostics } {
    return { intro: this.intro?.diagnostics ?? null, trust: { revealed: this.revealed, counters: [...this.counters] } };
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
      article.className = 'featured-item';
      article.style.setProperty('--i', String(index));
      article.innerHTML = `<div class="featured-copy"><span class="featured-eyebrow">${item.eyebrow}</span><h3>${item.title}</h3><p>${item.text}</p><div class="featured-chips">${item.chips.map(chip => `<span>${chip}</span>`).join('')}</div><span class="featured-index">0${index + 1}</span></div><figure class="featured-media"><div class="featured-frame"><img src="${sitePath(item.image)}" alt="${item.alt}" loading="lazy" decoding="async" /></div></figure>`;
      host.append(article);
      this.observe(article, () => article.classList.add('is-visible'), .25);
    });
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
    this.abort.abort();
    this.observers.forEach(observer => observer.disconnect());
  }
}

export function mountExperience(root: ParentNode = document): Experience | null {
  if (!root.querySelector('#experience-intro') && !root.querySelector('#featured') && !root.querySelector('#trust')) return null;
  return new Experience(root);
}
