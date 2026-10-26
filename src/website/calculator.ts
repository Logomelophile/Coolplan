import './shared.css';
import './calculator.css';
import { mountContactDialog, mountHeader, mountFooter } from './shared';

type GradeId = 'premium' | 'merit';
interface Estimate { grade: GradeId; area: number; installRate: number; material: number; installation: number; total: number }
interface Customer { name: string; phone: string; email: string; location: string; note: string }

const grades = {
  premium: { name: 'SPC Premium Grade', rate: 690, description: 'พื้น SPC คุณภาพพรีเมียม<br>สวย ทนทาน เหมาะสำหรับทุกพื้นที่' },
  merit: { name: 'Cost Merit Grade', rate: 490, description: 'พื้น SPC คุ้มค่า คุ้มราคา<br>ตอบโจทย์การใช้งานทั่วไป' },
} as const;
const number = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 });
const money = (value: number) => number.format(Math.round((value + Number.EPSILON) * 100) / 100);
const arrow = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>';
const chat = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H5l-3 2 1.3-5.1A8.5 8.5 0 1 1 21 11.5Z"/><path d="M7 11h1m3.5 0h1m3.5 0h1" stroke-linecap="round" stroke-width="2"/></svg>';
const app = document.querySelector<HTMLElement>('main.calculator-app');
if (!app) throw new Error('Calculator mount element is missing.');
document.body.classList.add('calculator-page');

