import { sitePath } from '../sitePath';
import { icon } from './shared';
import { money, NIGHT_WORK_PER_NIGHT, PACKAGES, PREP_OPTIONS, PRICE_LIST, PRICE_NOTES, SERIES, TRAVEL_FEE, type Series } from './catalog';
import { track } from './visualizer/analytics';

/**
 * #collections — every catalogue series as a card (swatch mosaic, size, price
 * per m²) with a family filter and an expandable shade strip.
 * #pricing     — a live estimate calculator fed by the 2026 price list, the full
 * price table and the 30 / 100 / 1,000 m² packages.
 */
const reduced = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const FAMILIES: { id: 'all' | Series['family']; label: string }[] = [
  { id: 'all', label: 'ทั้งหมด' }, { id: 'spc', label: 'SPC คลิกล็อก' }, { id: 'herringbone', label: 'ลายก้างปลา' }, { id: 'laminate', label: 'ลามิเนต' }, { id: 'lvt', label: 'LVT ทากาว' },
];

export interface CollectionsDiagnostics { filter: string; visible: number; expanded: string | null }

export class Collections {
  private readonly grid: HTMLElement;
  private readonly abort = new AbortController();
  private filter: 'all' | Series['family'] = 'all';
  private expanded: string | null = null;
  private disposed = false;

