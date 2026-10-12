import './shared.css';
import './home.css';
import { SPCPlankViewer } from '../SPCPlankViewer';
import { getProduct } from '../data/products';
import { RoomPreview, type RoomPreviewDiagnostics } from './roomPreview';
import { icon, mountHeader, mountContactDialog, sprite } from './shared';

type Crop = [number,number,number,number];
const $ = <T extends HTMLElement = HTMLElement>(id:string) => document.getElementById(id) as T;
const floors = [
  {name:'Light Natural Oak',code:'CP-101',id:'light-natural-oak',tones:[1,2],crop:[76,979,132,86]},
  {name:'Warm Oak',code:'CP-102',id:'warm-taupe-oak',tones:[1,3],crop:[228,978,139,89]},
  {name:'Honey Oak',code:'CP-103',id:'golden-honey-oak',tones:[1,3],crop:[385,978,139,89]},
  {name:'Classic Oak',code:'CP-104',id:'whitewashed-ash-oak',tones:[2,3],crop:[73,1123,137,89]},
  {name:'Grey Oak',code:'CP-105',id:'greige-oak',tones:[4],crop:[229,1123,137,89]},
  {name:'Walnut Brown',code:'CP-106',id:'dark-walnut-brown',tones:[5],crop:[385,1123,139,89]},
] as const;
const rooms=['ห้องนั่งเล่น','ห้องนอน','ห้องครัว','ห้องทำงาน','ห้องรับประทานอาหาร','ห้องน้ำ','ห้องแต่งตัว'];
const roomCrops:Crop[]=[[62,733,130,104],[207,733,131,104],[351,733,130,104],[496,733,130,104],[641,733,130,104],[786,733,130,104],[931,733,131,104]];
const viewCrops:Crop[]=[[567,1227,75,56],[652,1227,77,56],[738,1227,77,56],[825,1227,78,56],[914,1227,81,56],[1005,1227,50,56]];
const state={finish:0,room:0,view:0,filter:0,compare:false,progress:.65,disposed:false};
let viewer:SPCPlankViewer|undefined;
let pendingProduct=0;
let frame=0;
const abort = new AbortController();
const listen = (node:EventTarget,event:string,callback:EventListener) => node.addEventListener(event,callback,{signal:abort.signal});

