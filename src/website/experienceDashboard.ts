import { COMPANY, PACKAGES } from './catalog';
import { motionPreference } from './motionPreference';
import { experienceFrame, EXPERIENCE_END_YEAR } from './experienceTimeline';

const METRICS = [
  { value: COMPANY.totalSqm, unit: 'ตร.ม.', suffix: '+', label: 'พื้นที่ที่ส่งมอบ', detail: 'บ้าน คาเฟ่ และโครงการทั่วประเทศ', code: '01 / PROJECTS' },
  { value: COMPANY.years, unit: 'ปี', suffix: '', label: 'ประสบการณ์งานพื้น', detail: `ดูแลงานพื้นมาตั้งแต่ปี ${COMPANY.since}`, code: '02 / EXPERIENCE' },
  { value: PACKAGES[0].warrantyYears, unit: 'ปี', suffix: '', label: 'รับประกันการติดตั้ง', detail: 'ติดตั้งและดูแลด้วยทีมช่างของเรา', code: '03 / CARE' },
];

export interface IntroDiagnostics {
  progress: number; counter: number; active: number; panels: number; animating: boolean;
  rings: number[]; counters: number[]; typed: number[]; year: number; timeline: number; checks: number[]; marqueeRunning: boolean;
}

/** Typing, years and dashboard share a reversible native-scroll timeline. */
export class ExperienceIntro {
  private readonly abort = new AbortController();
  private readonly sticky: HTMLElement;
  private readonly counter: HTMLElement;
  private readonly panels: HTMLElement[];
  private readonly arcs: SVGCircleElement[];
  private readonly values: HTMLElement[];
  private readonly heading: HTMLElement;
  private readonly typed: HTMLElement[];
  private readonly characters: string[][];
  private readonly openingHeadLength: number;
  private readonly yearPoint: HTMLElement;
  private readonly yearFill: HTMLElement;
  private readonly checks: HTMLElement[];
  private readonly projectButton: HTMLButtonElement;
  private readonly observer: IntersectionObserver | null;
  private readonly resizeObserver: ResizeObserver | null;
  private progress = 0;
  private target = 0;
  private visible = false;
  private reduced = motionPreference.matches;
  private raf = 0;
  private disposed = false;
  private projectsPaused = false;

