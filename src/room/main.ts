import { ACESFilmicToneMapping, BoxGeometry, CanvasTexture, Color, DirectionalLight, HemisphereLight, Mesh, MeshBasicMaterial, MeshStandardMaterial, PCFSoftShadowMap, PerspectiveCamera, PlaneGeometry, PMREMGenerator, Scene, SRGBColorSpace, WebGLRenderer } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createRoom } from './roomGeometry';
import { AnimatedFloor } from './floor';
import { roomFinishes } from './finishes';
import { FLOOR, sampleStory } from './motion';

const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const host = el('room-canvas');
const story = el('room-story');
const loading = el('room-loading');
const picker = el('finish-picker');
const reference = el('reference-panel');
const referenceImage = el<HTMLImageElement>('reference-image');
const motionButton = el<HTMLButtonElement>('motion-toggle');
const reduceQuery = matchMedia('(prefers-reduced-motion: reduce)');
const listeners = new AbortController();
let position = 0;
let target = 0;
let selected = -1;
let paused = false;
let reduced = reduceQuery.matches;
let frame = 0;
let destroyed = false;
let dirty = true;
let ready = false;
let fallback = false;
let lastTime = 0;
let renderedFrames = 0;
let previousRender = 0;
const frameDurations: number[] = [];
let resolveReady: () => void;
const readyPromise = new Promise<void>(resolve => { resolveReady = resolve; });
let renderer: WebGLRenderer | undefined;
let cleanupScene = () => {};
let floor: AnimatedFloor | undefined;
const scene = new Scene();
scene.background = new Color('#eeeae2');
const camera = new PerspectiveCamera(46, 1, 0.04, 45);

function progressFromScroll() {
  const range = story.offsetHeight - host.clientHeight;
  target = Math.max(0, Math.min(5, (scrollY - story.offsetTop) / Math.max(1, range) * 5));
  if (fallback) { position = target; updateText(); }
}
function goToFinish(index: number) {
  if (paused) setPaused(false);
  const top = story.offsetTop + index / 5 * (story.offsetHeight - host.clientHeight);
  window.scrollTo({top, behavior: reduced ? 'instant' : 'smooth'});
}
const buttons = roomFinishes.map((finish, index) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.finish = finish.id;
  button.setAttribute('aria-pressed', String(index === 0));
  button.setAttribute('aria-label', `เลือก ${finish.name}`);
  button.disabled = true;
  const swatch = document.createElement('span');
  swatch.className = 'swatch';
  swatch.style.backgroundColor = finish.color;
  swatch.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span');
  label.textContent = finish.name;
  button.append(swatch, label);
  button.addEventListener('click', () => goToFinish(index), {signal: listeners.signal});
  picker.append(button);
  return button;
});
function updateText() {
  const state = sampleStory(position, 6);
  const next = reduced || fallback ? Math.round(position) : state.selected;
  if (next !== selected) {
    selected = next;
    const finish = roomFinishes[selected];
    el('finish-name').textContent = finish.name;
    el('finish-subtitle').textContent = finish.subtitle;
    el('finish-count').innerHTML = `${String(selected + 1).padStart(2, '0')} <span>/ 06</span>`;
    buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === selected)));
    if (!reference.hidden) referenceImage.src = finish.reference;
    if (fallback) host.style.backgroundImage = `url('${finish.reference}')`;
  }
  el('story-progress').style.width = `${position / 5 * 100}%`;
  el('motion-status').textContent = fallback ? 'ชมภาพอ้างอิง' : paused ? 'หยุดการเคลื่อนไหวแล้ว' : reduced ? 'โหมดลดการเคลื่อนไหว' : state.phase > 0 && state.phase < 1 ? state.phase < 0.51 ? 'พื้นเดิมค่อย ๆ ลอยออก' : 'พื้นใหม่ค่อย ๆ เข้ามาแทน' : 'เลื่อนเพื่อเปลี่ยนพื้น';
  el('room-canvas').setAttribute('aria-label', `${fallback ? 'ภาพอ้างอิงห้อง' : 'ห้องสามมิติ'} ${roomFinishes[selected].name}`);
}
function setPaused(value: boolean) {
  paused = value;
  motionButton.setAttribute('aria-pressed', String(paused));
  const label = paused ? 'เล่นการเคลื่อนไหวต่อ' : 'หยุดการเคลื่อนไหว';
  motionButton.setAttribute('aria-label', label);
  motionButton.querySelector('span')!.textContent = label;
  motionButton.querySelector('svg')!.innerHTML = paused ? '<path d="m8 5 10 7-10 7V5Z"/>' : '<path d="M9 6v12M15 6v12"/>';
  updateText();
}
function showReference(value: boolean) {
  reference.hidden = !value;
  el('reference-toggle').setAttribute('aria-expanded', String(value));
  if (value) {
    referenceImage.src = roomFinishes[Math.max(0, selected)].reference;
    el('reference-close').focus({preventScroll:true});
  } else el('reference-toggle').focus({preventScroll:true});
}
el('reference-toggle').addEventListener('click', () => showReference(reference.hidden), {signal:listeners.signal});
el('reference-close').addEventListener('click', () => showReference(false), {signal:listeners.signal});
motionButton.addEventListener('click', () => setPaused(!paused), {signal:listeners.signal});
el('replay').addEventListener('click', () => goToFinish(0), {signal:listeners.signal});
window.addEventListener('keydown', event => { if (event.key === 'Escape' && !reference.hidden) showReference(false); }, {signal:listeners.signal});
window.addEventListener('scroll', progressFromScroll, {passive:true, signal:listeners.signal});
reduceQuery.addEventListener('change', () => { reduced = reduceQuery.matches; dirty = true; }, {signal:listeners.signal});

