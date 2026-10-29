import './shared.css';
import './home.css';
import './brand-introduction.css';
import './experience.css';
import './experienceDashboard.css';
import './experienceRedesign.css';
import './clientLogos.css';
import './showcase.css';
import './collections.css';
import './herringbone.css';
import { mountShowcase } from './showcase';
import { mountHerringbone } from './herringbone';
import { mountExperience } from './experience';
import { mountClientLogos } from './clientLogos';
import { mountCollections, mountPricing } from './collections';
import { FloorScrollStory } from './FloorScrollStory';
import './visualizer.css';
import { FloorVisualizer, type FloorVisualizerDiagnostics as RoomPreviewDiagnostics } from './visualizer';
import { mountVisualizerToolbar, type ToolbarHandle } from './visualizer/ui/Toolbar';
import { mountQrDialog, UPLOAD_HASH } from './visualizer/ui/QrDialog';
import { track } from './visualizer/analytics';
import { icon, mountHeader, mountFooter, mountContactDialog } from './shared';
import { SAMPLE_ROOMS } from './visualizer/rooms';
import { sitePath } from '../sitePath';
import type { FloorPattern } from './visualizer/texture/layout';

const $ = <T extends HTMLElement = HTMLElement>(id:string) => document.getElementById(id) as T;
const floors = [
  {name:'Light Natural Oak',code:'CP-101',id:'light-natural-oak',tones:[1,2],crop:[76,979,132,86]},
  {name:'Warm Oak',code:'CP-102',id:'warm-taupe-oak',tones:[1,3],crop:[228,978,139,89]},
  {name:'Honey Oak',code:'CP-103',id:'golden-honey-oak',tones:[1,3],crop:[385,978,139,89]},
  {name:'Classic Oak',code:'CP-104',id:'whitewashed-ash-oak',tones:[2,3],crop:[73,1123,137,89]},
  {name:'Grey Oak',code:'CP-105',id:'greige-oak',tones:[4],crop:[229,1123,137,89]},
  {name:'Walnut Brown',code:'CP-106',id:'dark-walnut-brown',tones:[5],crop:[385,1123,139,89]},
] as const;
const rooms=SAMPLE_ROOMS.map(room=>room.name!);
const viewNames=['ภาพห้องเต็ม','ดูด้านซ้าย','ดูด้านขวา','ดูส่วนกลาง','รายละเอียดด้านซ้าย','รายละเอียดพื้น'];
const state={finish:0,room:0,view:0,filter:0,compare:false,progress:.65,disposed:false};
let story:FloorScrollStory|undefined;
const abort = new AbortController();
const listen = (node:EventTarget,event:string,callback:EventListener) => node.addEventListener(event,callback,{signal:abort.signal});

