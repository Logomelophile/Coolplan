import type { FloorVisualizer, FloorVisualizerDiagnostics, Tool } from '../index';
import { adviceEndpoint, requestRoomAdvice } from '../advice';
import { track } from '../analytics';

/**
 * Customer tools for sample rooms and uploaded photos:
 * brush add/erase, horizon, plank scale, rescan / manual corners, download, share.
 * Optional AI tools appear only for automatically segmented uploads.
 */
export interface ToolbarHandle {
  element: HTMLElement;
  update(state: FloorVisualizerDiagnostics): void;
  dispose(): void;
}

export interface ToolbarOptions {
  hint: (message: string) => void;
  fileName: () => string;
  /** Catalogue for the AI advice request (id, names, tone). */
  products?: () => { id: string; name: string; nameTh: string; tone: string }[];
  /** Called with suggested product ids so the page can highlight them. */
  onAdvice?: (ids: string[]) => void;
}

export function mountVisualizerToolbar(anchor: HTMLElement, visualizer: FloorVisualizer, options: ToolbarOptions): ToolbarHandle {
  const root = document.createElement('div');
  root.className = 'visualizer-tools';
  root.id = 'visualizer-tools';
  root.hidden = true;
  root.setAttribute('role', 'toolbar');
  root.setAttribute('aria-label', 'ปรับลายพื้นและบันทึกภาพ');
  const abort = new AbortController();
  const signal = abort.signal;

  const button = (id: string, label: string, title: string, onClick: () => void, toggle = false): HTMLButtonElement => {
    const el = document.createElement('button');
    el.type = 'button';
    el.id = id;
    el.textContent = label;
    el.title = title;
    if (toggle) el.setAttribute('aria-pressed', 'false');
    el.addEventListener('click', onClick, { signal });
    return el;
  };
  const range = (id: string, label: string, min: number, max: number, step: number, value: number, onInput: (value: number) => void): { wrap: HTMLElement; input: HTMLInputElement } => {
    const wrap = document.createElement('label');
    wrap.className = 'visualizer-range';
    wrap.htmlFor = id;
    const text = document.createElement('span');
    text.textContent = label;
    const input = document.createElement('input');
    input.type = 'range';
    input.id = id;
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    input.addEventListener('input', () => onInput(Number(input.value)), { signal });
    wrap.append(text, input);
    return { wrap, input };
  };

  let tool: Tool = 'none';
  const setTool = (next: Tool): void => {
    tool = tool === next ? 'none' : next;
    visualizer.setTool(tool);
    if (tool !== 'none') track({ name: 'visualizer_tool', tool });
    if (tool === 'none') options.hint('เปลี่ยนสี หมุนลาย หรือเปรียบเทียบได้ · ใช้เครื่องมือด้านล่างถ้าขอบหรือมุมไม่ตรง');
  };

  const groupEdit = document.createElement('div');
  groupEdit.className = 'visualizer-group';
  const brushAdd = button('tool-brush-add', '+ เพิ่มพื้นที่พื้น', 'ระบายเพิ่มบริเวณที่เป็นพื้น', () => setTool('brush-add'), true);
  const brushErase = button('tool-brush-erase', '− ลบส่วนเกิน', 'ระบายส่วนที่ทับโต๊ะ ขาเก้าอี้ หรือเฟอร์นิเจอร์ออก', () => setTool('brush-erase'), true);
  const undo = button('tool-undo', '↶ ย้อนกลับ', 'ย้อนรอยระบายครั้งล่าสุด', () => visualizer.undoMask());
  const redo = button('tool-redo', '↷ ทำซ้ำ', 'คืนรอยระบายที่เพิ่งย้อนกลับ', () => visualizer.redoMask());
  const horizon = button('tool-horizon', 'ปรับมุมมอง', 'เลื่อนเส้นขอบฟ้าให้ตรงระดับสายตา', () => setTool('horizon'), true);
  const resetMask = button('tool-reset-mask', 'คืนค่าขอบ', 'ยกเลิกการระบายและกลับไปใช้ขอบพื้นเริ่มต้น', () => visualizer.resetMask());
  const brushSize = range('tool-brush-size', 'ขนาดแปรง', 6, 120, 2, 28, value => visualizer.setBrushSize(value));
  const plankScale = range('tool-plank-scale', 'ขนาดแผ่น', 60, 240, 5, 140, value => visualizer.setPlankScale(value / 100));
  plankScale.input.title = 'เลื่อนซ้าย = แผ่นใหญ่ขึ้น (กล้องใกล้พื้น), ขวา = แผ่นเล็กลง';
  const clickAdd = button('tool-click-add', 'แตะเพิ่มพื้น (AI)', 'แตะหนึ่งจุด AI จะเลือกบริเวณพื้นทั้งผืนให้', () => setTool('click-add'), true);
  const clickErase = button('tool-click-erase', 'แตะลบวัตถุ (AI)', 'แตะวัตถุที่ทับพื้น AI จะลบออกทั้งชิ้น', () => setTool('click-erase'), true);
  const depth = button('tool-depth', 'แยกวัตถุด้วยความลึก', 'ใช้โมเดลความลึกตัดวัตถุที่วางบนพื้นออกจากขอบพื้น', () => visualizer.refineWithDepth());
  groupEdit.append(brushAdd, brushErase, brushSize.wrap, undo, redo, resetMask, clickAdd, clickErase, horizon, depth);

  const groupMode = document.createElement('div');
  groupMode.className = 'visualizer-group';
  const rescan = button('tool-rescan', 'สแกนใหม่', 'ตรวจหาพื้นอัตโนมัติอีกครั้ง', () => visualizer.rescan());
  const manual = button('tool-manual', 'เลือก 4 มุมเอง', 'กำหนดบริเวณพื้นด้วยการคลิก 4 มุม', () => visualizer.useManualCorners());
  groupMode.append(rescan, manual);

  const groupExport = document.createElement('div');
  groupExport.className = 'visualizer-group';
  const download = button('tool-download', 'ดาวน์โหลดภาพ', 'บันทึกภาพห้องพร้อมพื้นใหม่', () => {
    void visualizer.exportImage('image/jpeg').then(blob => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${options.fileName()}.jpg`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      track({ name: 'visualizer_export', kind: 'download' });
      options.hint('บันทึกภาพแล้ว');
    }).catch(error => options.hint(error instanceof Error ? error.message : 'บันทึกภาพไม่สำเร็จ'));
  });
  groupExport.append(download);
  const canShareFiles = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  if (canShareFiles) {
    const share = button('tool-share', 'แชร์', 'แชร์ภาพผ่านแอปในเครื่อง', () => {
      void visualizer.exportImage('image/jpeg').then(async blob => {
        const file = new File([blob], `${options.fileName()}.jpg`, { type: 'image/jpeg' });
        const data: ShareData = { files: [file], title: 'COOLPLAN SPC', text: `ห้องของฉันกับพื้น ${visualizer.productName}` };
        if (navigator.canShare && !navigator.canShare(data)) throw new Error('อุปกรณ์นี้แชร์ไฟล์ภาพไม่ได้ ใช้ดาวน์โหลดแทน');
        await navigator.share(data);
        track({ name: 'visualizer_export', kind: 'share' });
      }).catch(error => { if (!(error instanceof DOMException && error.name === 'AbortError')) options.hint(error instanceof Error ? error.message : 'แชร์ไม่สำเร็จ'); });
    });
    groupExport.append(share);
  }
  // Optional AI colour advice (vision LLM through our edge function). Only when configured, always opt-in.
  const endpoint = adviceEndpoint();
  let advice: HTMLButtonElement | null = null;
  if (endpoint && options.products) {
    advice = button('tool-advice', 'แนะนำสีด้วย AI', 'ส่งภาพย่อไปให้ AI ทายประเภทห้องและแนะนำสีที่เข้ากัน', () => {
      const photo = visualizer.photoCanvas;
      if (!photo) return;
      const consent = window.confirm('จะส่งภาพห้องของคุณ (ย่อขนาด 512 px) ไปยังบริการ AI ของ COOLPLAN เพื่อขอคำแนะนำสี ภาพอาจถูกส่งต่อไปยังผู้ให้บริการโมเดล ยืนยันหรือไม่?');
      if (!consent) return;
      advice!.disabled = true;
      options.hint('กำลังขอคำแนะนำจาก AI…');
      requestRoomAdvice(photo, options.products!(), { endpoint }).then(result => {
        track({ name: 'visualizer_advice', ok: true, model: result.model });
        options.onAdvice?.(result.suggestions.map(item => item.id));
        const names = result.suggestions.map(item => `${item.id}${item.reason ? ` (${item.reason})` : ''}`).join(' · ');
        options.hint(`${result.roomType ? `ห้อง: ${result.roomType}` : ''}${result.style ? ` · สไตล์ ${result.style}` : ''}${names ? ` · แนะนำ: ${names}` : ' · AI ไม่ได้แนะนำสีเฉพาะเจาะจง'}`);
      }).catch(error => {
        track({ name: 'visualizer_advice', ok: false });
        options.hint(error instanceof Error ? error.message : 'ขอคำแนะนำไม่สำเร็จ');
      }).finally(() => { if (advice) advice.disabled = false; });
    });
    groupExport.append(advice);
  }

  const quick = document.createElement('div');
  quick.className = 'visualizer-group visualizer-quick';
  quick.append(plankScale.wrap);
  const refinement = document.createElement('details');
  refinement.className = 'visualizer-refinement';
  refinement.id = 'visualizer-refinement';
  const summary = document.createElement('summary');
  summary.textContent = 'ปรับขอบพื้น';
  const help = document.createElement('p');
  help.textContent = 'ถ้าพื้นทับขาโต๊ะหรือเฟอร์นิเจอร์ ให้เลือกลบส่วนเกินแล้วระบายบนภาพ ใช้ปุ่มย้อนกลับเพื่อลบรอยระบายล่าสุดได้';
  refinement.append(summary, help, groupEdit, groupMode);
  refinement.addEventListener('toggle', () => { if (!refinement.open && tool !== 'none') { tool = 'none'; visualizer.setTool('none'); } }, { signal });
  groupExport.classList.add('visualizer-export');
  root.append(quick, refinement, groupExport);
  anchor.insertAdjacentElement('afterend', root);

  return {
    element: root,
    update(state) {
      root.hidden = !state.ready;
      const auto = state.stage === 'auto';
      groupEdit.hidden = !state.floorSelected;
      groupMode.hidden = !state.uploaded;
      help.hidden = !state.floorSelected;
      clickAdd.hidden = clickErase.hidden = horizon.hidden = depth.hidden = !auto;
      undo.disabled = !state.canUndo;
      redo.disabled = !state.canRedo;
      const pressed = (el: HTMLButtonElement, active: boolean): void => el.setAttribute('aria-pressed', String(active));
      pressed(brushAdd, state.tool === 'brush-add');
      pressed(brushErase, state.tool === 'brush-erase');
      pressed(horizon, state.tool === 'horizon');
      pressed(clickAdd, state.tool === 'click-add');
      pressed(clickErase, state.tool === 'click-erase');
      const samLabel = state.sam.status === 'embedding' ? ' …' : '';
      clickAdd.textContent = `แตะเพิ่มพื้น (AI)${samLabel}`;
      clickErase.textContent = `แตะลบวัตถุ (AI)${samLabel}`;
      depth.disabled = state.depth.status === 'running';
      depth.textContent = state.depth.status === 'running' ? 'กำลังประเมินความลึก…' : state.depth.status === 'done' ? 'แยกวัตถุด้วยความลึกอีกครั้ง' : 'แยกวัตถุด้วยความลึก';
      depth.classList.toggle('is-done', state.depth.status === 'done');
      brushSize.wrap.hidden = !state.tool.startsWith('brush');
      plankScale.wrap.hidden = state.tool !== 'horizon' && state.tool !== 'none';
      plankScale.input.disabled = !state.floorSelected;
      plankScale.input.value = String(Math.round(state.cameraHeight * 100));
      rescan.hidden = state.stage === 'scanning';
      rescan.textContent = state.stage === 'manual' ? 'สแกนอัตโนมัติ' : 'สแกนใหม่';
      manual.hidden = state.stage !== 'auto' && state.stage !== 'scanning';
      download.disabled = !state.floorSelected;
      groupExport.hidden = state.stage === 'scanning';
      if (state.tool !== tool) tool = state.tool;
    },
    dispose() { abort.abort(); root.remove(); },
  };
}
