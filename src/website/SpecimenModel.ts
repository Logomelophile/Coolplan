import { AmbientLight, BoxGeometry, CanvasTexture, DirectionalLight, Group, Mesh, MeshStandardMaterial, OrthographicCamera, Scene, SRGBColorSpace, WebGLRenderer, type Texture } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { herringboneTile } from './visualizer/texture/layout';
export interface SpecimenState {
    thickness: number;
    foam: boolean;
    family: string;
    image: string;
    herringbone: boolean;
}
/** Loaded only near the estimator. This is a cutaway sample, with catalogue texture. */
export class SpecimenModel {
    private readonly scene = new Scene();
    private readonly camera = new OrthographicCamera(-23, 23, 20, -20, .1, 250);
    private readonly group = new Group();
    private readonly renderer: WebGLRenderer;
    private readonly controls: OrbitControls;
    private readonly resize: ResizeObserver;
    private texture: Texture | null = null;
    private revision = 0;
    private disposed = false;
    constructor(private readonly host: HTMLElement) {
        this.renderer = new WebGLRenderer({ alpha: true, antialias: true });
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
        this.renderer.outputColorSpace = SRGBColorSpace;
        this.renderer.domElement.setAttribute('aria-label', 'โมเดลตัวอย่างพื้น 3D ลากเพื่อหมุนดู');
        this.renderer.domElement.setAttribute('role', 'img');
        host.append(this.renderer.domElement);
        this.camera.position.set(34, 31, 40);
        this.camera.lookAt(0, 0, 0);
        this.scene.add(new AmbientLight(0xffffff, 2.8));
        const light = new DirectionalLight(0xfff1e4, 4);
        light.position.set(15, 35, 18);
        this.scene.add(light, this.group);
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableZoom = false;
        this.controls.enablePan = false;
        this.controls.enableDamping = false;
        this.controls.minPolarAngle = .35;
        this.controls.maxPolarAngle = 1.4;
        this.controls.addEventListener('change', this.draw);
        this.resize = new ResizeObserver(() => { const width = host.clientWidth, height = host.clientHeight; this.renderer.setSize(width, height, false); const ratio = width / Math.max(1, height); this.camera.left = -22 * ratio; this.camera.right = 22 * ratio; this.camera.top = 22; this.camera.bottom = -22; this.camera.updateProjectionMatrix(); this.draw(); });
        this.resize.observe(host);
        host.classList.add('is-3d-ready');
    }
    async set(state: SpecimenState): Promise<void> {
        const revision = ++this.revision;
        const image = new Image();
        image.decoding = 'async';
        image.src = state.image;
        try {
            await image.decode();
        }
        catch {
            return;
        }
        if (this.disposed || revision !== this.revision)
            return;
        const canvas = document.createElement('canvas');
        canvas.width = 768;
        canvas.height = 512;
        const ctx = canvas.getContext('2d')!;
        if (state.herringbone) {
            ctx.fillStyle = '#a98261';
            ctx.fillRect(0, 0, 768, 512);
            ctx.scale(3.84, 2.56);
            const seen = new Set<string>();
            for (let y = -5; y < 16; y++)
                for (let x = -5; x < 16; x++) {
                    const tile = herringboneTile(x + .5, y + .5, 1, 5), origin = tile.idY - (tile.horizontal ? 0 : 97), key = `${tile.idX}:${origin}:${tile.horizontal}`;
                    if (seen.has(key))
                        continue;
                    seen.add(key);
                    ctx.save();
                    if (tile.horizontal)
                        ctx.translate(tile.idX * 20, origin * 20);
                    else {
                        ctx.translate((tile.idX + 1) * 20, origin * 20);
                        ctx.rotate(Math.PI / 2);
                    }
                    ctx.drawImage(image, 0, 0, 100, 20);
                    ctx.strokeStyle = '#e0c8ac';
                    ctx.lineWidth = .45;
                    ctx.strokeRect(0, 0, 100, 20);
                    ctx.restore();
                }
        }
        else
            ctx.drawImage(image, 0, 0, 768, 512);
        const map = new CanvasTexture(canvas);
        map.colorSpace = SRGBColorSpace;
        this.group.children.slice().forEach(object => { const mesh = object as Mesh<BoxGeometry, MeshStandardMaterial | MeshStandardMaterial[]>; mesh.geometry.dispose(); const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]; materials.forEach(m => m.dispose()); this.group.remove(mesh); });
        this.texture?.dispose();
        this.texture = map;
        const thickness = state.thickness / 10;
        const core = new Mesh(new BoxGeometry(31, thickness, 19), new MeshStandardMaterial({ color: state.family === 'laminate' ? '#aa895d' : state.family === 'lvt' ? '#737574' : '#d2d1c8', roughness: .8 }));
        core.position.y = -.1;
        this.group.add(core);
        const edge = new MeshStandardMaterial({ color: '#9f7957', roughness: .7 }), top = new MeshStandardMaterial({ map, roughness: .55, metalness: .03 });
        const surface = new Mesh(new BoxGeometry(31, .06, 19), [edge, edge, top, edge, edge, edge]);
        surface.position.y = thickness / 2 + .55;
        this.group.add(surface);
        if (state.foam) {
            const foam = new Mesh(new BoxGeometry(31, .16, 19), new MeshStandardMaterial({ color: '#353a3c', roughness: 1 }));
            foam.position.y = -thickness / 2 - .8;
            this.group.add(foam);
        }
        this.draw();
        this.host.dataset.renderedTexture = state.image;
    }
    private draw = (): void => { if (!this.disposed)
        this.renderer.render(this.scene, this.camera); };
    dispose(): void { this.disposed = true; this.revision++; this.resize.disconnect(); this.controls.dispose(); this.group.children.forEach(o => { const m = o as Mesh<BoxGeometry, MeshStandardMaterial | MeshStandardMaterial[]>; m.geometry.dispose(); (Array.isArray(m.material) ? m.material : [m.material]).forEach(material => material.dispose()); }); this.texture?.dispose(); this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer.domElement.remove(); }
}