function resize() {
  const width = host.clientWidth, height = host.clientHeight;
  const portrait = width / height < 1;
  camera.aspect = width / height;
  camera.fov = portrait ? 49 : 46;
  // A narrower composition uses a little more distance, keeping the furniture in frame.
  camera.position.set(portrait ? 0.62 : -1.25, portrait ? 1.13 : 1.03, portrait ? 4.25 : 3.03);
  camera.lookAt(portrait ? 0.48 : -0.20, portrait ? 0.12 : 0.06, -1.40);
  camera.updateProjectionMatrix();
  renderer?.setPixelRatio(Math.min(devicePixelRatio, portrait ? 1.5 : 1.75));
  renderer?.setSize(width, height);
  progressFromScroll();
  dirty = true;
}
const resizeObserver = new ResizeObserver(resize);
resizeObserver.observe(host);

function contactShadow(x: number, z: number, width: number, depth: number, opacity: number) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(64, 64, 6, 64, 64, 64);
  gradient.addColorStop(0, `rgba(35,27,20,${opacity})`);
  gradient.addColorStop(.55, `rgba(35,27,20,${opacity * .55})`);
  gradient.addColorStop(1, 'rgba(35,27,20,0)');
  ctx.fillStyle = gradient; ctx.fillRect(0,0,128,128);
  const texture = new CanvasTexture(canvas);
  const material = new MeshBasicMaterial({map:texture,transparent:true,depthWrite:false});
  const geometry = new PlaneGeometry(width, depth);
  const mesh = new Mesh(geometry, material);
  mesh.rotation.x = -Math.PI/2;
  mesh.position.set(x, .0061, z);
  scene.add(mesh);
  return () => { scene.remove(mesh); geometry.dispose(); material.dispose(); texture.dispose(); };
}

function animate(time: number) {
  if (destroyed) return;
  frame = requestAnimationFrame(animate);
  const delta = Math.min(.05, (time - lastTime) / 1000 || .016);
  lastTime = time;
  if (document.hidden || !ready) return;
  const priorPosition = position;
  if (!paused) {
    position = reduced ? target : position + (target - position) * (1 - Math.exp(-12 * delta));
    if (Math.abs(target - position) < .00008) position = target;
  }
  const changed = floor?.update(position, reduced) ?? false;
  if (position !== priorPosition || dirty) updateText();
  if (changed || dirty) {
    if (renderer) {
      renderer.shadowMap.needsUpdate = true;
      renderer.render(scene, camera);
      if (previousRender && time - previousRender < 100) {
        frameDurations.push(time - previousRender);
        if (frameDurations.length > 180) frameDurations.shift();
      }
      previousRender = time;
      renderedFrames++;
    }
    dirty = false;
  }
}
function dispose() {
  if (destroyed) return;
  destroyed = true;
  ready = false;
  resolveReady();
  cancelAnimationFrame(frame);
  listeners.abort();
  resizeObserver.disconnect();
  cleanupScene();
  floor?.dispose();
  renderer?.dispose();
  renderer?.domElement.remove();
}

