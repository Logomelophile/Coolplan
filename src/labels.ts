import { Camera, Group, Vector3 } from 'three';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import type { LayerEntry } from './geometry/plankGeometry';
import type { Locale, ProductConfig, ViewPreset } from './types';

const SVG_NS = 'http://www.w3.org/2000/svg';
export class LayerLabels {
  readonly renderer = new CSS2DRenderer();
  readonly group = new Group();
  private svg = document.createElementNS(SVG_NS, 'svg');
  private items: {entry: LayerEntry; label: CSS2DObject; button: HTMLButtonElement; line: SVGPolylineElement; dot: SVGCircleElement}[] = [];
  private dimension = document.createElement('div');
  private dimensionLine = document.createElementNS(SVG_NS, 'path');
  private width = 1;
  private height = 1;
  constructor(private root: HTMLElement, private select: (id: string | null) => void) {
    this.renderer.domElement.className = 'spc-labels';
    this.svg.classList.add('spc-lines');
    this.svg.setAttribute('aria-hidden', 'true');
    this.dimension.className = 'spc-dimension';
    this.dimensionLine.setAttribute('fill', 'none');
    this.dimensionLine.setAttribute('stroke', '#aaa2ad');
    this.dimensionLine.setAttribute('stroke-width', '1');
    this.root.append(this.svg, this.renderer.domElement, this.dimension);
  }
  setLayers(entries: Iterable<LayerEntry>, locale: Locale) {
    this.clear();
    const sorted = [...entries].sort((a, b) => a.config.order - b.config.order);
    for (const entry of sorted) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'spc-label';
      button.dataset.layerId = entry.config.id;
      button.addEventListener('pointerenter', () => this.select(entry.config.id));
      button.addEventListener('pointerleave', () => this.select(null));
      button.addEventListener('focus', () => this.select(entry.config.id));
      button.addEventListener('blur', () => this.select(null));
      button.addEventListener('click', () => this.select(entry.config.id));
      const label = new CSS2DObject(button);
      this.group.add(label);
      const line = document.createElementNS(SVG_NS, 'polyline');
      line.setAttribute('fill', 'none');
      line.setAttribute('stroke', '#aaa1ae');
      line.setAttribute('stroke-width', '1');
      const dot = document.createElementNS(SVG_NS, 'circle');
      dot.setAttribute('r', '2.5');
      dot.setAttribute('fill', '#817087');
      this.svg.append(line, dot);
      this.items.push({ entry, label, button, line, dot });
    }
    this.svg.append(this.dimensionLine);
    this.setLocale(locale);
  }
  setLocale(locale: Locale) {
    for (const {entry, button} of this.items) {
      const title = document.createElement('strong');
      title.textContent = entry.config.label[locale];
      const desc = document.createElement('small');
      desc.textContent = entry.config.description[locale];
      button.replaceChildren(title, desc);
    }
  }
  highlight(id: string | null) {
    for (const item of this.items) {
      const active = id === item.entry.config.id;
      item.button.dataset.selected = String(active);
      item.line.setAttribute('stroke', active ? '#795594' : '#b9b2bd');
    }
  }
  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.renderer.setSize(width, height);
    this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  }
  private screen(point: Vector3, camera: Camera) {
    const p = point.clone().project(camera);
    return {x: (p.x + 1) * this.width / 2, y: (1 - p.y) * this.height / 2, z: p.z};
  }
  update(camera: Camera, product: ProductConfig, explode: number, view: ViewPreset, dimensions: boolean) {
    const shown = explode > 0.08 && view !== 'back' && view !== 'profile';
    const visible = this.items.filter(item => item.entry.mesh.visible);
    const labelWidth = this.width <= 600 ? 140 : 205;
    const px = this.width - labelWidth / 2 - 12;
    const gap = Math.min(this.width <= 600 ? 82 : 90, (this.height - 60) / Math.max(1, visible.length));
    for (const item of this.items) {
      const index = visible.indexOf(item);
      const isVisible = shown && index >= 0;
      item.label.visible = isVisible;
      item.line.style.display = item.dot.style.display = isVisible ? '' : 'none';
      if (!isVisible) continue;
      item.button.style.width = `${labelWidth}px`;
      const py = this.height / 2 + (index - (visible.length - 1) / 2) * gap;
      item.label.position.set(px / this.width * 2 - 1, 1 - py / this.height * 2, 0.1).unproject(camera);
      item.button.style.opacity = String(Math.min(1, explode * 3));
      const l = product.dimensions.lengthMm / 20;
      const w = product.dimensions.widthMm / 20;
      const candidates = [new Vector3(l, 0, w), new Vector3(l, 0, -w), new Vector3(-l, 0, w), new Vector3(-l, 0, -w)]
        .map(p => this.screen(item.entry.mesh.localToWorld(p), camera));
      const anchor = candidates.reduce((a, b) => a.x > b.x ? a : b);
      const endX = px - labelWidth / 2 - 6;
      item.line.setAttribute('points', `${anchor.x},${anchor.y} ${endX - 14},${py} ${endX},${py}`);
      item.dot.setAttribute('cx', String(anchor.x));
      item.dot.setAttribute('cy', String(anchor.y));
    }
    const showDim = dimensions && (view === 'front' || view === 'profile') && explode < 0.02;
    this.dimension.hidden = !showDim;
    this.dimensionLine.style.display = showDim ? '' : 'none';
    if (showDim) {
      if (view === 'front') {
        const a = this.screen(new Vector3(-product.dimensions.lengthMm / 20, 0, product.dimensions.widthMm / 20 + 5), camera);
        const b = this.screen(new Vector3(product.dimensions.lengthMm / 20, 0, product.dimensions.widthMm / 20 + 5), camera);
        this.dimensionLine.setAttribute('d', `M ${a.x - 4} ${a.y} H ${a.x + 4} M ${a.x} ${a.y} L ${b.x} ${b.y} M ${b.x - 4} ${b.y} H ${b.x + 4}`);
        this.dimension.textContent = `${product.dimensions.lengthMm} × ${product.dimensions.widthMm} mm`;
        this.dimension.style.left = `${this.width / 2}px`;
        this.dimension.style.top = `${Math.max(24, Math.min(this.height - 24, Math.max(a.y,b.y) + 20))}px`;
      } else {
        const a = this.screen(new Vector3(0, 0, -product.dimensions.widthMm / 20 - 2), camera);
        const b = this.screen(new Vector3(0, product.dimensions.thicknessMm / 10, -product.dimensions.widthMm / 20 - 2), camera);
        this.dimensionLine.setAttribute('d', `M ${a.x - 5} ${a.y} H ${a.x + 5} M ${a.x} ${a.y} L ${b.x} ${b.y} M ${b.x - 5} ${b.y} H ${b.x + 5}`);
        this.dimension.textContent = `${product.dimensions.thicknessMm} mm`;
        this.dimension.style.left = `${Math.min(this.width - 40, Math.max(40, a.x))}px`;
        this.dimension.style.top = `${b.y - 25}px`;
      }
    }
  }
  private clear() {
    for (const item of this.items) { item.label.removeFromParent(); item.button.remove(); }
    this.items = [];
    this.svg.replaceChildren();
  }
  dispose() { this.clear(); this.group.removeFromParent(); this.renderer.domElement.remove(); this.svg.remove(); this.dimension.remove(); }
}