mountHeader('home');
mountContactDialog();
document.querySelectorAll<HTMLElement>('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon!));

function syncPreview(value:RoomPreviewDiagnostics) {
  if(state.disposed)return;
  state.compare=value.compare;
  $('compare-toggle').setAttribute('aria-pressed',String(value.compare));
  $('room-preview-shell').classList.toggle('upload-picking',value.uploaded&&!value.floorSelected);
  $('reset-upload').hidden=!value.uploaded;
  $('reset-upload').textContent='กลับสู่ห้องตัวอย่าง';
  $('sample-tab').classList.toggle('active',!value.uploaded);
  $('sample-tab').setAttribute('aria-pressed',String(!value.uploaded));
  $('upload-tab').classList.toggle('active',value.uploaded);
  $('upload-tab').setAttribute('aria-pressed',String(value.uploaded));
  $('previous-room').hidden=value.uploaded;
  $('next-room').hidden=value.uploaded;
}
const preview=new RoomPreview($('room-preview'),{onHint:message=>$('preview-hint').textContent=message,onChange:syncPreview});

function roomButton(index:number) {
  const button=document.createElement('button');button.type='button';button.className='room-choice';button.dataset.room=String(index);
  button.setAttribute('aria-pressed',String(index===state.room));
  const photo=document.createElement('span');photo.className='room-photo';sprite(photo,roomCrops[index]);
  const label=document.createElement('span');label.textContent=rooms[index];button.append(photo,label);
  listen(button,'click',()=>{selectRoom(index);($('room-gallery') as HTMLDialogElement).close();});
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

function updateViews(){document.querySelectorAll<HTMLElement>('[data-view]').forEach(el=>el.setAttribute('aria-pressed',String(Number(el.dataset.view)===state.view)));}
viewCrops.forEach((crop,index)=>{
  const button=document.createElement('button');button.type='button';button.className='view-thumbnail';button.dataset.view=String(index);
  button.setAttribute('aria-label',['ภาพห้องเต็ม','ดูด้านซ้าย','ดูด้านขวา','ดูส่วนกลาง','รายละเอียดด้านซ้าย','รายละเอียดพื้น'][index]);sprite(button,crop);
  listen(button,'click',()=>{state.view=index;preview.setView(index);updateViews();});$('view-thumbnails').append(button);
});updateViews();

function renderProducts(){
  $('product-grid').replaceChildren();
  floors.forEach((floor,index)=>{
    if(state.filter && !(floor.tones as readonly number[]).includes(state.filter))return;
    const button=document.createElement('button');button.type='button';button.className='product-card';button.dataset.product=String(index);
    button.setAttribute('aria-pressed',String(index===state.finish));button.setAttribute('aria-label',`${floor.name} ${floor.code}`);
    const photo=document.createElement('span');photo.className='product-swatch';sprite(photo,[...floor.crop] as Crop);
    const name=document.createElement('span');name.className='product-name';name.textContent=floor.name;
    const code=document.createElement('span');code.className='product-code';code.textContent=floor.code;
    button.append(photo,name,code);listen(button,'click',()=>void selectFloor(index));$('product-grid').append(button);
  });
  $('filter-empty').hidden=$('product-grid').childElementCount>0;
}
async function selectFloor(index:number){
  state.finish=index;preview.setFinish(index);renderProducts();
  $('room-preview').setAttribute('aria-label',`${rooms[state.room]} พร้อมพื้น ${floors[index].name}`);
  const token=++pendingProduct;
  try {if(viewer){await loadSampleMap(index);if(state.disposed||token!==pendingProduct)return;await viewer.setProduct(floors[index].id);if(!state.disposed&&token===pendingProduct)viewer.setExplodeProgress(state.progress);}}
  catch {if(!state.disposed)$('hero-hint').textContent='โหลดวัสดุไม่สำเร็จ กรุณาเลือกสีอีกครั้ง';}
}
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
  state.progress=Math.max(0,Math.min(1,value));viewer?.setExplodeProgress(state.progress);
  $<HTMLInputElement>('layer-slider').value=String(Math.round(state.progress*100));
  $('layers-toggle').setAttribute('aria-pressed',String(state.progress>.5));
}
function scrollProgress(){frame=0;if(!state.disposed)setProgress(.65+window.scrollY/Math.max(250,$('hero').offsetHeight*.65)*.35);}
listen(window,'scroll',()=>{if(!frame)frame=requestAnimationFrame(scrollProgress);});
listen($('layer-slider'),'input',()=>setProgress(Number($<HTMLInputElement>('layer-slider').value)/100));
listen($('layers-toggle'),'click',()=>setProgress(state.progress>.5?0:1));
listen($('hero-reset'),'click',()=>{viewer?.setView('exploded');setProgress(.65);});

const patches:[number,Crop][]=[[1,[46,115,186,791]],[7,[91,135,178,900]],[5,[78,122,174,660]],[2,[77,144,166,731]],[6,[90,137,147,697]],[3,[81,122,185,826]]];
const heroCatalog=floors.map(floor=>{
    const product=structuredClone(getProduct(floor.id));
    // A cutaway material sample, not a dimensioned full-length sales plank.
    product.dimensions.lengthMm=600;product.dimensions.widthMm=300;
    const wear=product.layers.find(layer=>layer.material.kind==='wear');if(wear)wear.material.opacity=.18;
    product.name=floor.name;product.nameTh=floor.name;
    return product;
});
const mapLoads=new Map<number,Promise<void>>();
function loadSampleMap(index:number):Promise<void>{
  const cached=mapLoads.get(index);if(cached)return cached;
  const promise=(async()=>{
    const [sheet,[x,y,w,h]]=patches[index];
    const reference=new Image();reference.src=`/website/assets/material-${sheet}.jpg`;await reference.decode();
    if(state.disposed)return;
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
    const ctx=canvas.getContext('2d')!;
    ctx.translate(512,256);ctx.rotate(-Math.PI/2);
    ctx.drawImage(reference,x,y,w,h,-256,-512,512,1024);
    heroCatalog[index].maps={albedo:canvas.toDataURL('image/png')};
  })().catch(error=>{mapLoads.delete(index);throw error;});
  mapLoads.set(index,promise);return promise;
}

const ready=(async()=>{
  try{
    await loadSampleMap(0);if(state.disposed)return;
    viewer=new SPCPlankViewer($('hero-viewer'),{products:heroCatalog,productId:floors[0].id,view:'exploded',transparent:true,exposure:.65,scrollControls:true,clickToExplode:false,labels:false,dimensions:false,autoRotate:false,discoverMaps:false});
    await viewer.ready;if(state.disposed)return;
    if(viewer.diagnostics.webgl){scrollProgress();if(state.finish)await selectFloor(state.finish);}
    else{
      sprite($('hero-viewer'),[450,332,397,209]);$('hero-viewer').style.backgroundRepeat='no-repeat';
      $('hero-hint').textContent='ภาพอ้างอิง · เปิดด้วยเบราว์เซอร์ที่รองรับ WebGL 2 เพื่อหมุนดู 3D';
      document.querySelectorAll<HTMLButtonElement|HTMLInputElement>('.hero-3d-tools button,.hero-3d-tools input').forEach(el=>el.disabled=true);
    }
  }catch{if(!state.disposed)$('hero-hint').textContent='ไม่สามารถโหลด 3D ได้ กรุณาโหลดหน้านี้ใหม่';}
  await preview.ready;
})();

function dispose(){if(state.disposed)return;closeExpanded();state.disposed=true;pendingProduct++;cancelAnimationFrame(frame);abort.abort();viewer?.dispose();preview.dispose();}
listen(window,'pagehide',event=>{if(!(event as PageTransitionEvent).persisted)dispose();});
Object.assign(window,{websiteDemo:{ready,get state(){return {...state};},get diagnostics(){return {viewer:viewer?.diagnostics,preview:preview.diagnostics};},setProgress,dispose}});