app.innerHTML = `
  <section class="calc-hero" aria-labelledby="calculator-title">
    <div class="calc-hero-copy">
      <p>YOUR SPACE A BETTER TOMORROW</p>
      <h1 id="calculator-title">คำนวณราคา</h1>
      <p>เลือกประเภทพื้น กรอกขนาดพื้นที่ และดูราคาประมาณการได้ทันที</p>
    </div>
  </section>
  <div class="calc-shell">
    <div class="calc-form-card">
      <section class="calc-step" aria-labelledby="grade-heading">
        <div class="calc-step-heading"><span class="calc-step-number" aria-hidden="true">1</span><div><h2 id="grade-heading">เลือกหมวดสินค้า</h2><p>เลือกประเภทพื้นที่ต้องการ เพื่อดูราคาต่อหน่วย</p></div></div>
        <div class="calc-grades" role="group" aria-label="ประเภทพื้น">
          ${(['premium', 'merit'] as const).map(id => `<button class="calc-grade ${id === 'premium' ? 'is-selected' : ''}" type="button" data-grade="${id}" aria-pressed="${id === 'premium'}">
            <span class="calc-grade-check" aria-hidden="true">✓</span><span class="calc-grade-photo calc-grade-photo--${id}" aria-hidden="true"></span>
            <strong>${grades[id].name}</strong><span class="calc-grade-description">${grades[id].description}</span>
            <span class="calc-unit-price"><b>${grades[id].rate}</b> บาท / ตร.ม.</span>
          </button>`).join('')}
        </div>
      </section>
      <section class="calc-step" aria-labelledby="area-heading">
        <div class="calc-step-heading"><span class="calc-step-number" aria-hidden="true">2</span><div><h2 id="area-heading">กรอกขนาดพื้นที่</h2><p>ระบุขนาดพื้นที่ที่ต้องการปูพื้น</p></div></div>
        <label class="calc-area-label" for="floor-area">จำนวนพื้นที่ (ตร.ม.)</label>
        <div class="calc-number-wrap"><input id="floor-area" type="number" inputmode="decimal" min="0.1" max="100000" step="0.01" value="35" required aria-describedby="area-error"><span aria-hidden="true">ตร.ม.</span></div>
        <p id="area-error" class="calc-error" role="alert"></p>
      </section>
      <section class="calc-step" aria-labelledby="summary-heading">
        <div class="calc-step-heading"><span class="calc-step-number" aria-hidden="true">3</span><div><h2 id="summary-heading">สรุปราคา</h2><p>ตรวจสอบรายละเอียดและราคาประมาณการ</p></div></div>
        <div class="calc-tabs" role="tablist" aria-label="เปรียบเทียบเกรดพื้น">
          <button class="calc-tab" id="tab-premium" type="button" role="tab" data-grade-tab="premium" aria-selected="true" aria-controls="estimate-panel" tabindex="0">SPC Premium Grade</button>
          <button class="calc-tab" id="tab-merit" type="button" role="tab" data-grade-tab="merit" aria-selected="false" aria-controls="estimate-panel" tabindex="-1">Cost Merit Grade</button>
        </div>
        <div class="calc-summary" id="estimate-panel" role="tabpanel" aria-labelledby="tab-premium" tabindex="0">
          <h3>สรุปราคา <span id="summary-grade">(SPC Premium Grade)</span></h3>
          <div class="calc-summary-row"><span>ค่าวัสดุ</span><span class="calc-equation" id="material-equation">35 × 690 =</span><span class="calc-value"><strong id="material-total">24,150</strong> บาท</span></div>
          <div class="calc-summary-row"><span>ค่าติดตั้ง</span><span class="calc-equation" id="installation-equation">35 × 100 =</span><span class="calc-value"><strong id="installation-total">3,500</strong> บาท</span></div>
          <div class="calc-total"><strong>รวมประมาณ</strong><output class="calc-total-price" id="grand-total" for="floor-area install-rate" aria-live="polite"><b>27,650</b> บาท</output></div>
        </div>
      </section>
    </div>
    <aside class="calc-aside" aria-label="รายละเอียดเพิ่มเติมและขอใบเสนอราคา">
      <figure class="calc-lifestyle-photo" role="img" aria-label="ห้องรับประทานอาหารโทนธรรมชาติ — มากกว่าพื้น คือพื้นฐานของทุกช่วงเวลาในบ้านคุณ"></figure>
      <section class="calc-install" aria-labelledby="install-heading">
        <div class="calc-install-icon" aria-hidden="true">⚙</div>
        <div><h3 id="install-heading">ค่าติดตั้ง</h3><div class="calc-install-price"><input id="install-rate" class="calc-install-rate" type="number" inputmode="decimal" min="0" max="10000" step="0.01" value="100" required aria-label="ค่าติดตั้งต่อหนึ่งตารางเมตร" aria-describedby="install-error" title="ปรับค่าติดตั้งต่อตารางเมตร"> บาท / ตร.ม.</div><p>ติดตั้งโดยทีมช่างมืออาชีพ<br>มาตรฐานเดียวกันทั่วประเทศ</p><p id="install-error" class="calc-error" role="alert"></p></div>
      </section>
      <section class="calc-swatches" aria-labelledby="swatches-heading">
        <div class="calc-swatches-heading"><h3 id="swatches-heading">ตัวอย่างลายพื้น SPC</h3><a href="/website/#products">ดูสินค้าทั้งหมด →</a></div>
        <div class="calc-swatch-list">
          ${[
            ['OAK NATURAL', 620], ['LIGHT BEIGE', 690], ['WARM WOOD', 760], ['SMOKE GREY', 831], ['CLASSIC BROWN', 901],
          ].map(([label, x]) => `<a class="calc-swatch" href="/room/" aria-label="ชมตัวอย่างพื้น ${label} ในห้อง"><span class="calc-swatch-photo" style="--swatch-x:${Number(x) / (1024 - 63) * 100}%" aria-hidden="true"></span><span>${label}</span></a>`).join('')}
        </div>
      </section>
      <div class="calc-note"><span class="calc-note-icon" aria-hidden="true">i</span><p>* ราคานี้เป็นราคาโดยประมาณ<br>* สามารถติดต่อเพื่อขอใบเสนอราคาจริงได้</p></div>
      <button class="calc-action calc-action--primary" type="button" id="request-estimate">ขอใบเสนอราคา ${arrow}</button>
      <button class="calc-action calc-action--secondary" type="button" data-contact-open>${chat} ปรึกษาผู้เชี่ยวชาญ</button>
    </aside>
  </div>
  <section class="calc-benefits" aria-label="บริการจาก COOLPLAN">
    <div class="calc-benefit"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="m4 13 7-8h18l7 8-16 22Z M4 13h32M11 5l9 30L29 5M11 13l9-8 9 8"/></svg><p>วัสดุคุณภาพระดับพรีเมียม<span>ทนทาน ใช้งานได้ยาวนาน</span></p></div>
    <div class="calc-benefit"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M7 34C7 14 15 9 33 5c-2 18-6 27-21 26M6 35 28 13"/></svg><p>ดีไซน์สวย เหมาะกับทุกสไตล์<span>ตอบโจทย์ทุกพื้นที่</span></p></div>
    <div class="calc-benefit"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="m20 3 14 6v11c-1 8-7 13-14 17C13 33 7 28 6 20V9ZM13 19l5 5 10-12"/></svg><p>ติดตั้งโดยทีมมืออาชีพ<span>มั่นใจในมาตรฐาน</span></p></div>
    <div class="calc-benefit"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="m3 18 17-15 17 15M7 16v20h10V23h7v13h10V16"/></svg><p>ดูแลหลังการขาย<span>พร้อมให้คำปรึกษาเสมอ</span></p></div>
  </section>
  <footer class="calc-photo-footer" aria-label="COOLPLAN — พื้นที่ที่ใช่ สร้างชีวิตที่ดีกว่าได้ในทุกวัน"><span class="calc-sr-only">COOLPLAN · Flooring for a better tomorrow</span></footer>
  <dialog class="calc-quote-dialog" id="quote-dialog" aria-labelledby="quote-dialog-title">
    <div class="calc-dialog-header"><div><h2 id="quote-dialog-title">เตรียมใบเสนอราคา</h2><p>เพิ่มข้อมูลติดต่อ แล้วบันทึกหรือส่งรายละเอียดให้ทีมงาน</p></div><button class="calc-dialog-close" type="button" aria-label="ปิดใบเสนอราคา">×</button></div>
    <form class="calc-quote-form" id="quote-form">
      <div class="calc-customer-grid">
        <label>ชื่อผู้ติดต่อ *<input name="customerName" autocomplete="name" required maxlength="120" placeholder="ชื่อ–นามสกุล"></label>
        <label>เบอร์โทรศัพท์ *<input name="customerPhone" autocomplete="tel" type="tel" required maxlength="20" placeholder="08x xxx xxxx"></label>
        <label class="calc-field-wide">อีเมล<input name="customerEmail" autocomplete="email" type="email" maxlength="160" placeholder="name@example.com"></label>
        <label class="calc-field-wide">สถานที่ติดตั้ง<input name="customerLocation" autocomplete="street-address" maxlength="240" placeholder="โครงการ / เขต / จังหวัด"></label>
        <label class="calc-field-wide">รายละเอียดเพิ่มเติม<textarea name="customerNote" maxlength="1500" placeholder="เช่น กำหนดการติดตั้งหรือรายละเอียดพื้นที่"></textarea></label>
      </div>
      <div class="calc-dialog-estimate"><div><span id="quote-grade">SPC Premium Grade</span><span id="quote-area">35 ตร.ม. พร้อมค่าติดตั้ง</span></div><strong id="quote-total">27,650 บาท</strong></div>
      <div class="calc-dialog-actions"><button class="calc-action calc-action--secondary" type="button" id="quote-print">พิมพ์ / บันทึก PDF</button><button class="calc-action calc-action--secondary" type="button" id="quote-download">ดาวน์โหลดใบประมาณราคา</button><button class="calc-action calc-action--primary calc-email-action" type="submit">เตรียมอีเมลขอใบเสนอราคา ${arrow}</button></div>
      <p class="calc-dialog-status" id="quote-status" role="status">อีเมลจะเปิดเป็นฉบับร่างในแอปอีเมลของคุณ และยังไม่ส่งอัตโนมัติ</p>
      <p class="calc-direct-contact">ติดต่อคุณคะน้า <a href="tel:0846707551">084 670 7551</a><br><a href="mailto:coolplanworkshop@gmail.com">coolplanworkshop@gmail.com</a><br>ราคานี้เป็นราคาโดยประมาณ กรุณาติดต่อเพื่อขอใบเสนอราคาจริง</p>
    </form>
  </dialog>
`;