mountHeader('home');
mountFooter();
mountContactDialog();
const experience=mountExperience(document);
const clientLogos=mountClientLogos(document.getElementById('client-logos'));
const showcase=mountShowcase(document.getElementById('showcase'));
const collections=mountCollections(document.getElementById('collections'));
const herringbone=mountHerringbone(document.getElementById('herringbone'));
const pricing=mountPricing(document.getElementById('pricing'));
document.querySelectorAll<HTMLElement>('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon!));

function syncPreview(value:RoomPreviewDiagnostics) {
  if(state.disposed)return;
  state.compare=value.compare;
  $('compare-toggle').setAttribute('aria-pressed',String(value.compare));
  $('room-preview-shell').classList.toggle('upload-picking',value.uploaded&&!value.floorSelected);
  $('room-preview-shell').classList.toggle('upload-scanning',value.stage==='scanning');
  tools?.update(value);
  $('preview-selection').textContent=`${floors[state.finish].name} · ${value.pattern==='herringbone'?'ลายก้างปลา':'ลายตรง'}`;
  document.querySelectorAll<HTMLButtonElement>('[data-pattern]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.pattern===value.pattern)));
  $('reset-upload').hidden=!value.uploaded;
  $('reset-upload').textContent='กลับสู่ห้องตัวอย่าง';
  $('sample-tab').classList.toggle('active',!value.uploaded);
  $('sample-tab').setAttribute('aria-pressed',String(!value.uploaded));
  $('upload-tab').classList.toggle('active',value.uploaded);
  $('upload-tab').setAttribute('aria-pressed',String(value.uploaded));
  $('previous-room').hidden=value.uploaded;
  $('next-room').hidden=value.uploaded;
}
let tools:ToolbarHandle|undefined;
const preview=new FloorVisualizer($('room-preview'),{productIds:floors.map(floor=>floor.id),onHint:message=>$('preview-hint').textContent=message,onChange:syncPreview});
const toneNames=['','ธรรมชาติ','อ่อน','คลาสสิก','เทา','เข้ม'];
tools=mountVisualizerToolbar($('room-preview-shell'),preview,{
  hint:message=>$('preview-hint').textContent=message,
  fileName:()=>`coolplan-${floors[state.finish].code}-${preview.diagnostics.pattern}`,
  products:()=>floors.map(floor=>({id:floor.code,name:floor.name,nameTh:floor.name,tone:floor.tones.map(tone=>toneNames[tone]).join('/')})),
  onAdvice:ids=>{document.querySelectorAll<HTMLElement>('[data-product]').forEach(el=>el.classList.toggle('is-suggested',ids.includes(floors[Number(el.dataset.product)].code)));},
});
// Plank-direction toggle lives beside the hint so the markup stays unchanged.
const rotateButton=document.createElement('button');rotateButton.type='button';rotateButton.id='rotate-planks';rotateButton.className='rotate-planks';rotateButton.innerHTML=`${icon('compare')}<span>หมุนลายแผ่น</span>`;rotateButton.setAttribute('aria-label','หมุนทิศทางลายแผ่น 90 องศา');
$('preview-hint').insertAdjacentElement('afterend',rotateButton);
listen(rotateButton,'click',()=>preview.rotate());
tools.element.querySelector('.visualizer-quick')!.prepend(rotateButton);
document.querySelectorAll<HTMLButtonElement>('[data-pattern]').forEach(button=>listen(button,'click',()=>preview.setPattern(button.dataset.pattern as FloorPattern)));
// Herringbone section CTA: switch the simulator to the herringbone lay-up and bring it into view.
const herringboneCta=document.getElementById('herringbone-cta');
if(herringboneCta)listen(herringboneCta,'click',()=>{preview.setPattern('herringbone');$('products').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});track({name:'visualizer_tool',tool:'herringbone-cta'});});
// Desktop visitors can continue on their phone: QR of this page with a hash that jumps to the visualizer.
const qr=mountQrDialog(`${location.origin}${location.pathname}${UPLOAD_HASH}`);
const qrButton=document.createElement('button');qrButton.type='button';qrButton.id='open-on-phone';qrButton.className='rotate-planks';qrButton.innerHTML=`${icon('camera')}<span>ถ่ายด้วยมือถือ</span>`;
tools.element.querySelector('.visualizer-export')!.append(qrButton);
listen(qrButton,'click',()=>qr.open());
if(location.hash===UPLOAD_HASH){requestAnimationFrame(()=>{$('room-preview-shell').scrollIntoView({block:'center'});$('preview-hint').textContent='แตะ "อัปโหลดรูปห้องของคุณ" เพื่อถ่ายรูปห้อง แล้วระบบจะหาพื้นให้อัตโนมัติ';$('upload-tab').focus();});}

function roomButton(index:number) {
  const button=document.createElement('button');button.type='button';button.className='room-choice';button.dataset.room=String(index);
  button.setAttribute('aria-pressed',String(index===state.room));
  const photo=document.createElement('span');photo.className='room-photo';photo.style.backgroundImage=`url('${sitePath(SAMPLE_ROOMS[index].image!)}')`;photo.style.backgroundSize='cover';photo.style.backgroundPosition='center';
  const label=document.createElement('span');label.textContent=rooms[index];button.append(photo,label);
  listen(button,'click',()=>{selectRoom(index);const gallery=$('room-gallery') as HTMLDialogElement;if(gallery.open)gallery.close();});
  return button;
}
function selectRoom(index:number) {
  state.room=(index+rooms.length)%rooms.length;state.view=0;
  preview.setRoom(state.room);preview.setCompare(false);
  document.querySelectorAll<HTMLElement>('[data-room]').forEach(el=>el.setAttribute('aria-pressed',String(Number(el.dataset.room)===state.room)));
  updateViews();
  $('room-preview').setAttribute('aria-label',`${rooms[state.room]} พร้อมพื้น ${floors[state.finish].name}`);
}
rooms.forEach((_,i)=>{$('room-choices').append(roomButton(i));$('gallery-grid').append(roomButton(i));});
listen($('all-rooms'),'click',()=>($('room-gallery') as HTMLDialogElement).showModal());
listen($('gallery-close'),'click',()=>($('room-gallery') as HTMLDialogElement).close());

