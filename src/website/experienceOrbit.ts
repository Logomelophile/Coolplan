import {sitePath} from '../sitePath';
import {COMPANY,PACKAGES} from './catalog';
import {motionPreference} from './motionPreference';
import {projectPhotoSize} from './projectPhotos';
import {orbitFrame,orbitPhotoPose} from './orbitTimeline';

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
    private readonly arcs:SVGCircleElement[];
    private readonly values:HTMLElement[];
    private readonly toggle:HTMLButtonElement;
    private readonly observer:IntersectionObserver;
    private readonly resize:ResizeObserver;
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
            return `<figure class="orbit-photo" style="--photo-ratio:${s.ratio}"><img src="${sitePath(`/website/showcase/${file}.webp`)}" alt="${alt}" width="${s.width}" height="${s.height}" loading="lazy" decoding="async"/></figure>`;
        }).join('')}</div><header class="orbit-heading"><p>COOLPLAN · OUR STORY</p><h2 id="experience-orbit-title" aria-label="เบื้องหลังความสมบูรณ์แบบ ของโครงการชั้นนำ">${['เบื้องหลังความสมบูรณ์แบบ','ของโครงการชั้นนำ'].map((text,i)=>`<span class="orbit-title-line ${i?'is-sub':''}"><span class="orbit-title-placeholder" aria-hidden="true">${text}</span><span class="orbit-typed" aria-hidden="true"></span></span>`).join('')}</h2></header><div class="orbit-statistics"><div class="orbit-total" aria-label="ปูพื้นสะสม 175,000 ตารางเมตร"><span>ปูพื้นสะสม</span><div><strong>0</strong><span>ตร.ม.</span></div></div><div class="orbit-dashboard">${METRICS.map((m,i)=>`<article class="orbit-stat" aria-label="${m.title} ${m.value.toLocaleString('th-TH')} ${m.unit}"><div class="orbit-gauge"><svg viewBox="0 0 240 240" aria-hidden="true"><circle class="orbit-gauge-orbit" cx="120" cy="120" r="116"/><circle class="orbit-gauge-track" cx="120" cy="120" r="103"/><circle class="orbit-gauge-fill" cx="120" cy="120" r="103" pathLength="100"/></svg><div><strong>0</strong><span>${m.unit}</span></div></div><p>${m.title}</p></article>`).join('')}</div></div><div class="orbit-handoff" aria-hidden="true"><span>จากทุกพื้นที่ สู่เรื่องราวของเรา</span></div><footer class="orbit-footer"><button type="button" class="orbit-pause" aria-pressed="false">พักการหมุนภาพ <span aria-hidden="true">Ⅱ</span></button><a href="#experience-timeline">เลื่อนต่อเพื่อชมเส้นทางของเรา <span aria-hidden="true">↓</span></a></footer></div>`;
        host.prepend(root);host.setAttribute('aria-labelledby','experience-orbit-title');
        this.scroll=root;this.stage=root.querySelector('.orbit-sticky')!;this.photos=Array.from(root.querySelectorAll('.orbit-photo'));
        this.title=root.querySelector('.orbit-heading')!;this.typed=Array.from(root.querySelectorAll('.orbit-typed'));
        const segmenter=new Intl.Segmenter('th',{granularity:'grapheme'});
        this.letters=Array.from(root.querySelectorAll('.orbit-title-placeholder'),e=>Array.from(segmenter.segment(e.textContent??''),p=>p.segment));
        this.stats=root.querySelector('.orbit-statistics')!;this.counter=root.querySelector('.orbit-total strong')!;
        this.arcs=Array.from(root.querySelectorAll('.orbit-gauge-fill'));this.values=Array.from(root.querySelectorAll('.orbit-gauge strong'));
        this.toggle=root.querySelector('.orbit-pause')!;
        const signal=this.abort.signal;
        this.toggle.addEventListener('click',()=>{this.paused=!this.paused;this.toggle.setAttribute('aria-pressed',String(this.paused));this.toggle.innerHTML=this.paused?'หมุนภาพต่อ <span aria-hidden="true">▶</span>':'พักการหมุนภาพ <span aria-hidden="true">Ⅱ</span>';this.wake();},{signal});
        window.addEventListener('scroll',this.onScroll,{passive:true,signal});window.addEventListener('resize',this.measure,{signal});
        document.addEventListener('visibilitychange',()=>document.hidden?this.stop():this.wake(),{signal});
        motionPreference.addEventListener('change',this.onPreference,{signal});
        this.observer=new IntersectionObserver(entries=>{this.visible=entries.some(e=>e.isIntersecting);if(this.visible){this.photos.forEach(e=>e.querySelector('img')!.loading='eager');this.wake();}else this.stop();},{rootMargin:'5% 0px'});this.observer.observe(root);
        this.resize=new ResizeObserver(this.measure);this.resize.observe(this.stage);
        this.progress=this.reduced?1:0;this.host.classList.toggle('orbit-reduced',this.reduced);this.measure();this.render();
    }
    get diagnostics(){const f=orbitFrame(this.reduced?1:this.progress);return {progress:this.progress,target:this.target,angle:this.angle,running:this.visible&&!this.reduced&&!this.paused&&!document.hidden&&f.snake<1,animating:this.progress!==this.target,typed:[f.head,f.sub],counter:this.reduced?175000:f.counter,rings:this.reduced?[1,1,1]:f.rings,snake:f.snake,exit:f.exit,photos:this.photos.length,reduced:this.reduced};}
    private measure=()=>{this.width=this.stage.clientWidth;this.height=this.stage.clientHeight;this.onScroll();this.render();};
    private onPreference=(event:MediaQueryListEvent)=>{this.stop();this.reduced=event.matches;this.host.classList.toggle('orbit-reduced',this.reduced);this.measure();if(this.reduced)this.progress=1;this.render();this.wake();};
    private onScroll=()=>{const rect=this.scroll.getBoundingClientRect(),lead=Math.min(180,innerHeight*.2),travel=this.scroll.offsetHeight-this.stage.offsetHeight;this.target=this.reduced?1:clamp((lead-rect.top)/(travel+lead));this.wake();};
    private wake(){if(!this.disposed&&!this.reduced&&this.visible&&!document.hidden&&!this.raf){this.lastTime=performance.now();this.raf=requestAnimationFrame(this.tick);}}
    private stop(){cancelAnimationFrame(this.raf);this.raf=0;}
    private tick=(now:number)=>{this.raf=0;if(this.disposed||!this.visible||document.hidden)return;
        const dt=Math.min(64,now-this.lastTime);this.lastTime=now;this.progress+=(this.target-this.progress)*.24;if(Math.abs(this.target-this.progress)<.0003)this.progress=this.target;
        const f=orbitFrame(this.progress);if(!this.reduced&&!this.paused)this.angle+=dt*.00013*(1-f.snake);
        this.render();if(!this.reduced&&(!this.paused&&f.snake<1||this.progress!==this.target))this.raf=requestAnimationFrame(this.tick);
    };
    private render(){const f=orbitFrame(this.progress),reduced=this.reduced;
        this.typed.forEach((e,i)=>{const fraction=reduced?1:i?f.sub:f.head,count=Math.ceil(this.letters[i].length*fraction);const text=this.letters[i].slice(0,count).join('');if(e.textContent!==text)e.textContent=text;e.classList.toggle('is-typing',fraction>0&&fraction<1);});
        this.title.style.opacity=String(reduced?1:f.title);this.stats.style.opacity=String(reduced?1:f.stats);
        const total=(reduced?175000:f.counter).toLocaleString('th-TH');if(this.counter.textContent!==total)this.counter.textContent=total;
        this.stage.style.setProperty('--snake',String(f.snake));this.stage.style.setProperty('--exit',String(f.exit));
        this.arcs.forEach((e,i)=>{const amount=reduced?1:f.rings[i];e.style.strokeDashoffset=String((1-amount)*100);const text=Math.round(METRICS[i].value*amount).toLocaleString('th-TH');if(this.values[i].textContent!==text)this.values[i].textContent=text;this.values[i].closest<HTMLElement>('.orbit-stat')!.style.opacity=String(reduced?1:clamp((this.progress-.34-i*.035)/.08));});
        this.photos.forEach((e,i)=>{if(reduced){e.style.removeProperty('transform');e.style.opacity='1';return;}const pose=orbitPhotoPose(i,this.photos.length,this.angle,this.progress,this.width,this.height);e.style.transform=`translate3d(${pose.x}px,${pose.y}px,0) translate(-50%,-50%) rotate(${pose.rotation}deg) scale(${pose.scale})`;e.style.opacity=String(pose.opacity);});
    }
    dispose(){if(this.disposed)return;this.disposed=true;this.stop();this.abort.abort();this.observer.disconnect();this.resize.disconnect();}
}
