import qrcode from 'qrcode-generator';

/**
 * "Open on your phone" dialog (design phase 3). Shows a QR code of this page
 * with a hash that scrolls straight to the visualizer, so a desktop visitor can
 * continue with the phone camera. No server pairing: the phone processes its own
 * photo locally, which is simpler and keeps the image on the device.
 */
export const UPLOAD_HASH = '#upload-room';

export function mountQrDialog(url: string): { open(): void; dispose(): void } {
  const dialog = document.createElement('dialog');
  dialog.className = 'site-dialog qr-dialog';
  dialog.setAttribute('aria-labelledby', 'qr-heading');
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'dialog-close';
  close.setAttribute('aria-label', 'ปิด');
  close.textContent = '✕';
  const eyebrow = document.createElement('span');
  eyebrow.className = 'dialog-eyebrow';
  eyebrow.textContent = 'TRY IT IN YOUR ROOM';
  const heading = document.createElement('h2');
  heading.id = 'qr-heading';
  heading.textContent = 'ถ่ายรูปห้องด้วยมือถือ';
  const text = document.createElement('p');
  text.textContent = 'สแกน QR เพื่อเปิดหน้านี้บนมือถือ แล้วแตะ "อัปโหลดรูปห้องของคุณ" เพื่อถ่ายรูป รูปจะถูกประมวลผลบนมือถือของคุณเอง ไม่ถูกส่งขึ้นเซิร์ฟเวอร์';
  const holder = document.createElement('div');
  holder.className = 'qr-holder';
  const code = qrcode(0, 'M');
  code.addData(url);
  code.make();
  const cells = code.getModuleCount();
  const canvas = document.createElement('canvas');
  const scale = 6, margin = 4;
  canvas.width = canvas.height = (cells + margin * 2) * scale;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `QR code ของ ${url}`);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#3b2a4a';
    for (let row = 0; row < cells; row++) for (let col = 0; col < cells; col++) {
      if (code.isDark(row, col)) ctx.fillRect((col + margin) * scale, (row + margin) * scale, scale, scale);
    }
  }
  const link = document.createElement('a');
  link.className = 'qr-link';
  link.href = url;
  link.textContent = url.replace(/^https?:\/\//, '');
  holder.append(canvas, link);
  dialog.append(close, eyebrow, heading, text, holder);
  document.body.append(dialog);
  const onClose = (): void => dialog.close();
  close.addEventListener('click', onClose);
  return {
    open() { if (!dialog.open) dialog.showModal(); },
    dispose() { close.removeEventListener('click', onClose); dialog.remove(); },
  };
}
