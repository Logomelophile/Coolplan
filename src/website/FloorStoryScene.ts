import {
  ACESFilmicToneMapping, CanvasTexture, Color, EdgesGeometry, LineBasicMaterial,
  LineSegments, OrthographicCamera, PCFSoftShadowMap, Scene, Spherical, SRGBColorSpace,
  Vector3, WebGLRenderer, type Texture,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { getProduct } from '../data/products';
import { createPlank, type PlankModel } from '../geometry/plankGeometry';
import { createMaterials, type MaterialBundle } from '../materials/materialFactory';
import { createStudio } from '../lighting';
import type { ProductConfig } from '../types';
import { sitePath } from '../sitePath';

export type FloorStoryLayerId = 'wear' | 'decor' | 'core' | 'backing';
export interface FloorStoryFrame {
  from: number;
  to: number;
  mix: number;
  explode: number;
  /** -1 for an overview; 0–3 follow the physical top-to-bottom order. */
  focus: number;
  zoom: number;
  /** Scrub the assembled sample toward a shallow side view. Omission preserves the original overview API. */
  profile?: number;
}
export interface FloorStoryAnchor {
  id: FloorStoryLayerId;
  x: number;
  y: number;
  visible: boolean;
}
export interface FloorStoryThicknessAnchors {
  top: {x: number; y: number; visible: boolean};
  bottom: {x: number; y: number; visible: boolean};
  /** The 5 mm dimension refers to the assembled sample, never an exploded gap. */
  assembled: true;
  thicknessMm: 5;
}
export interface FloorStorySceneOptions {
  onAnchors?: (anchors: FloorStoryAnchor[], thickness: FloorStoryThicknessAnchors) => void;
}

type ModelState = {
  model: PlankModel;
  bundle: MaterialBundle;
  product: ProductConfig;
  photo: CanvasTexture;
  wearOutline: LineSegments<EdgesGeometry, LineBasicMaterial>;
  blend: {map: {value: Texture}; mix: {value: number}};
};
const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const ids = ['light-natural-oak', 'warm-taupe-oak', 'golden-honey-oak', 'whitewashed-ash-oak', 'greige-oak', 'dark-walnut-brown'];
const layerIds: FloorStoryLayerId[] = ['wear', 'decor', 'core', 'backing'];
const thicknesses: Record<FloorStoryLayerId, number> = {wear: .5, decor: .1, core: 3.4, backing: 1};
const overviewDirection = new Vector3(76, 67, 95);
const profileElevationDelta = 1.40 - new Spherical().setFromVector3(overviewDirection).phi;
const patches: [number, [number, number, number, number]][] = [
  [1, [46, 115, 186, 791]], [7, [91, 135, 178, 900]], [5, [78, 122, 174, 660]],
  [2, [77, 144, 166, 731]], [6, [90, 137, 147, 697]], [3, [81, 122, 185, 826]],
];

/** A scroll-owned cutaway scene. One world unit is one centimetre. */
export class FloorStoryScene {
  readonly ready: Promise<void>;
  private scene = new Scene();
  private camera = new OrthographicCamera(-60, 60, 40, -40, .1, 600);
  private renderer?: WebGLRenderer;
  private controls?: OrbitControls;
  private studio?: ReturnType<typeof createStudio>;
  private models: ModelState[] = [];
  private observer: ResizeObserver;
  private intersection: IntersectionObserver;
  private abort = new AbortController();
  private width = 1;
  private height = 1;
  private raf = 0;
  private disposed = false;
  private inView = true;
  private contextLost = false;
  private loaded = false;
  private _frame: FloorStoryFrame = {from: 0, to: 0, mix: 0, explode: .3, focus: -1, zoom: 0, profile: 0};
  private active = 0;
  private lastTarget = new Vector3();
  private lastAppliedExplode = NaN;
  private lastAppliedZoom = NaN;
  private lastAppliedProfile = 0;
  private appliedProfileOffset = 0;
  private status: HTMLDivElement;
  private anchors: FloorStoryAnchor[] = [];
  private thickness: FloorStoryThicknessAnchors = {
    top: {x: 0, y: 0, visible: false}, bottom: {x: 0, y: 0, visible: false}, assembled: true, thicknessMm: 5,
  };

  constructor(private host: HTMLElement, private options: FloorStorySceneOptions = {}) {
    this.status = document.createElement('div');
    this.status.className = 'floor-story-status';
    this.status.setAttribute('role', 'status');
    this.status.textContent = 'กำลังเตรียมพื้นทั้ง 6 สี…';
    Object.assign(this.status.style, {position: 'absolute', bottom: '20px', left: '20px', fontSize: '13px'});
    host.append(this.status);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.intersection = new IntersectionObserver(entries => {
      this.inView = entries[0]?.isIntersecting ?? true;
      if (this.inView) this.requestRender();
    }, {rootMargin: '120px'});
    this.intersection.observe(host);

    try {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('webgl2', {alpha: true, antialias: true});
      if (context) this.renderer = new WebGLRenderer({canvas, context, alpha: true, antialias: true});
    } catch { /* A readable fallback stays in the document without trapping scroll. */ }
    if (!this.renderer) {
      this.status.textContent = 'ภาพ 3D ต้องใช้เบราว์เซอร์ที่รองรับ WebGL 2';
      this.ready = Promise.resolve();
      return;
    }

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = .65;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    const canvas = this.renderer.domElement;
    canvas.className = 'floor-story-canvas';
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'แผ่นพื้น 3D ลากเมาส์เพื่อหมุน เลื่อนหน้าเพื่อเปลี่ยนสีและแยกชั้นวัสดุ');
    Object.assign(canvas.style, {width: '100%', height: '100%', display: 'block', background: 'transparent'});
    host.prepend(canvas);
    this.studio = createStudio(this.scene, this.renderer);
    this.studio.ground.material.opacity = .09;
    this.scene.background = null;
    this.renderer.setClearColor(0x000000, 0);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableZoom = false;
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = .11;
    this.controls.rotateSpeed = .55;
    this.controls.minPolarAngle = .30;
    this.controls.maxPolarAngle = Math.PI / 2 - .07;
    // OrbitControls defaults to touch-action:none. Vertical movement belongs to the page.
    canvas.style.touchAction = 'pan-y';
    this.controls.addEventListener('change', this.requestRender);
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      this.contextLost = true;
      this.status.hidden = false;
      this.status.textContent = 'ภาพ 3D หยุดชั่วคราว กำลังคืนการแสดงผล…';
    }, {signal: this.abort.signal});
    canvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
      this.status.hidden = this.loaded;
      this.requestRender();
    }, {signal: this.abort.signal});
    canvas.addEventListener('keydown', event => {
      if (event.key.toLowerCase() === 'r') this.resetView();
    }, {signal: this.abort.signal});
    this.resetView();
    this.resize();
    this.ready = this.load().then(() => {
      if (this.disposed) return;
      this.loaded = true;
      this.status.hidden = true;
      this.applyFrame();
      this.render();
    }).catch(error => {
      if (this.disposed) return;
      this.status.hidden = false;
      this.status.textContent = 'โหลดวัสดุ 3D ไม่สำเร็จ กรุณาโหลดหน้านี้ใหม่';
      throw error;
    });
  }

  private async load(): Promise<void> {
    const references = await Promise.all(patches.map(async ([sheet]) => {
      const image = new Image();
      image.src = sitePath(`/website/assets/material-${sheet}.jpg`);
      await image.decode();
      return image;
    }));
    if (this.disposed || !this.renderer) return;
    const anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    for (let index = 0; index < ids.length; index++) {
      if (this.disposed) return;
      const product = structuredClone(getProduct(ids[index]));
      // Website cutaway sample: these dimensions do not alter the original sales catalog.
      product.dimensions = {lengthMm: 600, widthMm: 300, thicknessMm: 5};
      for (const layer of product.layers) {
        layer.thicknessMm = thicknesses[layer.id as FloorStoryLayerId];
        if (layer.material.kind === 'wear') layer.material.opacity = .16;
        if (layer.material.kind === 'core') layer.material.color = '#e4e3df';
      }
      product.maps = undefined;
      const bundle = await createMaterials(product, {maxAnisotropy: anisotropy});
      if (this.disposed) {bundle.dispose(); return;}
      const [, [x, y, width, height]] = patches[index];
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 512;
      const context = canvas.getContext('2d');
      if (!context) {bundle.dispose(); throw new Error('Canvas 2D is unavailable.');}
      context.translate(512, 256);
      context.rotate(-Math.PI / 2);
      context.drawImage(references[index], x, y, width, height, -256, -512, 512, 1024);
      const photo = new CanvasTexture(canvas);
      photo.name = `floor-story-reference-${index + 1}`;
      photo.colorSpace = SRGBColorSpace;
      photo.anisotropy = Math.min(anisotropy, 16);
      const decor = bundle.materials.get('decor')!;
      decor.map = photo;
      // Photographic grain supplies the visible detail; a gentle generated normal avoids inflated ridges.
      decor.normalScale.set(.22, .22);
      const blend = {map: {value: photo as Texture}, mix: {value: 0}};
      decor.onBeforeCompile = shader => {
        shader.uniforms.storyNextMap = blend.map;
        shader.uniforms.storyMix = blend.mix;
        shader.fragmentShader = `uniform sampler2D storyNextMap;\nuniform float storyMix;\n${shader.fragmentShader}`;
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
          #ifdef USE_MAP
            vec4 storyFirst = texture2D(map, vMapUv);
            vec4 storyNext = texture2D(storyNextMap, vMapUv);
            diffuseColor *= mix(storyFirst, storyNext, storyMix);
          #endif
        `);
      };
      decor.customProgramCacheKey = () => 'floor-story-photo-blend-v1';
      const model = createPlank(product, bundle.materials);
      const wear = model.layers.get('wear')!;
      const outline = new LineSegments(new EdgesGeometry(wear.mesh.geometry, 30), new LineBasicMaterial({
        color: '#d7e0df', transparent: true, opacity: .42, depthWrite: false,
      }));
      outline.name = 'wear-layer-outline';
      wear.mesh.add(outline);
      model.group.visible = false;
      this.scene.add(model.group);
      this.models.push({model, bundle, product, photo, wearOutline: outline, blend});
      // Yield between CPU texture builds so the page remains scrollable while all six finishes load.
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    }
    if (this.disposed || !this.renderer) return;
    // Every finish uses the same shader program; initialize textures before scroll starts.
    for (const state of this.models) {
      this.renderer.initTexture(state.photo);
      for (const material of state.bundle.materials.values()) {
        for (const texture of [material.map, material.normalMap, material.roughnessMap]) {
          if (texture) this.renderer.initTexture(texture);
        }
      }
    }
  }

  setFrame(frame: FloorStoryFrame): void {
    if (this.disposed) return;
    for (const value of Object.values(frame)) if (value !== undefined && !Number.isFinite(value)) throw new Error('Floor story values must be finite.');
    this._frame = {
      from: Math.round(clamp(frame.from, 0, 5)), to: Math.round(clamp(frame.to, 0, 5)),
      mix: clamp(frame.mix), explode: clamp(frame.explode), focus: Math.round(clamp(frame.focus, -1, 3)), zoom: clamp(frame.zoom),
      profile: clamp(frame.profile ?? 0),
    };
    // The shell grows with the same scroll frame; resizing now keeps the canvas and camera in step instead of one observer tick apart.
    if (this.host.clientWidth !== this.width || this.host.clientHeight !== this.height) this.resize();
    this.applyFrame();
    // A single synchronous draw makes model colour match the room canvas in the same scroll frame.
    if (this.loaded && this.inView) this.render();
  }

  private applyFrame(): void {
    if (!this.models.length) return;
    const {from, to, mix, explode, focus, zoom, profile = 0} = this._frame;
    this.active = mix >= 1 ? to : from;
    const state = this.models[this.active];
    if (!state) return;
    this.models.forEach((item, index) => {item.model.group.visible = index === this.active;});
    state.blend.map.value = this.models[to]?.photo ?? state.photo;
    state.blend.mix.value = mix >= 1 ? 0 : mix;
    for (const [id, entry] of state.model.layers) {
      const order = layerIds.indexOf(id as FloorStoryLayerId);
      // Separation is a visual explanation of construction, never a dimensioned factory specification.
      entry.mesh.position.y = entry.baseY + (3 - order) * 5.2 * explode;
      entry.mesh.material.emissive = new Color(focus === order ? '#806841' : '#000000');
      entry.mesh.material.emissiveIntensity = focus === order ? .055 : 0;
    }
    state.wearOutline.material.opacity = .25 + explode * .27;
    if (explode !== this.lastAppliedExplode) {
      const target = new Vector3(0, .25 + 7.8 * explode, 0);
      const translation = target.clone().sub(this.lastTarget);
      this.camera.position.add(translation);
      this.controls?.target.copy(target);
      this.lastTarget.copy(target);
      this.lastAppliedExplode = explode;
    }
    if (zoom !== this.lastAppliedZoom) {
      this.camera.zoom = .90 + .27 * zoom;
      this.camera.updateProjectionMatrix();
      this.lastAppliedZoom = zoom;
    }
    if (profile !== this.lastAppliedProfile) {
      const direction = this.camera.position.clone().sub(this.lastTarget);
      const spherical = new Spherical().setFromVector3(direction);
      // Subtract only the previous scripted offset. Any mouse rotation remains part of the baseline.
      // Remember the actual clamped offset so returning to profile=0 restores the exact overview.
      const baseline = spherical.phi - this.appliedProfileOffset;
      spherical.phi = clamp(baseline + profile * profileElevationDelta, .30, Math.PI / 2 - .07);
      this.appliedProfileOffset = spherical.phi - baseline;
      this.camera.position.copy(this.lastTarget).add(direction.setFromSpherical(spherical));
      this.lastAppliedProfile = profile;
    }
    this.controls?.update();
    this.scene.updateMatrixWorld(true);
  }

  resetView(): void {
    if (this.disposed) return;
    const target = new Vector3(0, .25 + 7.8 * this._frame.explode, 0);
    const profile = this._frame.profile ?? 0;
    const direction = overviewDirection.clone();
    const spherical = new Spherical().setFromVector3(direction);
    this.appliedProfileOffset = profile * profileElevationDelta;
    spherical.phi += this.appliedProfileOffset;
    this.camera.position.copy(target).add(direction.setFromSpherical(spherical));
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(target);
    this.controls?.target.copy(target);
    this.lastTarget.copy(target);
    this.lastAppliedExplode = this._frame.explode;
    this.lastAppliedProfile = profile;
    this.controls?.update();
    this.requestRender();
  }

  private resize(): void {
    if (this.disposed || !this.renderer) return;
    this.width = Math.max(1, this.host.clientWidth);
    this.height = Math.max(1, this.host.clientHeight);
    const aspect = this.width / this.height;
    const span = Math.max(61, 87 / aspect);
    this.camera.left = -span * aspect / 2;
    this.camera.right = span * aspect / 2;
    this.camera.top = span / 2;
    this.camera.bottom = -span / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height, false);
    this.requestRender();
  }

  private requestRender = (): void => {
    if (this.disposed || this.raf || !this.inView) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      const moved = this.controls?.update() ?? false;
      this.render();
      if (moved) this.requestRender();
    });
  };

  private point(position: Vector3): {x: number; y: number; visible: boolean} {
    const projected = position.project(this.camera);
    return {
      x: (projected.x + 1) * this.width / 2,
      y: (1 - projected.y) * this.height / 2,
      visible: projected.z >= -1 && projected.z <= 1 && Math.abs(projected.x) <= 1.05 && Math.abs(projected.y) <= 1.05,
    };
  }

  projectLayerAnchors(): FloorStoryAnchor[] {
    const state = this.models[this.active];
    if (!state) return [];
    this.camera.updateMatrixWorld();
    this.scene.updateMatrixWorld(true);
    return layerIds.map(id => {
      const entry = state.model.layers.get(id)!;
      // Leaders leave from the screen-right silhouette instead of crossing the visible wood face.
      // Transform actual layer corners so anchors remain attached while the user orbits the sample.
      const corners = [[-29.5, -14.5], [-29.5, 14.5], [29.5, -14.5], [29.5, 14.5]];
      const points = corners.map(([x, z]) => this.point(entry.mesh.localToWorld(new Vector3(x, entry.height / 2, z))));
      points.sort((a, b) => Math.abs(b.x - a.x) > .25 ? b.x - a.x : b.y - a.y);
      return {id, ...points[0]};
    });
  }

  getThicknessAnchors(): FloorStoryThicknessAnchors {
    this.camera.updateMatrixWorld();
    return {
      top: this.point(new Vector3(-29, .5, 14.5)), bottom: this.point(new Vector3(-29, 0, 14.5)),
      assembled: true, thicknessMm: 5,
    };
  }

  private render(): void {
    if (this.disposed || !this.renderer || this.contextLost) return;
    this.renderer.render(this.scene, this.camera);
    this.anchors = this.projectLayerAnchors();
    this.thickness = this.getThicknessAnchors();
    this.options.onAnchors?.(this.anchors, this.thickness);
  }

  get diagnostics() {
    return {
      webgl: Boolean(this.renderer) && !this.contextLost, loaded: this.loaded, disposed: this.disposed,
      frame: {...this._frame}, explode: this._frame.explode, productId: ids[this.active], cachedModels: this.models.length,
      visibleModels: this.models.filter(state => state.model.group.visible).length,
      layerCount: this.models[this.active]?.model.layers.size ?? 0,
      dimensions: {lengthMm: 600, widthMm: 300, thicknessMm: 5},
      layerThicknessMm: {...thicknesses}, layerThicknessSumMm: Object.values(thicknesses).reduce((sum, value) => sum + value, 0),
      cameraPosition: this.camera.position.toArray(), target: this.controls?.target.toArray(),
      cameraZoom: this.camera.zoom, anchors: this.anchors.map(anchor => ({...anchor})),
      thickness: structuredClone(this.thickness), calls: this.renderer?.info.render.calls ?? 0,
      memory: this.renderer ? {...this.renderer.info.memory} : null,
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.abort.abort();
    this.observer.disconnect();
    this.intersection.disconnect();
    this.controls?.removeEventListener('change', this.requestRender);
    this.controls?.dispose();
    for (const state of this.models) {
      state.wearOutline.geometry.dispose();
      state.wearOutline.material.dispose();
      state.photo.dispose();
      state.model.dispose();
      state.bundle.dispose();
      this.scene.remove(state.model.group);
    }
    this.models = [];
    this.studio?.dispose();
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
    this.status.remove();
  }
}
