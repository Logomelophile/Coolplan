import { COMPANY, PACKAGES } from './catalog';
import { motionPreference } from './motionPreference';
import { experienceFrame, EXPERIENCE_END_YEAR } from './experienceTimeline';
import { sitePath } from '../sitePath';

const METRICS = [
  { value: COMPANY.years, unit: 'ปี', suffix: '', label: 'ประสบการณ์งานพื้น', detail: `ดูแลงานพื้นมาตั้งแต่ปี ${COMPANY.since}`, code: '01 / EXPERIENCE' },
  { value: COMPANY.totalSqm, unit: 'ตร.ม.', suffix: '+', label: 'พื้นที่ที่ส่งมอบ', detail: 'บ้านจัดสรร คอนโด และพื้นที่ของคุณ', code: '02 / PROJECTS' },
  { value: PACKAGES[0].warrantyYears, unit: 'ปี', suffix: '', label: 'รับประกันการติดตั้ง', detail: 'ติดตั้งและดูแลด้วยทีมช่างของเรา', code: '03 / CARE' },
];
const MILESTONES = [
  { position: 14, seek: .48, label: 'ประสบการณ์', title: 'จากประสบการณ์ สู่ทุกหน้างาน', text: 'ตั้งแต่ปี 2005 เราดูแลงานพื้นทั้งการเลือกวัสดุ เตรียมพื้นที่ และติดตั้งด้วยทีมช่างของเราเอง เก็บรายละเอียดจากหน้างานจริงในทุกขั้นตอน' },
  { position: 48, seek: .7, label: 'บ้านจัดสรรและคอนโด', title: 'เบื้องหลังพื้นที่อยู่อาศัย', text: 'จากบ้านเดี่ยว Narasiri สู่โครงการคอนโดอย่าง Origin และ Regent Home ประสบการณ์ที่ต่อเนื่องทั้งงานโครงการและรายละเอียดภายในบ้าน' },
  { position: 82, seek: .94, label: 'ลูกค้ารายย่อย', title: 'ใส่ใจในพื้นที่ของคุณ', text: 'บ้านพัก คาเฟ่ และออฟฟิศ ทุกพื้นที่เริ่มจากการพูดคุย เลือกลายที่เหมาะกับการใช้งาน และดูแลตั้งแต่ติดตั้งจนส่งมอบ' },
];
const PHOTOS = [
  { file: 'installation-team', caption: 'ทีมช่างระหว่างติดตั้ง', x: .04, y: .05, angle: -6 },
  { file: 'installation-prep', caption: 'เตรียมพื้นจากหน้างานจริง', x: .65, y: .24, angle: 5 },
  { file: 'installation-room', caption: 'ติดตั้งพื้นภายในห้อง', x: .36, y: .58, angle: -3 },
  { file: 'narasiri-light', caption: 'บ้านเดี่ยว @ Narasiri', x: .12, y: .6, angle: -5 },
  { file: 'narasiri-dark', caption: 'อีกมุมของบ้าน Narasiri', x: .9, y: .04, angle: 6 },
  { file: 'narasiri-stairs', caption: 'บันไดบ้าน @ Narasiri', x: .4, y: .4, angle: -2 },
  { file: 'cafe-herringbone', caption: 'คาเฟ่ลายก้างปลา', x: .25, y: .16, angle: -4 },
  { file: 'cafe-herringbone-top', caption: 'อีกมุมของคาเฟ่เดียวกัน', x: .8, y: .08, angle: 5 },
  { file: 'office-meeting', caption: 'Office · ห้องประชุม', x: .68, y: .65, angle: 3 },
];

export interface IntroDiagnostics {
  progress: number; counter: number; active: number; panels: number; animating: boolean;
  rings: number[]; counters: number[]; typed: number[]; year: number; timeline: number; checks: number[]; marqueeRunning: boolean;
  milestones: number[]; photos: number[]; archived: number[]; proof: number;
  mode: 'scroll' | 'flow'; reduced: boolean;
}