  constructor(private readonly section: HTMLElement) {
    this.sticky = section.querySelector<HTMLElement>('.experience-sticky')!;
    this.counter = section.querySelector<HTMLElement>('.experience-counter strong')!;
    this.heading = section.querySelector<HTMLElement>('.experience-dashboard-heading')!;
    this.typed = Array.from(section.querySelectorAll<HTMLElement>('.experience-typed'));
    const segmenter = new Intl.Segmenter('th', { granularity: 'grapheme' });
    this.openingHeadLength = Array.from(segmenter.segment('เบื้องหลัง')).length;
    this.characters = Array.from(section.querySelectorAll<HTMLElement>('.experience-title-placeholder'), line => Array.from(segmenter.segment(line.textContent ?? ''), part => part.segment));
    this.yearFill = section.querySelector<HTMLElement>('.experience-years-fill')!;
    this.yearPoint = section.querySelector<HTMLElement>('.experience-years-point')!;
    section.querySelector('.experience-year-start span')!.textContent = String(COMPANY.since);
    section.querySelector('.experience-year-end span')!.textContent = String(EXPERIENCE_END_YEAR);
    this.checks = Array.from(section.querySelectorAll<HTMLElement>('.experience-checks li'));
    this.projectButton = section.querySelector<HTMLButtonElement>('.experience-projects-toggle')!;
    const projectTrack = section.querySelector<HTMLElement>('.experience-projects-track')!;
    const projects = [...COMPANY.partners.map(partner => `${partner.name} · ${partner.sqm.toLocaleString('th-TH')} ตร.ม.`), ...COMPANY.portfolio.map(project => `${project} ตร.ม.`)];
    for (let copy = 0; copy < 2; copy++) {
      const group = document.createElement('div');
      group.className = 'experience-projects-group';
      if (copy) group.setAttribute('aria-hidden', 'true');
      projects.forEach(project => { const span = document.createElement('span'); span.textContent = project; group.append(span); });
      projectTrack.append(group);
    }
    const dashboard = section.querySelector<HTMLElement>('.experience-dashboard')!;
    dashboard.innerHTML = METRICS.map((metric, index) => `<article class="experience-stat" aria-label="${metric.label} ${metric.value.toLocaleString('th-TH')}${metric.suffix} ${metric.unit}">
      <span class="experience-stat-code">${metric.code}</span>
      <div class="experience-ring"><svg viewBox="0 0 240 240" aria-hidden="true"><defs><linearGradient id="experience-ring-${index}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b492ca"/><stop offset=".55" stop-color="#87649f"/><stop offset="1" stop-color="#c6a5ba"/></linearGradient></defs><circle class="experience-ring-orbit" cx="120" cy="120" r="116"/><circle class="experience-ring-track" cx="120" cy="120" r="103"/><circle class="experience-ring-arc" cx="120" cy="120" r="103" pathLength="100" stroke="url(#experience-ring-${index})"/><circle class="experience-ring-inner" cx="120" cy="120" r="90"/></svg><div class="experience-ring-value"><strong>0</strong><span>${metric.unit}</span></div><i class="experience-ring-dot" aria-hidden="true"></i></div>
      <div class="experience-stat-copy"><h3 class="experience-stat-label">${metric.label}</h3><p>${metric.detail}</p></div>
    </article>`).join('');
    this.panels = Array.from(dashboard.querySelectorAll<HTMLElement>('.experience-stat'));
    this.arcs = Array.from(dashboard.querySelectorAll<SVGCircleElement>('.experience-ring-arc'));
    this.values = Array.from(dashboard.querySelectorAll<HTMLElement>('.experience-ring-value strong'));
    const signal = this.abort.signal;
    window.addEventListener('scroll', this.onScroll, { passive: true, signal });
    window.addEventListener('resize', this.onResize, { signal });
    document.addEventListener('visibilitychange', this.onVisibility, { signal });
    motionPreference.addEventListener('change', this.onPreference, { signal });
    this.projectButton.addEventListener('click', () => { this.projectsPaused = !this.projectsPaused; this.syncProjects(); }, { signal });
    this.observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
      this.visible = entries.some(entry => entry.isIntersecting);
      if (this.visible) this.onScroll();
      else this.stop();
      this.syncProjects();
    }, { rootMargin: '10% 0px' });
    this.observer?.observe(section);
    if (!this.observer) this.visible = true;
    this.resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(this.onResize);
    this.resizeObserver?.observe(this.heading);
    this.resizeObserver?.observe(this.sticky);
    section.classList.toggle('is-reduced', this.reduced);
    this.measureLayout();
    this.measure();
    this.progress = this.reduced ? 1 : this.target;
    this.render();
  }

  get diagnostics(): IntroDiagnostics {
    const frame = experienceFrame(this.progress);
    return { progress: this.progress, counter: frame.counter, active: frame.active, panels: this.panels.length, animating: this.raf !== 0, rings: frame.rings, counters: METRICS.map((metric, index) => Math.round(metric.value * frame.rings[index])), typed: [frame.head, frame.sub], year: frame.year, timeline: frame.timeline, checks: frame.checks, marqueeRunning: this.projectsRunning };
  }

  private get projectsRunning(): boolean { return this.visible && !document.hidden && !this.reduced && !this.projectsPaused && experienceFrame(this.progress).marquee > .05; }

  private syncProjects(): void {
    this.section.classList.toggle('is-projects-running', this.projectsRunning);
    this.projectButton.setAttribute('aria-pressed', String(this.projectsPaused));
    this.projectButton.setAttribute('aria-label', this.projectsPaused ? 'เลื่อนชื่อโครงการต่อ' : 'พักแถบชื่อโครงการ');
    this.projectButton.textContent = this.projectsPaused ? '▶' : 'Ⅱ';
  }

  private measureLayout(): void {
    const top = parseFloat(getComputedStyle(this.sticky).paddingTop) || 0;
    this.section.style.setProperty('--heading-center-shift', `${Math.max(0, (this.sticky.clientHeight - this.heading.offsetHeight) / 2 - top)}px`);
  }

  private onResize = (): void => { if (!this.disposed) { this.measureLayout(); this.onScroll(); } };

  private measure(): void {
    const rect = this.section.getBoundingClientRect();
    const travel = this.section.offsetHeight - this.sticky.offsetHeight;
    this.target = travel > 0 ? Math.max(0, Math.min(1, -rect.top / travel)) : 1;
  }

  private stop(): void { cancelAnimationFrame(this.raf); this.raf = 0; }

  private onVisibility = (): void => {
    if (document.hidden) this.stop();
    else this.onScroll();
    this.syncProjects();
  };

  private onPreference = (): void => {
    this.reduced = motionPreference.matches;
    this.section.classList.toggle('is-reduced', this.reduced);
    this.stop();
    this.measureLayout();
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
    const frame = experienceFrame(this.progress);
    this.counter.textContent = frame.counter.toLocaleString('th-TH');
    this.section.style.setProperty('--dashboard-progress', this.progress.toFixed(4));
    this.section.style.setProperty('--header-dock', frame.dock.toFixed(4));
    this.section.style.setProperty('--timeline-reveal', frame.timelineReveal.toFixed(4));
    this.section.style.setProperty('--marquee-reveal', frame.marquee.toFixed(4));
    this.section.classList.toggle('is-counted', frame.counter === COMPANY.totalSqm);
    [frame.head, frame.sub].forEach((fraction, index) => {
      const count = Math.max(index === 0 ? this.openingHeadLength : 0, Math.round(this.characters[index].length * fraction));
      this.typed[index].textContent = this.characters[index].slice(0, count).join('');
      this.typed[index].classList.toggle('is-typing', fraction > 0 && fraction < 1);
    });
    this.yearFill.style.transform = `scaleX(${frame.timeline.toFixed(5)})`;
    this.yearPoint.style.left = `${frame.timeline * 100}%`;
    this.yearPoint.querySelector('b')!.textContent = String(frame.year);
    this.yearPoint.querySelector<HTMLElement>('b')!.style.opacity = frame.timeline > .005 && frame.timeline < .995 ? '1' : '0';
    this.panels.forEach((panel, index) => {
      const filled = frame.rings[index];
      panel.style.setProperty('--panel-reveal', frame.panels[index].toFixed(4));
      panel.classList.toggle('is-active', frame.active === index);
      panel.classList.toggle('is-complete', filled >= 1);
      this.arcs[index].style.strokeDashoffset = String((1 - filled) * 100);
      this.values[index].textContent = `${Math.round(METRICS[index].value * filled).toLocaleString('th-TH')}${METRICS[index].suffix}`;
      panel.style.setProperty('--gauge-turn', `${filled}turn`);
    });
    this.checks.forEach((check, index) => {
      check.style.setProperty('--check-reveal', frame.checks[index].toFixed(4));
      check.querySelector<SVGPathElement>('path')!.style.strokeDashoffset = String(24 * (1 - frame.checks[index]));
      check.classList.toggle('is-checked', frame.checks[index] > .6);
    });
    this.syncProjects();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    this.abort.abort();
    this.observer?.disconnect();
    this.resizeObserver?.disconnect();
    this.section.classList.remove('is-projects-running');
  }
}
