import { SPCPlankViewer, products, generateSurfaceTextures } from '../index';
import type { Locale, ViewPreset, ExplodeMode, ProductConfig } from '../types';
import './style.css';

const app = document.querySelector<HTMLElement>('#studio')!;
const icon = (name: string) => {
  const paths: Record<string, string> = {
    brand: '<path d="m4 11 12-7 12 7-12 7-12-7Z"/><path d="m4 17 12 7 12-7M4 23l12 7 12-7"/>',
    download: '<path d="M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4"/>',
    rotate: '<path d="M19 8a8 8 0 1 0 1 7M19 3v5h-5"/>',
    expand: '<path d="m4 8 8-5 8 5-8 5-8-5Zm0 4 8 5 8-5M4 16l8 5 8-5"/>',
    arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
    reset: '<path d="M5 8a8 8 0 1 1-1 7M5 3v5h5"/>',
    front: '<rect x="8" y="3" width="8" height="18" rx="1"/>',
    perspective34: '<path d="m3 16 11-12 7 4L10 20 3 16Z"/>',
    stacked: '<path d="m3 12 11-9 7 4-11 9-7-4Zm0 4 7 4L21 11M5 21l5 2 11-9"/>',
    closeup: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6M7 10h6m-3-3v6"/>',
    back: '<path d="m3 16 11-12 7 4-11 12-7-4Zm4-4 7 4m-4-7 7 4m-4-7 7 4"/>',
    exploded: '<path d="m4 6 8-4 8 4-8 4-8-4Zm0 6 8 4 8-4M4 18l8 4 8-4"/>',
    profile: '<path d="M3 10h6v2h6v-2h6v5h-6v-2H9v2H3Z"/>',
  };
  return `<svg viewBox="0 0 ${name === 'brand' ? '32 34' : '24 24'}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${paths[name] ?? paths.arrow}</svg>`;
};
const text = {
  th: {
    collection: 'คอลเลกชันพื้น SPC', tagline: 'รายละเอียดที่สร้างความรู้สึกให้พื้นที่',
    save: 'บันทึกภาพ', choose: 'เลือกสัมผัสที่ใช่', finishes: '{count} เฉดสี · {count} บุคลิก',
    length: 'ยาว', width: 'กว้าง', thickness: 'หนารวม', construction: 'มองลึกลงไปในวัสดุ',
    constructionNote: 'ความงามบนผิวหน้า เริ่มจากทุกชั้นที่อยู่ข้างใต้',
    explode: 'สำรวจชั้นวัสดุ', assemble: 'ประกอบกลับ', separation: 'ระยะแยกชั้น',
    lift: 'ยกตรง', stair: 'เหลื่อมชั้น', layerVisibility: 'การแสดงชั้นวัสดุ', stack: 'จำนวนแผ่น',
    rotate: 'หมุนอัตโนมัติ', reset: 'กลับมุมเริ่มต้น', ready: 'พร้อมให้สำรวจ', loading: 'กำลังเตรียมวัสดุ',
    hint: 'ลากเพื่อหมุน · เลื่อนเพื่อซูม · แตะแผ่นเพื่อแยกชั้น',
    unavailable: 'อุปกรณ์นี้ไม่รองรับภาพ 3 มิติ',
    selectHint: 'แตะชั้นวัสดุเพื่อดูรายละเอียด', view: 'มุมมอง', imageSaved: 'บันทึกภาพแล้ว',
    note: 'สีบนจออาจแตกต่างจากวัสดุจริง กรุณาเทียบกับตัวอย่างสินค้าก่อนเลือกสี',
    material: 'STONE PLASTIC COMPOSITE', footer: 'ค้นพบวัสดุ ในมุมที่เป็นคุณ',
    front: 'ด้านบน', perspective34: 'สามส่วนสี่', stacked: 'วางซ้อน', closeup: 'ผิวสัมผัส', back: 'ด้านหลัง', exploded: 'แยกชั้น', profile: 'ขอบแผ่น',
  },
  en: {
    collection: 'THE SPC COLLECTION', tagline: 'A closer look. A different feeling.',
    save: 'Save image', choose: 'Find your finish', finishes: '{count} finishes · {count} expressions',
    length: 'Length', width: 'Width', thickness: 'Total thickness', construction: 'Beauty, layer by layer.',
    constructionNote: 'Discover the thoughtful construction beneath the surface.',
    explode: 'Explore the layers', assemble: 'Bring it together', separation: 'Layer separation',
    lift: 'Lift', stair: 'Stair', layerVisibility: 'Visible layers', stack: 'Planks in stack',
    rotate: 'Auto-rotate', reset: 'Reset view', ready: 'Ready to explore', loading: 'Preparing material',
    hint: 'Drag to rotate · Scroll to zoom · Tap the plank to separate',
    unavailable: '3D viewing is unavailable on this device',
    selectHint: 'Tap a layer to discover its detail', view: 'View', imageSaved: 'Image saved',
    note: 'Screen colours may vary from the actual material. Compare a physical sample before choosing your finish.',
    material: 'STONE PLASTIC COMPOSITE', footer: 'Space for a different perspective.',
    front: 'Top', perspective34: 'Perspective', stacked: 'Stacked', closeup: 'Surface', back: 'Back', exploded: 'Layers', profile: 'Profile',
  },
};
const views: ViewPreset[] = ['front', 'perspective34', 'stacked', 'closeup', 'back', 'exploded', 'profile'];
const displayOrder = ['light-natural-oak', 'whitewashed-ash-oak', 'golden-honey-oak', 'warm-taupe-oak', 'greige-oak', 'dark-walnut-brown', 'white-marble'];
const orderedProducts = [
  ...displayOrder.map(id => products.find(product => product.id === id)).filter((product): product is ProductConfig => product !== undefined),
  ...products.filter(product => !displayOrder.includes(product.id)),
];
let locale: Locale = 'th';
let mode: ExplodeMode = 'lift';
let currentProduct = orderedProducts[0];
let busy = true;
let isReady = false;
let selectedLayer: string | null = null;
let statusTimer = 0;