function updateViews(){
  const positions=['50% 50%','18% 54%','83% 54%','50% 62%','32% 57%','78% 98%'];
  const zooms=[100,130,130,160,180,210];
  document.querySelectorAll<HTMLElement>('[data-view]').forEach(el=>{
    const index=Number(el.dataset.view);
    el.setAttribute('aria-pressed',String(index===state.view));
    el.style.backgroundImage=`url('${sitePath(SAMPLE_ROOMS[state.room].image!)}')`;
    el.style.backgroundSize=index===0?'cover':`${Math.max(125,zooms[index])}% auto`;
    el.style.backgroundPosition=positions[index];
  });
}
viewNames.forEach((label,index)=>{
  const button=document.createElement('button');button.type='button';button.className='view-thumbnail';button.dataset.view=String(index);
  button.setAttribute('aria-label',label);button.title=label;
  listen(button,'click',()=>{state.view=index;preview.setView(index);updateViews();});$('view-thumbnails').append(button);
});updateViews();

function renderProducts(){
  $('product-grid').replaceChildren();
  floors.forEach((floor,index)=>{
    if(state.filter && !(floor.tones as readonly number[]).includes(state.filter))return;
    const button=document.createElement('button');button.type='button';button.className='product-card';button.dataset.product=String(index);
    button.setAttribute('aria-pressed',String(index===state.finish));button.setAttribute('aria-label',`${floor.name} ${floor.code}`);
    const photo=document.createElement('span');photo.className='product-swatch';photo.style.backgroundImage=`url('${sitePath(`/v2/assets/finish-${index+1}.webp`)}')`;photo.style.backgroundSize='cover';photo.style.backgroundPosition='center';
    const name=document.createElement('span');name.className='product-name';name.textContent=floor.name;
    const code=document.createElement('span');code.className='product-code';code.textContent=floor.code;
    button.append(photo,name,code);listen(button,'click',()=>void selectFloor(index));$('product-grid').append(button);
  });
  $('filter-empty').hidden=$('product-grid').childElementCount>0;
}
async function selectFloor(index:number){
  state.finish=index;preview.setFinish(index);updateProductSelection();
  track({name:'visualizer_finish',product:floors[index].code,context:preview.diagnostics.uploaded?'upload':'sample'});
  $('room-preview').setAttribute('aria-label',`${rooms[state.room]} พร้อมพื้น ${floors[index].name}`);
  story?.selectFinish(index);
}
function updateProductSelection(){document.querySelectorAll<HTMLElement>('[data-product]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.product)===state.finish)));}
['ทั้งหมด','โทนธรรมชาติ','โทนอ่อน','โทนคลาสสิก','โทนเทา','โทนเข้ม'].forEach((label,index)=>{
  const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.filter=String(index);button.setAttribute('aria-pressed',String(index===0));
  listen(button,'click',()=>{state.filter=index;document.querySelectorAll<HTMLElement>('[data-filter]').forEach(el=>el.setAttribute('aria-pressed',String(Number(el.dataset.filter)===index)));renderProducts();});$('color-filters').append(button);
});renderProducts();

listen($('compare-toggle'),'click',()=>preview.setCompare(!state.compare));
listen($('previous-room'),'click',()=>selectRoom(state.room-1));
listen($('next-room'),'click',()=>selectRoom(state.room+1));
listen($('sample-tab'),'click',()=>selectRoom(state.room));
listen($('reset-upload'),'click',()=>{preview.resetUpload();state.view=0;updateViews();});
listen($('upload-tab'),'click',()=>($('room-file') as HTMLInputElement).click());
listen($('room-file'),'change',async()=>{
  const input=$<HTMLInputElement>('room-file'), file=input.files?.[0];if(!file)return;
  track({name:'visualizer_upload',bytes:file.size,type:file.type});
  try{await preview.upload(file);state.view=0;updateViews();}catch(error){$('preview-hint').textContent=error instanceof Error?error.message:'ไม่สามารถเปิดภาพนี้ได้';}finally{input.value='';}
});

let expanded:HTMLElement|null=null, previousFocus:HTMLElement|null=null;
function closeExpanded(){
  if(!expanded)return;
  expanded.classList.remove('is-expanded');expanded.removeAttribute('role');expanded.removeAttribute('aria-modal');
  $('hero-fullscreen-close').hidden=true;$('preview-close').hidden=true;document.body.style.overflow='';document.body.classList.remove('has-expanded');expanded=null;previousFocus?.focus();
}
function expand(host:HTMLElement,close:HTMLElement){
  closeExpanded();previousFocus=document.activeElement as HTMLElement;expanded=host;host.classList.add('is-expanded');host.setAttribute('role','dialog');host.setAttribute('aria-modal','true');close.hidden=false;document.body.style.overflow='hidden';document.body.classList.add('has-expanded');close.focus();
}
listen($('hero-expand'),'click',()=>expand($('hero-3d-shell'),$('hero-fullscreen-close')));
listen($('preview-expand'),'click',()=>expand($('room-preview-shell'),$('preview-close')));
listen($('hero-fullscreen-close'),'click',closeExpanded);listen($('preview-close'),'click',closeExpanded);
document.addEventListener('keydown',event=>{
  const e=event as KeyboardEvent;if(!expanded)return;
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeExpanded();}
  if(e.key==='Tab'){
    const nodes=[...expanded.querySelectorAll<HTMLElement>('button:not([hidden]),input,canvas[tabindex]')].filter(n=>n.offsetParent!==null);
    const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
  }
},{signal:abort.signal,capture:true});

function setProgress(value:number){
  state.progress=Math.max(0,Math.min(1,value));story?.setExplode(state.progress);
  $<HTMLInputElement>('layer-slider').value=String(Math.round(state.progress*100));
  $('layers-toggle').setAttribute('aria-pressed',String(state.progress>.5));
}
listen($('layer-slider'),'input',()=>setProgress(Number($<HTMLInputElement>('layer-slider').value)/100));
listen($('layers-toggle'),'click',()=>setProgress(state.progress>.5?0:1));
listen($('hero-reset'),'click',()=>story?.resetView());

const ready=(async()=>{
  story=new FloorScrollStory({onFinish:index=>{if(state.disposed)return;state.finish=index;preview.setFinish(index);updateProductSelection();},onFrame:frame=>{state.progress=frame.explode;$<HTMLInputElement>('layer-slider').value=String(Math.round(frame.explode*100));$('layers-toggle').setAttribute('aria-pressed',String(frame.explode>.5));}});
  await story.ready;
  await preview.ready;
})();

function dispose(){if(state.disposed)return;closeExpanded();state.disposed=true;abort.abort();story?.dispose();preview.dispose();tools?.dispose();qr.dispose();showcase?.dispose();herringbone?.dispose();experience?.dispose();clientLogos?.dispose();collections?.dispose();pricing?.dispose();}
listen(window,'pagehide',event=>{if(!(event as PageTransitionEvent).persisted)dispose();});
Object.assign(window,{websiteDemo:{ready,get state(){return {...state};},get diagnostics(){return {viewer:story?.diagnostics.scene,preview:preview.diagnostics,showcase:showcase?.diagnostics,herringbone:herringbone?.diagnostics,experience:experience?.diagnostics,clientLogos:clientLogos?.diagnostics,collections:collections?.diagnostics,pricing:pricing?.diagnostics};},get story(){return story?.state;},seekStep:(index:number,smooth=false)=>story?.seekStep(index,smooth),setProgress,dispose}});
