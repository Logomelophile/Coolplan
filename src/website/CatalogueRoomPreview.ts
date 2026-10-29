import { sitePath } from '../sitePath';
import { FloorVisualizer } from './visualizer';
import { SAMPLE_ROOMS } from './visualizer/rooms';

export interface CatalogueRoomSelection {
  code: string; image: string; sizeMm: string; herringbone: boolean; illustrative: boolean;
}

/** An estimator-only sample preview. It shares the floor renderer, not the main configurator's selection. */
export class CatalogueRoomPreview {
  private readonly abort = new AbortController();
  private readonly preview: FloorVisualizer;
  private key = '';
  private revision = 0;
  private disposed = false;
  private readonly status: HTMLElement;

  constructor(private readonly host: HTMLElement) {
    host.innerHTML = `<header class="package-room-heading"><span>ลองสีในห้องของคุณ</span><strong class="package-room-name">${SAMPLE_ROOMS[0].name}</strong></header><div class="package-room-view" role="img" aria-label="ภาพห้องพร้อมพื้นตามสเปคที่เลือก"></div><div class="package-room-choices" role="group" aria-label="เลือกห้องตัวอย่างสำหรับสเปค">${SAMPLE_ROOMS.map((room, index) => `<button type="button" data-spec-room="${index}" aria-pressed="${index === 0}"><img src="${sitePath(room.image!)}" alt="" loading="lazy" decoding="async"/><span>${room.name}</span></button>`).join('')}</div><p class="package-room-status" role="status" aria-live="polite">กำลังเตรียมตัวอย่างห้อง</p>`;
    this.status = host.querySelector('.package-room-status')!;
    this.preview = new FloorVisualizer(host.querySelector('.package-room-view')!, {
      productIds: ['light-natural-oak'], autoDetect: false, preloadRooms: false, disposeSharedAtlases: false,
      onChange: state => {
        host.dataset.catalogueRoom = String(state.room);
        host.dataset.renderedRoom = state.maskSource !== 'none' ? String(state.room) : '';
        host.querySelector('.package-room-name')!.textContent = SAMPLE_ROOMS[state.room].name!;
        host.querySelectorAll<HTMLButtonElement>('[data-spec-room]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.specRoom) === state.room)));
        if (state.failed) this.status.textContent = 'โหลดภาพห้องไม่สำเร็จ กรุณาเลือกห้องอีกครั้ง';
      },
    });
    host.addEventListener('click', event => {
      const button = (event.target as Element).closest<HTMLButtonElement>('[data-spec-room]');
      if (button) this.preview.setRoom(Number(button.dataset.specRoom));
    }, { signal: this.abort.signal });
  }

  async set(selection: CatalogueRoomSelection): Promise<void> {
    const key = `${selection.code}|${selection.image}|${selection.sizeMm}|${selection.herringbone}`;
    if (this.disposed || key === this.key) return;
    this.key = key;
    const revision = ++this.revision;
    this.status.textContent = 'กำลังเปลี่ยนสีพื้นตามสเปค';
    await this.preview.ready;
    if (this.disposed || revision !== this.revision) return;
    const sizes = selection.sizeMm.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [180, 1220];
    const unit = selection.sizeMm.includes('นิ้ว') ? 25.4 : 1;
    const applied = await this.preview.setCatalogueSurface({
      code: selection.code, image: selection.image,
      lengthMm: Math.max(...sizes) * unit, widthMm: Math.min(...sizes) * unit,
      pattern: selection.herringbone ? 'herringbone' : 'straight',
    });
    if (this.disposed || revision !== this.revision) return;
    if (!applied) { this.key = ''; this.status.textContent = 'ยังแสดงเฉดนี้ไม่ได้ กรุณาลองเลือกสีอีกครั้ง'; return; }
    this.host.dataset.renderedTexture = selection.image;
    this.host.dataset.catalogueCode = selection.code;
    this.host.dataset.cataloguePattern = selection.herringbone ? 'herringbone' : 'straight';
    this.status.textContent = selection.illustrative ? 'ภาพจำลองตระกูลสินค้า ให้ทีมงานยืนยันภาพของเฉดที่เลือก' : `${selection.code} · เปลี่ยนเฉพาะพื้นในภาพห้อง`;
  }

  dispose(): void { this.disposed = true; this.revision++; this.abort.abort(); this.preview.dispose(); }
}