mountHeader('calculator');
mountFooter();
mountContactDialog();

const areaInput = document.querySelector<HTMLInputElement>('#floor-area')!;
const rateInput = document.querySelector<HTMLInputElement>('#install-rate')!;
const quoteDialog = document.querySelector<HTMLDialogElement>('#quote-dialog')!;
const quoteForm = document.querySelector<HTMLFormElement>('#quote-form')!;
const quoteStatus = document.querySelector<HTMLElement>('#quote-status')!;
let selectedGrade: GradeId = 'premium';

const setText = (id: string, value: string) => { document.getElementById(id)!.textContent = value; };

function readNumber(input: HTMLInputElement, minimum: number, maximum: number, message: string): number | null {
  const value = input.valueAsNumber;
  const valid = Number.isFinite(value) && value >= minimum && value <= maximum && !input.validity.stepMismatch;
  input.setCustomValidity(valid ? '' : message);
  input.setAttribute('aria-invalid', String(!valid));
  setText(input.id === 'floor-area' ? 'area-error' : 'install-error', valid ? '' : message);
  return valid ? value : null;
}

function currentEstimate(): Estimate | null {
  const area = readNumber(areaInput, 0.1, 100000, 'กรอกพื้นที่ 0.1–100,000 ตร.ม. โดยใช้ทศนิยมไม่เกิน 2 ตำแหน่ง');
  const installRate = readNumber(rateInput, 0, 10000, 'กรอกค่าติดตั้ง 0–10,000 บาท โดยใช้ทศนิยมไม่เกิน 2 ตำแหน่ง');
  if (area === null || installRate === null) return null;
  const material = Math.round(area * grades[selectedGrade].rate * 100) / 100;
  const installation = Math.round(area * installRate * 100) / 100;
  return { grade: selectedGrade, area, installRate, material, installation, total: material + installation };
}

