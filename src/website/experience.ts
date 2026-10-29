import { sitePath } from '../sitePath';
import { motionPreference } from './motionPreference';
import { COMPANY } from './catalog';
import { SHOWCASE_ITEMS } from './showcase';

/**
 * The "experience" run that follows the pinned floor story:
 *  1. #experience-intro  – a blank, pinned panel where three storytelling lines
 *     type themselves in as the visitor scrolls (time keeps them moving when idle)
 *  2. #featured          – three real project photo stories and an installation warranty story
 *  3. #trust             – animated rings / counters, partner marquee and ticking check marks
 */
const reduced = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export const INTRO_LINES = [
  { lead: 'ตั้งแต่ปี 2005', text: 'เราปูพื้นมาแล้วกว่า 175,900 ตารางเมตร' },
  { lead: 'จากคอนโดและบ้านพัก', text: 'ถึงโรงแรม ธนาคาร และโชว์รูมรถยนต์ชั้นนำ' },
  { lead: 'ทุกตารางเมตรคือความไว้วางใจ', text: 'ที่เราตั้งใจส่งมอบด้วยทีมช่างของเราเอง' },
];

export interface IntroDiagnostics { progress: number; typed: number; total: number; counter: number; cards: number }

export class ExperienceIntro {
  private readonly sticky: HTMLElement;
  private readonly lines: { row: HTMLElement; lead: HTMLElement; text: HTMLElement; total: number }[] = [];
  private readonly cards: HTMLElement[] = [];
  private readonly counter: HTMLElement | null;
  private readonly outro: HTMLElement | null;
  private readonly abort = new AbortController();
  private readonly observer: IntersectionObserver | null = null;
  private readonly total: number;
  private readonly reduced: boolean;
  private visible = false;
  private target = 0;
  private progress = 0;
  private raf = 0;
  private disposed = false;

  /** Scroll-progress timeline (fractions of the pinned distance). */
  private static readonly TYPE = { start: 0, end: .5 };
  private static readonly COUNT = { start: .1, end: .55 };
  private static readonly PILE = { start: .48, end: .9 };
  private static readonly OUTRO = { start: .86, end: 1 };

