import { COMPANY, PACKAGES } from './catalog';
import { motionPreference } from './motionPreference';

const clamp = (value: number): number => Math.max(0, Math.min(1, value));
const ease = (value: number): number => 1 - Math.pow(1 - clamp(value), 3);
const METRICS = [
  { value: COMPANY.totalSqm, unit: 'ตร.ม.', suffix: '+', label: 'พื้นที่ที่ส่งมอบ', detail: 'บ้าน คาเฟ่ และโครงการทั่วประเทศ', code: '01 / PROJECTS' },
  { value: COMPANY.years, unit: 'ปี', suffix: '', label: 'ประสบการณ์งานพื้น', detail: `ดูแลงานพื้นมาตั้งแต่ปี ${COMPANY.since}`, code: '02 / EXPERIENCE' },
  { value: PACKAGES[0].warrantyYears, unit: 'ปี', suffix: '', label: 'รับประกันการติดตั้ง', detail: 'ติดตั้งและดูแลด้วยทีมช่างของเรา', code: '03 / CARE' },
];

export interface IntroDiagnostics {
  progress: number; counter: number; active: number; panels: number; animating: boolean;
  rings: number[]; counters: number[];
}

/** A readable first frame and circular gauges, all driven reversibly by native scroll. */
export class ExperienceIntro {
  private readonly abort = new AbortController();
  private readonly sticky: HTMLElement;
  private readonly counter: HTMLElement;
  private readonly panels: HTMLElement[];
  private readonly arcs: SVGCircleElement[];
  private readonly values: HTMLElement[];
  private readonly labels: HTMLElement[];
  private readonly observer: IntersectionObserver | null;
  private progress = 0;
  private target = 0;
  private visible = false;
  private reduced = motionPreference.matches;
  private raf = 0;
  private disposed = false;

  constructor(private readonly section: HTMLElement) {
    this.sticky = section.querySelector<HTMLElement>('.experience-sticky')!;
    this.counter = section.querySelector<HTMLElement>('.experience-counter strong')!;
    const dashboard = section.querySelector<HTMLElement>('.experience-dashboard')!;
    dashboard.innerHTML = METRICS.map((metric, index) => `<article class="experience-stat" aria-label="${metric.label} ${metric.value.toLocaleString('th-TH')}${metric.suffix} ${metric.unit}">
      <span class="experience-stat-code">${metric.code}</span>
      <div class="experience-ring"><svg viewBox="0 0 240 240" aria-hidden="true"><defs><linearGradient id="experience-ring-${index}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d6bbff"/><stop offset=".55" stop-color="#c5a4f2"/><stop offset="1" stop-color="#f1a177"/></linearGradient></defs><circle class="experience-ring-orbit" cx="120" cy="120" r="116"/><circle class="experience-ring-track" cx="120" cy="120" r="103"/><circle class="experience-ring-arc" cx="120" cy="120" r="103" pathLength="100" stroke="url(#experience-ring-${index})"/><circle class="experience-ring-inner" cx="120" cy="120" r="90"/></svg><div class="experience-ring-value"><strong>0</strong><span>${metric.unit}</span></div><i class="experience-ring-dot" aria-hidden="true"></i></div>
      <div class="experience-stat-copy"><h3 class="experience-stat-label">${metric.label}</h3><p>${metric.detail}</p></div>
    </article>`).join('');
    this.panels = Array.from(dashboard.querySelectorAll<HTMLElement>('.experience-stat'));
    this.arcs = Array.from(dashboard.querySelectorAll<SVGCircleElement>('.experience-ring-arc'));
    this.values = Array.from(dashboard.querySelectorAll<HTMLElement>('.experience-ring-value strong'));
    this.labels = Array.from(section.querySelectorAll<HTMLElement>('.experience-dashboard-step'));
    const signal = this.abort.signal;
    window.addEventListener('scroll', this.onScroll, { passive: true, signal });
    window.addEventListener('resize', this.onScroll, { signal });
    document.addEventListener('visibilitychange', this.onVisibility, { signal });
    motionPreference.addEventListener('change', this.onPreference, { signal });
    this.observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
      this.visible = entries.some(entry => entry.isIntersecting);
      if (this.visible) this.onScroll();
      else this.stop();
    }, { rootMargin: '10% 0px' });
    this.observer?.observe(section);
    if (!this.observer) this.visible = true;
    section.classList.toggle('is-reduced', this.reduced);
    this.measure();
    this.progress = this.reduced ? 1 : this.target;
    this.render();
  }

  get diagnostics(): IntroDiagnostics {
    return { progress: this.progress, counter: this.count(), active: this.active(), panels: this.panels.length, animating: this.raf !== 0, rings: METRICS.map((_, index) => this.fill(index)), counters: METRICS.map((metric, index) => Math.round(metric.value * this.fill(index))) };
  }

  private count(): number { return Math.round(COMPANY.totalSqm * ease(this.progress / .82)); }
  private active(): number { return Math.min(2, Math.floor(this.progress * 3)); }
  private fill(index: number): number { return ease((this.progress * 3 - index) / .92); }

  private measure(): void {
    const rect = this.section.getBoundingClientRect();
    const travel = this.section.offsetHeight - this.sticky.offsetHeight;
    this.target = travel > 0 ? clamp(-rect.top / travel) : 1;
  }

  private stop(): void { cancelAnimationFrame(this.raf); this.raf = 0; }

  private onVisibility = (): void => {
    if (document.hidden) this.stop();
    else this.onScroll();
  };

  private onPreference = (): void => {
    this.reduced = motionPreference.matches;
    this.section.classList.toggle('is-reduced', this.reduced);
    this.stop();
    this.measure();
    this.progress = this.reduced ? 1 : this.target;
    this.render();
  };

  private onScroll = (): void => {
    if (this.disposed || this.reduced) return;
    this.measure();
    if (!this.visible || document.hidden || this.raf) return;
    this.raf = requestAnimationFrame(this.tick);
  };

  private tick = (): void => {
    this.raf = 0;
    if (this.disposed || this.reduced || !this.visible || document.hidden) return;
    this.progress += (this.target - this.progress) * .2;
    if (Math.abs(this.target - this.progress) < .0004) this.progress = this.target;
    this.render();
    if (this.progress !== this.target) this.raf = requestAnimationFrame(this.tick);
  };

  private render(): void {
    this.counter.textContent = this.count().toLocaleString('th-TH');
    const active = this.active();
    this.section.style.setProperty('--dashboard-progress', this.progress.toFixed(4));
    this.section.classList.toggle('is-counted', this.count() === COMPANY.totalSqm);
    this.panels.forEach((panel, index) => {
      const filled = this.fill(index);
      panel.classList.toggle('is-active', active === index);
      panel.classList.toggle('is-complete', filled >= 1);
      this.arcs[index].style.strokeDashoffset = String((1 - filled) * 100);
      this.values[index].textContent = `${Math.round(METRICS[index].value * filled).toLocaleString('th-TH')}${METRICS[index].suffix}`;
      panel.style.setProperty('--gauge-turn', `${filled}turn`);
      this.labels[index]?.classList.toggle('is-active', active === index);
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    this.abort.abort();
    this.observer?.disconnect();
  }
}