function updateEstimate(): void {
  const estimate = currentEstimate();
  setText('summary-grade', `(${grades[selectedGrade].name})`);
  setText('material-equation', estimate ? `${number.format(estimate.area)} × ${grades[selectedGrade].rate} =` : '—');
  setText('installation-equation', estimate ? `${number.format(estimate.area)} × ${number.format(estimate.installRate)} =` : '—');
  setText('material-total', estimate ? money(estimate.material) : '—');
  setText('installation-total', estimate ? money(estimate.installation) : '—');
  document.querySelector<HTMLElement>('#grand-total b')!.textContent = estimate ? money(estimate.total) : '—';
  setText('quote-grade', grades[selectedGrade].name);
  setText('quote-area', estimate ? `${number.format(estimate.area)} ตร.ม. พร้อมค่าติดตั้ง` : 'กรุณาตรวจสอบข้อมูลพื้นที่');
  setText('quote-total', estimate ? `${money(estimate.total)} บาท` : '—');
}

function selectGrade(id: GradeId): void {
  selectedGrade = id;
  document.querySelectorAll<HTMLButtonElement>('[data-grade]').forEach(button => {
    const active = button.dataset.grade === id;
    button.classList.toggle('is-selected', active);
    button.setAttribute('aria-pressed', String(active));
  });
  document.querySelectorAll<HTMLButtonElement>('[data-grade-tab]').forEach(button => {
    const active = button.dataset.gradeTab === id;
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
  });
  document.getElementById('estimate-panel')!.setAttribute('aria-labelledby', `tab-${id}`);
  updateEstimate();
}

document.querySelectorAll<HTMLButtonElement>('[data-grade]').forEach(button => button.addEventListener('click', () => selectGrade(button.dataset.grade as GradeId)));
document.querySelectorAll<HTMLButtonElement>('[data-grade-tab]').forEach(button => {
  button.addEventListener('click', () => selectGrade(button.dataset.gradeTab as GradeId));
  button.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 'premium' : event.key === 'End' ? 'merit' : selectedGrade === 'premium' ? 'merit' : 'premium';
    selectGrade(next);
    document.querySelector<HTMLButtonElement>(`[data-grade-tab="${next}"]`)!.focus();
  });
});
areaInput.addEventListener('input', updateEstimate);
rateInput.addEventListener('input', updateEstimate);
function openQuote() {
  if (!currentEstimate()) {
    (areaInput.validity.valid ? rateInput : areaInput).reportValidity();
    return;
  }
  updateEstimate();
  quoteDialog.showModal();
}
document.getElementById('request-estimate')!.addEventListener('click', openQuote);
document.querySelectorAll('[data-quote-open]').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();openQuote();}));
document.querySelector('.calc-dialog-close')!.addEventListener('click', () => quoteDialog.close());
quoteDialog.addEventListener('click', event => {
  if (event.target !== quoteDialog) return;
  const bounds = quoteDialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) quoteDialog.close();
});