async function init() {
  try {
    renderer = new WebGLRenderer({antialias:true, powerPreference:'high-performance'});
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = .88;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    host.append(renderer.domElement);
    renderer.domElement.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      ready = false;
      loading.hidden = false;
      el('loading-text').textContent = 'กราฟิกหยุดทำงานชั่วคราว กำลังกู้คืนห้อง';
    }, {signal:listeners.signal});
    renderer.domElement.addEventListener('webglcontextrestored', () => { ready = true; dirty = true; loading.hidden = true; }, {signal:listeners.signal});
    const environmentScene = new RoomEnvironment();
    const pmrem = new PMREMGenerator(renderer);
    const environment = pmrem.fromScene(environmentScene, .04);
    environmentScene.dispose(); pmrem.dispose();
    scene.environment = environment.texture;
    scene.environmentIntensity = .34;
    const room = createRoom();
    scene.add(room.group);
    const sky = new HemisphereLight('#eaf2ff', '#baa88c', .72);
    scene.add(sky);
    const sun = new DirectionalLight('#fff0d4', 2.7);
    sun.position.set(2.5, 5.2, -5.5);
    sun.target.position.set(-1.0, 0, 1.0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {left:-5.8,right:5.8,top:5.0,bottom:-5.0,near:.5,far:18});
    sun.shadow.normalBias = .025;
    sun.shadow.bias = -.00018;
    sun.shadow.radius = 3;
    scene.add(sun, sun.target);
    const fill = new DirectionalLight('#fff7e9', .5);
    fill.position.set(-2, 2, 4); scene.add(fill);
    const substrateGeometry = new BoxGeometry(FLOOR.width, .04, FLOOR.depth);
    const substrateMaterial = new MeshStandardMaterial({color:'#a59c8e',roughness:.96});
    const substrate = new Mesh(substrateGeometry, substrateMaterial);
    substrate.position.set(0, -.0205, FLOOR.back + FLOOR.depth/2);
    substrate.receiveShadow = true;
    scene.add(substrate);
    const shadowCleanups = [contactShadow(1.4,-1.78,3.2,1.4,.34),contactShadow(2.1,-.3,1.7,1.6,.28),contactShadow(-.6,-2,.6,.6,.25)];
    floor = new AnimatedFloor();
    scene.add(floor.group);
    cleanupScene = () => { room.dispose(); environment.dispose(); sun.shadow.dispose(); substrateGeometry.dispose(); substrateMaterial.dispose(); shadowCleanups.forEach(cleanup => cleanup()); scene.clear(); };
    for (let i = 0; i < roomFinishes.length; i++) {
      el('loading-text').textContent = `กำลังเตรียมพื้น ${i+1} / 6`;
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      if (destroyed) return;
      const thumbnail = floor.addFinish(renderer.capabilities.getMaxAnisotropy());
      (buttons[i].querySelector('.swatch') as HTMLElement).style.backgroundImage = `url('${thumbnail}')`;
    }
    resize();
    floor.update(position, reduced);
    await renderer.compileAsync(scene, camera);
    if (destroyed) return;
    renderer.shadowMap.needsUpdate = true;
    renderer.render(scene, camera);
  } catch (error) {
    if (destroyed) return;
    console.warn('Room renderer unavailable; showing supplied reference images.', error);
    cleanupScene(); floor?.dispose(); renderer?.dispose(); renderer?.domElement.remove();
    renderer = undefined; floor = undefined; cleanupScene = () => {};
    fallback = true;
    host.style.backgroundSize = 'cover';
    host.style.backgroundPosition = 'center';
    host.setAttribute('role','img');
    const note = document.createElement('p');
    note.className = 'room-fallback-note';
    note.textContent = 'อุปกรณ์นี้เปิดภาพ 3D ไม่ได้ จึงแสดงภาพอ้างอิงแทน';
    host.after(note);
    motionButton.disabled = true;
  }
  buttons.forEach(button => { button.disabled = false; });
  loading.hidden = true;
  ready = true;
  updateText();
  resolveReady();
  frame = requestAnimationFrame(animate);
}

const api = {
  ready:readyPromise,
  setProgress(value: number) { position = target = Math.max(0, Math.min(5,value)); dirty = true; },
  get diagnostics() {
    return {
      ready, webgl:!!renderer, fallback, position, selected, reduced, paused,
      floor:floor?.diagnostics,
      calls:renderer?.info.render.calls, triangles:renderer?.info.render.triangles,
      memory:renderer ? {...renderer.info.memory} : undefined,
      renderedFrames,
      motionFps:frameDurations.length ? 1000 / (frameDurations.reduce((a,b)=>a+b,0) / frameDurations.length) : null,
      camera:camera.position.toArray(),
      dimensions:[FLOOR.width,FLOOR.depth],
    };
  },
  dispose,
};
declare global { interface Window { roomDemo: typeof api } }
window.roomDemo = api;
window.addEventListener('pagehide', event => { if (!event.persisted) dispose(); }, {signal:listeners.signal});
void init();
