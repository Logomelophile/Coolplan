import './style.css';
import { SPLINE_SCENE_URL, SPLINE_FILE_ID } from './config';

const stage=document.getElementById('scene')!;
const mount=document.getElementById('scene-mount')!;
const start=document.getElementById('scene-start') as HTMLButtonElement;
const retry=document.getElementById('scene-retry') as HTMLButtonElement;
const status=document.getElementById('scene-status')!;
const waiting=document.getElementById('scene-waiting')!;
let frame:HTMLIFrameElement|undefined;
let timer:ReturnType<typeof setTimeout>|undefined;
let requestedAt:number|null=null;
let readyAt:number|null=null;
let observer:IntersectionObserver|undefined;
let disposed=false;
const abort=new AbortController();
const sceneUrl=(()=>{try{const url=new URL(SPLINE_SCENE_URL);return url.protocol==='https:'&&/(^|\.)spline\.design$/.test(url.hostname)?url.href:'';}catch{return '';}})();

function markReady(){
  if(disposed||!frame)return;
  readyAt=performance.now();clearTimeout(timer);waiting.hidden=true;
  stage.classList.add('scene-ready');stage.classList.remove('scene-loading');
  frame.setAttribute('aria-busy','false');
}
function loadScene(){
  if(disposed||frame||!sceneUrl)return;
  observer?.disconnect();requestedAt=performance.now();
  frame=document.createElement('iframe');
  frame.src=sceneUrl;frame.title='Coolplan V2 — ห้องโชว์วัสดุ 3D แบบโต้ตอบ';
  frame.allow='fullscreen';frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';
  frame.setAttribute('aria-busy','true');
  frame.addEventListener('load',()=>{
    // The document loading is not proof that its WebGL scene is ready.
    // Reveal the real iframe and keep its preparation status until its bridge confirms readiness.
    stage.classList.add('scene-loading');
  },{signal:abort.signal});
  frame.addEventListener('error',showRetry,{signal:abort.signal});
  waiting.hidden=false;start.disabled=true;status.textContent='กำลังเตรียมห้อง 3D…';
  mount.replaceChildren(frame);timer=setTimeout(showRetry,25000);
}
function showRetry(){
  if(disposed||readyAt!==null)return;
  waiting.hidden=false;waiting.childNodes[1].textContent=' ใช้เวลาโหลดนานกว่าปกติ ';
  retry.hidden=false;
}
function reloadScene(){
  clearTimeout(timer);frame?.remove();frame=undefined;readyAt=null;
  retry.hidden=true;waiting.childNodes[1].textContent=' กำลังเตรียมห้อง 3D… ';
  loadScene();
}
if(sceneUrl){
  document.querySelectorAll<HTMLAnchorElement>('.spline-link').forEach(link=>{link.href=sceneUrl;link.hidden=false;});
  start.addEventListener('click',loadScene,{signal:abort.signal});
  retry.addEventListener('click',reloadScene,{signal:abort.signal});
  const connection=(navigator as Navigator & {connection?:{saveData?:boolean}}).connection;
  if(!connection?.saveData&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
    observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting))loadScene();},{rootMargin:'200px 0px',threshold:.01});observer.observe(stage);
  }
}else{
  status.textContent='กำลังจัดเตรียมฉาก Spline สำหรับ V2';start.disabled=true;
}
window.addEventListener('message',event=>{
  const data=event.data;
  // Spline's HTML bridge is sandboxed and may report an opaque origin. This
  // message only dismisses loading UI; it never changes URLs, code, or page data.
  if(data&&typeof data==='object'&&data.type==='coolplan:spline-ready'&&data.fileId===SPLINE_FILE_ID)markReady();
},{signal:abort.signal});
function dispose(){if(disposed)return;disposed=true;clearTimeout(timer);observer?.disconnect();abort.abort();frame?.remove();}
window.addEventListener('pagehide',dispose,{once:true});
(window as Window & {coolplanV2?:unknown}).coolplanV2={
  loadScene,dispose,
  get diagnostics(){return {sceneConfigured:!!sceneUrl,requestedAt,readyAt,sceneLoaded:readyAt!==null,iframeCount:mount.querySelectorAll('iframe').length,disposed};},
};
