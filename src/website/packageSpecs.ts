import { sitePath } from '../sitePath';
import { SERIES, type Series } from './catalog';
import { herringboneTile } from './visualizer/texture/layout';
import './packageSpecs.css';

function herringbonePlanks(): string {
  const seen = new Set<string>();
  const planks: string[] = [];
  for (let y = -5; y < 15; y++) for (let x = -5; x < 15; x++) {
    const tile = herringboneTile(x + .5, y + .5, 1, 5);
    const originY = tile.idY - (tile.horizontal ? 0 : 97);
    const key = `${tile.idX}:${originY}:${tile.horizontal}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const transform = tile.horizontal ? `translate(${tile.idX * 20} ${originY * 20})` : `translate(${(tile.idX + 1) * 20} ${originY * 20}) rotate(90)`;
    planks.push(`<rect width="100" height="20" transform="${transform}" fill="url(#package-wood)" stroke="#d6c8b8" stroke-width="1"/>`);
  }
  return planks.join('');
}

export interface PackageSpecDiagnostics {
  thicknessMm: number; foam: boolean; pattern: 'straight' | 'herringbone'; seriesId: string; code: string; image: string;
}

/** Real catalogue finishes, plus a separately quoted underlay preference. */
export class PackageSpecs {
  private readonly abort = new AbortController();
  private thickness = 5;
  private foam = false;
  private pattern: 'straight' | 'herringbone' = 'straight';
  private shade = 0;
  private disposed = false;

  constructor(private readonly host: HTMLElement, private readonly onChange: (seriesId: string) => void) {
    host.innerHTML = `<header class="package-specs-heading"><span class="pricing-eyebrow">CHOOSE YOUR FLOOR</span><h2 id="package-specs-title">เริ่มจากพื้นแบบที่คุณชอบ</h2><p>เลือกความหนา โฟมรองพื้น และลาย ก่อนเลือกแพ็กเกจ</p></header>
      <div class="package-specs-grid"><div class="package-model"><div class="package-model-top"><span>SPC / MATERIAL STUDY</span><strong id="package-model-thickness">5 <small>mm</small></strong></div>
        <svg class="package-model-svg" viewBox="0 0 680 430" role="img" aria-label="ภาพอธิบายโครงสร้างตามสเปคที่เลือก"><defs><pattern id="package-wood" width="1" height="1" patternContentUnits="objectBoundingBox"><image id="package-model-texture" width="1" height="1" preserveAspectRatio="xMidYMid slice" /></pattern><pattern id="package-herringbone" width="200" height="200" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">${herringbonePlanks()}</pattern></defs>
        <ellipse cx="350" cy="352" rx="242" ry="28" fill="#513e3920"/>
        <g id="package-model-foam"><path d="M76 257 408 113 610 225 278 378Z" fill="#33363a"/><path d="m76 257 202 121 332-153v14L278 392 76 271Z" fill="#20252a"/><path d="m89 270 186 109 314-144" fill="none" stroke="#646970" stroke-width="2" stroke-dasharray="3 5"/></g>
        <g class="package-model-core"><path d="M76 207 408 63 610 175 278 328Z" fill="#dfded7"/><path id="package-model-core-edge" d="m76 207 202 121 332-153v28L278 356 76 235Z" fill="#bdbeb7"/><path id="package-model-core-front" d="m76 207 202 121v28L76 235Z" fill="#d0d1c8"/></g>
        <g class="package-model-finish"><path id="package-model-surface" d="M76 167 408 23 610 135 278 288Z" fill="url(#package-wood)"/><path d="m76 167 202 121 332-153v6L278 294 76 173Z" fill="#987356"/><path d="M76 167 408 23 610 135 278 288Z" fill="none" stroke="#ffffff77" stroke-width="1.5"/></g>
        <path d="m278 297 40 23M278 354l40 24M310 315v57" fill="none" stroke="#9d839e" stroke-width="1"/><text id="package-model-measure" x="323" y="352" fill="#806886" font-size="14" font-family="Arial,sans-serif">5 mm</text>
        </svg>
        <div class="package-model-bottom"><span id="package-model-code"></span><span>ภาพอธิบายโครงสร้าง<br>ตามสเปคที่เลือก</span></div></div>
        <div class="package-spec-controls"><fieldset><legend><span>01</span> ความหนาแผ่น SPC</legend><div class="package-spec-options" role="group" aria-label="เลือกความหนาแผ่น SPC"><button type="button" data-spec-thickness="4">4 <small>mm</small></button><button type="button" data-spec-thickness="5">5 <small>mm</small></button></div></fieldset>
        <fieldset><legend><span>02</span> โฟมรองพื้น</legend><div class="package-spec-options package-foam-options" role="group" aria-label="เลือกโฟมรองพื้นที่ต้องการ"><button type="button" data-spec-foam="false"><svg viewBox="0 0 36 28" aria-hidden="true"><path d="m3 10 18-7 12 7-18 8Zm0 6 12 8 18-8"/></svg><span>ไม่เพิ่มโฟม</span></button><button type="button" data-spec-foam="true"><svg viewBox="0 0 36 28" aria-hidden="true"><path d="m3 6 18-5 12 7-18 6Zm0 7 12 8 18-7M3 20l12 7 18-7"/></svg><span>ต้องการโฟมรองพื้น</span></button></div><p class="package-spec-option-note">ให้ทีมงานยืนยันชนิดโฟมและรุ่นที่รองรับก่อนสั่งซื้อ</p></fieldset>
        <fieldset><legend><span>03</span> ลายปู</legend><div class="package-pattern-options" role="group" aria-label="เลือกลายปูพื้น"><button type="button" data-spec-pattern="straight"><img alt="ตัวอย่างพื้น SPC ลายไม้ปูตรง" loading="lazy" decoding="async" src="${sitePath('/website/catalog/cpw-kse-134d.webp')}"/><span>ลายตรง<small>4 / 5 mm</small></span></button><button type="button" data-spec-pattern="herringbone"><img alt="ตัวอย่างพื้น SPC ลายก้างปลา" loading="lazy" decoding="async" src="${sitePath('/website/showcase/cafe-herringbone-top.webp')}"/><span>ลายก้างปลา<small>5 mm</small></span></button></div></fieldset>
        <fieldset class="package-shade-field"><legend><span>04</span> เฉดสี <small id="package-shade-label"></small></legend><div class="package-shades" role="group" aria-label="เลือกเฉดสีจากแค็ตตาล็อก"></div></fieldset>
        <div class="package-spec-summary" aria-live="polite"><strong id="package-selected-spec"></strong><span id="package-selected-series"></span><p id="package-spec-size-note" hidden></p></div><button type="button" class="quiet-button package-spec-consult" data-contact-open>ปรึกษาสเปคนี้กับทีมงาน <span aria-hidden="true">↗</span></button>
        </div></div>`;
    host.addEventListener('click', this.onClick, { signal: this.abort.signal });
    this.render(true);
  }

  private get series(): Series { return SERIES.find(series => series.id === (this.pattern === 'herringbone' ? 'herringbone' : this.thickness === 4 ? 'spc-4-184' : 'spc-5-180'))!; }

  private finishes(): { code: string; image: string }[] {
    const series = this.series;
    return series.codes.flatMap(code => {
      if (series.family === 'herringbone') return [{ code, image: sitePath(`/website/herringbone/${code.toLowerCase().replace('cpw-', '')}.webp`) }];
      const filename = code.toLowerCase().replace(/\s+/g, '-');
      return series.swatches.includes(filename) ? [{ code, image: sitePath(`/website/catalog/${filename}.webp`) }] : [];
    });
  }

  get diagnostics(): PackageSpecDiagnostics {
    const finish = this.finishes()[this.shade];
    return { thicknessMm: this.thickness, foam: this.foam, pattern: this.pattern, seriesId: this.series.id, code: finish.code, image: finish.image };
  }

  get summary(): string {
    const spec = this.diagnostics;
    return `SPC ${spec.thicknessMm} มม. · ${spec.pattern === 'herringbone' ? 'ลายก้างปลา' : 'ลายตรง'} · ${spec.foam ? 'ต้องการโฟมรองพื้น' : 'ไม่เพิ่มโฟม'} · ${spec.code}`;
  }

  private onClick = (event: MouseEvent): void => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button');
    if (!button || !this.host.contains(button)) return;
    let rebuild = false;
    if (button.dataset.specThickness) {
      this.thickness = Number(button.dataset.specThickness);
      if (this.thickness === 4) this.pattern = 'straight';
      this.shade = 0; rebuild = true;
    } else if (button.dataset.specFoam) this.foam = button.dataset.specFoam === 'true';
    else if (button.dataset.specPattern) {
      this.pattern = button.dataset.specPattern as 'straight' | 'herringbone';
      if (this.pattern === 'herringbone') this.thickness = 5;
      this.shade = 0; rebuild = true;
    } else if (button.dataset.specShade) this.shade = Number(button.dataset.specShade);
    else return;
    this.render(rebuild);
  };

  private render(rebuild: boolean): void {
    if (this.disposed) return;
    const state = this.diagnostics;
    this.host.querySelectorAll<HTMLButtonElement>('[data-spec-thickness]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.specThickness) === this.thickness)));
    this.host.querySelectorAll<HTMLButtonElement>('[data-spec-foam]').forEach(button => button.setAttribute('aria-pressed', String((button.dataset.specFoam === 'true') === this.foam)));
    this.host.querySelectorAll<HTMLButtonElement>('[data-spec-pattern]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.specPattern === this.pattern)));
    if (rebuild) this.host.querySelector<HTMLElement>('.package-shades')!.innerHTML = this.finishes().map((finish, index) => `<button type="button" data-spec-shade="${index}" aria-label="${finish.code}" title="${finish.code}"><img src="${finish.image}" alt="" loading="lazy" decoding="async"/></button>`).join('');
    this.host.querySelectorAll<HTMLButtonElement>('[data-spec-shade]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.specShade) === this.shade)));
    this.host.querySelectorAll<SVGImageElement>('#package-model-texture,.package-pattern-image').forEach(image => image.setAttribute('href', state.image));
    this.host.querySelector('#package-model-surface')!.setAttribute('fill', this.pattern === 'herringbone' ? 'url(#package-herringbone)' : 'url(#package-wood)');
    this.host.querySelector<SVGGElement>('#package-model-foam')!.style.opacity = this.foam ? '1' : '0';
    this.host.querySelector<HTMLElement>('.package-model')!.classList.toggle('has-foam', this.foam);
    this.host.querySelector<HTMLElement>('#package-model-thickness')!.innerHTML = `${this.thickness} <small>mm</small>`;
    const edge = this.thickness === 4 ? 18 : 28;
    this.host.querySelector('#package-model-core-edge')!.setAttribute('d', `m76 207 202 121 332-153v${edge}L278 ${328 + edge} 76 ${207 + edge}Z`);
    this.host.querySelector('#package-model-core-front')!.setAttribute('d', `m76 207 202 121v${edge}L76 ${207 + edge}Z`);
    this.host.querySelector('#package-model-measure')!.textContent = `${this.thickness} mm`;
    this.host.querySelector('#package-model-code')!.textContent = state.code;
    this.host.querySelector('#package-shade-label')!.textContent = state.code;
    this.host.querySelector('#package-selected-spec')!.textContent = this.summary;
    this.host.querySelector('#package-selected-series')!.textContent = `${this.series.nameTh} · ${this.series.sizeMm} มม.`;
    const sizeNote = this.host.querySelector<HTMLElement>('#package-spec-size-note')!;
    sizeNote.hidden = !this.series.note;
    sizeNote.textContent = this.series.note ?? '';
    this.host.querySelector<HTMLButtonElement>('.package-spec-consult')!.dataset.contactContext = `${this.summary} · ให้ทีมงานยืนยันรุ่น โฟมรองพื้น และราคาตามสเปค`;
    this.onChange(state.seriesId);
  }

  dispose(): void { this.disposed = true; this.abort.abort(); }
}
