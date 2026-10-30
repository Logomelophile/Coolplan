import {sitePath} from '../sitePath';
import {COMPANY,PACKAGES} from './catalog';
import {motionPreference} from './motionPreference';
import {projectPhotoSize} from './projectPhotos';
import {orbitFrame,orbitPhotoPose,orbitLayout} from './orbitTimeline';
import {journeyFrame,measureJourney,ORBIT_END} from './experienceJourney';

const PHOTOS=[
    ['chevron-hall','พื้นลายเชฟรอนในโถงทางเดิน'],['orbit-wood-cafe','พื้นลายไม้ในคาเฟ่'],
    ['orbit-van','งานพื้นภายในรถตู้'],['orbit-studio','พื้นสตูดิโอออกกำลังกาย'],
    ['orbit-restaurant','พื้นลายไม้ในร้านอาหาร'],['installation-prep','ทีมช่างเตรียมพื้นหน้างาน'],
    ['stair-oak','รายละเอียดพื้นบันได'],['orbit-warm-stairs','งานบันไดลายไม้โทนอุ่น'],
    ['cafe-herringbone-top','พื้นก้างปลาจากมุมสูงของคาเฟ่'],['cafe-herringbone','พื้นก้างปลาบริเวณที่นั่งคาเฟ่'],
    ['preparation-primer','ทีมช่างเตรียมผิวพื้นก่อนติดตั้ง'],
];
const METRICS=[{value:COMPANY.years,unit:'ปี',title:'ประสบการณ์ตั้งแต่ปี 2005'},
    {value:175000,unit:'ตร.ม.',title:'ผลงานติดตั้งสะสม'},
    {value:PACKAGES[0].warrantyYears,unit:'ปี',title:'รับประกันการติดตั้ง'}];
const clamp=(n:number)=>Math.max(0,Math.min(1,n));

