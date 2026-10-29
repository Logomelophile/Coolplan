import { COMPANY, PACKAGES } from './catalog';
import { motionPreference } from './motionPreference';
import { experienceFrame, experienceScrollRange, experienceScrollProgress, experienceScrollOffset, type ExperienceScrollRange, EXPERIENCE_END_YEAR, EXPERIENCE_TOTAL_SQM, EXPERIENCE_GATHER_START, EXPERIENCE_GATHER_END, EXPERIENCE_SUMMARY_HOLD_MS, EXPERIENCE_STAGES } from './experienceTimeline';
import { projectPhotoSize } from './projectPhotos';
import { sitePath } from '../sitePath';
const METRICS = [
    { value: COMPANY.years, unit: 'ปี', suffix: '', label: 'ประสบการณ์งานพื้น', detail: `ดูแลงานพื้นมาตั้งแต่ปี ${COMPANY.since}`, code: '01 / EXPERIENCE' },
    { value: EXPERIENCE_TOTAL_SQM, unit: 'ตร.ม.', suffix: '', label: 'พื้นที่ที่ส่งมอบ', detail: 'บ้านจัดสรร คอนโด และพื้นที่ของคุณ', code: '02 / PROJECTS' },
    { value: PACKAGES[0].warrantyYears, unit: 'ปี', suffix: '', label: 'รับประกันการติดตั้ง', detail: 'ติดตั้งและดูแลด้วยทีมช่างของเรา', code: '03 / CARE' },
];
const MILESTONES = [
    { position: 14, label: 'ประสบการณ์', title: 'จากประสบการณ์ สู่ทุกหน้างาน', text: 'ตั้งแต่ปี 2005 เราดูแลงานพื้นทั้งการเลือกวัสดุ เตรียมพื้นที่ และติดตั้งด้วยทีมช่างของเราเอง เก็บรายละเอียดจากหน้างานจริงในทุกขั้นตอน' },
    { position: 48, label: 'บ้านจัดสรรและคอนโด', title: 'เบื้องหลังพื้นที่อยู่อาศัย', text: 'จากบ้านเดี่ยว Narasiri สู่โครงการคอนโดอย่าง Origin และ Regent Home ประสบการณ์ที่ต่อเนื่องทั้งงานโครงการและรายละเอียดภายในบ้าน' },
    { position: 82, label: 'ลูกค้ารายย่อย', title: 'ใส่ใจในพื้นที่ของคุณ', text: 'บ้านพัก คาเฟ่ และออฟฟิศ ทุกพื้นที่เริ่มจากการพูดคุย เลือกลายที่เหมาะกับการใช้งาน และดูแลตั้งแต่ติดตั้งจนส่งมอบ' },
];
const PHOTOS = [
    { file: 'experience-herringbone-hall', caption: 'พื้นก้างปลาในพื้นที่โถง', x: .04, y: .05, angle: -6 },
    { file: 'experience-window-room', caption: 'เก็บงานพื้นริมหน้าต่าง', x: .65, y: .24, angle: 5 },
    { file: 'chevron-hall', caption: 'ลายพื้นต่อเนื่องตลอดโถงทางเดิน', x: .36, y: .58, angle: -3 },
    { file: 'narasiri-light', caption: 'บ้านเดี่ยว @ Narasiri', x: .12, y: .6, angle: -5 },
    { file: 'narasiri-dark', caption: 'อีกมุมของบ้าน Narasiri', x: .9, y: .04, angle: 6 },
    { file: 'narasiri-stairs', caption: 'บันไดบ้าน @ Narasiri', x: .4, y: .4, angle: -2 },
    { file: 'customer-open-plan', caption: 'พื้นที่เปิดโล่งภายในบ้าน', x: .25, y: .16, angle: -4 },
    { file: 'customer-connected-room', caption: 'พื้นเชื่อมต่อระหว่างห้อง', x: .8, y: .08, angle: 5 },
    { file: 'stair-oak', caption: 'เก็บรายละเอียดงานบันได', x: .68, y: .65, angle: 3 },
];
export interface IntroDiagnostics {
    progress: number;
    counter: number;
    active: number;
    panels: number;
    animating: boolean;
    rings: number[];
    counters: number[];
    typed: number[];
    year: number;
    timeline: number;
    checks: number[];
    marqueeRunning: boolean;
    milestones: number[];
    photos: number[];
    archived: number[];
    proof: number;
    mode: 'scroll' | 'flow';
    reduced: boolean;
    gather: number;
    summaryHoldRemainingMs: number;
    summaryVisibleAt: number | null;
    summaryHolding: boolean;
    scroll: ExperienceScrollRange;
}
interface TravelPose {
    x: number;
    y: number;
    endX: number;
    endY: number;
    scale: number;
    gatherX: number;
    gatherY: number;
    gatherScale: number;
}
/** Typing, years and dashboard share a reversible native-scroll timeline. */
export class ExperienceIntro {
    private readonly abort = new AbortController();
    private readonly sticky: HTMLElement;
    private readonly scroll: HTMLElement;
    private readonly evidence: HTMLElement;
    private readonly counter: HTMLElement;
    private readonly counterWrap: HTMLElement;
    private counterPose = { x: 24, y: 180, endX: 0, endY: 30, baseSize: 32, finalSize: 112 };
    private readonly panels: HTMLElement[];
    private readonly arcs: SVGCircleElement[];
    private readonly values: HTMLElement[];
    private readonly heading: HTMLElement;
    private readonly typed: HTMLElement[];
    private readonly characters: string[][];
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
    private tokenPoses: {
        panel: TravelPose;
        photo: TravelPose;
    }[] = [];
    private typingProgress = 0;
    private scrollRange = experienceScrollRange(0, 0);
    private typedFractions = [0, 0];
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
    private summaryHoldStarted: number | null = null;
    private summaryVisibleAt: number | null = null;
    private summaryHoldConsumed = false;
    constructor(private readonly section: HTMLElement) {
        this.sticky = section.querySelector<HTMLElement>('.experience-sticky')!;
        this.scroll = section.querySelector<HTMLElement>('.experience-scroll')!;
        this.evidence = section.querySelector<HTMLElement>('.experience-evidence')!;
        this.counter = section.querySelector<HTMLElement>('.experience-counter strong')!;
        this.counterWrap = section.querySelector<HTMLElement>('.experience-counter')!;
        this.heading = section.querySelector<HTMLElement>('.experience-dashboard-heading')!;
        this.typed = Array.from(section.querySelectorAll<HTMLElement>('.experience-typed'));
        const segmenter = new Intl.Segmenter('th', { granularity: 'grapheme' });
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
        this.pile.innerHTML = PHOTOS.map((photo, index) => { const size = projectPhotoSize(photo.file); return `<figure class="experience-pile-photo${size.portrait ? ' is-portrait' : ''}" style="--photo-ratio:${size.ratio}" data-story="${Math.floor(index / 3)}"><img src="${sitePath(`/website/showcase/${photo.file}.webp`)}" alt="${photo.caption}" loading="lazy" decoding="async" width="${size.width}" height="${size.height}"/><figcaption>${photo.caption}</figcaption></figure>`; }).join('');
        this.photos = Array.from(this.pile.children) as HTMLElement[];
        this.checks = Array.from(section.querySelectorAll<HTMLElement>('.experience-checks li'));
        this.projectButton = section.querySelector<HTMLButtonElement>('.experience-projects-toggle')!;
        const projectTrack = section.querySelector<HTMLElement>('.experience-projects-track')!;
        const projects = [...COMPANY.partners.map(partner => `${partner.name} · ${partner.sqm.toLocaleString('th-TH')} ตร.ม.`), ...COMPANY.portfolio.map(project => `${project} ตร.ม.`)];
        for (let copy = 0; copy < 2; copy++) {
            const group = document.createElement('div');
            group.className = 'experience-projects-group';
            if (copy)
                group.setAttribute('aria-hidden', 'true');
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
        const summary = document.createElement('div');
        summary.className = 'experience-summary-frame';
        summary.setAttribute('aria-hidden', 'true');
        summary.innerHTML = `<div class="experience-summary-cards">${METRICS.map(metric => `<div class="experience-summary-slot"><span>${metric.label}</span><small>${metric.detail}</small></div>`).join('')}</div>`;
        this.sticky.append(summary);
        this.sticky.append(this.evidence);
        this.syncTokenLayout();
        const signal = this.abort.signal;
        window.addEventListener('scroll', this.onScroll, { passive: true, signal });
        window.addEventListener('wheel', this.onWheel, { passive: false, signal });
        window.addEventListener('resize', this.onResize, { signal });
        document.addEventListener('visibilitychange', this.onVisibility, { signal });
        motionPreference.addEventListener('change', this.onPreference, { signal });
        this.projectButton.addEventListener('click', () => { this.projectsPaused = !this.projectsPaused; this.syncProjects(); }, { signal });
        section.querySelector('.experience-motion-replay')?.addEventListener('click', () => { window.scrollTo({ top: this.scroll.getBoundingClientRect().top + window.scrollY + (this.reduced ? 0 : experienceScrollOffset(0, this.scrollRange)), behavior: this.reduced ? 'auto' : 'smooth' }); }, { signal });
        section.querySelector('.experience-scene-footer a[href="#experience-evidence"]')?.addEventListener('click', event => {
            event.preventDefault();
            if (this.reduced || this.flow) {
                this.evidence.scrollIntoView({ behavior: 'auto', block: 'center' });
                return;
            }
            const travel = this.scroll.offsetHeight - this.sticky.offsetHeight;
            window.scrollTo({ top: this.scroll.getBoundingClientRect().top + window.scrollY + travel, behavior: 'smooth' });
        }, { signal });
        this.observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
            this.visible = entries.some(entry => entry.isIntersecting);
            if (this.visible) {
                this.photos.forEach(photo => { photo.querySelector('img')!.loading = 'eager'; });
                this.onScroll();
            }
            else
                this.stop();
            this.syncProjects();
        }, { rootMargin: '10% 0px' });
        this.observer?.observe(section);
        if (!this.observer)
            this.visible = true;
        this.resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(this.onResize);
        this.resizeObserver?.observe(this.heading);
        this.resizeObserver?.observe(this.sticky);
        this.resizeObserver?.observe(this.pile);
        section.classList.toggle('is-reduced', this.reduced);
        this.measureLayout();
        this.measure();
        this.progress = this.reduced ? 1 : this.target;
        this.typingProgress = this.progress;
        this.proofProgress = this.reduced ? 1 : this.proofTarget;
        this.render();
    }
    get diagnostics(): IntroDiagnostics {
        const frame = experienceFrame(this.progress, this.proofProgress);
        return { progress: this.progress, counter: frame.counter, active: frame.active, panels: this.panels.length, animating: this.raf !== 0, rings: frame.rings, counters: METRICS.map((metric, index) => Math.round(metric.value * frame.rings[index])), typed: [...this.typedFractions], year: frame.year, timeline: frame.timeline, checks: frame.checks, marqueeRunning: this.projectsRunning, milestones: frame.milestones, photos: frame.photos, archived: frame.archived, proof: this.proofProgress, mode: this.flow ? 'flow' : 'scroll', reduced: this.reduced, gather: frame.gather, summaryHoldRemainingMs: this.summaryHoldRemainingMs, summaryVisibleAt: this.summaryVisibleAt, scroll: { ...this.scrollRange }, summaryHolding: this.summaryHoldStarted !== null && !this.summaryHoldConsumed && (this.summaryVisibleAt === null || this.summaryHoldRemainingMs > 0) };
    }
    private get summaryHoldRemainingMs(): number { return this.reduced || this.summaryHoldConsumed || this.summaryVisibleAt === null ? 0 : Math.max(0, EXPERIENCE_SUMMARY_HOLD_MS - (performance.now() - this.summaryVisibleAt)); }
    private resetSummaryHold(): void { this.summaryHoldStarted = null; this.summaryVisibleAt = null; this.summaryHoldConsumed = false; }
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
        this.counterPose = { x: Math.max(12, this.sticky.clientWidth * .025), y: anchor.bottom - stage.top - lineEntranceY + 22, endX: this.sticky.clientWidth * .5, endY: Math.max(18, this.sticky.clientHeight * .045), baseSize: this.sticky.clientWidth <= 850 ? 24 : 32, finalSize: Math.min(112, this.sticky.clientWidth * .13, this.sticky.clientHeight * .14) };
        const fontSize = parseFloat(getComputedStyle(this.era.querySelector('strong')!).fontSize);
        this.eraPose = { startX: this.sticky.clientWidth * .5, startY: this.sticky.clientHeight * .54, endX: anchor.left + anchor.width / 2 - stage.left, endY: anchor.top + anchor.height / 2 - stage.top - lineEntranceY, scale: 10 / fontSize };
        const scene = this.section.querySelector('.experience-scene')!.getBoundingClientRect();
        this.section.style.setProperty('--scene-height', `${scene.height}px`);
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
            host.style.width = `${dashboard.width}px`;
            host.style.height = `${dashboard.height}px`;
            this.photoHosts[index].style.width = `${pile.width}px`;
            this.photoHosts[index].style.height = `${pile.height}px`;
            const panel = this.panels[index], ring = panel.querySelector<HTMLElement>('.experience-ring')!;
            const metricScale = dockRing / ring.clientWidth;
            const photoScale = dockPhoto / Math.max(1, this.photos[index * 3].offsetWidth);
            const slot = this.section.querySelectorAll<HTMLElement>('.experience-summary-slot')[index].getBoundingClientRect();
            const narrow = this.sticky.clientWidth <= 850;
            const finalSize = narrow ? Math.min(90, slot.height * .48, slot.width * .7) : Math.min(140, slot.height - 30, slot.width * .36), summaryScale = finalSize / ring.clientWidth;
            return {
                panel: { x: dashboard.left - scene.left, y: dashboard.top - scene.top, endX: center - dockRing / 2 - (panel.offsetLeft + ring.offsetLeft) * metricScale, endY: dockTop - (panel.offsetTop + ring.offsetTop) * metricScale, scale: metricScale, gatherX: slot.left + (narrow ? (slot.width - finalSize) / 2 : 18) - scene.left - (panel.offsetLeft + ring.offsetLeft) * summaryScale, gatherY: slot.top + (narrow ? 15 : (slot.height - finalSize) / 2) - scene.top - (panel.offsetTop + ring.offsetTop) * summaryScale, gatherScale: summaryScale },
                photo: { x: pile.left - scene.left, y: pile.top - scene.top, endX: center - dockPhoto / 2 - 5, endY: dockTop + dockRing + 6, scale: photoScale, gatherX: slot.right - (narrow ? 34 : 82) - scene.left, gatherY: slot.top + (narrow ? slot.height * .6 : 10) - scene.top, gatherScale: narrow ? 22 / Math.max(1, this.photos[index * 3].offsetWidth) : photoScale },
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
    private onResize = (): void => { if (!this.disposed) {
        this.measureLayout();
        this.onScroll();
    } };
    private measure(): void {
        const rect = this.scroll.getBoundingClientRect();
        const travel = this.scroll.offsetHeight - this.sticky.offsetHeight;
        this.scrollRange = experienceScrollRange(window.innerHeight, travel);
        this.flow = travel <= 0;
        this.section.classList.toggle('is-flow', this.flow);
        this.target = experienceScrollProgress(-rect.top, this.scrollRange);
        this.proofTarget = Math.max(0, Math.min(1, (this.target - EXPERIENCE_GATHER_START) / (EXPERIENCE_GATHER_END - EXPERIENCE_GATHER_START)));
        if (this.target < EXPERIENCE_GATHER_START - .02) this.resetSummaryHold();
    }
    private seekMilestone(index: number): void {
        if (this.reduced || this.flow) {
            this.stories[index].scrollIntoView({ behavior: this.reduced ? 'auto' : 'smooth', block: 'center' });
            return;
        }
        window.scrollTo({ top: this.scroll.getBoundingClientRect().top + window.scrollY + experienceScrollOffset(EXPERIENCE_STAGES[index].seek, this.scrollRange), behavior: 'smooth' });
    }
    private stop(): void { cancelAnimationFrame(this.raf); this.raf = 0; }
    private onVisibility = (): void => {
        if (document.hidden)
            this.stop();
        else
            this.onScroll();
        this.syncProjects();
    };
    private onPreference = (): void => {
        this.reduced = motionPreference.matches;
        this.resetSummaryHold();
        this.section.classList.toggle('is-reduced', this.reduced);
        this.syncTokenLayout();
        this.stop();
        this.measureLayout();
        this.measure();
        this.progress = this.reduced ? 1 : this.target;
        this.typingProgress = this.progress;
        this.proofProgress = this.reduced ? 1 : this.proofTarget;
        this.render();
    };
    private onScroll = (): void => {
        if (this.disposed || this.reduced)
            return;
        this.measure();
        if (!this.visible || document.hidden || this.raf)
            return;
        this.raf = requestAnimationFrame(this.tick);
    };
    /** A single brief wheel dwell lets the finished number be read. Reverse, keyboard,
     * anchors and reduced motion remain native; a watchdog bounds a stalled renderer. */
    private onWheel = (event: WheelEvent): void => {
        if (this.disposed || this.reduced || this.flow || !this.visible || this.summaryHoldConsumed || event.defaultPrevented || event.ctrlKey || event.shiftKey || !event.cancelable || event.deltaY <= 0 || Math.abs(event.deltaX) > event.deltaY || (event.target instanceof Element && event.target.closest('dialog[open]'))) return;
        const rect = this.scroll.getBoundingClientRect(), start = rect.top + window.scrollY;
        const travel = this.scroll.offsetHeight - this.sticky.offsetHeight;
        if (travel <= 0 || window.scrollY < start - 1 || window.scrollY > start + travel + 1) return;
        const anchor = Math.ceil(start + experienceScrollOffset(EXPERIENCE_GATHER_END, this.scrollRange));
        const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1);
        if (window.scrollY + delta < anchor) return;
        const now = performance.now();
        if ((this.summaryVisibleAt !== null && now - this.summaryVisibleAt >= EXPERIENCE_SUMMARY_HOLD_MS) || (this.summaryHoldStarted !== null && now - this.summaryHoldStarted >= 2500)) {
            this.summaryHoldConsumed = true;
            return;
        }
        this.summaryHoldStarted ??= now;
        event.preventDefault();
        window.scrollTo({ top: Math.min(start + travel, Math.max(anchor, window.scrollY)), behavior: 'instant' });
        this.onScroll();
    };
    private tick = (): void => {
        this.raf = 0;
        if (this.disposed || this.reduced || !this.visible || document.hidden)
            return;
        this.progress += (this.target - this.progress) * .1;
        this.typingProgress += (this.target - this.typingProgress) * .3;
        this.proofProgress += (this.proofTarget - this.proofProgress) * .1;
        if (Math.abs(this.target - this.progress) < .0004)
            this.progress = this.target;
        if (Math.abs(this.proofTarget - this.proofProgress) < .0004)
            this.proofProgress = this.proofTarget;
        if (Math.abs(this.target - this.typingProgress) < .0004) this.typingProgress = this.target;
        this.render();
        if (this.progress !== this.target || this.proofProgress !== this.proofTarget || this.typingProgress !== this.target)
            this.raf = requestAnimationFrame(this.tick);
    };
    private render(): void {
        const frame = experienceFrame(this.progress, this.proofProgress);
        if (!this.reduced && this.visible && frame.gather === 1 && frame.counter === EXPERIENCE_TOTAL_SQM && this.summaryVisibleAt === null && Math.abs(this.sticky.getBoundingClientRect().top) < 1) this.summaryVisibleAt = performance.now();
        this.counter.textContent = frame.counter.toLocaleString('th-TH');
        const gather = this.reduced ? 1 : frame.gather, counter = this.counterPose;
        this.counterWrap.style.setProperty('--counter-reveal', String(this.reduced ? 1 : frame.counterReveal));
        this.counterWrap.style.setProperty('--counter-size', `${counter.baseSize + (counter.finalSize - counter.baseSize) * gather}px`);
        this.counterWrap.style.transform = `translate3d(${counter.x + (counter.endX - counter.x) * gather}px,${counter.y + (counter.endY - counter.y) * gather}px,0) translateX(${-50 * gather}%)`;
        this.counterWrap.setAttribute('aria-hidden', String(!this.reduced && frame.counterReveal === 0));
        this.heading.style.opacity = String(1 - gather);
        this.section.style.setProperty('--dashboard-progress', this.progress.toFixed(4));
        this.section.style.setProperty('--header-dock', frame.dock.toFixed(4));
        this.section.style.setProperty('--gather', (this.reduced ? 0 : frame.gather).toFixed(4));
        this.section.classList.toggle('is-gathered', frame.gather > .98 && !this.reduced);
        this.evidence.inert = !this.reduced && frame.gather < .95;
        this.era.style.opacity = String(frame.era * (1 - gather));
        this.section.style.setProperty('--era-opacity', frame.era.toFixed(4));
        this.section.style.setProperty('--era-dock', frame.eraDock.toFixed(4));
        const era = this.eraPose, dock = frame.eraDock;
        this.era.style.transform = `translate3d(${era.startX + (era.endX - era.startX) * dock}px,${era.startY + (era.endY - era.startY) * dock}px,0) translate(-50%,-50%) scale(${1 + (era.scale - 1) * dock})`;
        this.section.style.setProperty('--timeline-reveal', frame.timelineReveal.toFixed(4));
        this.section.style.setProperty('--marquee-reveal', frame.marquee.toFixed(4));
        this.section.classList.toggle('is-counted', frame.counter === EXPERIENCE_TOTAL_SQM);
        const typing = experienceFrame(this.typingProgress);
        this.typedFractions = [typing.head, typing.sub];
        this.typedFractions.forEach((fraction, index) => {
            const minimum = 0;
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
            if (frame.active === index)
                node.setAttribute('aria-current', 'step');
            else
                node.removeAttribute('aria-current');
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
                    const x = point.x + (point.endX - point.x) * amount, y = point.y + (point.endY - point.y) * amount, scale = 1 + (point.scale - 1) * amount;
                    host.style.transform = `translate3d(${x + (point.gatherX - x) * frame.gather}px,${y + (point.gatherY - y) * frame.gather}px,0) scale(${scale + (point.gatherScale - scale) * frame.gather})`;
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
            const restX = bound((pileWidth - width) * [.25, .5, .38][index % 3], extraX, pileWidth - width - extraX);
            const restY = bound((pileHeight - height) * [.04, .3, .6][index % 3], extraY, pileHeight - height - extraY);
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
        if (this.disposed)
            return;
        this.disposed = true;
        this.stop();
        this.abort.abort();
        this.observer?.disconnect();
        this.resizeObserver?.disconnect();
        this.section.classList.remove('is-projects-running');
    }
}
