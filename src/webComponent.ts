import { SPCPlankViewer } from './SPCPlankViewer';
import type { Locale, ViewPreset } from './types';

// The guard keeps importing the module safe in an SSR environment.
const HTMLElementBase = typeof HTMLElement === 'undefined' ? class {} as typeof HTMLElement : HTMLElement;

export class SPCPlankViewerElement extends HTMLElementBase {
  static observedAttributes = ['product','view','auto-rotate','locale','stack-count'];
  viewer?: SPCPlankViewer;
  private mount?: HTMLDivElement;
  connectedCallback() {
    if (this.viewer) return;
    const shadow = this.shadowRoot ?? this.attachShadow({mode:'open'});
    shadow.replaceChildren();
    const style = document.createElement('style');
    style.textContent = ':host{display:block;position:relative;width:100%;height:560px;min-height:240px}.mount{width:100%;height:100%}';
    this.mount = document.createElement('div');
    this.mount.className = 'mount';
    shadow.append(style,this.mount);
    this.viewer = new SPCPlankViewer(this.mount, {
      productId: this.getAttribute('product') ?? undefined,
      view: this.getAttribute('view') as ViewPreset || 'perspective34',
      locale: this.getAttribute('locale') as Locale || 'th',
      autoRotate: this.hasAttribute('auto-rotate') && this.getAttribute('auto-rotate') !== 'false',
      stackCount: Number(this.getAttribute('stack-count') ?? 3),
    });
    for (const type of ['ready','productchange','viewchange','layerselect','explodechange','autorotatechange']) {
      this.viewer.addEventListener(type,event => {
        this.dispatchEvent(new CustomEvent(type, {detail:(event as CustomEvent).detail,bubbles:true,composed:true}));
      });
    }
    void this.viewer.ready.catch(error => this.dispatchEvent(new CustomEvent('viewererror',{detail:{message:String(error)},bubbles:true,composed:true})));
  }
  attributeChangedCallback(name: string, before: string | null, after: string | null) {
    if (!this.viewer || before === after) return;
    try {
      if (name === 'product' && after) void this.viewer.setProduct(after).catch(error => this.dispatchEvent(new CustomEvent('viewererror',{detail:{message:String(error)}})));
      if (name === 'view') this.viewer.setView(after as ViewPreset || 'perspective34');
      if (name === 'locale') this.viewer.setLocale(after as Locale || 'th');
      if (name === 'auto-rotate') this.viewer.setAutoRotate(after !== null && after !== 'false');
      if (name === 'stack-count') this.viewer.setStackCount(Number(after ?? 3));
    } catch(error) { this.dispatchEvent(new CustomEvent('viewererror',{detail:{message:String(error)}})); }
  }
  disconnectedCallback() { this.viewer?.dispose(); this.viewer = undefined; }
}
export function registerSPCPlankViewer(tagName = 'spc-plank-viewer') {
  if (typeof customElements !== 'undefined' && !customElements.get(tagName)) {
    customElements.define(tagName,tagName === 'spc-plank-viewer' ? SPCPlankViewerElement : class extends SPCPlankViewerElement {});
  }
}
