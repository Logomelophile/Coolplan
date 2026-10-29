import { PRICE_LIST, money } from './catalog';
import { catalogueFinishes, FLOOR_SELECTIONS, selectionImage, sizeLabel, formatDimensions, type FloorSelection } from './floorSelections';
import type { SpecimenModel } from './SpecimenModel';
import type { CatalogueRoomPreview } from './CatalogueRoomPreview';
import './packageSpecs.css';
export interface PackageSpecDiagnostics {
    thicknessMm: number;
    foam: boolean;
    pattern: 'straight' | 'herringbone';
    seriesId: string;
    code: string;
    image: string;
    productId: string;
    rowIndex: number;
    family: string;
    sizeMm: string;
    modelReady: boolean;
}
export class PackageSpecs {
    private readonly abort = new AbortController();
    private product = FLOOR_SELECTIONS.find(p => p.id === 'spc-5-180')!;
    private foam = false;
    private shade = 0;
    private model: SpecimenModel | null = null;
    private roomPreview: CatalogueRoomPreview | null = null;
    private observer: IntersectionObserver | null = null;
    private disposed = false;
    constructor(private readonly host: HTMLElement, private readonly onChange: (option: FloorSelection) => void) {
        host.innerHTML = `<header class="package-specs-heading"><span class="pricing-eyebrow">YOUR FLOOR, YOUR SPACE</span><h2 id="package-specs-title">เริ่มจากพื้นแบบที่คุณชอบ</h2><p>เลือกวัสดุ สเปค และเฉดสี ใส่พื้นที่ แล้วเห็นราคาพร้อมติดตั้งได้ทันที</p></header><div class="package-specs-grid"><div class="package-model"><div class="package-model-top"><span id="package-model-family">SPC / MATERIAL STUDY</span><strong id="package-model-thickness"></strong></div><div class="package-model-view"><div class="package-model-fallback"><img id="package-model-texture" alt="ภาพผิววัสดุจากแค็ตตาล็อก"/><i></i></div><div class="package-model-canvas"></div></div><div class="package-model-bottom"><span id="package-model-code"></span><span>ตัวอย่างตัดขวางวัสดุ 3D<br>ลากเพื่อหมุนดู</span></div><div class="package-model-facts"><span id="package-model-size"></span><span id="package-model-install"></span></div><p class="package-model-note">ภาพอธิบายโครงสร้าง ช่องแยกชั้นไม่ใช่ความหนาจริงของแผ่น</p></div><div class="package-spec-controls"><fieldset><legend><span>01</span> วัสดุที่ชอบ</legend><div class="package-material-options">${[{ id: 'spc', label: 'SPC' }, { id: 'herringbone', label: 'ก้างปลา' }, { id: 'laminate', label: 'Laminate' }, { id: 'lvt', label: 'LVT' }].map(f => `<button type="button" data-spec-family="${f.id}">${f.label}</button>`).join('')}</div></fieldset><fieldset><legend><span>02</span> รุ่นและความหนา</legend><div class="package-spec-options package-row-options"></div></fieldset><fieldset><legend><span>03</span> ขนาดแผ่น</legend><select id="package-size" aria-label="เลือกขนาดแผ่น"></select></fieldset><fieldset class="package-foam-field"><legend><span>04</span> โฟมรองพื้น</legend><div class="package-spec-options package-foam-options"><button type="button" data-spec-foam="false">ไม่เพิ่มโฟม</button><button type="button" data-spec-foam="true">ต้องการโฟมรองพื้น</button></div><p class="package-spec-option-note">ให้ทีมงานยืนยันชนิดโฟมและรุ่นที่รองรับ ราคาโฟมยังไม่รวมในยอดประเมิน</p></fieldset><fieldset><legend><span>05</span> ลายปู</legend><div class="package-pattern-options"><button type="button" data-spec-pattern="straight"><span>ลายตรง / ลายไม้</span></button><button type="button" data-spec-pattern="herringbone"><span>ลายก้างปลา</span></button><button type="button" data-spec-pattern="cement"><span>ลายปูน</span></button></div></fieldset><fieldset><legend><span>06</span> เฉดสี <small id="package-shade-label"></small></legend><div class="package-shades"></div></fieldset><div class="package-spec-summary" aria-live="polite"><strong id="package-selected-spec"></strong><span id="package-selected-series"></span><p id="package-spec-size-note"></p><div class="package-unit-price"></div></div><button type="button" class="quiet-button package-spec-consult" data-contact-open>ปรึกษาสเปคนี้กับทีมงาน ↗</button></div><section class="package-estimate-slot" aria-label="ใส่พื้นที่และคำนวณราคาตามสเปค"></section></div>`;
        const model = host.querySelector<HTMLElement>('.package-model')!;
        const previews = document.createElement('div');
        previews.className = 'package-preview-stack';
        model.before(previews);
        const room = document.createElement('section');
        room.className = 'package-room';
        room.setAttribute('aria-label', 'ลองสเปคที่เลือกในห้องตัวอย่าง');
        room.innerHTML = '<p class="package-room-placeholder">ตัวอย่างห้องพร้อมสีพื้นที่เลือก</p>';
        previews.append(model, room);
        host.addEventListener('click', this.onClick, { signal: this.abort.signal });
        host.querySelector('#package-size')!.addEventListener('change', e => this.selectProduct((e.target as HTMLSelectElement).value), { signal: this.abort.signal });
        this.render(true);
        this.observer = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) {
            this.observer?.disconnect();
            void this.loadModel();
        } }, { rootMargin: '100px' });
        this.observer.observe(host.querySelector('.package-model')!);
    }
    private async loadModel(): Promise<void> {
        const [model, room] = await Promise.allSettled([import('./SpecimenModel'), import('./CatalogueRoomPreview')]);
        if (this.disposed) return;
        if (model.status === 'fulfilled') {
            try { this.model = new model.value.SpecimenModel(this.host.querySelector('.package-model-canvas')!); }
            catch { this.host.querySelector('.package-model-view')!.classList.add('model-fallback'); }
        }
        if (room.status === 'fulfilled') {
            try { this.roomPreview = new room.value.CatalogueRoomPreview(this.host.querySelector('.package-room')!); }
            catch { this.host.querySelector('.package-room')!.textContent = 'ยังเปิดตัวอย่างห้องไม่ได้ กรุณาลองใหม่'; }
        }
        this.updateModel();
    }
    private finishes() { return this.product.series ? catalogueFinishes(this.product.series) : [{ code: 'ให้ทีมงานยืนยันสีตามรุ่น', image: null }]; }
    get diagnostics(): PackageSpecDiagnostics { const finish = this.finishes()[this.shade] ?? this.finishes()[0]; return { thicknessMm: this.product.thicknessMm, foam: this.foam, pattern: this.product.family === 'herringbone' ? 'herringbone' : 'straight', seriesId: this.product.id, productId: this.product.id, rowIndex: this.product.priceIndex, code: finish.code, image: finish.image ?? selectionImage(this.product), family: this.product.family, sizeMm: this.product.sizeMm, modelReady: !!this.model }; }
    get summary(): string { return `${this.product.name} · ${sizeLabel(this.product)} · ${this.diagnostics.code} · ${this.foam ? 'ต้องการโฟมรองพื้น (ยืนยันราคาเพิ่มเติม)' : 'ไม่เพิ่มโฟม'}`; }
    selectProduct(id: string): void { const p = FLOOR_SELECTIONS.find(p => p.id === id); if (!p)
        return; this.product = p; this.shade = 0; if (p.install === 'glue')
        this.foam = false; this.render(true); }
    selectPrice(index: number): void { const p = FLOOR_SELECTIONS.find(p => p.priceIndex === index); if (p)
        this.selectProduct(p.id); }
    private onClick = (event: MouseEvent): void => { const b = (event.target as Element).closest<HTMLButtonElement>('button'); if (!b)
        return; if (b.dataset.specFamily) {
        const p = FLOOR_SELECTIONS.find(p => p.family === b.dataset.specFamily)!;
        this.selectProduct(p.id);
    }
    else if (b.dataset.specRow)
        this.selectPrice(Number(b.dataset.specRow));
    else if (b.dataset.specFoam) {
        this.foam = b.dataset.specFoam === 'true' && this.product.install !== 'glue';
        this.render(false);
    }
    else if (b.dataset.specShade) {
        this.shade = Number(b.dataset.specShade);
        this.render(false);
    }
    else if (b.dataset.specPattern) {
        this.selectProduct(b.dataset.specPattern === 'herringbone' ? 'herringbone' : b.dataset.specPattern === 'cement' ? 'lvt-cement' : this.product.family === 'lvt' ? 'lvt-wood' : this.product.family === 'herringbone' ? 'spc-5-180' : this.product.id);
    } };
    private updateModel(): void {
        const s = this.diagnostics;
        void this.model?.set({ thickness: s.thicknessMm, foam: s.foam, family: s.family, image: s.image, herringbone: s.pattern === 'herringbone' });
        void this.roomPreview?.set({ code: s.code, image: s.image, sizeMm: s.sizeMm, herringbone: s.pattern === 'herringbone', illustrative: !this.finishes()[this.shade]?.image });
    }
    private render(rebuild: boolean): void {
        if (this.disposed)
            return;
        const s = this.diagnostics, row = PRICE_LIST[this.product.priceIndex];
        this.host.querySelectorAll<HTMLButtonElement>('[data-spec-family]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.specFamily === this.product.family)));
        if (rebuild) {
            const rows = [...new Set(FLOOR_SELECTIONS.filter(p => p.family === this.product.family).map(p => p.priceIndex))];
            this.host.querySelector('.package-row-options')!.innerHTML = rows.map(i => `<button type="button" data-spec-row="${i}" data-spec-thickness="${FLOOR_SELECTIONS.find(p => p.priceIndex === i)!.thicknessMm}" aria-pressed="${i === this.product.priceIndex}">${PRICE_LIST[i].item}</button>`).join('');
            const sizes = FLOOR_SELECTIONS.filter(p => p.family === this.product.family && p.priceIndex === this.product.priceIndex);
            this.host.querySelector<HTMLSelectElement>('#package-size')!.innerHTML = sizes.map(p => `<option value="${p.id}">${sizeLabel(p)}</option>`).join('');
            this.host.querySelector<HTMLSelectElement>('#package-size')!.value = this.product.id;
            this.host.querySelector('.package-shades')!.innerHTML = this.finishes().map((f, i) => `<button type="button" data-spec-shade="${i}" aria-label="${f.code}" title="${f.code}">${f.image ? `<img src="${f.image}" alt="" loading="lazy" decoding="async"/>` : `<span>${f.code}</span>`}</button>`).join('');
        }
        this.host.querySelectorAll<HTMLButtonElement>('[data-spec-shade]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.specShade) === this.shade)));
        this.host.querySelectorAll<HTMLButtonElement>('[data-spec-foam]').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.specFoam === 'true') === this.foam)));
        this.host.querySelector<HTMLElement>('.package-foam-field')!.hidden = this.product.install === 'glue';
        this.host.querySelectorAll<HTMLButtonElement>('[data-spec-pattern]').forEach(b => { const pattern = this.product.family === 'herringbone' ? 'herringbone' : this.product.id === 'lvt-cement' ? 'cement' : 'straight'; b.setAttribute('aria-pressed', String(b.dataset.specPattern === pattern)); b.hidden = b.dataset.specPattern === 'cement' && this.product.family !== 'lvt'; });
        this.host.querySelector<HTMLImageElement>('#package-model-texture')!.src = s.image;
        this.host.querySelector('#package-model-family')!.textContent = `${s.family.toUpperCase()} / MATERIAL STUDY`;
        this.host.querySelector('#package-model-thickness')!.innerHTML = `${s.thicknessMm} <small>mm</small>`;
        this.host.querySelector('#package-model-code')!.textContent = s.code;
        this.host.querySelector('#package-shade-label')!.textContent = s.code;
        this.host.querySelector('#package-model-size')!.textContent = sizeLabel(this.product);
        this.host.querySelector('#package-model-install')!.textContent = this.product.install === 'glue' ? 'ติดตั้งแบบทากาว' : 'ติดตั้งแบบคลิกล็อก';
        this.host.querySelector('#package-selected-spec')!.textContent = this.summary;
        this.host.querySelector('#package-selected-series')!.textContent = this.finishes()[this.shade]?.image ? 'ภาพเฉดสีจากแค็ตตาล็อก 2026' : 'ยังไม่มีภาพของเฉดนี้ ภาพด้านข้างเป็นตัวอย่างตระกูลสินค้า ให้ทีมงานยืนยันสี';
        this.host.querySelector('#package-spec-size-note')!.textContent = this.product.series?.note ?? (this.product.series && row.sizeMm && row.sizeMm !== this.product.sizeMm ? `ขนาดในใบราคา ${formatDimensions(row.sizeMm)} ต่างจากแค็ตตาล็อก กรุณายืนยันขนาดก่อนสั่งซื้อ` : '');
        this.host.querySelector('.package-unit-price')!.innerHTML = `<span>วัสดุ ${money(row.pricePerSqm)} + ติดตั้ง ${money(row.installPerSqm)}</span><strong>${money(row.pricePerSqm + row.installPerSqm)}<small> / ตร.ม.</small></strong>`;
        this.host.querySelector<HTMLButtonElement>('.package-spec-consult')!.dataset.contactContext = this.summary;
        this.onChange(this.product);
        this.updateModel();
    }
    dispose(): void { this.disposed = true; this.observer?.disconnect(); this.model?.dispose(); this.roomPreview?.dispose(); this.abort.abort(); }
}