app.innerHTML = `
  <header class="studio-header">
    <a class="studio-brand" href="#" aria-label="Coolplan Material Studio">${icon('brand')}<span>coolplan<span class="studio-brand-sub">MATERIAL STUDIO</span></span></a>
    <span class="studio-header-note" data-text="tagline"></span>
    <div class="studio-header-actions"><div class="studio-language" role="group" aria-label="Language"><button type="button" data-locale="th" aria-pressed="true">TH</button><span>/</span><button type="button" data-locale="en" aria-pressed="false">EN</button></div><button type="button" class="studio-save" id="save-image" disabled>${icon('download')}<span data-text="save"></span></button></div>
  </header>
  <section class="studio-workspace" aria-label="Material explorer">
    <aside class="studio-product-panel">
      <div class="studio-eyebrow"><span class="studio-purple-dot"></span><span data-text="collection"></span></div>
      <div class="studio-product-index"><span id="product-number">01</span><span> / ${String(orderedProducts.length).padStart(2, '0')}</span></div>
      <h1 id="product-name"></h1><p class="studio-product-th" id="product-local-name"></p>
      <p class="studio-description" id="product-description"></p>
      <dl class="studio-specs"><div><dt data-text="length"></dt><dd>1220<span>mm</span></dd></div><div><dt data-text="width"></dt><dd>180<span>mm</span></dd></div><div><dt data-text="thickness"></dt><dd>5.3<span>mm</span></dd></div></dl>
      <button class="studio-explore" type="button" id="toggle-explode" disabled><span id="explode-label"></span>${icon('arrow')}</button>
      <div class="studio-product-material"><span class="studio-material-line"></span><span data-text="material"></span></div>
    </aside>
    <div class="studio-visual-panel">
      <div class="studio-stage-top"><span class="studio-stage-number">01 — <span id="current-view"></span></span><div class="studio-stage-actions"><button type="button" class="studio-icon-button" id="reset-view" disabled>${icon('reset')}</button><button type="button" class="studio-rotate" id="auto-rotate" aria-pressed="false" disabled>${icon('rotate')}<span data-text="rotate"></span><i aria-hidden="true"></i></button></div></div>
      <div class="studio-canvas-wrap"><div id="viewer" class="studio-viewer"></div><div class="studio-loading" id="loading" role="status"><span class="studio-loader"></span><span data-text="loading"></span></div></div>
      <div class="studio-stage-bottom"><p id="interaction-hint" data-text="hint"></p><span class="studio-status" id="viewer-status" aria-live="polite"></span></div>
      <div class="studio-view-tabs" role="group" aria-label="Camera views">${views.map((view, index) => `<button type="button" data-view="${view}" aria-pressed="${view === 'perspective34'}" disabled>${icon(view)}<span data-text="${view}"></span><small>${index + 1}</small></button>`).join('')}</div>
    </div>
  </section>
  <section class="studio-finish-section" aria-labelledby="finish-title"><div class="studio-section-heading"><div><p class="studio-eyebrow">THE MATERIAL PALETTE</p><h2 id="finish-title" data-text="choose"></h2></div><span data-text="finishes"></span></div><div class="studio-swatches" id="swatches" role="group" aria-labelledby="finish-title">${orderedProducts.map((product, index) => `<button type="button" class="studio-swatch" data-product="${product.id}" aria-pressed="${index === 0}" disabled><span class="studio-swatch-image" style="background:${product.surface.palette.base}"><img alt="" loading="eager"/><span class="studio-swatch-check" aria-hidden="true">✓</span></span><span class="studio-swatch-title">${product.name}</span><span class="studio-swatch-index">${String(index + 1).padStart(2, '0')}</span></button>`).join('')}</div></section>
  <section class="studio-construction" aria-labelledby="construction-title"><div class="studio-construction-intro"><p class="studio-eyebrow">BEYOND THE SURFACE</p><h2 id="construction-title" data-text="construction"></h2><p data-text="constructionNote"></p><div class="studio-selected-layer" id="selected-layer" aria-live="polite"></div></div><div class="studio-construction-controls"><div class="studio-explode-controls"><div class="studio-range-header"><label for="explode-range" data-text="separation"></label><output for="explode-range" id="explode-value">0%</output></div><input type="range" id="explode-range" min="0" max="100" value="0" step="1" disabled/><div class="studio-explode-options"><div class="studio-segment" role="group" aria-label="Layer separation style"><button type="button" data-mode="lift" aria-pressed="true" data-text="lift" disabled></button><button type="button" data-mode="stair" aria-pressed="false" data-text="stair" disabled></button></div><label class="studio-stack-label"><span data-text="stack"></span><select id="stack-count" disabled><option value="2">2</option><option value="3" selected>3</option><option value="4">4</option><option value="5">5</option></select></label></div></div><fieldset class="studio-layer-fields"><legend data-text="layerVisibility"></legend><div id="layers" class="studio-layer-list"></div></fieldset></div></section>
  <footer class="studio-footer"><span data-text="footer"></span><p data-text="note"></p><a href="./room/" style="color:var(--purple);white-space:nowrap">Room Motion ↗</a><span>COOLPLAN © ${new Date().getFullYear()}</span></footer>`;

