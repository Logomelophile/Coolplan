import { sitePath } from '../sitePath';
import { motionPreference } from './motionPreference';
import { projectPhotoSize } from './projectPhotos';
import { ExperienceIntro, type IntroDiagnostics } from './experienceDashboard';
import { ExperienceOrbit } from './experienceOrbit';
export { ExperienceIntro } from './experienceDashboard';
export type { IntroDiagnostics } from './experienceDashboard';
/**
 * The "experience" run that follows the pinned floor story:
 *  1. #experience-intro  – two readable lines and a dashboard linked to page scroll
 *  2. #featured          – three real project photo stories and an installation warranty story
 */
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
interface FeaturedPhoto {
    image: string;
    alt: string;
    caption: string;
}
interface FeaturedProject {
    id: string;
    eyebrow: string;
    title: string;
    subtitle: string;
    text: string;
    chips: string[];
    photos: FeaturedPhoto[];
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
];
const INSTALLATION_PHOTOS: FeaturedPhoto[] = [
    { image: '/website/showcase/installation-room.webp', alt: 'ทีมช่าง COOLPLAN ติดตั้งพื้นภายในห้อง', caption: 'ดูแลงานตั้งแต่เตรียมพื้นที่' },
    { image: '/website/showcase/preparation-primer.webp', alt: 'ช่างกำลังเตรียมผิวพื้นก่อนติดตั้งบริเวณริมหน้าต่าง', caption: 'เตรียมผิวก่อนติดตั้ง' },
    { image: '/website/showcase/preparation-leveling.webp', alt: 'ทีมช่างกำลังเก็บรายละเอียดผิวพื้นหน้างานจริง', caption: 'ทีมช่างเก็บรายละเอียดหน้างาน' },
    { image: '/website/showcase/installation-prep.webp', alt: 'ทีมช่างเตรียมพื้นเดิมก่อนเริ่มงานปูพื้น', caption: 'เตรียมพื้นเดิมให้พร้อม' },
    { image: '/website/showcase/installation-team.webp', alt: 'ทีมช่างกำลังติดตั้งพื้นในพื้นที่ออกกำลังกาย', caption: 'ติดตั้งด้วยทีมช่างของเรา' },
    { image: '/website/showcase/chevron-hall.webp', alt: 'โถงทางเดินซุ้มโค้งกับพื้นลายเชฟรอนโทนอ่อน', caption: 'จังหวะเส้นโค้งและลายพื้น' },
    { image: '/website/showcase/office-meeting.webp', alt: 'พื้นที่ประชุมตกแต่งด้วยไม้และตู้สีน้ำเงิน', caption: 'รายละเอียดพื้นที่ทำงาน' },
    { image: '/website/showcase/orbit-wood-cafe.webp', alt: 'ภายในคาเฟ่โทนไม้กับแสงอุ่น', caption: 'ไม้ แสง และบรรยากาศ' },
    { image: '/website/showcase/orbit-warm-stairs.webp', alt: 'บันไดไม้โทนอุ่นในพื้นที่ภายใน', caption: 'เส้นสายและสัดส่วนของบันได' },
    { image: '/website/showcase/cafe-herringbone-top.webp', alt: 'มุมสูงของคาเฟ่ เห็นการจัดโต๊ะและพื้นก้างปลา', caption: 'องค์ประกอบของพื้นที่คาเฟ่' },
];
export interface FeaturedDiagnostics {
    id: string;
    progress: number;
    photos: number;
    visible: boolean;
    animating: boolean;
    selectedPhoto: number | null;
    dragging: boolean;
    offsets: {
        x: number;
        y: number;
    }[];
}
interface PhotoOffset {
    x: number;
    y: number;
}
interface PhotoDrag {
    index: number;
    pointerId: number;
    startX: number;
    startY: number;
    origin: PhotoOffset;
}
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
    private readonly copyLines: {
        host: HTMLElement;
        typed: HTMLElement;
        characters: string[];
        count: number;
    }[] = [];
    constructor(private readonly section: HTMLElement, private readonly id: string, initialReduced: boolean) {
        this.cards = Array.from(section.querySelectorAll<HTMLElement>('.featured-photo'));
        this.media = section.querySelector<HTMLElement>('.featured-media')!;
        this.offsets = this.cards.map(() => ({ x: 0, y: 0 }));
        const segmenter = new Intl.Segmenter('th', { granularity: 'grapheme' });
        section.querySelectorAll<HTMLElement>('.featured-copy h3,.featured-subtitle,.featured-description').forEach(host => {
            const text = host.textContent ?? '';
            host.setAttribute('aria-label', text);
            const placeholder = document.createElement('span');
            placeholder.className = 'featured-copy-placeholder';
            placeholder.textContent = text;
            placeholder.setAttribute('aria-hidden', 'true');
            const typed = document.createElement('span');
            typed.className = 'featured-typed';
            typed.setAttribute('aria-hidden', 'true');
            host.replaceChildren(placeholder, typed);
            this.copyLines.push({ host, typed, characters: Array.from(segmenter.segment(text), p => p.segment), count: -1 });
        });
        const signal = this.abort.signal;
        section.querySelectorAll<HTMLButtonElement>('[data-install-step]').forEach((button,index)=>button.addEventListener('click',()=>{
            if(this.reducedMotion)return;
            const travel=section.offsetHeight-innerHeight;
            scrollTo({top:section.getBoundingClientRect().top+scrollY+(.34+index*.22)*(travel+innerHeight*.45)-innerHeight*.45,behavior:'smooth'});
        },{signal}));
        section.querySelector('.installation-motion-toggle')?.addEventListener('click',event=>{
            const paused=section.classList.toggle('photos-paused'),button=event.currentTarget as HTMLButtonElement;
            button.setAttribute('aria-pressed',String(paused));button.textContent=paused?'เล่นภาพต่อ ▶':'พักภาพช่าง Ⅱ';
        },{signal});
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
                this.cards.forEach(card=>{card.querySelector('img')!.loading='eager';});
                this.onScroll();
            }
            else {
                cancelAnimationFrame(this.raf);
                this.raf = 0;
            }
        }, { rootMargin: '10% 0px', threshold: 0 });
        this.observer?.observe(section);
        if (!this.observer) {
            this.visible = true;
            section.classList.add('is-visible');
        }
        this.setReducedMotion(initialReduced);
    }
    get diagnostics(): FeaturedDiagnostics {
        return { id: this.id, progress: this.progress, photos: this.cards.length, visible: this.visible, animating: this.raf !== 0, selectedPhoto: this.selectedPhoto, dragging: this.drag !== null, offsets: this.offsets.map(offset => ({ ...offset })) };
    }
    private selectPhoto(index: number): void {
        const newlySelected=this.selectedPhoto!==index;
        this.selectedPhoto = index;
        this.cards.forEach((card, i) => {
            card.classList.toggle('is-selected', i === index);
            card.setAttribute('aria-pressed', String(i === index));
            card.style.zIndex = String(i === index ? 20 : i + 1);
        });
        if(newlySelected&&this.section.classList.contains('installation-story')&&!this.reducedMotion){
            const frame=this.media.getBoundingClientRect(),photo=this.cards[index].getBoundingClientRect();
            this.offsets[index].x+=Math.max(0,frame.left+12-photo.left)+Math.min(0,frame.right-12-photo.right);
            this.offsets[index].y+=Math.max(0,frame.top+18-photo.top)+Math.min(0,frame.bottom-18-photo.bottom);
            this.render();
        }
    }
    private startDrag(event: PointerEvent, index: number): void {
        if (!event.isPrimary || event.button !== 0)
            return;
        this.selectPhoto(index);
        // A touch tap raises a photograph; native touch scrolling remains available.
        if (event.pointerType === 'touch')
            return;
        event.preventDefault();
        const card = this.cards[index];
        card.focus({ preventScroll: true });
        this.drag = { index, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin: { ...this.offsets[index] } };
        card.classList.add('is-dragging');
        card.setPointerCapture(event.pointerId);
    }
    private moveDrag = (event: PointerEvent): void => {
        const drag = this.drag;
        if (!drag || drag.pointerId !== event.pointerId)
            return;
        this.offsets[drag.index] = { x: drag.origin.x + event.clientX - drag.startX, y: drag.origin.y + event.clientY - drag.startY };
        this.render();
    };
    private endDrag = (event: PointerEvent): void => {
        const drag = this.drag;
        if (!drag || drag.pointerId !== event.pointerId)
            return;
        this.drag = null;
        const card = this.cards[drag.index];
        card.classList.remove('is-dragging');
        if (card.hasPointerCapture(event.pointerId))
            card.releasePointerCapture(event.pointerId);
    };
    private moveWithKeyboard(event: KeyboardEvent, index: number): void {
        const direction: Record<string, PhotoOffset> = { ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 } };
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.selectPhoto(index);
            return;
        }
        if (event.key !== 'Home' && !direction[event.key])
            return;
        event.preventDefault();
        this.selectPhoto(index);
        if (event.key === 'Home')
            this.offsets[index] = { x: 0, y: 0 };
        else {
            const step = event.shiftKey ? 30 : 10;
            this.offsets[index].x += direction[event.key].x * step;
            this.offsets[index].y += direction[event.key].y * step;
        }
        this.render();
    }
    private onResize = (): void => { this.render(); this.onScroll(); };
    setReducedMotion(value: boolean): void {
        if (this.disposed)
            return;
        this.reducedMotion = value;
        this.section.classList.toggle('is-reduced', value);
        if (value) {
            cancelAnimationFrame(this.raf);
            this.raf = 0;
            this.section.classList.add('is-visible');
            this.progress = this.target = 1;
            this.render();
        }
        else
            this.onScroll();
    }
    private onVisibility = (): void => {
        if (document.hidden) {
            cancelAnimationFrame(this.raf);
            this.raf = 0;
        }
        else
            this.onScroll();
    };
    private onScroll = (): void => {
        this.dirty = true;
        if (this.disposed || this.reducedMotion || !this.visible || document.hidden || this.raf)
            return;
        this.raf = requestAnimationFrame(this.tick);
    };
    private tick = (): void => {
        this.raf = 0;
        if (this.disposed || !this.visible || document.hidden || this.reducedMotion)
            return;
        if (this.dirty) {
            const rect = this.section.getBoundingClientRect();
            const travel = this.section.offsetHeight - window.innerHeight;
            this.target = travel > 0 ? clamp((window.innerHeight * .45 - rect.top) / (travel + window.innerHeight * .45), 0, 1) : clamp((window.innerHeight - rect.top) / (window.innerHeight + rect.height), 0, 1);
            this.dirty = false;
        }
        this.progress += (this.target - this.progress) * .18;
        if (Math.abs(this.target - this.progress) < .0005)
            this.progress = this.target;
        this.render();
        if (this.progress !== this.target)
            this.raf = requestAnimationFrame(this.tick);
    };
    private render(): void {
        if (this.disposed)
            return;
        const p = this.progress;
        const width = this.media.clientWidth, height = this.media.clientHeight;
        this.media.style.setProperty('--media-height', `${height}px`);
        this.section.style.setProperty('--feature-progress', p.toFixed(4));
        const installation=this.section.classList.contains('installation-story');
        const shift = this.reducedMotion ? 1 : 1 - Math.pow(1 - clamp((p - .04) / .4, 0, 1), 3), copy = this.reducedMotion ? 1 : clamp(installation?(p-.01)/.19:(p - .24) / .34, 0, 1);
        this.section.style.setProperty('--feature-shift', String(shift));
        this.section.style.setProperty('--copy-reveal', String(copy));
        this.copyLines.forEach((line, i) => { const fraction = this.reducedMotion ? 1 : clamp((copy - i * .13) / .68, 0, 1), count = Math.floor(line.characters.length * fraction); if (count !== line.count) {
            line.typed.textContent = line.characters.slice(0, count).join('');
            line.count = count;
        } line.host.classList.toggle('is-typing', fraction > 0 && fraction < 1); });
        if(installation){
            const active=p<.45?0:p<.67?1:2;
            this.section.querySelectorAll<HTMLElement>('[data-install-step]').forEach((e,i)=>{
                const reveal=this.reducedMotion?1:clamp((p-.10-i*.12)/.15,0,1);
                e.style.setProperty('--method-reveal',String(reveal));e.classList.toggle('is-active',active===i);e.setAttribute('aria-pressed',String(active===i));
            });
            const care=this.reducedMotion?1:clamp((p-.50)/.22,0,1);
            this.section.style.setProperty('--care-reveal',String(care));
            this.section.querySelector('.installation-care strong')!.textContent=String(Math.round(10*care));
        }
        this.cards.forEach((card, index) => {
            const centreX = (width - card.offsetWidth) / 2 + (index - (this.cards.length - 1) / 2) * 18, centreY = (height - card.offsetHeight) / 2 + index * 10;
            const centerWidth=width<=520?width*.64:Math.min(760,width*.40),lane=(width-centerWidth)/2,gutter=width<=520?6:width<=850?14:32;
            const left=[0,2,3,5,7].includes(index);
            const collageX=[-width*.055,width-card.offsetWidth*.72,-width*.06,lane-card.offsetWidth-gutter,width-lane+gutter,lane-card.offsetWidth-gutter,width-lane+gutter,lane-card.offsetWidth-gutter,width-card.offsetWidth*.68,width-lane+gutter][index];
            const destinationX = installation?collageX:(width - card.offsetWidth) * [.12, .8, .4][index];
            const destinationY = installation?height*[.10,-.14,.49,.27,.37,-.28,-.18,.77,.72,.88][index]:(height - card.offsetHeight) * [.04, .6, .3][index];
            let x = centreX + (destinationX - centreX) * shift, y = centreY + (destinationY - centreY) * shift;
            if(installation){x=destinationX;y=destinationY;}
            const entering = this.reducedMotion ? 1 : this.id === 'warranty' ? clamp((p + .10 - index * .008) / .22, 0, 1) : 1;
            const rotate = this.reducedMotion ? 0 : (installation?[-7,6,4,-4,-6,4,-5,5,7,-7][index]:[-6, 5, -2][index]) + (this.id === 'warranty' ? (1 - entering) * (index % 2 ? -14 : 14) : 0);
            // Account for rotation when bounding each photo, including its caption.
            const radians = rotate * Math.PI / 180;
            const extraX = (Math.abs(card.offsetWidth * Math.cos(radians)) + Math.abs(card.offsetHeight * Math.sin(radians)) - card.offsetWidth) / 2;
            const extraY = (Math.abs(card.offsetHeight * Math.cos(radians)) + Math.abs(card.offsetWidth * Math.sin(radians)) - card.offsetHeight) / 2;
            const minX = installation?Math.min(destinationX,(left?0:width-lane)+8+extraX):8 + extraX - card.offsetLeft;
            const maxX = installation?Math.max(destinationX,(left?lane:width)-8-extraX-card.offsetWidth):width - 8 - extraX - card.offsetLeft - card.offsetWidth;
            const minY = installation?Math.min(destinationY,24+extraY):8 + extraY - card.offsetTop;
            const maxY = installation?Math.max(destinationY,height-28-extraY-card.offsetHeight):height - 44 - extraY - card.offsetTop - card.offsetHeight;
            const bound = (value: number, min: number, max: number): number => max >= min ? clamp(value, min, max) : (min + max) / 2;
            x = bound(x, minX, maxX);
            y = bound(y, minY, maxY);
            const flyX = this.id === 'warranty' && !this.reducedMotion ? (1 - entering) * (installation?(left?-width*.06:width*.06):(index % 2 ? -width : width)) : 0;
            const flyY = this.id === 'warranty' && !this.reducedMotion ? (1 - entering) * (installation?height*.10:height * .7 + index * 35) : 0;
            this.offsets[index].x = bound(x + this.offsets[index].x, minX, maxX) - x;
            this.offsets[index].y = bound(y + this.offsets[index].y, minY, maxY) - y;
            card.style.setProperty('--photo-x', `${(x + flyX).toFixed(2)}px`);
            card.style.setProperty('--photo-y', `${(y + flyY).toFixed(2)}px`);
            card.style.setProperty('--photo-angle', `${rotate.toFixed(2)}deg`);
            card.style.setProperty('--drag-x', `${(this.offsets[index].x + (this.reducedMotion ? x : 0)).toFixed(2)}px`);
            card.style.setProperty('--drag-y', `${(this.offsets[index].y + (this.reducedMotion ? y : 0)).toFixed(2)}px`);
            card.style.setProperty('--photo-drift', `${((.5 - p) * (index === 0 ? 18 : 10)).toFixed(2)}px`);
            card.style.opacity = String(entering);
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
            if (card.hasPointerCapture(this.drag.pointerId))
                card.releasePointerCapture(this.drag.pointerId);
            this.drag = null;
        }
    }
}
export class Experience {
    readonly intro: ExperienceIntro | null;
    readonly orbit: ExperienceOrbit | null;
    private readonly abort = new AbortController();
    private readonly motion = motionPreference;
    private readonly featured: FeaturedStoryMotion[] = [];
    private disposed = false;
    constructor(private readonly root: ParentNode) {
        const intro = root.querySelector<HTMLElement>('#experience-intro');
        this.orbit = intro ? new ExperienceOrbit(intro) : null;
        this.intro = intro ? new ExperienceIntro(intro) : null;
        this.buildFeatured();
        // One preference event updates every story together, including offscreen stories.
        this.motion.addEventListener('change', this.syncFeaturedMotion, { signal: this.abort.signal });
    }
    private syncFeaturedMotion = (): void => {
        const value = this.motion.matches;
        this.featured.forEach(story => story.setReducedMotion(value));
    };
    get diagnostics(): {
        intro: IntroDiagnostics | null;
        orbit: ExperienceOrbit['diagnostics'] | null;
        featured: FeaturedDiagnostics[];
    } {
        return { intro: this.intro?.diagnostics ?? null, orbit: this.orbit?.diagnostics ?? null, featured: this.featured.map(story => story.diagnostics) };
    }
    private buildFeatured(): void {
        const host = this.root.querySelector<HTMLElement>('#featured .featured-list');
        if (!host)
            return;
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
        warranty.className = 'installation-story';
        warranty.id = 'installation-warranty';
        warranty.setAttribute('aria-labelledby', 'installation-warranty-title');
        warranty.innerHTML = `<div class="installation-stage"><div class="installation-art installation-art-arch" aria-hidden="true"><svg viewBox="0 0 180 260" fill="none"><path d="M25 245V95a65 65 0 0 1 130 0v150M40 245V95a50 50 0 0 1 100 0v150M55 245V95a35 35 0 0 1 70 0v150M12 245h156M90 0v260"/><path d="M25 185h130M25 210h130"/></svg><span>INTERIOR STUDY / 01</span></div><div class="installation-art installation-art-material" aria-hidden="true"><svg viewBox="0 0 220 220" fill="none"><path d="m10 20 100 70 100-70M10 55l100 70 100-70M10 90l100 70 100-70M10 125l100 70 100-70M10 160l100 70 100-70M110 0v220"/><circle cx="110" cy="110" r="100"/></svg><span>MATERIAL & RHYTHM</span></div><div class="featured-media" aria-label="ภาพทีมช่างและงาน Interior ของ COOLPLAN">${this.photoMarkup(INSTALLATION_PHOTOS,true)}</div><div class="featured-copy"><span class="installation-eyebrow">COOLPLAN · PROFESSIONAL INSTALLATION</span><h3 id="installation-warranty-title">การติดตั้งแบบมืออาชีพ</h3><p class="featured-subtitle">พื้นสวย เริ่มจากฐานที่เรียบ</p><p class="installation-intro">เตรียมพื้นให้พร้อม ปูอย่างใส่ใจ<br>เก็บครบทุกมุม ด้วยทีมช่างของเรา</p><div class="installation-services"><ol class="installation-methods" aria-label="บริการปรับพื้นตามสภาพหน้างาน">${[
            ['ปรับ Self-leveling','ปรับระดับให้ได้ระนาบ'],['ปรับสกิมพื้น','เก็บรอยและผิวพื้น'],['ปรับไล้พื้น','ไล้เก็บผิวให้เรียบ'],
        ].map(([title,text],i)=>`<li><button type="button" data-install-step="${i}" aria-pressed="false"><span>0${i+1}</span><h4>${title}</h4><p>${text}</p></button></li>`).join('')}</ol><div class="installation-care" aria-label="รับประกันติดตั้ง 10 ปี เปลี่ยนให้ฟรี"><div><strong aria-hidden="true">0</strong><span>ปี</span></div><p>รับประกันติดตั้ง 10 ปี<br><b>เปลี่ยนให้ฟรี ↗</b></p></div></div><p class="installation-method-note">เลือกวิธีปรับพื้นให้เหมาะกับสภาพหน้างาน</p><p class="installation-terms">สอบถามรายละเอียดการรับประกันกับทีมงาน</p><a class="installation-cta" href="#package-specs">เลือกรุ่นและคำนวณราคา <span aria-hidden="true">↗</span></a></div><footer class="installation-footer"><button type="button" class="installation-motion-toggle" aria-pressed="false">พักภาพช่าง Ⅱ</button><span>ภาพทีมช่างจริง · คลิกค้างเพื่อลากรูป</span></footer><div class="installation-progress" aria-hidden="true"><span></span></div></div>`;
        const featuredSection=host.closest('#featured');
        if(featuredSection)featuredSection.after(warranty);else host.append(warranty);
        this.featured.push(new FeaturedStoryMotion(warranty, 'warranty', this.motion.matches));
    }
    private photoMarkup(photos: FeaturedPhoto[],installation=false): string {
        return photos.map((photo, index) => { const size = projectPhotoSize(photo.image); return `<figure class="featured-photo featured-photo-${index + 1}${size.portrait ? ' is-portrait' : ''}" style="--photo-ratio:${size.ratio}" tabindex="0" role="button" aria-pressed="false" aria-label="${photo.caption} · คลิกค้างเพื่อลากรูป ใช้ปุ่มลูกศรเพื่อขยับ และ Home เพื่อคืนตำแหน่ง"><div class="featured-photo-image"><img src="${sitePath(photo.image)}" alt="${photo.alt}" loading="lazy" decoding="async" draggable="false" width="${size.width}" height="${size.height}" /></div><figcaption>${installation?`<span class="installation-card-copy"><b>${index<5?'COOLPLAN / TEAM':'INTERIOR / COOLPLAN'}</b><span>${photo.caption}</span></span>`:`<span>${String(index + 1).padStart(2, '0')}</span>${photo.caption}`}</figcaption></figure>`; }).join('');
    }
    dispose(): void {
        if (this.disposed)
            return;
        this.disposed = true;
        this.intro?.dispose();
        this.orbit?.dispose();
        this.featured.forEach(story => story.dispose());
        this.abort.abort();
    }
}
export function mountExperience(root: ParentNode = document): Experience | null {
    if (!root.querySelector('#experience-intro') && !root.querySelector('#featured'))
        return null;
    return new Experience(root);
}
