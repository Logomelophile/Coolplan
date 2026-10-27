import { FloorStoryScene } from './FloorStoryScene';
import { HeroRoomFloor } from './HeroRoomFloor';
import { STORY_STEPS,STORY_END,STORY_UNIT,STORY_LAST,DETAIL_STOP,sampleStory } from './storyTimeline';
import './story.css';

type Anchor={id:string;x:number;y:number;visible?:boolean};
/** Time constant of the scroll follow. Long enough to hide wheel notches, short enough to never feel late. */
const FOLLOW_SECONDS=.14;
type Callbacks={onFinish?:(index:number)=>void;onFrame?:(frame:ReturnType<typeof sampleStory>)=>void};
const layers=[
  {id:'wear',title:'Wear Layer',thai:'ชั้นเคลือบป้องกันผิว',text:'ชั้นใสบนสุด ช่วยกันรอยขีดข่วนและคราบจากการใช้งานทุกวัน'},
  {id:'decor',title:'Decor Film',thai:'ฟิล์มลวดลายไม้',text:'ฟิล์มพิมพ์ลายไม้ ให้สีและลวดลายของพื้นแต่ละรุ่น'},
  {id:'core',title:'SPC Core',thai:'แกนกลาง SPC',text:'แกนผสมผงหิน แข็งแรงและคงรูป เป็นโครงสร้างหลักของแผ่น'},
  {id:'backing',title:'IXPE Backing',thai:'ชั้นรองพื้น IXPE',text:'ชั้นโฟมรองใต้แผ่น ช่วยลดเสียงกระทบและให้สัมผัสนุ่มเวลาเดิน'},
];
export class FloorScrollStory{
  readonly ready:Promise<void>;
  readonly scene:FloorStoryScene;
  readonly room:HeroRoomFloor;
  private host=document.getElementById('floor-story')!;
  private hero=document.getElementById('hero')!;
  private shell=document.getElementById('hero-3d-shell')!;
  private frame=sampleStory(0);
  private abort=new AbortController();
  private raf=0;
  private disposed=false;
  private loaded=false;
  private anchors:Anchor[]=[];
  private lastFinish=-1;
  private manualFinish:number|null=null;
  private manualExplode:number|null=null;
  private target=0;
  private follow=0;
  private followTime=0;
  private reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  private panel:HTMLElement;
  private overlay:SVGSVGElement;
  private status:HTMLElement;
  constructor(private callbacks:Callbacks={}){
    this.hero.insertAdjacentHTML('afterbegin','<div id="hero-room-background" aria-hidden="true"></div><div class="story-detail-wash" aria-hidden="true"></div>');
    this.hero.insertAdjacentHTML('beforeend',`<div class="story-copy" id="story-copy"><span class="story-eyebrow" id="story-eyebrow"></span><h2 id="story-title"></h2><p id="story-description"></p><div class="story-thickness" id="story-thickness"><strong>5<span>MM</span></strong><small>ความหนารวมของแผ่นพื้น</small></div></div><svg class="story-leaders" id="story-leaders" aria-hidden="true">${layers.map((layer,index)=>`<polyline data-leader="${layer.id}"/><circle data-dot="${layer.id}" r="5"/><text data-num="${layer.id}">${index+1}</text>`).join('')}</svg><div class="story-labels" id="story-labels">${layers.map((layer,index)=>`<div class="story-layer" data-layer="${layer.id}" data-shown="false"><span class="story-layer-number">0${index+1}</span><div><strong>${layer.title}</strong><b>${layer.thai}</b><small>${layer.text}</small></div></div>`).join('')}</div><div class="story-rail"><div class="story-rail-top"><span id="story-step-name">เลื่อนเพื่อสำรวจสีและชั้นวัสดุ</span><a href="#rooms" id="story-skip">เลือกสีพื้นด้านล่าง <span aria-hidden="true">↘</span></a></div><div class="story-rail-controls"><button id="story-prev" type="button" aria-label="ขั้นก่อนหน้า">←</button><div class="story-steps" role="group" aria-label="ลำดับการสำรวจ">${STORY_STEPS.map((step,index)=>`<button type="button" data-story-step="${index}" aria-label="ขั้น ${index+1}: ${step.title.replace('\n',' ')}" title="${step.title.replace('\n',' ')}"><span></span></button>`).join('')}</div><button id="story-next" type="button" aria-label="ขั้นถัดไป">→</button></div></div><p class="story-caption" id="story-caption">ชิ้นตัวอย่างวัสดุ · ขยายระยะระหว่างชั้นเพื่ออธิบายโครงสร้าง</p><div class="story-loading" id="story-loading" role="status">กำลังเตรียมห้องและวัสดุ 3D…</div>`);
    this.panel=document.getElementById('story-labels')!;this.overlay=document.getElementById('story-leaders') as unknown as SVGSVGElement;this.status=document.getElementById('story-loading')!;
    this.overlay.insertAdjacentHTML('beforeend','<g id="story-dimension" opacity="0"><path/><text>5 MM</text></g>');
    this.room=new HeroRoomFloor(document.getElementById('hero-room-background')!);
    this.scene=new FloorStoryScene(document.getElementById('hero-viewer')!,{onAnchors:anchors=>{this.anchors=anchors;this.updateLeaders();}});
    const signal=this.abort.signal;
    document.querySelectorAll<HTMLButtonElement>('button[data-story-step]').forEach(button=>button.addEventListener('click',()=>this.seekStep(Number(button.dataset.storyStep),true),{signal}));
    document.getElementById('story-next')!.addEventListener('click',()=>{if(this.frame.step===STORY_LAST)document.getElementById('rooms')!.scrollIntoView({behavior:this.reduced.matches?'instant':'smooth'});else this.seekStep(this.frame.step+1,true);},{signal});
    document.getElementById('story-prev')!.addEventListener('click',()=>this.seekStep(Math.max(0,this.frame.step-1),true),{signal});
    window.addEventListener('scroll',this.schedule,{signal,passive:true});window.addEventListener('resize',this.schedule,{signal,passive:true});
    this.reduced.addEventListener('change',this.updateReduced,{signal});this.updateReduced();
    this.apply(0);
    this.ready=Promise.all([this.scene.ready,this.room.ready]).then(()=>{
      if(this.disposed)return;this.loaded=true;this.status.hidden=true;this.readScroll(true);
      if(!this.scene.diagnostics.webgl){document.getElementById('hero-hint')!.textContent='อุปกรณ์นี้ไม่รองรับ 3D · ใช้ปุ่มด้านล่างเพื่อสำรวจสีและข้อมูลวัสดุ';this.hero.classList.add('story-no-webgl');}
    }).catch(error=>{if(!this.disposed){this.status.textContent='โหลดวัสดุไม่สำเร็จ กรุณาโหลดหน้าใหม่ หรือเลื่อนต่อเพื่อเลือกพื้น';this.hero.classList.add('story-load-error');}console.error(error);});
  }
  private updateReduced=()=>{this.readScroll(true);};
  private schedule=()=>{if(!this.raf)this.raf=requestAnimationFrame(()=>{this.raf=0;this.readScroll();});};
  private readScroll(force=false){
    if(this.disposed)return;
    const start=this.host.getBoundingClientRect().top+scrollY;
    const progress=Math.max(0,Math.min(STORY_END,(scrollY-start)/(this.hero.offsetHeight*STORY_UNIT)));
    document.body.classList.toggle('story-pinned',scrollY<start+this.hero.offsetHeight*STORY_END*STORY_UNIT);
    // A new scroll position releases manual slider/finish overrides; the follow ticks below must not, or a slider change mid-glide is lost.
    if(Math.abs(progress-this.target)>.00001&&progress<STORY_END){this.manualFinish=null;this.manualExplode=null;}
    this.target=progress;
    if(Math.abs(progress-this.frame.progress)<=.00001&&!force)return;
    // Wheel notches arrive as steps; a short damped follow turns them into one continuous move. Direct seeks and reduced motion snap.
    if(force||this.reduced.matches){this.stopFollow();this.apply(progress);}
    else if(!this.follow){this.followTime=performance.now();this.follow=requestAnimationFrame(this.tick);}
  }
  private stopFollow(){if(this.follow){cancelAnimationFrame(this.follow);this.follow=0;}}
  private tick=(now:number)=>{
    this.follow=0;
    if(this.disposed)return;
    const dt=Math.min(.064,Math.max(0,(now-this.followTime)/1000));this.followTime=now;
    const diff=this.target-this.frame.progress;
    if(Math.abs(diff)<.0005){this.apply(this.target);return;}
    this.apply(this.frame.progress+diff*(1-Math.exp(-dt/FOLLOW_SECONDS)));
    this.follow=requestAnimationFrame(this.tick);
  };
  private apply(progress:number){
    this.frame=sampleStory(progress);
    const f=this.frame;
    if(this.manualFinish!==null){f.from=f.to=f.finishIndex=this.manualFinish;f.mix=0;}
    if(this.manualExplode!==null)f.explode=f.explosion=this.manualExplode;
    const step=STORY_STEPS[f.step];
    this.hero.style.setProperty('--story-detail',String(f.detail));this.hero.style.setProperty('--story-intro',String(f.intro));
    this.hero.dataset.storyStep=String(f.step);this.hero.classList.toggle('story-details',f.detail>.6);
    // The copy and tool bar change layout when story-details flips at .6; fade them through that instant instead of jumping.
    const across=Math.min(1,Math.abs(f.detail-.6)/.22),settled=across*across*(3-2*across);
    this.hero.style.setProperty('--story-switch',String(1-settled));
    document.getElementById('story-copy')!.style.opacity=String((1-f.intro)*settled);
    document.getElementById('story-eyebrow')!.textContent=step.eyebrow;document.getElementById('story-title')!.textContent=step.title;document.getElementById('story-description')!.textContent=step.description;
    const thickness=document.getElementById('story-thickness')!;thickness.style.opacity=String(f.thickness);thickness.setAttribute('aria-hidden',String(f.thickness<.5));
    document.getElementById('story-step-name')!.textContent=`${String(f.step+1).padStart(2,'0')} / ${STORY_STEPS.length} · ${f.step<DETAIL_STOP?'เลือกบรรยากาศที่เป็นคุณ':f.step===DETAIL_STOP?'เข้าใกล้รายละเอียด':f.step===STORY_LAST?'ครบทุกชั้นแล้ว':layers[f.step-DETAIL_STOP-1].title}`;
    this.panel.querySelectorAll<HTMLElement>('.story-layer').forEach((el,index)=>{el.style.opacity=String(f.labelsVisible[index]);el.dataset.shown=String(f.labelsVisible[index]>.5);el.setAttribute('aria-hidden',String(f.labelsVisible[index]<.5));el.classList.toggle('active',f.focus===index);});
    document.querySelectorAll<HTMLElement>('button[data-story-step]').forEach((el,index)=>{el.setAttribute('aria-current',index===f.step?'step':'false');el.classList.toggle('is-complete',index<f.step);});
    (document.getElementById('story-prev') as HTMLButtonElement).disabled=f.step===0;
    if(this.loaded){this.room.setBlend(f.from,f.to,f.mix);this.scene.setFrame({from:f.from,to:f.to,mix:f.mix,explode:f.explode,focus:f.focus,zoom:f.zoom,profile:f.profile});}
    if(f.finishIndex!==this.lastFinish){this.lastFinish=f.finishIndex;this.callbacks.onFinish?.(f.finishIndex);}
    this.callbacks.onFrame?.(f);this.updateLeaders();
  }
  private updateLeaders(){
    if(this.disposed||!this.overlay)return;
    const heroRect=this.hero.getBoundingClientRect(),sceneRect=document.getElementById('hero-viewer')!.getBoundingClientRect();
    this.overlay.setAttribute('viewBox',`0 0 ${heroRect.width} ${heroRect.height}`);
    this.anchors.forEach(anchor=>{
      const label=this.panel.querySelector<HTMLElement>(`[data-layer="${anchor.id}"]`),line=this.overlay.querySelector<SVGPolylineElement>(`[data-leader="${anchor.id}"]`),dot=this.overlay.querySelector<SVGCircleElement>(`[data-dot="${anchor.id}"]`);if(!label||!line||!dot)return;
      const rect=label.getBoundingClientRect(),x=anchor.x+sceneRect.left-heroRect.left,y=anchor.y+sceneRect.top-heroRect.top;
      const mobile=innerWidth<=520;
      // Lines meet the row beside its number, not its vertical middle, so multi-line rows do not pull lines downward.
      const badge=label.querySelector('.story-layer-number')?.getBoundingClientRect();
      const endX=rect.left-heroRect.left+(mobile?rect.width/2:-12),endY=(badge?badge.top+badge.height/2:rect.top+rect.height/2)-heroRect.top;
      const index=layers.findIndex(layer=>layer.id===anchor.id),opacity=anchor.visible===false?0:this.frame.labelsVisible[index];
      // The line leaves the layer edge and ends in a dot beside the row's number, one line per row.
      // Phones have no room for lines: a numbered badge sits on the layer edge and matches the numbered list below.
      const num=this.overlay.querySelector<SVGTextElement>(`[data-num="${anchor.id}"]`)!,dotX=mobile?x:endX,dotY=mobile?y:endY;
      // Elbow 18px before the dot; when the layer edge is already past that point, run straight to the dot instead of folding back.
      if(!mobile)line.setAttribute('points',x<endX-24?`${x.toFixed(2)},${y.toFixed(2)} ${(endX-18).toFixed(2)},${endY.toFixed(2)} ${endX.toFixed(2)},${endY.toFixed(2)}`:`${x.toFixed(2)},${y.toFixed(2)} ${endX.toFixed(2)},${endY.toFixed(2)}`);
      line.style.opacity=String(mobile?0:opacity);dot.style.opacity=String(opacity);num.style.opacity=String(opacity);
      dot.setAttribute('cx',String(dotX));dot.setAttribute('cy',String(dotY));num.setAttribute('x',String(dotX));num.setAttribute('y',String(dotY));
      dot.classList.toggle('active',this.frame.focus===index);
    });
    const dimension=document.getElementById('story-dimension')!,points=this.scene?.getThicknessAnchors();
    const show=this.frame.progress>DETAIL_STOP-.25&&this.frame.progress<=DETAIL_STOP+.2&&this.frame.explode<.001&&points?.top.visible&&points.bottom.visible;
    dimension.setAttribute('opacity',show?'1':'0');
    if(show&&points){const a={x:points.top.x+sceneRect.left-heroRect.left,y:points.top.y+sceneRect.top-heroRect.top},b={x:points.bottom.x+sceneRect.left-heroRect.left,y:points.bottom.y+sceneRect.top-heroRect.top};dimension.querySelector('path')!.setAttribute('d',`M ${a.x-6} ${a.y} h 12 M ${a.x} ${a.y} L ${b.x} ${b.y} M ${b.x-6} ${b.y} h 12 M ${a.x} ${a.y} l -20 -28 h -35`);const text=dimension.querySelector('text')!;text.setAttribute('x',String(Math.max(12,a.x-55)));text.setAttribute('y',String(a.y-34));}
  }
  seekStep(index:number,smooth=false){
    const target=Math.max(0,Math.min(STORY_LAST,index));
    const top=this.host.getBoundingClientRect().top+scrollY+target*this.hero.offsetHeight*STORY_UNIT;
    window.scrollTo({top,behavior:smooth&&!this.reduced.matches?'smooth':'instant'});this.readScroll(true);
  }
  setExplode(value:number){this.manualExplode=Math.max(0,Math.min(1,value));this.apply(this.frame.progress);}
  selectFinish(index:number){this.manualFinish=index;this.apply(this.frame.progress);}
  resetView(){this.scene.resetView();}
  get diagnostics(){return {scene:this.scene.diagnostics,room:this.room.diagnostics,anchors:this.anchors.map(a=>({...a})),reducedMotion:this.reduced.matches,loaded:this.loaded,disposed:this.disposed};}
  get state(){return {progress:this.frame.progress,step:this.frame.step,frame:{...this.frame,labelsVisible:[...this.frame.labelsVisible]},diagnostics:this.diagnostics};}
  dispose(){if(this.disposed)return;this.disposed=true;cancelAnimationFrame(this.raf);this.stopFollow();this.abort.abort();this.scene.dispose();this.room.dispose();document.body.classList.remove('story-pinned');}
}