/** A continuously orbiting photographic introduction. Native scroll controls the story, never the orbit clock. */
export class ExperienceOrbit {
    private readonly abort=new AbortController();
    private readonly scroll:HTMLElement;
    private readonly stage:HTMLElement;
    private readonly photos:HTMLElement[];
    private readonly title:HTMLElement;
    private readonly typed:HTMLElement[];
    private readonly letters:string[][];
    private readonly stats:HTMLElement;
    private readonly counter:HTMLElement;
    private readonly messages:HTMLElement[];
    private readonly arcs:SVGCircleElement[];
    private readonly values:HTMLElement[];
    private readonly toggle:HTMLButtonElement;
    private readonly observer:IntersectionObserver;
    private readonly resize:ResizeObserver;
    private readonly pin:HTMLElement;
    private readonly timeline:HTMLElement;
    private journeyProgress=0;
    private journeyTarget=0;
    private progress=0;
    private target=0;
    private angle=0;
    private lastTime=0;
    private raf=0;
    private visible=false;
    private paused=false;
    private reduced=motionPreference.matches;
    private width=1;
    private height=1;
    private disposed=false;
    constructor(private readonly host:HTMLElement) {
        host.classList.add('has-orbit');
        const root=document.createElement('div');root.className='orbit-scroll';
        root.innerHTML=`<div class="orbit-sticky"><div class="orbit-photo-field" aria-label="ภาพผลงานแนวตั้งของ COOLPLAN">${PHOTOS.map(([file,alt])=>{
            const s=projectPhotoSize(file);if(!s.portrait)throw new Error(`Orbit photo must be portrait: ${file}`);
            return `<figure class="orbit-photo" style="--photo-ratio:${s.ratio}"><img src="${sitePath(`/website/showcase/${file}.webp`)}" alt="${alt}" width="${s.width}" height="${s.height}" loading="lazy" decoding="sync"/></figure>`;
        }).join('')}</div><header class="orbit-heading"><p>COOLPLAN · OUR STORY</p><h2 id="experience-orbit-title" aria-label="เบื้องหลังความสมบูรณ์แบบ ของโครงการชั้นนำ">${['เบื้องหลังความสมบูรณ์แบบ','ของโครงการชั้นนำ'].map((text,i)=>`<span class="orbit-title-line ${i?'is-sub':''}"><span class="orbit-title-placeholder" aria-hidden="true">${text}</span><span class="orbit-typed" aria-hidden="true"></span></span>`).join('')}</h2></header><div class="orbit-statistics"><div class="orbit-total" aria-label="ปูพื้นสะสม 175,000 ตารางเมตร"><span>ปูพื้นสะสม</span><div><strong>0</strong><span>ตร.ม.</span></div></div><div class="orbit-dashboard">${METRICS.map((m,i)=>`<article class="orbit-stat" aria-label="${m.title} ${m.value.toLocaleString('th-TH')} ${m.unit}"><div class="orbit-gauge"><svg viewBox="0 0 240 240" aria-hidden="true"><circle class="orbit-gauge-orbit" cx="120" cy="120" r="116"/><circle class="orbit-gauge-track" cx="120" cy="120" r="103"/><circle class="orbit-gauge-fill" cx="120" cy="120" r="103" pathLength="100"/></svg><div><strong>0</strong><span>${m.unit}</span></div></div><p>${m.title}</p></article>`).join('')}</div></div><div class="orbit-handoff" aria-hidden="true"><span>จากทุกพื้นที่ สู่เรื่องราวของเรา</span></div><footer class="orbit-footer"><button type="button" class="orbit-pause" aria-pressed="false">พักการหมุนภาพ <span aria-hidden="true">Ⅱ</span></button><a href="#experience-timeline">เลื่อนต่อเพื่อชมเส้นทางของเรา <span aria-hidden="true">↓</span></a></footer></div>`;
        const message=document.createElement('div');message.className='orbit-messages';
        message.innerHTML='<p><strong>Luxury Flooring</strong><span>สำหรับพื้นที่ที่มีระดับ</span><small>จากโครงการบ้านและคอนโด<br>ถึงงานตกแต่งภายในรถ</small></p><p><strong>ยกระดับบ้านของคุณ</strong><span>ให้หรูอย่างมีสไตล์</span><small>ด้วยพื้น SPC COOLPLAN</small></p>';
        root.querySelector('.orbit-sticky')!.append(message);this.messages=Array.from(message.children) as HTMLElement[];
        const journey=document.createElement('div');journey.className='experience-journey';
        const pin=document.createElement('div');pin.className='experience-journey-sticky';
        const timeline=host.querySelector<HTMLElement>('.experience-scroll')!;
        host.prepend(journey);journey.append(pin);pin.append(root,timeline);
        this.pin=pin;this.timeline=timeline;
        host.setAttribute('aria-labelledby','experience-orbit-title');
        this.scroll=root;this.stage=root.querySelector('.orbit-sticky')!;this.photos=Array.from(root.querySelectorAll('.orbit-photo'));
        this.title=root.querySelector('.orbit-heading')!;this.typed=Array.from(root.querySelectorAll('.orbit-typed'));
        const segmenter=new Intl.Segmenter('th',{granularity:'grapheme'});
        this.letters=Array.from(root.querySelectorAll('.orbit-title-placeholder'),e=>Array.from(segmenter.segment(e.textContent??''),p=>p.segment));
        this.stats=root.querySelector('.orbit-statistics')!;this.counter=root.querySelector('.orbit-total strong')!;
        this.arcs=Array.from(root.querySelectorAll('.orbit-gauge-fill'));this.values=Array.from(root.querySelectorAll('.orbit-gauge strong'));
        this.toggle=root.querySelector('.orbit-pause')!;
        const signal=this.abort.signal;
        root.querySelector('a[href="#experience-timeline"]')!.addEventListener('click',event=>{event.preventDefault();if(this.reduced)this.timeline.scrollIntoView();else scrollTo({top:measureJourney(host).timelineStart,behavior:'smooth'});},{signal});
        this.toggle.addEventListener('click',()=>{this.paused=!this.paused;this.toggle.setAttribute('aria-pressed',String(this.paused));this.toggle.innerHTML=this.paused?'หมุนภาพต่อ <span aria-hidden="true">▶</span>':'พักการหมุนภาพ <span aria-hidden="true">Ⅱ</span>';this.wake();},{signal});
        window.addEventListener('scroll',this.onScroll,{passive:true,signal});window.addEventListener('resize',this.measure,{signal});
        document.addEventListener('visibilitychange',()=>document.hidden?this.stop():this.wake(),{signal});
        motionPreference.addEventListener('change',this.onPreference,{signal});
        this.observer=new IntersectionObserver(entries=>{this.visible=entries.some(e=>e.isIntersecting);if(this.visible){this.photos.forEach(e=>e.querySelector('img')!.loading='eager');this.wake();}else this.stop();},{rootMargin:'5% 0px'});this.observer.observe(journey);
        this.resize=new ResizeObserver(this.measure);this.resize.observe(this.stage);this.resize.observe(journey);
        this.progress=this.reduced?1:0;this.host.classList.toggle('orbit-reduced',this.reduced);this.measure();this.render();
    }
    get diagnostics(){const f=orbitFrame(this.reduced?1:this.progress),r=measureJourney(this.host);return {progress:this.progress,target:this.target,journeyProgress:this.journeyProgress,handoff:journeyFrame(this.journeyProgress).handoff,scroll:{startPx:r.start,travelPx:r.travel,orbitEnd:ORBIT_END},angle:this.angle,running:this.visible&&!this.reduced&&!this.paused&&!document.hidden&&f.snake<1,animating:this.journeyProgress!==this.journeyTarget,typed:[f.head,f.sub],counter:this.reduced?175000:f.counter,rings:this.reduced?[1,1,1]:f.rings,snake:f.snake,exit:f.exit,photos:this.photos.length,reduced:this.reduced};}
    private measure=()=>{this.width=this.stage.clientWidth;this.height=this.stage.clientHeight;
        const l=orbitLayout(this.width,this.height),short=this.height<=500&&this.width>520,mobile=this.width<=520;
        this.stage.style.setProperty('--orbit-content-width',`${l.contentWidth}px`);
        this.stage.style.setProperty('--orbit-content-height',`${l.contentHeight}px`);
        this.stage.style.setProperty('--orbit-photo-height',`${l.photoHeight}px`);
        this.stage.style.setProperty('--orbit-counter-size',`${short?32:mobile?32:Math.min(80,l.contentWidth*.12,l.contentHeight*.28)}px`);
        this.stage.style.setProperty('--orbit-gauge-size',`${short?38:mobile?48:Math.min(98,l.contentWidth*.21,l.contentHeight*.34)}px`);
        this.onScroll();this.render();};
    private onPreference=(event:MediaQueryListEvent)=>{this.stop();this.reduced=event.matches;this.host.classList.toggle('orbit-reduced',this.reduced);this.measure();this.journeyProgress=this.journeyTarget;this.progress=this.reduced?1:journeyFrame(this.journeyProgress).orbit;this.render();this.wake();};
    private onScroll=()=>{const r=measureJourney(this.host);this.journeyTarget=this.reduced?1:clamp((scrollY-r.start)/r.travel);this.target=journeyFrame(this.journeyTarget).orbit;this.wake();};
    private wake(){if(!this.disposed&&!this.reduced&&this.visible&&!document.hidden&&!this.raf){this.lastTime=performance.now();this.raf=requestAnimationFrame(this.tick);}}
    private stop(){cancelAnimationFrame(this.raf);this.raf=0;}
    private tick=(now:number)=>{this.raf=0;if(this.disposed||!this.visible||document.hidden)return;
        const dt=Math.min(64,now-this.lastTime);this.lastTime=now;this.journeyProgress+=(this.journeyTarget-this.journeyProgress)*.24;if(Math.abs(this.journeyTarget-this.journeyProgress)<.00003)this.journeyProgress=this.journeyTarget;this.progress=journeyFrame(this.journeyProgress).orbit;
        const f=orbitFrame(this.progress);if(!this.reduced&&!this.paused)this.angle+=dt*.00013*(1-f.snake);
        this.render();if(!this.reduced&&(!this.paused&&f.snake<1||this.journeyProgress!==this.journeyTarget))this.raf=requestAnimationFrame(this.tick);
    };
    private render(){const f=orbitFrame(this.progress),reduced=this.reduced;
        const handoff=journeyFrame(this.journeyProgress).handoff;
        this.pin.style.setProperty('--journey-handoff',String(handoff));
        this.timeline.inert=!reduced&&handoff<.999;
        this.scroll.inert=!reduced&&handoff>.001;
        this.title.style.top=reduced?'':`${48-f.titleDock*23}%`;
        this.typed.forEach((e,i)=>{const fraction=reduced?1:i?f.sub:f.head,count=Math.ceil(this.letters[i].length*fraction);const text=this.letters[i].slice(0,count).join('');if(e.textContent!==text)e.textContent=text;e.classList.toggle('is-typing',fraction>0&&fraction<1);});
        this.title.style.opacity=String(reduced?1:f.title);this.stats.style.opacity=String(reduced?1:f.stats);
        this.messages.forEach((e,i)=>{const amount=reduced?1:i?f.invitation:f.luxury;e.style.opacity=String(amount);e.style.transform=`translateY(${(1-amount)*12}px)`;});
        const total=(reduced?175000:f.counter).toLocaleString('th-TH');if(this.counter.textContent!==total)this.counter.textContent=total;
        this.stage.style.setProperty('--snake',String(f.snake));this.stage.style.setProperty('--exit',String(f.exit));
        this.arcs.forEach((e,i)=>{const amount=reduced?1:f.rings[i];e.style.strokeDashoffset=String((1-amount)*100);const text=Math.round(METRICS[i].value*amount).toLocaleString('th-TH');if(this.values[i].textContent!==text)this.values[i].textContent=text;this.values[i].closest<HTMLElement>('.orbit-stat')!.style.opacity=String(reduced?1:clamp((this.progress-.44-i*.04)/.06));});
        this.photos.forEach((e,i)=>{if(reduced){e.style.removeProperty('transform');e.style.opacity='1';return;}const pose=orbitPhotoPose(i,this.photos.length,this.angle,this.progress,this.width,this.height);e.style.transform=`translate3d(${pose.x}px,${pose.y}px,0) translate(-50%,-50%) rotate(${pose.rotation}deg) scale(${pose.scale})`;e.style.opacity=String(pose.opacity);});
    }
    dispose(){if(this.disposed)return;this.disposed=true;this.stop();this.abort.abort();this.observer.disconnect();this.resize.disconnect();}
}