function customerDetails(): Customer | null {
  const name = quoteForm.elements.namedItem('customerName') as HTMLInputElement;
  const phone = quoteForm.elements.namedItem('customerPhone') as HTMLInputElement;
  name.setCustomValidity(name.value.trim() ? '' : 'กรุณากรอกชื่อผู้ติดต่อ');
  phone.setCustomValidity(/^\+?\d{8,15}$/.test(phone.value.replace(/[\s().-]/g, '')) ? '' : 'กรุณากรอกเบอร์โทรศัพท์ที่ติดต่อได้');
  if (!quoteForm.reportValidity()) return null;
  const values = new FormData(quoteForm);
  const read = (key: string) => String(values.get(key) ?? '').trim();
  return { name: read('customerName'), phone: read('customerPhone'), email: read('customerEmail'), location: read('customerLocation'), note: read('customerNote') };
}
(quoteForm.elements.namedItem('customerName') as HTMLInputElement).addEventListener('input', event => (event.target as HTMLInputElement).setCustomValidity(''));
(quoteForm.elements.namedItem('customerPhone') as HTMLInputElement).addEventListener('input', event => (event.target as HTMLInputElement).setCustomValidity(''));

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

function quoteDocument(estimate: Estimate, customer: Customer): string {
  const date = new Intl.DateTimeFormat('th-TH', { dateStyle: 'long', timeZone: 'Asia/Bangkok' }).format(new Date());
  const detail = (label: string, value: string) => value ? `<p><b>${label}</b> ${escapeHtml(value)}</p>` : '';
  return `<!doctype html><html lang="th"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ใบประมาณราคา COOLPLAN — ${escapeHtml(customer.name)}</title><style>
    *{box-sizing:border-box}body{font-family:Tahoma,'Noto Sans Thai',sans-serif;max-width:820px;margin:40px auto;padding:20px;color:#302538;line-height:1.65;background:#fff}header{border-bottom:2px solid #7b638c;padding-bottom:18px;display:flex;justify-content:space-between;gap:25px}h1{font-size:27px;margin:0;color:#584363}header strong{font-size:26px;letter-spacing:2px;color:#5a493b}header p{font-size:12px;margin:3px 0}h2{font-size:18px;margin:22px 0 8px}p{margin:5px 0;font-size:14px}table{border-collapse:collapse;width:100%;margin-top:20px}th,td{text-align:left;border-bottom:1px solid #e6dfe8;padding:11px 8px;font-size:14px}th{background:#f0eaf2}td:last-child,th:last-child{text-align:right;white-space:nowrap}.total{display:flex;justify-content:space-between;align-items:baseline;background:#f2edf4;border-radius:8px;padding:16px;margin-top:18px;gap:15px}.total strong{font-size:29px;color:#624976}.note{white-space:pre-wrap;border-left:3px solid #d1c2d7;padding-left:13px;color:#6d6173}.contact{margin-top:26px;padding-top:15px;border-top:1px solid #ddd;color:#6a5b70}.print-action{background:#715881;color:white;border:0;border-radius:6px;padding:10px 18px;font:inherit;cursor:pointer;margin:20px 0}@media print{body{margin:0;max-width:none;padding:10mm}.print-action{display:none}header,table,.total{break-inside:avoid}a{color:inherit;text-decoration:none}}@media(max-width:560px){body{margin:10px auto;padding:15px}header{display:block}header>div:last-child{margin-top:15px}th,td{font-size:12px;padding:8px 4px}.total strong{font-size:24px}}</style></head><body>
    <header><div><strong>COOLPLAN</strong><p>FLOORING FOR A BETTER TOMORROW</p></div><div><h1>ใบประมาณราคา</h1><p>วันที่ ${date}</p></div></header>
    <h2>ข้อมูลผู้ติดต่อ</h2>${detail('ชื่อ:', customer.name)}${detail('โทรศัพท์:', customer.phone)}${detail('อีเมล:', customer.email)}${detail('สถานที่ติดตั้ง:', customer.location)}
    <table><thead><tr><th>รายการ</th><th>พื้นที่</th><th>ราคาต่อ ตร.ม.</th><th>รวม (บาท)</th></tr></thead><tbody><tr><td>${grades[estimate.grade].name}</td><td>${number.format(estimate.area)} ตร.ม.</td><td>${money(grades[estimate.grade].rate)}</td><td>${money(estimate.material)}</td></tr><tr><td>ค่าติดตั้ง</td><td>${number.format(estimate.area)} ตร.ม.</td><td>${money(estimate.installRate)}</td><td>${money(estimate.installation)}</td></tr></tbody></table>
    <div class="total"><span>รวมประมาณ</span><strong>${money(estimate.total)} บาท</strong></div>
    ${customer.note ? `<h2>รายละเอียดเพิ่มเติม</h2><p class="note">${escapeHtml(customer.note)}</p>` : ''}
    <p class="contact">ราคานี้เป็นราคาโดยประมาณ กรุณาติดต่อเพื่อขอใบเสนอราคาจริง<br>คุณคะน้า · <a href="tel:0846707551">084 670 7551</a> · <a href="mailto:coolplanworkshop@gmail.com">coolplanworkshop@gmail.com</a></p>
    <button class="print-action" onclick="window.print()">พิมพ์ / บันทึก PDF</button></body></html>`;
}

