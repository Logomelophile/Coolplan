/**
 * Optional "AI colour advice" (design §4.4). A vision LLM cannot find the floor,
 * but it is good at room type / style / lighting and at picking décors that
 * suit the room. The photo leaves the device ONLY when the user opts in, and
 * only to our own edge function (server/edge/room-advice.ts), never to the
 * model provider directly. Disabled unless VITE_ROOM_ADVICE_URL is configured.
 */
export interface AdviceProduct { id: string; name: string; nameTh: string; tone: string }
export interface RoomAdvice {
  roomType: string;
  style: string;
  lighting: string;
  suggestions: { id: string; reason: string }[];
  model: string;
}

export function adviceEndpoint(): string | null {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  const url = env?.VITE_ROOM_ADVICE_URL;
  return url && /^https?:\/\//.test(url) ? url : null;
}

/** JPEG data URL of the photo at ≤ `maxEdge` px: enough for a VLM, small enough to be quick and private. */
export function thumbnailDataUrl(source: HTMLCanvasElement, maxEdge = 512): string {
  const scale = Math.min(1, maxEdge / Math.max(source.width, source.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('เบราว์เซอร์นี้ไม่รองรับการย่อภาพ');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', .8);
}

export async function requestRoomAdvice(photo: HTMLCanvasElement, products: AdviceProduct[], options: { endpoint?: string; timeoutMs?: number } = {}): Promise<RoomAdvice> {
  const endpoint = options.endpoint ?? adviceEndpoint();
  if (!endpoint) throw new Error('ยังไม่ได้ตั้งค่าบริการแนะนำสี (VITE_ROOM_ADVICE_URL)');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 12000);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ image: thumbnailDataUrl(photo), products, locale: 'th' }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`บริการแนะนำสีตอบกลับผิดพลาด (${response.status})`);
    const data = await response.json() as Partial<RoomAdvice>;
    const known = new Set(products.map(product => product.id));
    return {
      roomType: String(data.roomType ?? ''),
      style: String(data.style ?? ''),
      lighting: String(data.lighting ?? ''),
      suggestions: Array.isArray(data.suggestions) ? data.suggestions.filter(item => item && known.has(String(item.id))).slice(0, 3).map(item => ({ id: String(item.id), reason: String(item.reason ?? '') })) : [],
      model: String(data.model ?? ''),
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error('บริการแนะนำสีใช้เวลานานเกินไป ลองใหม่ภายหลัง');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