/** Typing, years and dashboard share a reversible native-scroll timeline. */
export class ExperienceIntro {
  private readonly abort = new AbortController();
  private readonly sticky: HTMLElement;
  private readonly scroll: HTMLElement;
  private readonly evidence: HTMLElement;
  private readonly counter: HTMLElement;
  private readonly panels: HTMLElement[];
  private readonly arcs: SVGCircleElement[];
  private readonly values: HTMLElement[];
  private readonly heading: HTMLElement;
  private readonly typed: HTMLElement[];
  private readonly characters: string[][];
  private readonly openingHeadLength: number;
  private readonly glyphs: HTMLSpanElement[];
  private readonly typedPrefixes: Text[];
  private readonly typedCounts = [-1, -1];
  private readonly yearPoint: HTMLElement;
  private readonly yearFill: HTMLElement;
  private readonly checks: HTMLElement[];
  private readonly projectButton: HTMLButtonElement;
  private readonly milestones: HTMLButtonElement[];
  private readonly stories: HTMLElement[];
  private readonly pile: HTMLElement;
  private readonly photos: HTMLElement[];
  private readonly era: HTMLElement;
  private readonly tokens: HTMLElement;
  private readonly panelHosts: HTMLElement[];
  private readonly photoHosts: HTMLElement[];
  private eraPose = { startX: 0, startY: 0, endX: 0, endY: 0, scale: 1 };
  private tokenPoses: { panel: { x: number; y: number; endX: number; endY: number; scale: number }; photo: { x: number; y: number; endX: number; endY: number; scale: number } }[] = [];
  private readonly observer: IntersectionObserver | null;
  private readonly resizeObserver: ResizeObserver | null;
  private progress = 0;
  private proofProgress = 0;
  private proofTarget = 0;
  private target = 0;
  private visible = false;
  private reduced = motionPreference.matches;
  private raf = 0;
  private disposed = false;
  private projectsPaused = false;
  private flow = false;