  constructor(private readonly section: HTMLElement) {
    this.grid = section.querySelector<HTMLElement>('.collections-grid')!;
    const filters = section.querySelector<HTMLElement>('.collections-filters')!;
    FAMILIES.forEach(family => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.family = family.id;
      button.textContent = family.label;
      button.setAttribute('aria-pressed', String(family.id === this.filter));
      button.addEventListener('click', () => this.setFilter(family.id), { signal: this.abort.signal });
      filters.append(button);
    });
    this.render();
    if (!reduced() && typeof IntersectionObserver !== 'undefined') {
      const observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) { section.classList.add('is-visible'); observer.disconnect(); }
      }, { threshold: .15 });
      observer.observe(section);
      this.abort.signal.addEventListener('abort', () => observer.disconnect());
    } else section.classList.add('is-visible');
  }

  get diagnostics(): CollectionsDiagnostics { return { filter: this.filter, visible: this.grid.childElementCount, expanded: this.expanded }; }

  setFilter(filter: 'all' | Series['family']): void {
    this.filter = filter;
    this.section.querySelectorAll<HTMLButtonElement>('[data-family]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.family === filter)));
    this.render();
    track({ name: 'visualizer_tool', tool: `collection-filter:${filter}` });
  }

  private render(): void {
    this.grid.replaceChildren();
    const list = SERIES.filter(series => this.filter === 'all' || series.family === this.filter);
    list.forEach((series, index) => {
      const card = document.createElement('article');
      card.className = 'collection-card';
      card.style.setProperty('--i', String(index));
      card.dataset.series = series.id;
      const swatches = series.swatches.length ? series.swatches : series.id === 'herringbone' ? ['../herringbone/kh5-682', '../herringbone/kh5-735', '../herringbone/kh5-651', '../herringbone/kh5-110'] : [];
      const mosaic = swatches.slice(0, 4).map((file, i) => `<img src="${sitePath(`/website/catalog/${file}.webp`)}" alt="" loading="lazy" decoding="async" style="--j:${i}" />`).join('');
      const total = series.pricePerSqm + series.installPerSqm;
      card.innerHTML = `
        <div class="collection-mosaic" aria-hidden="true">${mosaic}<span class="collection-count">${series.codes.length} เฉดสี</span></div>
        <div class="collection-body">
          <span class="collection-eyebrow">${series.name}</span>
          <h3>${series.nameTh}</h3>
          <dl class="collection-specs"><div><dt>ความหนา</dt><dd>${series.thicknessMm} มม.</dd></div><div><dt>ขนาดแผ่น</dt><dd>${series.sizeMm} มม.</dd></div><div><dt>ติดตั้ง</dt><dd>${series.install === 'click' ? 'คลิกล็อก' : 'ทากาว'}</dd></div></dl>
          <ul class="collection-highlights">${series.highlights.map(item => `<li>${item}</li>`).join('')}</ul>
          <div class="collection-price"><strong>${money(series.pricePerSqm)}<small>/ตร.ม.</small></strong><span>+ ค่าติดตั้ง ${money(series.installPerSqm)} = <b>${money(total)}/ตร.ม.</b></span></div>
          <div class="collection-actions"><button type="button" class="collection-expand" aria-expanded="false">ดูเฉดสีทั้งหมด ${icon('arrow')}</button><button type="button" class="collection-estimate">คำนวณราคา</button></div>
          <div class="collection-shades" hidden><div class="collection-shade-strip">${series.codes.map((code, i) => {
            const file = series.swatches[i] ? `/website/catalog/${series.swatches[i]}.webp` : series.id === 'herringbone' ? `/website/herringbone/${code.toLowerCase().replace('cpw-', '')}.webp` : null;
            return `<figure>${file ? `<img src="${sitePath(file)}" alt="${code}" loading="lazy" decoding="async" />` : '<span class="collection-shade-empty">ดูในแค็ตตาล็อก</span>'}<figcaption>${code}</figcaption></figure>`;
          }).join('')}</div>${series.note ? `<p class="collection-note">${series.note}</p>` : ''}</div>`;
      card.querySelector('.collection-expand')!.addEventListener('click', () => this.toggle(series.id), { signal: this.abort.signal });
      card.querySelector('.collection-estimate')!.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('coolplan:estimate', { detail: { seriesId: series.id } }));
        document.getElementById('pricing')?.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
      }, { signal: this.abort.signal });
      this.grid.append(card);
    });
    if (this.expanded && !list.some(series => series.id === this.expanded)) this.expanded = null;
    if (this.expanded) this.toggle(this.expanded, true);
  }

  private toggle(id: string, force?: boolean): void {
    const card = this.grid.querySelector<HTMLElement>(`[data-series="${id}"]`);
    if (!card) return;
    const open = force ?? this.expanded !== id;
    this.grid.querySelectorAll<HTMLElement>('.collection-card').forEach(other => {
      const isTarget = other === card;
      const shades = other.querySelector<HTMLElement>('.collection-shades')!;
      const button = other.querySelector<HTMLButtonElement>('.collection-expand')!;
      const show = isTarget && open;
      shades.hidden = !show;
      other.classList.toggle('is-expanded', show);
      button.setAttribute('aria-expanded', String(show));
      button.innerHTML = `${show ? 'ซ่อนเฉดสี' : 'ดูเฉดสีทั้งหมด'} ${icon('arrow')}`;
    });
    this.expanded = open ? id : null;
    if (open) track({ name: 'visualizer_tool', tool: `collection-open:${id}` });
  }

  dispose(): void { if (!this.disposed) { this.disposed = true; this.abort.abort(); } }
}

export interface PricingDiagnostics { sqm: number; rowIndex: number; total: number; perSqm: number }

export class Pricing {
  private readonly form: HTMLFormElement;
  private readonly abort = new AbortController();
  private result: PricingDiagnostics = { sqm: 0, rowIndex: 0, total: 0, perSqm: 0 };
  private disposed = false;