function element<T extends HTMLElement>(id: string): T { return app.querySelector<T>(`#${id}`)!; }
const container = element<HTMLDivElement>('viewer');
const viewer = new SPCPlankViewer(container, { productId: currentProduct.id, view: 'perspective34', locale, autoRotate: false, stackCount: 3 });
const range = element<HTMLInputElement>('explode-range');
const hiddenLayers = new Set<string>();

function announce(message: string) {
  clearTimeout(statusTimer);
  element('viewer-status').textContent = message;
  statusTimer = window.setTimeout(() => { if (!busy) element('viewer-status').textContent = text[locale].ready; }, 2500);
}
function setBusy(value: boolean) {
  busy = value;
  app.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement>('button:not([data-locale]), input, select').forEach(control => { control.disabled = value; });
  element('loading').hidden = !value;
  container.setAttribute('aria-busy', String(value));
  element('viewer-status').textContent = value ? text[locale].loading : text[locale].ready;
}
function renderProduct(product: ProductConfig) {
  currentProduct = product;
  element('product-name').textContent = product.name;
  element('product-local-name').textContent = locale === 'th' ? product.nameTh : 'SPC FLOORING';
  element('product-description').textContent = product.description[locale];
  element('product-number').textContent = String(orderedProducts.findIndex(p => p.id === product.id) + 1).padStart(2, '0');
  const dimensionKeys = ['lengthMm', 'widthMm', 'thicknessMm'] as const;
  app.querySelectorAll<HTMLElement>('.studio-specs dd').forEach((value, index) => { value.innerHTML = `${product.dimensions[dimensionKeys[index]]}<span>mm</span>`; });
  app.querySelectorAll<HTMLElement>('[data-product]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.product === product.id)));
  element('layers').replaceChildren(...[...product.layers].sort((a, b) => a.order - b.order).map(layer => {
    const label = document.createElement('label');
    label.className = 'studio-layer-control';
    const check = document.createElement('input');
    check.type = 'checkbox'; check.checked = !hiddenLayers.has(layer.id); check.disabled = busy;
    check.addEventListener('change', () => {
      if (check.checked) hiddenLayers.delete(layer.id); else hiddenLayers.add(layer.id);
      viewer.setLayerVisible(layer.id, check.checked);
    });
    const dot = document.createElement('span'); dot.className = 'studio-layer-dot';
    dot.style.background = layer.material.kind === 'decor' ? product.surface.palette.base : layer.material.color ?? (layer.material.kind === 'backing' ? '#252523' : '#d3d5d5');
    const title = document.createElement('span'); title.textContent = layer.label[locale];
    const thickness = document.createElement('small'); thickness.textContent = `${layer.thicknessMm.toFixed(1)} mm`;
    label.append(check, dot, title, thickness);
    return label;
  }));
  renderSelectedLayer();
}
function renderSelectedLayer() {
  const layer = currentProduct.layers.find(item => item.id === selectedLayer);
  const target = element('selected-layer');
  target.replaceChildren();
  if (!layer) { target.textContent = text[locale].selectHint; return; }
  const strong = document.createElement('strong'); strong.textContent = layer.label[locale];
  const description = document.createElement('span'); description.textContent = layer.description[locale];
  target.append(strong, description);
}
function syncView() {
  app.querySelectorAll<HTMLElement>('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === viewer.view)));
  element('current-view').textContent = text[locale][viewer.view];
  const number = element('current-view').parentElement!.firstChild!;
  number.textContent = `${String(views.indexOf(viewer.view) + 1).padStart(2, '0')} — `;
}
function syncExplode() {
  const percent = Math.round(viewer.explode * 100);
  range.value = String(percent);
  element('explode-value').textContent = `${percent}%`;
  element('explode-label').textContent = percent > 0 ? text[locale].assemble : text[locale].explode;
  element('toggle-explode').setAttribute('aria-pressed', String(percent > 0));
}
function renderLocale() {
  document.documentElement.lang = locale;
  app.querySelectorAll<HTMLElement>('[data-text]').forEach(item => {
    const key = item.dataset.text as keyof typeof text.en;
    item.textContent = text[locale][key].replaceAll('{count}', String(orderedProducts.length));
  });
  app.querySelectorAll<HTMLElement>('[data-locale]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.locale === locale)));
  element('reset-view').setAttribute('aria-label', text[locale].reset);
  element('reset-view').title = text[locale].reset;
  renderProduct(currentProduct); syncView(); syncExplode();
  element('viewer-status').textContent = !viewer.diagnostics.webgl ? text[locale].unavailable : busy ? text[locale].loading : text[locale].ready;
}

app.querySelectorAll<HTMLButtonElement>('[data-locale]').forEach(button => button.addEventListener('click', () => { locale = button.dataset.locale as Locale; viewer.setLocale(locale); renderLocale(); }));
app.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button => button.addEventListener('click', () => { viewer.setView(button.dataset.view as ViewPreset); syncView(); syncExplode(); }));
app.querySelectorAll<HTMLButtonElement>('[data-product]').forEach(button => button.addEventListener('click', async () => {
  if (busy || button.dataset.product === currentProduct.id) return;
  setBusy(true);
  try {
    selectedLayer = null; hiddenLayers.clear();
    await viewer.setProduct(button.dataset.product!);
    renderProduct(viewer.product); syncView(); syncExplode();
  } catch (error) {
    announce(error instanceof Error ? error.message : 'Unable to load this material.');
  } finally { setBusy(false); }
}));
element('toggle-explode').addEventListener('click', () => {
  if (viewer.explode > 0) { viewer.setExplode(false, mode); viewer.setView('perspective34'); }
  else { viewer.setView('exploded'); viewer.setExplode(true, mode); }
  syncView(); syncExplode();
});
range.addEventListener('input', () => { viewer.setExplode(Number(range.value) / 100, mode); syncExplode(); });
app.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(button => button.addEventListener('click', () => {
  mode = button.dataset.mode as ExplodeMode;
  app.querySelectorAll<HTMLElement>('[data-mode]').forEach(item => item.setAttribute('aria-pressed', String(item.dataset.mode === mode)));
  viewer.setExplode(viewer.explode, mode);
}));
element<HTMLSelectElement>('stack-count').addEventListener('change', event => { viewer.setStackCount(Number((event.target as HTMLSelectElement).value)); viewer.setView('stacked'); syncView(); });
element('auto-rotate').addEventListener('click', () => { viewer.setAutoRotate(!viewer.autoRotate); element('auto-rotate').setAttribute('aria-pressed', String(viewer.autoRotate)); });
element('reset-view').addEventListener('click', () => { viewer.setExplode(false); viewer.setView('perspective34'); selectedLayer = null; renderSelectedLayer(); syncView(); syncExplode(); });
element('save-image').addEventListener('click', () => {
  try {
    const link = document.createElement('a'); link.href = viewer.screenshot(); link.download = `coolplan-${currentProduct.id}-${viewer.view}.png`; link.click(); announce(text[locale].imageSaved);
  } catch (error) { announce(error instanceof Error ? error.message : 'Unable to save image.'); }
});
viewer.addEventListener('productchange', () => { renderProduct(viewer.product); });
viewer.addEventListener('viewchange', () => { syncView(); syncExplode(); });
viewer.addEventListener('layerselect', event => { selectedLayer = (event as CustomEvent<{ layerId: string | null }>).detail.layerId; renderSelectedLayer(); });
viewer.addEventListener('explodechange', syncExplode);
container.addEventListener('pointerup', () => { window.setTimeout(() => { if (isReady) { syncView(); syncExplode(); } }, 700); });
renderLocale();
viewer.ready.then(() => {
  if (!viewer.diagnostics.webgl) {
    setBusy(true);
    element('loading').hidden = true;
    element('viewer-status').textContent = text[locale].unavailable;
    return;
  }
  isReady = true; setBusy(false); renderProduct(viewer.product); syncView(); syncExplode();
}).catch(error => {
  element('loading').hidden = true;
  element('viewer-status').textContent = error instanceof Error ? error.message : 'WebGL is unavailable.';
});

async function createSwatches() {
  for (const product of orderedProducts) {
    await new Promise<void>(resolve => window.setTimeout(resolve, 0));
    const maps = generateSurfaceTextures(product, 512, 128);
    const img = app.querySelector<HTMLImageElement>(`[data-product="${product.id}"] img`)!;
    img.src = maps.thumbnail;
    maps.dispose();
  }
}
void createSwatches();
window.addEventListener('pagehide', () => { clearTimeout(statusTimer); viewer.dispose(); }, { once: true });