  constructor(private readonly section: HTMLElement) {
    this.sticky = section.querySelector<HTMLElement>('.experience-sticky')!;
    this.scroll = section.querySelector<HTMLElement>('.experience-scroll')!;
    this.evidence = section.querySelector<HTMLElement>('.experience-evidence')!;
    this.counter = section.querySelector<HTMLElement>('.experience-counter strong')!;
    this.heading = section.querySelector<HTMLElement>('.experience-dashboard-heading')!;
    this.typed = Array.from(section.querySelectorAll<HTMLElement>('.experience-typed'));
    const segmenter = new Intl.Segmenter('th', { granularity: 'grapheme' });
    this.openingHeadLength = Array.from(segmenter.segment('เบื้องหลัง')).length;
    this.characters = Array.from(section.querySelectorAll<HTMLElement>('.experience-title-placeholder'), line => Array.from(segmenter.segment(line.textContent ?? ''), part => part.segment));
    this.typedPrefixes = this.typed.map(() => document.createTextNode(''));
    this.glyphs = this.typed.map((line, index) => {
      const glyph = document.createElement('span');
      glyph.className = 'experience-typing-glyph';
      line.replaceChildren(this.typedPrefixes[index], glyph);
      return glyph;
    });
    this.yearFill = section.querySelector<HTMLElement>('.experience-years-fill')!;
    this.yearPoint = section.querySelector<HTMLElement>('.experience-years-point')!;
    this.era = section.querySelector<HTMLElement>('.experience-era')!;
    this.era.querySelector('strong')!.textContent = String(COMPANY.since);
    section.querySelector('.experience-year-end span')!.textContent = String(EXPERIENCE_END_YEAR);
    const yearsTrack = section.querySelector<HTMLElement>('.experience-years-track')!;
    this.milestones = MILESTONES.map((milestone, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'experience-milestone-node';
      button.style.left = `${milestone.position}%`;
      button.innerHTML = `<i aria-hidden="true"></i><span>${milestone.label}</span>`;
      button.setAttribute('aria-label', `ดูเรื่องราว ${milestone.label}`);
      button.addEventListener('click', () => this.seekMilestone(index), { signal: this.abort.signal });
      yearsTrack.append(button);
      return button;
    });
    const story = section.querySelector<HTMLElement>('.experience-milestone-content')!;
    story.innerHTML = MILESTONES.map((milestone, index) => `<article class="experience-milestone-copy"><span>0${index + 1} / ${milestone.label}</span><h3>${milestone.title}</h3><p>${milestone.text}</p></article>`).join('');
    this.stories = Array.from(story.children) as HTMLElement[];
    this.pile = section.querySelector<HTMLElement>('.experience-photo-pile')!;
    this.pile.innerHTML = PHOTOS.map((photo, index) => `<figure class="experience-pile-photo" data-story="${Math.floor(index / 3)}"><img src="${sitePath(`/website/showcase/${photo.file}.webp`)}" alt="${photo.caption}" loading="lazy" decoding="async" width="960" height="720"/><figcaption>${photo.caption}</figcaption></figure>`).join('');
    this.photos = Array.from(this.pile.children) as HTMLElement[];
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
      <div class="experience-ring"><svg viewBox="0 0 240 240" aria-hidden="true"><defs><linearGradient id="experience-ring-${index}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4b084"/><stop offset=".55" stop-color="#ed854a"/><stop offset="1" stop-color="#db692c"/></linearGradient></defs><circle class="experience-ring-orbit" cx="120" cy="120" r="116"/><circle class="experience-ring-track" cx="120" cy="120" r="103"/><circle class="experience-ring-arc" cx="120" cy="120" r="103" pathLength="100" stroke="url(#experience-ring-${index})"/><circle class="experience-ring-inner" cx="120" cy="120" r="90"/></svg><div class="experience-ring-value"><strong>0</strong><span>${metric.unit}</span></div><i class="experience-ring-dot" aria-hidden="true"></i></div>
      <div class="experience-stat-copy"><h3 class="experience-stat-label">${metric.label}</h3><p>${metric.detail}</p></div>
    </article>`).join('');
    this.panels = Array.from(dashboard.querySelectorAll<HTMLElement>('.experience-stat'));
    this.arcs = Array.from(dashboard.querySelectorAll<SVGCircleElement>('.experience-ring-arc'));
    this.values = Array.from(dashboard.querySelectorAll<HTMLElement>('.experience-ring-value strong'));
    this.tokens = document.createElement('div');
    this.tokens.className = 'experience-story-tokens';
    this.panelHosts = [];
    this.photoHosts = [];
    METRICS.forEach((_, index) => {
      const token = document.createElement('div');
      token.className = 'experience-story-token';
      token.dataset.storyToken = String(index);
      const panel = document.createElement('div'), photo = document.createElement('div');
      panel.className = 'experience-token-dashboard';
      photo.className = 'experience-token-photos';
      token.append(panel, photo);
      this.tokens.append(token);
      this.panelHosts.push(panel);
      this.photoHosts.push(photo);
    });
    section.querySelector('.experience-scene')!.append(this.tokens);
    this.syncTokenLayout();
    const signal = this.abort.signal;
    window.addEventListener('scroll', this.onScroll, { passive: true, signal });
    window.addEventListener('resize', this.onResize, { signal });
    document.addEventListener('visibilitychange', this.onVisibility, { signal });
    motionPreference.addEventListener('change', this.onPreference, { signal });
    this.projectButton.addEventListener('click', () => { this.projectsPaused = !this.projectsPaused; this.syncProjects(); }, { signal });
    section.querySelector('.experience-motion-replay')?.addEventListener('click', () => this.scroll.scrollIntoView({ behavior: this.reduced ? 'auto' : 'smooth', block: 'start' }), { signal });
    this.observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
      this.visible = entries.some(entry => entry.isIntersecting);
      if (this.visible) { this.pile.querySelectorAll<HTMLImageElement>('img').forEach(image => { image.loading = 'eager'; }); this.onScroll(); }
      else this.stop();
      this.syncProjects();
    }, { rootMargin: '10% 0px' });
    this.observer?.observe(section);
    if (!this.observer) this.visible = true;
    this.resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(this.onResize);
    this.resizeObserver?.observe(this.heading);
    this.resizeObserver?.observe(this.sticky);
    this.resizeObserver?.observe(this.pile);
    section.classList.toggle('is-reduced', this.reduced);
    this.measureLayout();
    this.measure();
    this.progress = this.reduced ? 1 : this.target;
    this.proofProgress = this.reduced ? 1 : this.proofTarget;
    this.render();
  }

  get diagnostics(): IntroDiagnostics {
    const frame = experienceFrame(this.progress, this.proofProgress);
    return { progress: this.progress, counter: frame.counter, active: frame.active, panels: this.panels.length, animating: this.raf !== 0, rings: frame.rings, counters: METRICS.map((metric, index) => Math.round(metric.value * frame.rings[index])), typed: [frame.head, frame.sub], year: frame.year, timeline: frame.timeline, checks: frame.checks, marqueeRunning: this.projectsRunning, milestones: frame.milestones, photos: frame.photos, archived: frame.archived, proof: this.proofProgress, mode: this.flow ? 'flow' : 'scroll', reduced: this.reduced };
  }

  private get projectsRunning(): boolean { return this.visible && !document.hidden && !this.reduced && !this.projectsPaused && experienceFrame(this.progress, this.proofProgress).marquee > .05; }

  private syncProjects(): void {
    this.section.classList.toggle('is-projects-running', this.projectsRunning);
    this.projectButton.setAttribute('aria-pressed', String(this.projectsPaused));
    this.projectButton.setAttribute('aria-label', this.projectsPaused ? 'เลื่อนชื่อโครงการต่อ' : 'พักแถบชื่อโครงการ');
    this.projectButton.textContent = this.projectsPaused ? '▶' : 'Ⅱ';
  }

  private measureLayout(): void {
    const top = parseFloat(getComputedStyle(this.sticky).paddingTop) || 0;
    this.section.style.setProperty('--heading-center-shift', `${Math.max(0, this.sticky.clientHeight * .32 - this.heading.offsetHeight / 2 - top)}px`);
    this.section.style.setProperty('--pile-height', `${this.pile.clientHeight}px`);
    const stage = this.sticky.getBoundingClientRect();
    // The line has its own entrance translate; docking targets use its final layout position.
    const lineEntranceY = parseFloat(getComputedStyle(this.section.querySelector('.experience-years')!).translate.split(' ')[1]) || 0;
    const anchor = this.section.querySelector('.experience-era-anchor')!.getBoundingClientRect();
    const fontSize = parseFloat(getComputedStyle(this.era.querySelector('strong')!).fontSize);
    this.eraPose = { startX: this.sticky.clientWidth * .5, startY: this.sticky.clientHeight * .54, endX: anchor.left + anchor.width / 2 - stage.left, endY: anchor.top + anchor.height / 2 - stage.top - lineEntranceY, scale: 10 / fontSize };
    const scene = this.section.querySelector('.experience-scene')!.getBoundingClientRect();
    const dashboard = this.section.querySelector('.experience-dashboard')!.getBoundingClientRect();
    const pile = this.pile.getBoundingClientRect();
    const compact = this.sticky.clientWidth <= 850 || this.sticky.clientHeight <= 620;
    const dockRing = compact ? 32 : 44, dockPhoto = compact ? 38 : 60;
    const labelBottom = Math.max(...this.milestones.map(node => {
      const label = node.querySelector<HTMLElement>('span')!;
      const entranceY = parseFloat(getComputedStyle(label).translate.split(' ')[1]) || 0;
      return label.getBoundingClientRect().bottom - entranceY;
    })) - lineEntranceY - scene.top;
    const dockTop = labelBottom + 8;
    this.tokenPoses = this.panelHosts.map((host, index) => {
      const node = index < 2 ? this.milestones[index + 1].getBoundingClientRect() : this.section.querySelector('.experience-year-end')!.getBoundingClientRect();
      const center = Math.max(34, Math.min(this.sticky.clientWidth - 34, node.left + node.width / 2 - stage.left)) + stage.left - scene.left;
      host.style.width = `${dashboard.width}px`; host.style.height = `${dashboard.height}px`;
      this.photoHosts[index].style.width = `${pile.width}px`; this.photoHosts[index].style.height = `${pile.height}px`;
      const panel = this.panels[index], ring = panel.querySelector<HTMLElement>('.experience-ring')!;
      const metricScale = dockRing / ring.clientWidth;
      const photoScale = dockPhoto / Math.max(1, this.photos[index * 3].offsetWidth);
      return {
        panel: { x: dashboard.left - scene.left, y: dashboard.top - scene.top, endX: center - dockRing / 2 - (panel.offsetLeft + ring.offsetLeft) * metricScale, endY: dockTop - (panel.offsetTop + ring.offsetTop) * metricScale, scale: metricScale },
        photo: { x: pile.left - scene.left, y: pile.top - scene.top, endX: center - dockPhoto / 2 - 5, endY: dockTop + dockRing + 6, scale: photoScale },
      };
    });
  }

  /** The original nodes move into the timeline; reduced motion keeps the readable flow layout. */
  private syncTokenLayout(): void {
    const dashboard = this.section.querySelector('.experience-dashboard')!;
    this.tokens.hidden = this.reduced;
    this.panels.forEach((panel, index) => (this.reduced ? dashboard : this.panelHosts[index]).append(panel));
    this.photos.forEach((photo, index) => (this.reduced ? this.pile : this.photoHosts[Math.floor(index / 3)]).append(photo));
  }

  private onResize = (): void => { if (!this.disposed) { this.measureLayout(); this.onScroll(); } };

  private measure(): void {
    const rect = this.scroll.getBoundingClientRect();
    const travel = this.scroll.offsetHeight - this.sticky.offsetHeight;
    this.flow = travel <= 0;
    this.section.classList.toggle('is-flow', this.flow);
    this.target = travel > 0 ? Math.max(0, Math.min(1, -rect.top / travel)) : 1;
    this.proofTarget = Math.max(0, Math.min(1, (window.innerHeight - this.evidence.getBoundingClientRect().top) / (window.innerHeight * .55)));
  }

  private seekMilestone(index: number): void {
    if (this.reduced || this.flow) { this.stories[index].scrollIntoView({ behavior: this.reduced ? 'auto' : 'smooth', block: 'center' }); return; }
    const travel = this.scroll.offsetHeight - this.sticky.offsetHeight;
    window.scrollTo({ top: this.scroll.getBoundingClientRect().top + window.scrollY + travel * MILESTONES[index].seek, behavior: 'smooth' });
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
    this.syncTokenLayout();
    this.stop();
    this.measureLayout();
    this.measure();
    this.progress = this.reduced ? 1 : this.target;
    this.proofProgress = this.reduced ? 1 : this.proofTarget;
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
    this.proofProgress += (this.proofTarget - this.proofProgress) * .2;
    if (Math.abs(this.target - this.progress) < .0004) this.progress = this.target;
    if (Math.abs(this.proofTarget - this.proofProgress) < .0004) this.proofProgress = this.proofTarget;
    this.render();
    if (this.progress !== this.target || this.proofProgress !== this.proofTarget) this.raf = requestAnimationFrame(this.tick);
  };

  private render(): void {
    const frame = experienceFrame(this.progress, this.proofProgress);
    this.counter.textContent = frame.counter.toLocaleString('th-TH');
    this.section.style.setProperty('--dashboard-progress', this.progress.toFixed(4));
    this.section.style.setProperty('--header-dock', frame.dock.toFixed(4));
    this.section.style.setProperty('--era-opacity', frame.era.toFixed(4));
    this.section.style.setProperty('--era-dock', frame.eraDock.toFixed(4));
    const era = this.eraPose, dock = frame.eraDock;
    this.era.style.transform = `translate3d(${era.startX + (era.endX - era.startX) * dock}px,${era.startY + (era.endY - era.startY) * dock}px,0) translate(-50%,-50%) scale(${1 + (era.scale - 1) * dock})`;
    this.section.style.setProperty('--timeline-reveal', frame.timelineReveal.toFixed(4));
    this.section.style.setProperty('--marquee-reveal', frame.marquee.toFixed(4));
    this.section.classList.toggle('is-counted', frame.counter === COMPANY.totalSqm);
    [frame.head, frame.sub].forEach((fraction, index) => {
      const minimum = index === 0 ? this.openingHeadLength : 0;
      const reveal = this.characters[index].length * fraction;
      const count = Math.max(minimum, Math.ceil(reveal));
      if (count !== this.typedCounts[index]) {
        this.typedPrefixes[index].nodeValue = this.characters[index].slice(0, Math.max(0, count - 1)).join('');
        this.glyphs[index].textContent = this.characters[index][count - 1] ?? '';
        this.typedCounts[index] = count;
      }
      const letter = count <= minimum ? 1 : Math.max(0, Math.min(1, reveal - count + 1));
      this.glyphs[index].style.opacity = String(letter);
      this.glyphs[index].style.transform = `translateY(${(1 - letter) * 9}px)`;
      this.glyphs[index].style.filter = `blur(${(1 - letter) * 2}px)`;
      this.typed[index].classList.toggle('is-typing', fraction > 0 && fraction < 1);
    });
    this.yearFill.style.transform = `scaleX(${frame.timeline.toFixed(5)})`;
    this.yearPoint.style.left = `${frame.timeline * 100}%`;
    this.yearPoint.querySelector('b')!.textContent = String(frame.year);
    this.yearPoint.querySelector<HTMLElement>('b')!.style.opacity = frame.timeline > .005 && frame.timeline < .995 ? '1' : '0';
    this.milestones.forEach((node, index) => {
      node.style.setProperty('--milestone-reveal', frame.milestones[index].toFixed(4));
      node.tabIndex = frame.milestones[index] > .1 ? 0 : -1;
      node.classList.toggle('is-active', frame.active === index);
      if (frame.active === index) node.setAttribute('aria-current', 'step');
      else node.removeAttribute('aria-current');
      this.stories[index].style.opacity = String(frame.story[index]);
      this.stories[index].style.transform = `translateY(${(1 - frame.story[index]) * 14}px)`;
      this.stories[index].setAttribute('aria-hidden', String(!this.flow && frame.active !== index));
    });
    this.panels.forEach((panel, index) => {
      const filled = frame.rings[index];
      panel.style.setProperty('--panel-reveal', frame.panels[index].toFixed(4));
      panel.classList.toggle('is-active', frame.active === index);
      panel.classList.toggle('is-complete', filled >= 1);
      this.arcs[index].style.strokeDashoffset = String((1 - filled) * 100);
      this.values[index].textContent = `${Math.round(METRICS[index].value * filled).toLocaleString('th-TH')}${METRICS[index].suffix}`;
      panel.style.setProperty('--gauge-turn', `${filled}turn`);
      panel.classList.toggle('is-docked', frame.archived[index] > .999);
      const pose = this.tokenPoses[index], amount = frame.archived[index];
      panel.querySelector<HTMLElement>('.experience-stat-copy')!.style.opacity = String(this.reduced ? 1 : 1 - amount);
      panel.querySelector<HTMLElement>('.experience-stat-code')!.style.opacity = String(this.reduced ? 1 : 1 - amount);
      this.photoHosts[index].classList.toggle('is-docking', amount > 0);
      if (pose) {
        ([['panel', this.panelHosts[index]], ['photo', this.photoHosts[index]]] as const).forEach(([key, host]) => {
          const point = pose[key];
          host.style.transform = `translate3d(${point.x + (point.endX - point.x) * amount}px,${point.y + (point.endY - point.y) * amount}px,0) scale(${1 + (point.scale - 1) * amount})`;
          host.dataset.docked = amount.toFixed(4);
        });
      }
    });
    const pileWidth = this.pile.clientWidth, pileHeight = this.pile.clientHeight;
    this.photos.forEach((photo, index) => {
      const pose = PHOTOS[index], amount = frame.photos[index];
      const width = photo.offsetWidth, height = photo.offsetHeight;
      const angle = pose.angle * Math.PI / 180;
      const extraX = (Math.abs(width * Math.cos(angle)) + Math.abs(height * Math.sin(angle)) - width) / 2 + 8;
      const extraY = (Math.abs(height * Math.cos(angle)) + Math.abs(width * Math.sin(angle)) - height) / 2 + 8;
      const bound = (value: number, min: number, max: number): number => max >= min ? Math.max(min, Math.min(max, value)) : (min + max) / 2;
      const restX = bound((pileWidth - width) * pose.x, extraX, pileWidth - width - extraX);
      const restY = bound((pileHeight - height) * pose.y, extraY, pileHeight - height - extraY);
      const local = index % 3, group = Math.floor(index / 3);
      const archived = this.reduced ? 0 : frame.archived[group];
      const dockScale = this.tokenPoses[group]?.photo.scale ?? 1;
      const finalX = restX + ((4 + local * 4) / dockScale - restX) * archived;
      const finalY = restY + ((4 + local * 2) / dockScale - restY) * archived;
      const fromX = local === 2 ? -width - 45 : pileWidth + 70;
      const fromY = local === 1 ? pileHeight + 30 : restY - (local === 2 ? 65 : 35);
      const x = finalX + (fromX - finalX) * (1 - amount);
      const y = finalY + (fromY - finalY) * (1 - amount);
      photo.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) rotate(${(pose.angle + (local === 1 ? -18 : 18) * (1 - amount)).toFixed(2)}deg)`;
      photo.style.opacity = String(Math.min(1, amount * 1.8));
      photo.style.zIndex = String(index + 1);
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