  constructor(private readonly section: HTMLElement) {
    this.form = section.querySelector<HTMLFormElement>('#estimate-form')!;
    this.buildCalculator();
    this.buildTable();
    this.buildPackages();
    document.addEventListener('coolplan:estimate', this.onEstimateRequest as EventListener, { signal: this.abort.signal });
    if (!reduced() && typeof IntersectionObserver !== 'undefined') {
      const observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) { section.classList.add('is-visible'); observer.disconnect(); }
      }, { threshold: .1 });
      observer.observe(section);
      this.abort.signal.addEventListener('abort', () => observer.disconnect());
    } else section.classList.add('is-visible');
  }

  get diagnostics(): PricingDiagnostics { return { ...this.result }; }

  private onEstimateRequest = (event: CustomEvent<{ seriesId: string }>): void => {
    const index = PRICE_LIST.findIndex(row => row.seriesId === event.detail.seriesId);
    const select = this.form.querySelector<HTMLSelectElement>('#estimate-product');
    if (select && index >= 0) { select.value = String(index); this.compute(); }
  };

  private buildCalculator(): void {
    const select = this.form.querySelector<HTMLSelectElement>('#estimate-product')!;
    PRICE_LIST.forEach((row, index) => {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = `${row.item}${row.sizeMm ? ` (${row.sizeMm} มม.)` : ''} · ${money(row.pricePerSqm)} + ติดตั้ง ${money(row.installPerSqm)}`;
      select.append(option);
    });
    const prep = this.form.querySelector<HTMLElement>('#estimate-prep')!;
    PREP_OPTIONS.forEach(option => {
      const label = document.createElement('label');
      label.innerHTML = `<input type="checkbox" name="prep" value="${option.id}" /> <span>${option.label} <small>+${money(option.perSqm)}/ตร.ม.</small></span>`;
      prep.append(label);
    });
    this.form.addEventListener('input', () => this.compute(), { signal: this.abort.signal });
    this.form.addEventListener('submit', event => { event.preventDefault(); this.compute(); }, { signal: this.abort.signal });
    this.form.querySelectorAll<HTMLButtonElement>('[data-sqm]').forEach(button => button.addEventListener('click', () => {
      const input = this.form.querySelector<HTMLInputElement>('#estimate-sqm')!;
      input.value = button.dataset.sqm!;
      this.compute();
    }, { signal: this.abort.signal }));
    this.compute();
  }

  private compute(): void {
    const sqmInput = this.form.querySelector<HTMLInputElement>('#estimate-sqm')!;
    const sqm = Math.max(0, Math.min(100000, Number(sqmInput.value) || 0));
    const rowIndex = Number(this.form.querySelector<HTMLSelectElement>('#estimate-product')!.value) || 0;
    const row = PRICE_LIST[rowIndex];
    const night = this.form.querySelector<HTMLInputElement>('#estimate-night')?.checked ?? false;
    const prepIds = [...this.form.querySelectorAll<HTMLInputElement>('input[name="prep"]:checked')].map(input => input.value);
    const material = sqm * row.pricePerSqm;
    const install = sqm * row.installPerSqm;
    const prep = prepIds.reduce((sum, id) => sum + sqm * (PREP_OPTIONS.find(option => option.id === id)?.perSqm ?? 0), 0);
    const travel = sqm > 0 && sqm < TRAVEL_FEE.belowSqm ? TRAVEL_FEE.amount : 0;
    const nights = night ? Math.max(1, Math.ceil(sqm / 100)) : 0;
    const nightFee = nights * NIGHT_WORK_PER_NIGHT;
    const total = material + install + prep + travel + nightFee;
    const set = (id: string, value: string): void => { const node = this.section.querySelector<HTMLElement>(`#${id}`); if (node) node.textContent = value; };
    set('estimate-material', money(material));
    set('estimate-install', money(install));
    set('estimate-prep-cost', money(prep));
    set('estimate-travel', travel ? money(travel) : '—');
    set('estimate-night-cost', nightFee ? `${money(nightFee)} (${nights} คืน)` : '—');
    set('estimate-total', money(total));
    set('estimate-per-sqm', sqm ? `${money(total / sqm)}/ตร.ม.` : '—');
    set('estimate-summary', sqm ? `${row.item} · ${sqm.toLocaleString('th-TH')} ตร.ม.` : 'ใส่พื้นที่เพื่อคำนวณ');
    const travelNote = this.section.querySelector<HTMLElement>('#estimate-travel-note');
    if (travelNote) travelNote.hidden = !travel;
    this.result = { sqm, rowIndex, total, perSqm: sqm ? total / sqm : 0 };
    const badge = this.section.querySelector<HTMLElement>('.estimate-total');
    if (badge && !reduced()) { badge.classList.remove('is-bump'); void badge.offsetWidth; badge.classList.add('is-bump'); }
  }

  private buildTable(): void {
    const body = this.section.querySelector<HTMLElement>('#price-table tbody')!;
    let lastGroup = '';
    PRICE_LIST.forEach(row => {
      if (row.group !== lastGroup) {
        const groupRow = document.createElement('tr');
        groupRow.className = 'price-group';
        groupRow.innerHTML = `<th colspan="5" scope="colgroup">${row.group}</th>`;
        body.append(groupRow);
        lastGroup = row.group;
      }
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${row.item}</td><td>${row.sizeMm || '—'}</td><td>${money(row.pricePerSqm)}</td><td>${money(row.installPerSqm)}</td><td><strong>${money(row.pricePerSqm + row.installPerSqm)}</strong></td>`;
      body.append(tr);
    });
    const notes = this.section.querySelector<HTMLElement>('#price-notes')!;
    notes.innerHTML = [...PREP_OPTIONS.map(option => `ค่าปรับพื้น ${option.label} ${money(option.perSqm)}/ตร.ม.`), ...PRICE_NOTES].map(note => `<li>${note}</li>`).join('');
  }

  private buildPackages(): void {
    const host = this.section.querySelector<HTMLElement>('#packages')!;
    host.innerHTML = `<table class="packages-table"><thead><tr><th scope="col">แพ็กเกจ</th>${PACKAGES.map(pkg => `<th scope="col"><span class="packages-title">${pkg.title}</span><span class="packages-subtitle">${pkg.subtitle}</span></th>`).join('')}</tr></thead><tbody>
      <tr><th scope="row">รายละเอียด</th>${PACKAGES.map(pkg => `<td class="packages-description">${pkg.description}</td>`).join('')}</tr>
      <tr><th scope="row">ราคาต่อ ตร.ม. (รวมติดตั้ง)</th>${PACKAGES.map(pkg => `<td><strong>${money(pkg.perSqm)}</strong></td>`).join('')}</tr>
      <tr><th scope="row">ระยะเวลาในการทำงาน</th>${PACKAGES.map(pkg => `<td>${pkg.days}</td>`).join('')}</tr>
      <tr><th scope="row">รับประกันการติดตั้ง 10 ปี</th>${PACKAGES.map(() => `<td><i class="packages-check" aria-label="รวมอยู่ในแพ็กเกจ"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></i></td>`).join('')}</tr>
      <tr class="packages-price"><th scope="row">ราคา</th>${PACKAGES.map(pkg => `<td><strong>${money(pkg.total)}</strong></td>`).join('')}</tr>
      <tr><th scope="row"></th>${PACKAGES.map(pkg => `<td><button type="button" class="primary-button packages-cta" data-package="${pkg.id}" data-contact-open>เลือกแพ็กเกจนี้</button></td>`).join('')}</tr>
    </tbody></table>`;
    host.querySelectorAll<HTMLButtonElement>('[data-package]').forEach(button => button.addEventListener('click', () => track({ name: 'visualizer_quote', product: `package:${button.dataset.package}` }), { signal: this.abort.signal }));
  }

  dispose(): void { if (!this.disposed) { this.disposed = true; this.abort.abort(); } }
}

export function mountCollections(section: HTMLElement | null): Collections | null { return section ? new Collections(section) : null; }
export function mountPricing(section: HTMLElement | null): Pricing | null { return section ? new Pricing(section) : null; }