function quoteData(): { estimate: Estimate; customer: Customer } | null {
  const estimate = currentEstimate();
  if (!estimate) {
    quoteStatus.textContent = 'กรุณาปิดหน้าต่างนี้และตรวจสอบพื้นที่หรือค่าติดตั้งก่อน';
    return null;
  }
  const customer = customerDetails();
  return customer ? { estimate, customer } : null;
}

document.getElementById('quote-download')!.addEventListener('click', () => {
  const data = quoteData();
  if (!data) return;
  const blob = new Blob([quoteDocument(data.estimate, data.customer)], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'COOLPLAN-ใบประมาณราคา.html';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  quoteStatus.textContent = 'ดาวน์โหลดใบประมาณราคาแล้ว เปิดไฟล์ในเบราว์เซอร์เพื่ออ่านหรือพิมพ์เป็น PDF ได้';
});

document.getElementById('quote-print')!.addEventListener('click', () => {
  const data = quoteData();
  if (!data) return;
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    quoteStatus.textContent = 'เบราว์เซอร์ปิดกั้นหน้าต่างพิมพ์ กรุณาอนุญาตป๊อปอัปหรือดาวน์โหลดใบประมาณราคาแทน';
    return;
  }
  printWindow.opener = null;
  printWindow.document.open();
  printWindow.document.write(quoteDocument(data.estimate, data.customer));
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => printWindow.print(), 250);
  quoteStatus.textContent = 'เปิดใบประมาณราคาในหน้าต่างใหม่แล้ว เลือกเครื่องพิมพ์หรือบันทึกเป็น PDF ได้';
});

quoteForm.addEventListener('submit', event => {
  event.preventDefault();
  const data = quoteData();
  if (!data) return;
  const { estimate, customer } = data;
  const body = [
    'เรียนทีมงาน COOLPLAN', '', 'ต้องการขอใบเสนอราคาพื้น SPC ตามรายละเอียดต่อไปนี้',
    `ชื่อผู้ติดต่อ: ${customer.name}`, `โทรศัพท์: ${customer.phone}`,
    ...(customer.email ? [`อีเมล: ${customer.email}`] : []),
    ...(customer.location ? [`สถานที่ติดตั้ง: ${customer.location}`] : []), '',
    `สินค้า: ${grades[estimate.grade].name}`, `พื้นที่: ${number.format(estimate.area)} ตร.ม.`,
    `ค่าวัสดุ: ${number.format(estimate.area)} × ${grades[estimate.grade].rate} = ${money(estimate.material)} บาท`,
    `ค่าติดตั้ง: ${number.format(estimate.area)} × ${money(estimate.installRate)} = ${money(estimate.installation)} บาท`,
    `รวมประมาณ: ${money(estimate.total)} บาท`,
    ...(customer.note ? ['', `รายละเอียดเพิ่มเติม: ${customer.note}`] : []), '',
    'ข้างต้นเป็นราคาประมาณการจากเว็บไซต์ กรุณาติดต่อกลับเพื่อยืนยันใบเสนอราคาจริง',
  ].join('\n');
  window.location.href = `mailto:coolplanworkshop@gmail.com?subject=${encodeURIComponent(`ขอใบเสนอราคา ${grades[estimate.grade].name} — ${customer.name}`)}&body=${encodeURIComponent(body)}`;
  quoteStatus.textContent = 'เตรียมอีเมลฉบับร่างแล้ว กรุณาตรวจสอบและกดส่งในแอปอีเมลของคุณ หากแอปไม่เปิด ติดต่อคุณคะน้า 084 670 7551 ได้';
});

updateEstimate();
if(location.hash==='#quote')openQuote();
