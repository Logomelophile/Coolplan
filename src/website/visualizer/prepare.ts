/** Image preparation for uploads (design §5.2): decode with EXIF orientation, bound the working size, letterbox a network tensor. */
export const IMAGENET_MEAN = [.485, .456, .406] as const;
export const IMAGENET_STD = [.229, .224, .225] as const;

export interface Letterbox { size: number; ox: number; oy: number; nw: number; nh: number }

export async function decodeImage(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch { /* HEIC or unsupported: fall back to an <img>, which Safari can decode */ }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('ไม่สามารถอ่านภาพนี้ได้ กรุณาเลือกภาพอื่น (JPG/PNG/WebP)'));
      image.src = url;
    });
  } finally {
    // The element keeps its decoded bitmap after load; the blob URL can go.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

export const imageSize = (source: ImageBitmap | HTMLImageElement): { width: number; height: number } =>
  'naturalWidth' in source ? { width: source.naturalWidth, height: source.naturalHeight } : { width: source.width, height: source.height };

/** Draws the source into a canvas no larger than `maxEdge` on its long side. */
export function toWorkingCanvas(source: ImageBitmap | HTMLImageElement, maxEdge = 1600): HTMLCanvasElement {
  const { width, height } = imageSize(source);
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('เบราว์เซอร์นี้ไม่รองรับการประมวลผลภาพ');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Depth Anything input: shorter side 518, both sides multiples of 14, aspect kept (no padding). */
export function depthTensor(work: HTMLCanvasElement, size = 518): { tensor: Float32Array; width: number; height: number } {
  const scale = size / Math.min(work.width, work.height);
  const round14 = (v: number): number => Math.max(14, Math.round(v / 14) * 14);
  const width = round14(work.width * scale), height = round14(work.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(work, 0, 0, width, height);
  const data = ctx.getImageData(0, 0, width, height).data;
  const plane = width * height;
  const tensor = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) for (let c = 0; c < 3; c++) tensor[c * plane + i] = (data[i * 4 + c] / 255 - IMAGENET_MEAN[c]) / IMAGENET_STD[c];
  return { tensor, width, height };
}

/** SAM input: longest edge 1024, padded bottom/right to 1024², ImageNet normalisation. Returns the scale from working pixels. */
export function samTensor(work: HTMLCanvasElement, size = 1024): { tensor: Float32Array; scale: number; nw: number; nh: number } {
  const scale = size / Math.max(work.width, work.height);
  const nw = Math.max(1, Math.round(work.width * scale)), nh = Math.max(1, Math.round(work.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(work, 0, 0, work.width, work.height, 0, 0, nw, nh);
  const data = ctx.getImageData(0, 0, size, size).data;
  const plane = size * size;
  const tensor = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) for (let c = 0; c < 3; c++) tensor[c * plane + i] = (data[i * 4 + c] / 255 - IMAGENET_MEAN[c]) / IMAGENET_STD[c];
  return { tensor, scale, nw, nh };
}

/** NCHW float tensor with ImageNet normalisation, image letterboxed into a square. */
export function letterboxTensor(work: HTMLCanvasElement, size: number): { tensor: Float32Array; box: Letterbox } {
  const s = size / Math.max(work.width, work.height);
  const nw = Math.max(1, Math.round(work.width * s)), nh = Math.max(1, Math.round(work.height * s));
  const ox = Math.floor((size - nw) / 2), oy = Math.floor((size - nh) / 2);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#7f7f7f';
  ctx.fillRect(0, 0, size, size);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(work, 0, 0, work.width, work.height, ox, oy, nw, nh);
  const data = ctx.getImageData(0, 0, size, size).data;
  const tensor = new Float32Array(3 * size * size);
  const plane = size * size;
  for (let i = 0; i < plane; i++) for (let c = 0; c < 3; c++) tensor[c * plane + i] = (data[i * 4 + c] / 255 - IMAGENET_MEAN[c]) / IMAGENET_STD[c];
  return { tensor, box: { size, ox, oy, nw, nh } };
}
