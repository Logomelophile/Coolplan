import {
  ACESFilmicToneMapping, Box3, Camera, Color, Group, Mesh, MeshPhysicalMaterial,
  OrthographicCamera, PCFSoftShadowMap, PerspectiveCamera, Raycaster, Scene,
  SRGBColorSpace, Vector2, Vector3, WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { cameraPresets, easeInOut, interpolateDirection, viewPresets } from './cameraPresets';
import { products, getProduct, validateProduct } from './data/products';
import { createPlank, type PlankModel } from './geometry/plankGeometry';
import { createMaterials } from './materials/materialFactory';
import { createStudio } from './lighting';
import { LayerLabels } from './labels';
import { viewerStyles } from './viewerStyles';
import textureManifest from 'virtual:spc-texture-manifest';
import type { ExplodeMode, Locale, ProductConfig, ViewerOptions, ViewPreset } from './types';

type Bundle = Awaited<ReturnType<typeof createMaterials>>;
type ModelState = {model: PlankModel; bundle: Bundle; product: ProductConfig; stacks: Group[]; opacity: number};
type CameraMotion = {
  start: number; fromPosition: Vector3; fromTarget: Vector3; fromUp: Vector3;
  toPosition: Vector3; toTarget: Vector3; toUp: Vector3; fromFov: number; toFov: number;
  fromSpan: number; toSpan: number; projection: 'perspective' | 'orthographic';
};

/** A self-contained, physically scaled studio viewer. One world unit equals one centimeter. */
export class SPCPlankViewer extends EventTarget {
  readonly ready: Promise<void>;
  readonly element: HTMLDivElement;
  private renderer?: WebGLRenderer;
  private scene = new Scene();
  private perspective = new PerspectiveCamera(34, 1, 0.1, 1600);
  private orthographic = new OrthographicCamera(-80, 80, 60, -60, 0.1, 1600);
  private camera: PerspectiveCamera | OrthographicCamera = this.perspective;
  private controls?: OrbitControls;
  private studio?: ReturnType<typeof createStudio>;
  private labels: LayerLabels;
  private status = document.createElement('div');
  private observer: ResizeObserver;
  private intersection: IntersectionObserver;
  private abort = new AbortController();
  private catalog: ProductConfig[];
  private current?: ModelState;
  private outgoing?: ModelState;
  private fadeStart = 0;
  private _product: ProductConfig;
  private _view: ViewPreset;
  private _locale: Locale;
  private _autoRotate: boolean;
  private amount = 0;
  private explodeTarget = 0;
  private explodeFrom = 0;
  private explodeStart = 0;
  private mode: ExplodeMode = 'lift';
  private stairBlend = 0;
  private stackCount: number;
  private selected: string | null = null;
  private hiddenLayers = new Set<string>();
  private cameraMotion?: CameraMotion;
  private raycaster = new Raycaster();
  private pointer = new Vector2();
  private pointerStart = new Vector2();
  private lastInteraction = 0;
  private dragging = false;
  private visible = true;
  private disposed = false;
  private raf = 0;
  private previousTime = 0;
  private requestId = 0;
  private orthoSpan = 145;
  private width = 1;
  private height = 1;
  private samples: number[] = [];
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(private container: HTMLElement, private options: ViewerOptions = {}) {
    super();
    this.catalog = options.products ?? products;
    if (!this.catalog.length) throw new Error('The product catalog must not be empty.');
    this.catalog.forEach(validateProduct);
    this._product = getProduct(options.productId ?? this.catalog[0].id, this.catalog);
    this._view = options.view ?? 'perspective34';
    if (!viewPresets.includes(this._view)) throw new Error(`Unknown view preset: ${this._view}`);
    this._locale = options.locale ?? 'th';
    this._autoRotate = options.autoRotate ?? false;
    this.stackCount = Math.max(1, Math.min(6, Math.round(options.stackCount ?? 3)));
    this.element = document.createElement('div');
    this.element.className = 'spc-root';
    this.element.setAttribute('role', 'region');
    this.element.setAttribute('aria-label', this._locale === 'th' ? 'แสดงแผ่นพื้นสามมิติ' : 'Interactive flooring viewer');
    const style = document.createElement('style');
    style.textContent = viewerStyles;
    this.status.className = 'spc-status';
    this.status.setAttribute('role', 'status');
    this.status.textContent = this._locale === 'th' ? 'กำลังเตรียมวัสดุ…' : 'Preparing materials…';
    this.element.append(style, this.status);
    container.append(this.element);
    this.labels = new LayerLabels(this.element, id => this.selectLayer(id));
    this.scene.add(this.labels.group);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(this.container);
    this.intersection = new IntersectionObserver(entries => { this.visible = entries[0]?.isIntersecting ?? true; });
    this.intersection.observe(this.container);
    let supported = false;
    try {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('webgl2', { antialias: true, alpha: false, preserveDrawingBuffer: true });
      if (context) {
        this.renderer = new WebGLRenderer({canvas, context, antialias: true, alpha: false, preserveDrawingBuffer: true});
        supported = true;
      }
    } catch { supported = false; }
    if (!supported || !this.renderer) {
      this.status.textContent = this._locale === 'th'
        ? 'อุปกรณ์นี้ไม่รองรับ WebGL 2 สำหรับภาพสามมิติ โปรดลองเบราว์เซอร์หรืออุปกรณ์อื่น'
        : '3D viewing requires WebGL 2. Please try another browser or device.';
      this.ready = Promise.resolve();
      return;
    }
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.setPixelRatio(Math.min(2, options.pixelRatio ?? window.devicePixelRatio ?? 1));
    const canvas = this.renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', 'Rotate: drag. Zoom: scroll. Explode: click. Views: keys 1 to 7.');
    this.element.prepend(canvas);
    this.studio = createStudio(this.scene, this.renderer);
    this.configureControls();
    this.bindInteraction();
    this.resize();
    this.applyPreset(this._view, false);
    this.raf = requestAnimationFrame(time => this.tick(time));
    this.ready = this.setProduct(this._product.id).then(() => {
      if (this.disposed) return;
      this.status.hidden = true;
      if (this._view === 'exploded') this.setExplode(1);
      this.emit('ready', {productId: this._product.id});
    }).catch(error => {
      if (this.disposed) return;
      this.status.hidden = false;
      this.status.textContent = `${this._locale === 'th' ? 'โหลดวัสดุไม่สำเร็จ' : 'Unable to load material'}: ${error instanceof Error ? error.message : String(error)}`;
      throw error;
    });
  }

  get product() { return this._product; }
  get view() { return this._view; }
  get locale() { return this._locale; }
  get explode() { return this.explodeTarget; }
  get autoRotate() { return this._autoRotate; }
  get diagnostics() {
    const info = this.renderer?.info;
    const bounds = this.current ? new Box3().setFromObject(this.current.model.group) : null;
    return {
      webgl: !!this.renderer, disposed: this.disposed, productId: this._product.id,
      view: this._view, explode: this.amount, mode: this.mode, stackCount: this.stackCount,
      layerCount: this.current?.model.layers.size ?? 0,
      bounds: bounds ? bounds.getSize(new Vector3()).toArray() : null,
      memory: info ? {...info.memory} : null,
      calls: info?.render.calls ?? 0,
      fps: this.samples.length ? Math.round(1000 / (this.samples.reduce((a,b) => a+b,0) / this.samples.length)) : 0,
    };
  }
  private emit(type: string, detail: unknown) { this.dispatchEvent(new CustomEvent(type, {detail})); }
  private assertActive() { if (this.disposed) throw new Error('This viewer has been disposed.'); }

  async setProduct(id: string): Promise<void> {
    this.assertActive();
    const product = getProduct(id, this.catalog);
    validateProduct(product);
    const token = ++this.requestId;
    if (!this.renderer) { this._product = product; return; }
    const base = this.options.textureBaseUrl ?? `${import.meta.env.BASE_URL}textures/`;
    const discovered = this.options.discoverMaps === false ? undefined : textureManifest[product.id];
    const discoveredMaps = discovered ? Object.fromEntries(Object.entries(discovered).map(([key,path]) => [key, `${base.replace(/\/?$/, '/')}${path}`])) : undefined;
    const bundle = await createMaterials(product, {maxAnisotropy: this.renderer.capabilities.getMaxAnisotropy(), discoveredMaps});
    if (this.disposed || token !== this.requestId) { bundle.dispose(); return; }
    if (this.outgoing) this.release(this.outgoing);
    this.outgoing = this.current;
    const model = createPlank(product, bundle.materials);
    this.current = {model, bundle, product, stacks: [], opacity: this.outgoing ? 0 : 1};
    this._product = product;
    this.hiddenLayers.clear();
    this.scene.add(model.group);
    this.selected = null;
    this.labels.setLayers(model.layers.values(), this._locale);
    this.rebuildStacks();
    this.fadeStart = performance.now();
    this.updateLayers(this.current);
    this.setOpacity(this.current, this.current.opacity);
    this.status.hidden = true;
    this.emit('productchange', {productId: id, product});
  }

  setView(view: ViewPreset): void {
    this.assertActive();
    if (!viewPresets.includes(view)) throw new Error(`Unknown view preset: ${view}`);
    this._view = view;
    this.setExplode(view === 'exploded' ? 1 : 0);
    this.applyPreset(view, true);
    this.rebuildStacks();
    this.emit('viewchange', {view});
  }
  setExplode(value: boolean | number, mode: ExplodeMode = this.mode): void {
    this.assertActive();
    if (!['lift','stair'].includes(mode)) throw new Error(`Unsupported explode mode: ${mode}`);
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Explode amount must be finite.');
    const next = Math.max(0, Math.min(1, Number(value)));
    this.mode = mode;
    this.explodeFrom = this.amount;
    this.explodeTarget = next;
    this.explodeStart = performance.now();
    if (next > 0 && this._view !== 'exploded') {
      this._view = 'exploded';
      this.applyPreset('exploded', true);
      this.rebuildStacks();
      this.emit('viewchange', {view: this._view});
    }
    if (next === 0) this.selectLayer(null);
    this.emit('explodechange', {amount: next, mode});
  }
  setLayerVisible(layerId: string, visible: boolean): void {
    this.assertActive();
    if (!this._product.layers.some(layer => layer.id === layerId)) throw new Error(`Unknown layer: ${layerId}`);
    if (visible) this.hiddenLayers.delete(layerId); else this.hiddenLayers.add(layerId);
    if (this.current) this.updateLayers(this.current);
  }
  setStackCount(count: number): void {
    this.assertActive();
    if (!Number.isFinite(count)) throw new Error('Stack count must be finite.');
    this.stackCount = Math.max(1, Math.min(6, Math.round(count)));
    this.rebuildStacks();
  }
  setLocale(locale: Locale): void {
    this.assertActive();
    if (!['en','th'].includes(locale)) throw new Error(`Unsupported locale: ${locale}`);
    this._locale = locale;
    this.labels.setLocale(locale);
    this.element.setAttribute('aria-label', locale === 'th' ? 'แสดงแผ่นพื้นสามมิติ' : 'Interactive flooring viewer');
  }
  setAutoRotate(enabled: boolean) { this.assertActive(); this._autoRotate = enabled; this.emit('autorotatechange', {autoRotate: enabled}); }
  screenshot(): string {
    this.assertActive();
    if (!this.renderer) throw new Error('WebGL is unavailable.');
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }
  resize(): void {
    if (this.disposed) return;
    const previousAspect = this.width / this.height;
    const rect = this.container.getBoundingClientRect();
    this.width = Math.max(1, rect.width);
    this.height = Math.max(240, rect.height);
    this.renderer?.setSize(this.width, this.height, false);
    this.perspective.aspect = this.width / this.height;
    this.perspective.updateProjectionMatrix();
    this.updateOrtho();
    this.labels.resize(this.width, this.height);
    if (this.controls && Math.abs(previousAspect - this.width / this.height) > 0.15) {
      this.cameraMotion = undefined;
      this.applyPreset(this._view, false);
    }
  }

  private configureControls() {
    if (!this.renderer) return;
    const target = this.controls?.target.clone() ?? new Vector3();
    this.controls?.dispose();
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(target);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 450;
    this.controls.minZoom = 0.3;
    this.controls.maxZoom = 8;
    this.controls.autoRotateSpeed = 0.4;
    this.controls.minPolarAngle = 0.001;
    this.controls.maxPolarAngle = Math.PI - 0.001;
    this.controls.addEventListener('start', () => { this.lastInteraction = performance.now(); this.dragging = true; this.cameraMotion = undefined; });
    this.controls.addEventListener('end', () => { this.lastInteraction = performance.now(); this.dragging = false; });
  }
  private updateOrtho() {
    const aspect = this.width / this.height;
    const fittedSpan = this._view === 'profile' ? Math.max(this.orthoSpan, this._product.dimensions.widthMm / 10 / aspect * 1.28) : this.orthoSpan;
    const h = fittedSpan / 2;
    this.orthographic.left = -h * aspect;
    this.orthographic.right = h * aspect;
    this.orthographic.top = h;
    this.orthographic.bottom = -h;
    this.orthographic.updateProjectionMatrix();
  }
  private applyPreset(view: ViewPreset, animate: boolean) {
    if (!this.controls) return;
    const p = cameraPresets[view];
    const scale = this._product.dimensions.lengthMm / 1220;
    const toTarget = new Vector3(...p.target).multiplyScalar(scale);
    const toPosition = new Vector3(...p.position).multiplyScalar(scale);
    if (p.projection === 'perspective' && view !== 'closeup') this.fitPerspective(view,toPosition,toTarget,p.fov,new Vector3(...p.up));
    const span = p.span * (view === 'profile' ? this._product.dimensions.widthMm / 180 : scale);
    const fromPosition = this.camera.position.clone();
    const fromUp = this.camera.up.clone();
    const fromTarget = this.controls.target.clone();
    const previousFov = this.camera instanceof PerspectiveCamera ? this.camera.fov : 34;
    const nextCamera = p.projection === 'orthographic' ? this.orthographic : this.perspective;
    if (nextCamera !== this.camera) {
      nextCamera.position.copy(fromPosition);
      nextCamera.up.copy(fromUp);
      this.camera = nextCamera;
      this.configureControls();
      this.controls!.target.copy(fromTarget);
    }
    this.camera.zoom = 1;
    this.camera.updateProjectionMatrix();
    this.lastInteraction = performance.now();
    if (animate && !this.reducedMotion) {
      this.cameraMotion = {
        start: performance.now(), fromPosition, fromTarget, fromUp,
        toPosition, toTarget, toUp: new Vector3(...p.up),
        fromFov: previousFov, toFov: p.fov,
        fromSpan: this.orthoSpan, toSpan: span, projection: p.projection,
      };
    } else {
      this.camera.position.copy(toPosition);
      this.camera.up.set(...p.up);
      this.controls!.target.copy(toTarget);
      this.perspective.fov = p.fov;
      this.perspective.updateProjectionMatrix();
      this.orthoSpan = span;
      this.updateOrtho();
      this.camera.lookAt(toTarget);
      this.controls!.update();
    }
  }
  private fitPerspective(view: ViewPreset, position: Vector3, target: Vector3, fov: number, up: Vector3) {
    const length = this._product.dimensions.lengthMm/10;
    const width = this._product.dimensions.widthMm/10;
    const layerHeight = view === 'exploded' ? (this._product.layers.length-1)*5.8+0.53 : 0.53;
    const points: Vector3[] = [];
    for (const x of [-length/2,length/2]) for (const y of [0,layerHeight]) for (const z of [-width/2,width/2]) points.push(new Vector3(x,y,z));
    if (view === 'stacked') {
      for (let i=1;i<this.stackCount;i++) {
        for (const x of [-length/2,length/2]) for (const z of [-width/2,width/2]) {
          points.push(new Vector3(x,0,z).applyAxisAngle(new Vector3(0,1,0),i*8*Math.PI/180).add(new Vector3(-i*2.8,(this.stackCount-1-i)*2.1,-i*2.3)));
        }
      }
    }
    const aspect = this.width/this.height;
    const temp = new PerspectiveCamera(fov,aspect,0.1,1600);
    const direction = position.clone().sub(target).normalize();
    const right = new Vector3().crossVectors(up,direction).normalize();
    const reserve = view === 'exploded' ? (this.width<=600?162:232) : 0;
    const desiredCenter = -reserve/this.width;
    const halfWidth = (1-reserve/this.width)*0.88;
    const center = new Vector3(0,view==='exploded'?layerHeight/2:view==='stacked'?(this.stackCount-1)*1.05:0,0);
    let distance = position.distanceTo(target);
    for (let iteration=0;iteration<8;iteration++) {
      const worldWidth = 2*distance*Math.tan(fov*Math.PI/360)*aspect;
      target.copy(center).addScaledVector(right,worldWidth*reserve/this.width/2);
      position.copy(target).addScaledVector(direction,distance);
      temp.position.copy(position);temp.up.copy(up);temp.lookAt(target);temp.updateMatrixWorld();
      let ratio=0;
      for (const point of points) {
        const projected = point.clone().project(temp);
        ratio=Math.max(ratio,Math.abs(projected.x-desiredCenter)/halfWidth,Math.abs(projected.y)/0.80);
      }
      if (Math.abs(ratio-1)<0.005) break;
      distance*=Math.max(0.75,Math.min(1.6,ratio));
    }
  }
  private rebuildStacks() {
    if (!this.current) return;
    this.current.stacks.forEach(group => group.removeFromParent());
    this.current.stacks = [];
    this.current.model.group.position.set(0, 0, 0);
    this.current.model.group.rotation.set(0, 0, 0);
    if (this._view !== 'stacked') return;
    const step = 2.1;
    this.current.model.group.position.y = (this.stackCount - 1) * step;
    for (let i = 1; i < this.stackCount; i++) {
      const clone = this.current.model.group.clone(true);
      clone.position.set(-i * 2.8, (this.stackCount - 1 - i) * step, -i * 2.3);
      clone.rotation.y = i * 8 * Math.PI / 180;
      this.scene.add(clone);
      this.current.stacks.push(clone);
    }
  }
  private updateLayers(state: ModelState) {
    const entries = [...state.model.layers.values()].sort((a,b) => a.config.order-b.config.order);
    const wear = entries.find(layer => layer.config.material.kind === 'wear');
    const decor = entries.find(layer => layer.config.material.kind === 'decor');
    const combineWear = wear && decor && entries.indexOf(decor) === entries.indexOf(wear) + 1;
    for (let i=0;i<entries.length;i++) {
      const entry = entries[i];
      const rise = (entries.length - 1 - i) * 5.8 * this.amount;
      entry.mesh.position.set((entries.length-1-i)*3.2*this.amount*this.stairBlend, entry.baseY + rise,
        (entries.length-1-i)*2.3*this.amount*this.stairBlend);
      entry.mesh.scale.y = 1;
      entry.mesh.visible = !this.hiddenLayers.has(entry.config.id);
      if (entry === wear && combineWear) entry.mesh.visible &&= this.amount > 0.015;
      if (entry === decor && wear && combineWear && !this.hiddenLayers.has(wear.config.id)) {
        const extension = wear.height * (1-this.amount);
        entry.mesh.scale.y = (entry.height + extension) / entry.height;
        entry.mesh.position.y += extension / 2;
      }
      const material = entry.mesh.material as MeshPhysicalMaterial;
      if (entry === decor) material.clearcoat = state.product.surface.clearcoat * (1-this.amount * 0.45);
    }
    state.stacks.forEach(clone => {
      for (const child of clone.children) {
        const original = state.model.group.children.find(node => node.name === child.name);
        if (original) { child.position.copy(original.position); child.scale.copy(original.scale); child.visible = original.visible; }
      }
    });
  }
  private setOpacity(state: ModelState, opacity: number) {
    state.opacity = opacity;
    for (const [id, material] of state.bundle.materials) {
      const config = state.product.layers.find(layer => layer.id === id)!;
      const baseline = config.material.opacity ?? (config.material.kind === 'wear' ? 0.35 : 1);
      const transparent = baseline < 1 || opacity < 0.999;
      if (material.transparent !== transparent) { material.transparent = transparent; material.needsUpdate = true; }
      material.opacity = baseline * opacity;
      material.depthWrite = baseline >= 1 && opacity >= 0.999;
    }
  }
  private selectLayer(id: string | null) {
    if (this.selected === id || !this.current) return;
    this.selected = id;
    for (const [layerId, material] of this.current.bundle.materials) {
      material.emissive = new Color('#705083');
      material.emissiveIntensity = id === layerId ? 0.12 : 0;
    }
    this.labels.highlight(id);
    this.emit('layerselect', {layerId:id});
  }
  private intersect(event: PointerEvent) {
    if (!this.current || !this.renderer) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((event.clientX-rect.left)/rect.width*2-1, -(event.clientY-rect.top)/rect.height*2+1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const meshes = [...this.current.model.layers.values()].filter(entry => entry.mesh.visible).map(entry => entry.mesh);
    const stackedMeshes = this.current.stacks.flatMap(group => group.children.filter(child => child instanceof Mesh && child.visible));
    return this.raycaster.intersectObjects([...meshes,...stackedMeshes], false)[0]?.object ?? null;
  }
  private bindInteraction() {
    if (!this.renderer) return;
    const canvas = this.renderer.domElement;
    const opts = {signal: this.abort.signal};
    canvas.addEventListener('pointerdown', e => { this.pointerStart.set(e.clientX,e.clientY); }, opts);
    canvas.addEventListener('pointerup', e => {
      this.lastInteraction = performance.now();
      if (this.pointerStart.distanceTo(new Vector2(e.clientX,e.clientY)) > 5) return;
      const mesh = this.intersect(e);
      if (mesh) {
        if (this.explodeTarget < 0.1) this.setExplode(true);
        else this.selectLayer(mesh.userData.layerId as string);
      } else {
        this.setExplode(false);
        if (this._view === 'exploded') this.setView('perspective34');
      }
    }, opts);
    canvas.addEventListener('pointermove', e => {
      if (!this.dragging && this.amount > 0.1) this.selectLayer(this.intersect(e)?.userData.layerId as string ?? null);
    }, opts);
    canvas.addEventListener('pointerleave', () => this.selectLayer(null), opts);
    canvas.addEventListener('wheel', () => { this.lastInteraction = performance.now(); }, {...opts,passive:true});
    this.element.addEventListener('keydown', e => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.ctrlKey || e.metaKey || e.altKey) return;
      const index = Number(e.key)-1;
      if (index >= 0 && index < viewPresets.length) { e.preventDefault(); this.setView(viewPresets[index]); }
      if (e.key === 'Escape') this.setView('perspective34');
      if (e.key === 'Enter' && e.target === canvas) { e.preventDefault(); this.setExplode(this.explodeTarget < 0.5); }
    }, opts);
    canvas.addEventListener('webglcontextlost', e => {
      e.preventDefault();
      this.status.hidden = false;
      this.status.textContent = this._locale === 'th' ? 'การแสดงผลหยุดชั่วคราว กำลังกู้คืน…' : 'Rendering paused. Restoring graphics…';
    }, opts);
    canvas.addEventListener('webglcontextrestored', () => { this.status.hidden = true; }, opts);
  }
  private tick(now: number) {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(time => this.tick(time));
    const delta = this.previousTime ? Math.min(0.1,(now-this.previousTime)/1000) : 1/60;
    this.previousTime = now;
    if (!this.visible || document.hidden || !this.renderer || !this.controls) return;
    this.samples.push(delta*1000);
    if (this.samples.length > 120) this.samples.shift();
    if (this.cameraMotion) {
      const m = this.cameraMotion;
      const progress = Math.max(0,Math.min(1,(now-m.start)/600));
      const t = easeInOut(progress);
      const target = m.fromTarget.clone().lerp(m.toTarget,t);
      const fromOffset = m.fromPosition.clone().sub(m.fromTarget);
      const toOffset = m.toPosition.clone().sub(m.toTarget);
      const direction = interpolateDirection(fromOffset,toOffset,t);
      this.camera.position.copy(direction.multiplyScalar(fromOffset.length()*(1-t)+toOffset.length()*t).add(target));
      this.camera.up.copy(interpolateDirection(m.fromUp,m.toUp,t));
      this.controls.target.copy(target);
      this.perspective.fov = m.fromFov*(1-t)+m.toFov*t;
      this.perspective.updateProjectionMatrix();
      this.orthoSpan = m.fromSpan*(1-t)+m.toSpan*t;
      this.updateOrtho();
      this.camera.lookAt(target);
      if (progress === 1) { this.cameraMotion = undefined; this.configureControls(); this.controls!.target.copy(target); }
    } else {
      this.controls.autoRotate = this._autoRotate && !this.reducedMotion && !this.dragging && now-this.lastInteraction > 3000 && !['front','profile','exploded','closeup'].includes(this._view);
      this.controls.update(delta);
    }
    const duration = this.reducedMotion ? 1 : 650;
    const t = easeInOut(Math.min(1,(now-this.explodeStart)/duration));
    this.amount = this.explodeFrom + (this.explodeTarget-this.explodeFrom)*t;
    this.stairBlend += ((this.mode === 'stair' ? 1 : 0)-this.stairBlend)*(this.reducedMotion ? 1 : 1-Math.exp(-delta*10));
    if (this.current) this.updateLayers(this.current);
    if (this.outgoing && this.current) {
      this.updateLayers(this.outgoing);
      const fade = Math.max(0,Math.min(1,(now-this.fadeStart)/400));
      this.setOpacity(this.current,fade);
      this.setOpacity(this.outgoing,1-fade);
      if (fade === 1) { this.release(this.outgoing); this.outgoing = undefined; }
    }
    if (this.studio) {
      this.studio.ground.visible = this.camera.position.y > 0 && this._view !== 'profile';
      this.studio.undersideKey.visible = this.camera.position.y < 0;
    }
    this.scene.updateMatrixWorld(true);
    this.camera.updateMatrixWorld();
    if (this.current) this.labels.update(this.camera,this._product,this.amount,this._view,this.options.dimensions ?? true);
    this.renderer.render(this.scene,this.camera);
    this.labels.renderer.render(this.scene,this.camera);
  }
  private release(state: ModelState) {
    state.stacks.forEach(group => group.removeFromParent());
    state.model.group.removeFromParent();
    state.model.dispose();
    state.bundle.dispose();
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    ++this.requestId;
    cancelAnimationFrame(this.raf);
    this.abort.abort();
    this.observer.disconnect();
    this.intersection.disconnect();
    this.controls?.dispose();
    this.labels.dispose();
    if (this.current) this.release(this.current);
    if (this.outgoing) this.release(this.outgoing);
    this.current = this.outgoing = undefined;
    this.studio?.dispose();
    this.renderer?.renderLists.dispose();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.scene.clear();
    this.element.remove();
  }
}