  constructor(private readonly section: HTMLElement) {
    this.reduced = reduced();
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
      this.lines.push({ row, lead, text, total: line.lead.length + line.text.length });
    });
    this.total = this.lines.reduce((sum, line) => sum + line.total, 0);
    this.counter = section.querySelector<HTMLElement>('.experience-counter strong');
    this.outro = section.querySelector<HTMLElement>('.experience-outro');
    const pile = section.querySelector<HTMLElement>('.experience-pile');
    if (pile) {
      SHOWCASE_ITEMS.forEach(item => {
        const card = document.createElement('figure');
        card.className = `experience-card is-${item.orientation}`;
        const img = document.createElement('img');
        img.src = sitePath(item.image);
        img.alt = '';
        img.loading = 'lazy';
        img.decoding = 'async';
        card.append(img);
        pile.append(card);
        this.cards.push(card);
      });
    }
    if (this.reduced) {
      section.classList.add('is-reduced');
      this.render(1);
      return;
    }
    const signal = this.abort.signal;
    window.addEventListener('scroll', this.onScroll, { passive: true, signal });
    window.addEventListener('resize', this.onScroll, { signal });
    if (typeof IntersectionObserver !== 'undefined') {
      this.observer = new IntersectionObserver(entries => {
        this.visible = entries.some(entry => entry.isIntersecting);
        if (this.visible) this.loop();
      }, { rootMargin: '15% 0px' });
      this.observer.observe(section);
    } else { this.visible = true; this.loop(); }
    this.onScroll();
    this.progress = this.target;
    this.render(this.progress);
  }

  get diagnostics(): IntroDiagnostics {
    return { progress: this.progress, typed: Math.round(this.typedFraction(this.progress) * this.total), total: this.total, counter: this.counterValue(this.progress), cards: this.cards.filter(card => card.classList.contains('is-in')).length };
  }

  /** Strictly scroll-linked: scrolling back up rewinds every part of the motion. */
  private onScroll = (): void => {
    const rect = this.section.getBoundingClientRect();
    const total = this.section.offsetHeight - this.sticky.clientHeight;
    this.target = total > 0 ? clamp(-rect.top / total, 0, 1) : 1;
    // Always ease towards the new target; the loop stops by itself once it arrives.
    this.loop();
  };

  private loop = (): void => {
    cancelAnimationFrame(this.raf);
    const tick = (): void => {
      if (this.disposed) return;
      // Short easing towards the scroll position keeps typing and card flight smooth without lagging behind.
      this.progress += (this.target - this.progress) * .16;
      if (Math.abs(this.target - this.progress) < .0005) this.progress = this.target;
      this.render(this.progress);
      if (this.progress !== this.target) this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  };

  private static phase(p: number, range: { start: number; end: number }): number {
    return clamp((p - range.start) / (range.end - range.start), 0, 1);
  }

  private typedFraction(p: number): number { return ExperienceIntro.phase(p, ExperienceIntro.TYPE); }

  private counterValue(p: number): number {
    const t = ExperienceIntro.phase(p, ExperienceIntro.COUNT);
    const eased = 1 - Math.pow(1 - t, 3);
    return Math.round(COMPANY.totalSqm * eased);
  }

  private render(p: number): void {
    // 1. Typing (reversible: text is a pure function of progress).
    let remaining = Math.round(this.typedFraction(p) * this.total);
    this.lines.forEach((line, index) => {
      const source = INTRO_LINES[index];
      const leadCount = clamp(remaining, 0, source.lead.length);
      const textCount = clamp(remaining - source.lead.length, 0, source.text.length);
      line.lead.textContent = source.lead.slice(0, leadCount);
      line.text.textContent = source.text.slice(0, textCount);
      line.row.classList.toggle('is-typing', remaining > 0 && remaining < line.total);
      line.row.classList.toggle('is-done', remaining >= line.total);
      line.row.classList.toggle('is-pending', remaining <= 0);
      remaining -= line.total;
    });
    // 2. Counter stops exactly at the catalogue figure.
    const count = this.counterValue(p);
    if (this.counter) this.counter.textContent = count.toLocaleString('th-TH');
    this.section.classList.toggle('is-counted', count >= COMPANY.totalSqm);
    // 3. Photo pile: each card flies in from its own side and settles into an overlapping stack.
    const pileT = ExperienceIntro.phase(p, ExperienceIntro.PILE);
    const n = this.cards.length;
    const width = this.sticky.clientWidth, height = this.sticky.clientHeight;
    const compact = width < 851;
    this.cards.forEach((card, index) => {
      const slot = 1 / Math.max(1, n);
      const t = clamp((pileT - index * slot * .82) / (slot * 1.6), 0, 1);
      const e = 1 - Math.pow(1 - t, 3);
      // Deterministic resting pose per card: a loose fan around the pile centre.
      const angle = (index / n) * Math.PI * 2 + .6;
      const radius = (compact ? .2 : .19) * Math.min(width, height) * (.5 + (index % 3) * .32);
      const restX = Math.cos(angle) * radius * (compact ? 1 : 1.25), restY = Math.sin(angle) * radius * .7;
      const restR = ((index * 37) % 23) - 11;
      const restS = compact ? .78 + (index % 4) * .06 : .9 + (index % 4) * .06;
      // Entrance: alternate from the left, right and below, further out than the viewport edge.
      const side = index % 3;
      const fromX = side === 0 ? -width * .7 : side === 1 ? width * .7 : restX * 2;
      const fromY = side === 2 ? height * .9 : restY - height * .25;
      const fromR = restR + (side === 1 ? 28 : -28);
      const x = fromX + (restX - fromX) * e, y = fromY + (restY - fromY) * e;
      const r = fromR + (restR - fromR) * e, s = .55 + (restS - .55) * e;
      card.style.transform = `translate(-50%,-50%) translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) rotate(${r.toFixed(2)}deg) scale(${s.toFixed(3)})`;
      card.style.opacity = String(clamp(e * 1.6, 0, 1));
      card.style.zIndex = String(10 + index);
      card.classList.toggle('is-in', t > .98);
    });
    this.section.style.setProperty('--pile', pileT.toFixed(4));
    // 4. Outro: copy recedes, the pile becomes the hero and the hand-off caption appears; the next section follows at once.
    const outroT = ExperienceIntro.phase(p, ExperienceIntro.OUTRO);
    this.section.style.setProperty('--outro', outroT.toFixed(4));
    if (this.outro) this.outro.style.opacity = String(outroT);
    this.section.style.setProperty('--p', p.toFixed(4));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.abort.abort();
    this.observer?.disconnect();
  }
}

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
}

/** Decorative, reversible photo motion. No animation frame runs while settled or offscreen. */
class FeaturedStoryMotion {
  private readonly abort = new AbortController();
  private reducedMotion = false;
  private readonly cards: HTMLElement[];
  private readonly observer: IntersectionObserver | null;
  private visible = false;
  private progress = 0;
  private target = 0;
  private raf = 0;
  private dirty = true;
  private disposed = false;

