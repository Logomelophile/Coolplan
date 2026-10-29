import { icon } from './shared';
import { money, NIGHT_WORK_PER_NIGHT, PACKAGES, PREP_OPTIONS, PRICE_LIST, TRAVEL_FEE } from './catalog';
import { track } from './visualizer/analytics';
import { PackageSpecs, type PackageSpecDiagnostics } from './packageSpecs';
import { catalogueFinishes, filterFloors, FLOOR_SELECTIONS, selectionImage, sizeLabel, formatDimensions, type CatalogueFilter } from './floorSelections';
const reduced = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches;
const FAMILIES = [{ id: 'all', label: 'ทั้งหมด' }, { id: 'spc', label: 'SPC' }, { id: 'herringbone', label: 'ลายก้างปลา' }, { id: 'laminate', label: 'Laminate' }, { id: 'lvt', label: 'LVT' }, { id: 'glue', label: 'ทากาว' }];
export interface CollectionsDiagnostics {
    filter: string;
    filters: CatalogueFilter;
    visible: number;
    expanded: string | null;
}
export class Collections {
    private readonly grid: HTMLElement;
    private readonly abort = new AbortController();
    private filters: CatalogueFilter = { families: [], thickness: null, size: '', glue: false };
    private expanded: string | null = null;
    constructor(private readonly section: HTMLElement) {
        this.grid = section.querySelector('.collections-grid')!;
        const host = section.querySelector<HTMLElement>('.collections-filters')!;
        host.innerHTML = `${FAMILIES.map(f => `<button type="button" data-family="${f.id}" aria-pressed="${f.id === 'all'}">${f.label}</button>`).join('')}<label>ความหนา<select id="collection-thickness"><option value="">ทุกความหนา</option>${[...new Set(FLOOR_SELECTIONS.map(s => s.thicknessMm))].sort((a, b) => a - b).map(n => `<option value="${n}">${n} มม.</option>`).join('')}</select></label><label>ขนาดแผ่น<select id="collection-size"><option value="">ทุกขนาด</option>${[...new Set(FLOOR_SELECTIONS.map(s => s.sizeMm).filter(Boolean))].map(size => `<option>${size}</option>`).join('')}</select></label>`;
        host.addEventListener('click', event => { const button = (event.target as Element).closest<HTMLButtonElement>('[data-family]'); if (button)
            this.setFilter(button.dataset.family!); }, { signal: this.abort.signal });
        host.addEventListener('change', () => { this.filters.thickness = Number(host.querySelector<HTMLSelectElement>('#collection-thickness')!.value) || null; this.filters.size = host.querySelector<HTMLSelectElement>('#collection-size')!.value; this.render(); }, { signal: this.abort.signal });
        section.classList.add('is-visible');
        this.render();
    }
    get diagnostics(): CollectionsDiagnostics { return { filter: this.filters.families.join(',') || 'all', filters: { ...this.filters, families: [...this.filters.families] }, visible: this.grid.querySelectorAll('.collection-card').length, expanded: this.expanded }; }
    setFilter(id: string): void {
        if (id === 'all') {
            this.filters = { families: [], thickness: null, size: '', glue: false };
            this.section.querySelectorAll<HTMLSelectElement>('.collections-filters select').forEach(s => s.value = '');
        }
        else if (id === 'glue')
            this.filters.glue = !this.filters.glue;
        else
            this.filters.families = this.filters.families.includes(id) ? this.filters.families.filter(f => f !== id) : [...this.filters.families, id];
        this.render();
        track({ name: 'visualizer_tool', tool: `collection-filter:${id}` });
    }
    private render(): void {
        const list = filterFloors(this.filters), all = !this.filters.families.length && !this.filters.glue && !this.filters.thickness && !this.filters.size;
        this.section.querySelectorAll<HTMLButtonElement>('[data-family]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.family === 'all' ? all : b.dataset.family === 'glue' ? this.filters.glue : this.filters.families.includes(b.dataset.family!))));
        this.grid.replaceChildren();
        const status = this.section.querySelector<HTMLElement>('.collections-results');
        if (status)
            status.textContent = `${list.length} รุ่น · ค่าวัสดุและค่าติดตั้งต่อ 1 ตร.ม.`;
        if (!list.length) {
            this.grid.innerHTML = '<div class="collection-empty"><h3>ไม่พบรุ่นที่ตรงทุกเงื่อนไข</h3><p>ลองลดเงื่อนไข หรือกด “ทั้งหมด” เพื่อเลือกใหม่</p><button type="button">ดูทั้งหมด</button></div>';
            this.grid.querySelector('button')!.addEventListener('click', () => this.setFilter('all'), { signal: this.abort.signal });
            return;
        }
        list.forEach((option, index) => {
            const { series, reference } = option, row = PRICE_LIST[option.priceIndex], finishes = series ? catalogueFinishes(series) : [];
            const card = document.createElement('article');
            card.className = 'collection-card';
            card.dataset.series = option.id;
            card.style.setProperty('--i', String(index));
            card.innerHTML = `<div class="collection-mosaic"><img src="${selectionImage(option)}" alt="${series ? option.name : `ภาพตัวอย่างตระกูล ${reference.nameTh}`}" loading="lazy" decoding="async"/><span class="collection-count">${series ? `${series.codes.length} เฉดสี` : 'ภาพตัวอย่างตระกูลสินค้า'}</span></div><div class="collection-body"><span class="collection-eyebrow">${option.family.toUpperCase()} / ${option.thicknessMm} MM</span><h3>${option.name}</h3><dl class="collection-specs"><div><dt>ความหนา</dt><dd>${option.thicknessMm} มม.</dd></div><div><dt>ขนาดแผ่น</dt><dd>${sizeLabel(option)}</dd></div><div><dt>ติดตั้ง</dt><dd>${option.install === 'glue' ? 'ทากาว' : 'คลิกล็อก'}</dd></div></dl><ul class="collection-highlights">${(series?.highlights ?? ['มีราคาในใบราคา 2026', 'ให้ทีมงานยืนยันรุ่น ขนาด และเฉดสีก่อนสั่งซื้อ']).map(t => `<li>${t}</li>`).join('')}</ul><div class="collection-price"><strong>${money(row.pricePerSqm + row.installPerSqm)}<small>/ตร.ม. รวมติดตั้ง</small></strong><span>วัสดุ ${money(row.pricePerSqm)} + ติดตั้ง ${money(row.installPerSqm)}</span></div><div class="collection-actions"><button type="button" class="collection-expand" aria-expanded="false">${finishes.length ? 'ดูเฉดสีทั้งหมด' : 'ดูรายละเอียดรุ่น'} ${icon('arrow')}</button><button type="button" class="collection-estimate">เลือกและคำนวณ</button></div><div class="collection-shades" hidden><div class="collection-shade-strip">${finishes.map(f => `<figure>${f.image ? `<img src="${f.image}" alt="${f.code}" loading="lazy" decoding="async"/>` : '<span class="collection-shade-empty">สอบถามภาพเฉดสี</span>'}<figcaption>${f.code}</figcaption></figure>`).join('')}</div><p class="collection-note">${series?.note ?? (!series ? 'ภาพใช้แสดงตระกูลสินค้า รุ่นนี้มีราคาในใบราคา 2026 กรุณายืนยันสีและขนาดกับทีมงาน' : 'ราคาตามใบราคา 2026 ยืนยันรุ่นและขนาดก่อนสั่งซื้อ')}</p>${series && row.sizeMm && row.sizeMm !== series.sizeMm ? `<p class="collection-note">แค็ตตาล็อก: ${series.sizeMm} มม. · ใบราคา: ${formatDimensions(row.sizeMm)} ให้ทีมงานยืนยันขนาดตามรุ่น</p>` : ''}</div></div>`;
            card.querySelector('.collection-expand')!.addEventListener('click', () => this.toggle(option.id), { signal: this.abort.signal });
            card.querySelector('.collection-estimate')!.addEventListener('click', () => { document.dispatchEvent(new CustomEvent('coolplan:estimate', { detail: { seriesId: option.id, productId: option.id } })); document.getElementById('package-specs')?.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }); }, { signal: this.abort.signal });
            this.grid.append(card);
        });
        if (this.expanded && list.some(o => o.id === this.expanded))
            this.toggle(this.expanded, true);
        else
            this.expanded = null;
    }
    private toggle(id: string, force?: boolean): void { const open = force ?? this.expanded !== id; this.grid.querySelectorAll<HTMLElement>('.collection-card').forEach(card => { const show = card.dataset.series === id && open; card.classList.toggle('is-expanded', show); card.querySelector<HTMLElement>('.collection-shades')!.hidden = !show; card.querySelector('button')!.setAttribute('aria-expanded', String(show)); }); this.expanded = open ? id : null; }
    dispose(): void { this.abort.abort(); }
}
export interface PricingDiagnostics {
    sqm: number;
    rowIndex: number;
    total: number;
    perSqm: number;
    spec?: PackageSpecDiagnostics;
}
export class Pricing {
    private readonly abort = new AbortController();
    private readonly form: HTMLFormElement;
    private specs: PackageSpecs | null = null;
    private result: PricingDiagnostics = { sqm: 0, rowIndex: 1, total: 0, perSqm: 0 };
    constructor(private readonly section: HTMLElement) {
        this.form = section.querySelector('#estimate-form')!;
        const select = this.form.querySelector<HTMLSelectElement>('#estimate-product')!;
        PRICE_LIST.forEach((row, index) => { const o = document.createElement('option'); o.value = String(index); o.textContent = `${row.item} · ${money(row.pricePerSqm)} + ${money(row.installPerSqm)}`; select.append(o); });
        select.value = '1';
        this.form.querySelector('#estimate-prep')!.innerHTML = PREP_OPTIONS.map(o => `<label><input type="checkbox" name="prep" value="${o.id}"/><span>${o.label} <small>+${money(o.perSqm)}/ตร.ม.</small></span></label>`).join('');
        this.form.addEventListener('input', () => this.compute(), { signal: this.abort.signal });
        select.addEventListener('change', () => this.specs?.selectPrice(Number(select.value)), { signal: this.abort.signal });
        this.form.addEventListener('submit', e => { e.preventDefault(); this.compute(); }, { signal: this.abort.signal });
        this.form.querySelectorAll<HTMLButtonElement>('[data-sqm]').forEach(b => b.addEventListener('click', () => { this.form.querySelector<HTMLInputElement>('#estimate-sqm')!.value = b.dataset.sqm!; this.compute(); }, { signal: this.abort.signal }));
        const oldCalculator = section.querySelector('#estimate-calculator')!;
        this.specs = new PackageSpecs(section.querySelector('#package-specs')!, option => { select.value = String(option.priceIndex); this.compute(); });
        section.querySelector('.package-estimate-slot')!.append(this.form);
        oldCalculator.remove();
        section.querySelector('.package-estimate-slot')!.id = 'estimate-calculator';
        this.form.querySelector('label[for="estimate-product"]')!.classList.add('estimate-product-source');
        this.buildPackages();
        document.addEventListener('coolplan:estimate', this.onEstimateRequest as EventListener, { signal: this.abort.signal });
        this.compute();
        section.classList.add('is-visible');
    }
    get diagnostics(): PricingDiagnostics { return { ...this.result, spec: this.specs?.diagnostics }; }
    private onEstimateRequest = (event: CustomEvent<{
        seriesId?: string;
        productId?: string;
    }>): void => { this.specs?.selectProduct(event.detail.productId ?? event.detail.seriesId ?? 'spc-5-180'); };
    private compute(): void {
        const sqm = Math.max(0, Math.min(100000, Number(this.form.querySelector<HTMLInputElement>('#estimate-sqm')!.value) || 0)), rowIndex = Number(this.form.querySelector<HTMLSelectElement>('#estimate-product')!.value) || 0, row = PRICE_LIST[rowIndex];
        const ids = [...this.form.querySelectorAll<HTMLInputElement>('input[name="prep"]:checked')].map(i => i.value), material = sqm * row.pricePerSqm, install = sqm * row.installPerSqm, prep = ids.reduce((s, id) => s + sqm * (PREP_OPTIONS.find(o => o.id === id)?.perSqm ?? 0), 0), travel = sqm > 0 && sqm < TRAVEL_FEE.belowSqm ? TRAVEL_FEE.amount : 0;
        const nights = this.form.querySelector<HTMLInputElement>('#estimate-night')!.checked ? Math.ceil(sqm / 100) : 0, nightFee = nights * NIGHT_WORK_PER_NIGHT, total = material + install + prep + travel + nightFee;
        const set = (id: string, value: string) => { this.form.querySelector(`#${id}`)!.textContent = value; };
        set('estimate-material', money(material));
        set('estimate-install', money(install));
        set('estimate-prep-cost', money(prep));
        set('estimate-travel', travel ? money(travel) : '—');
        set('estimate-night-cost', nightFee ? `${money(nightFee)} (${nights} คืน)` : '—');
        set('estimate-total', money(total));
        set('estimate-per-sqm', sqm ? `${money(total / sqm)}/ตร.ม.` : '—');
        set('estimate-summary', `${row.item} · ${sqm.toLocaleString('th-TH')} ตร.ม.`);
        this.form.querySelector<HTMLElement>('#estimate-travel-note')!.hidden = !travel;
        this.result = { sqm, rowIndex, total, perSqm: sqm ? total / sqm : 0 };
        this.form.querySelector<HTMLButtonElement>('[data-contact-open]')!.dataset.contactContext = `${this.specs?.summary ?? row.item} · ${sqm} ตร.ม. · ประเมิน ${money(total)} · ยืนยันสเปคและราคาหลังสำรวจหน้างาน`;
    }
    private buildPackages(): void {
        const host = this.section.querySelector('#packages')!;
        host.innerHTML = `<table class="packages-table"><caption>แพ็กเกจพื้น SPC ลายไม้ รวมค่าติดตั้ง</caption><thead><tr><th scope="col">แพ็กเกจ</th>${PACKAGES.map(p => `<th scope="col"><span class="packages-title">${p.title}</span><span class="packages-subtitle">${p.subtitle}</span></th>`).join('')}</tr></thead><tbody><tr><th scope="row">รายละเอียด</th>${PACKAGES.map(p => `<td class="packages-description">${p.description}</td>`).join('')}</tr><tr><th scope="row">ราคาต่อ ตร.ม. รวมติดตั้ง</th>${PACKAGES.map(p => `<td><strong>${money(p.perSqm)}</strong></td>`).join('')}</tr><tr><th scope="row">ระยะเวลาในการทำงาน</th>${PACKAGES.map(p => `<td>${p.days}</td>`).join('')}</tr><tr><th scope="row">รับประกันการติดตั้ง 10 ปี</th>${PACKAGES.map(() => '<td><i class="packages-check" aria-label="รวมอยู่ในแพ็กเกจ">✓</i></td>').join('')}</tr><tr class="packages-price"><th scope="row">ราคา</th>${PACKAGES.map(p => `<td><strong>${money(p.total)}</strong></td>`).join('')}</tr><tr><th></th>${PACKAGES.map(p => `<td><button type="button" class="primary-button packages-cta" data-package="${p.id}" data-contact-open>เลือกแพ็กเกจนี้</button></td>`).join('')}</tr></tbody></table>`;
        host.querySelectorAll<HTMLButtonElement>('[data-package]').forEach(b => b.addEventListener('click', () => { const p = PACKAGES.find(p => p.id === b.dataset.package)!; b.dataset.contactContext = `แพ็กเกจ ${p.title} · ${this.specs?.summary ?? 'SPC ลายไม้'} · ให้ทีมงานยืนยันสเปคและราคาแพ็กเกจ`; }, { signal: this.abort.signal }));
    }
    dispose(): void { this.specs?.dispose(); this.abort.abort(); }
}
export const mountCollections = (s: HTMLElement | null): Collections | null => s ? new Collections(s) : null;
export const mountPricing = (s: HTMLElement | null): Pricing | null => s ? new Pricing(s) : null;
