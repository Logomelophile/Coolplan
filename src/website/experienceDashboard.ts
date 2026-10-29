import { COMPANY } from './catalog';
import { motionPreference } from './motionPreference';

const clamp = (value: number): number => Math.max(0, Math.min(1, value));

export interface IntroDiagnostics {
  progress: number; counter: number; active: number; panels: number; animating: boolean;
}

/** A readable first frame, with a reversible dashboard driven by native page scroll. */
export class ExperienceIntro {
  private readonly abort = new AbortController();
  private readonly sticky: HTMLElement;
  private readonly counter: HTMLElement;
  private readonly panels: HTMLElement[];
  private readonly meters: HTMLElement[];
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
    this.panels = Array.from(section.querySelectorAll<HTMLElement>('.experience-stat'));
    this.meters = this.panels.map(panel => panel.querySelector<HTMLElement>('.experience-stat-meter span')!);
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
    return { progress: this.progress, counter: this.count(), active: this.active(), panels: this.panels.length, animating: this.raf !== 0 };
  }

  private count(): number {
    const t = clamp(this.progress / .82);
    return Math.round(COMPANY.totalSqm * (1 - Math.pow(1 - t, 3)));
  }

  private active(): number { return Math.min(2, Math.floor(this.progress * 3)); }

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
      const filled = clamp(this.progress * 3 - index);
      panel.classList.toggle('is-active', active === index);
      panel.classList.toggle('is-complete', filled >= 1);
      this.meters[index].style.transform = `scaleX(${filled.toFixed(4)})`;
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