  constructor(private readonly section: HTMLElement, private readonly id: string, initialReduced: boolean) {
    this.cards = Array.from(section.querySelectorAll<HTMLElement>('.featured-photo'));
    const signal = this.abort.signal;
    window.addEventListener('scroll', this.onScroll, { passive: true, signal });
    window.addEventListener('resize', this.onScroll, { signal });
    document.addEventListener('visibilitychange', this.onVisibility, { signal });
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
    return { id: this.id, progress: this.progress, photos: this.cards.length, visible: this.visible, animating: this.raf !== 0 };
  }

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
    const p = this.progress;
    this.section.style.setProperty('--feature-progress', p.toFixed(4));
    this.cards.forEach((card, index) => {
      const t = clamp((p - index * .08) / .72, 0, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const x = index === 0 ? -10 * p : (index % 2 ? 1 : -1) * 24 * (1 - eased);
      const y = index === 0 ? -18 * p : 60 * (1 - eased) - index * 5 * p;
      const rotate = index === 0 ? -1.5 + 1.5 * p : (index % 2 ? 1 : -1) * (6 - 8 * eased);
      card.style.setProperty('--photo-x', `${x.toFixed(2)}px`);
      card.style.setProperty('--photo-y', `${y.toFixed(2)}px`);
      card.style.setProperty('--photo-angle', `${rotate.toFixed(2)}deg`);
      card.style.setProperty('--photo-drift', `${((.5 - p) * (index === 0 ? 18 : 10)).toFixed(2)}px`);
    });
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.abort.abort();
    this.observer?.disconnect();
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
      article.innerHTML = `<div class="featured-stage"><div class="featured-copy"><div class="featured-kicker"><span class="featured-index" aria-hidden="true">0${index + 1}</span><span class="featured-eyebrow">${item.eyebrow}</span></div><h3 id="featured-${item.id}-title">${item.title}</h3><p class="featured-subtitle">${item.subtitle}</p><p class="featured-description">${item.text}</p><div class="featured-chips">${item.chips.map(chip => `<span>${chip}</span>`).join('')}</div><div class="featured-scroll-note" aria-hidden="true"><span></span>เลื่อนชมเรื่องราวของพื้น</div></div><div class="featured-media featured-media-${item.photos.length}" aria-label="ภาพผลงาน ${item.title}">${this.photoMarkup(item.photos)}<div class="featured-photo-count" aria-hidden="true"><span>${String(item.photos.length).padStart(2, '0')}</span><span>มุมจากผลงานจริง</span></div></div><div class="featured-story-progress" aria-hidden="true"><span></span></div></div>`;
      host.append(article);
      this.featured.push(new FeaturedStoryMotion(article, item.id, this.motion.matches));
    });
    const warranty = document.createElement('section');
    warranty.className = 'featured-warranty';
    warranty.id = 'installation-warranty';
    warranty.setAttribute('aria-labelledby', 'installation-warranty-title');
    warranty.innerHTML = `<div class="featured-stage"><div class="featured-copy"><span class="featured-eyebrow">OUR CRAFT / OUR PROMISE</span><div class="warranty-years" aria-hidden="true"><strong>10</strong><span>ปี<br><small>INSTALLATION WARRANTY</small></span></div><h3 id="installation-warranty-title">รับประกันการติดตั้ง 10 ปี</h3><p class="warranty-promise">เปลี่ยนให้ฟรี<span aria-hidden="true">↗</span></p><p class="featured-description">เบื้องหลังพื้นที่สวย คือทีมช่างที่ลงมือทำจริง<br>และความตั้งใจดูแลงานที่ส่งมอบ</p><p class="warranty-detail">สอบถามรายละเอียดการรับประกันกับทีมงาน</p></div><div class="featured-media featured-media-3" aria-label="ภาพทีมช่างติดตั้งพื้น COOLPLAN">${this.photoMarkup(INSTALLATION_PHOTOS)}<div class="featured-photo-count" aria-hidden="true"><span>CPW</span><span>ทีมช่างของเรา</span></div></div><div class="featured-story-progress" aria-hidden="true"><span></span></div></div>`;
    host.append(warranty);
    this.featured.push(new FeaturedStoryMotion(warranty, 'warranty', this.motion.matches));
  }

  private photoMarkup(photos: FeaturedPhoto[]): string {
    return photos.map((photo, index) => `<figure class="featured-photo featured-photo-${index + 1}"><div class="featured-photo-image"><img src="${sitePath(photo.image)}" alt="${photo.alt}" loading="lazy" decoding="async" width="960" height="960" /></div><figcaption><span>${String(index + 1).padStart(2, '0')}</span>${photo.caption}</figcaption></figure>`).join('');
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
