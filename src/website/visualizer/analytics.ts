/**
 * Visualizer usage events (design phase 3). No vendor lock-in: events go to
 * `window.dataLayer` (GTM/GA4) when present, to `navigator.sendBeacon`
 * (VITE_ANALYTICS_URL) when configured, and are kept in a small in-memory
 * ring buffer that `window.websiteDemo.diagnostics` exposes for tests.
 * No image data and no personal data are ever included.
 */
export type VisualizerEvent =
  | { name: 'visualizer_upload'; bytes: number; type: string }
  | { name: 'visualizer_scan'; stage: 'auto' | 'manual'; ms: number; backend: string | null; coverage: number; horizonConfidence: number; error: string | null }
  | { name: 'visualizer_tool'; tool: string }
  | { name: 'visualizer_depth'; status: string; ms: number; removed: number }
  | { name: 'visualizer_sam'; action: 'embed' | 'click'; ms: number }
  | { name: 'visualizer_finish'; product: string; context: 'sample' | 'upload' }
  | { name: 'visualizer_export'; kind: 'download' | 'share' }
  | { name: 'visualizer_advice'; ok: boolean; model?: string }
  | { name: 'visualizer_quote'; product: string };

type Payload = VisualizerEvent & { ts: number; session: string };
const buffer: Payload[] = [];
const session = Math.random().toString(36).slice(2, 10);

export function track(event: VisualizerEvent): void {
  const payload: Payload = { ...event, ts: Date.now(), session };
  buffer.push(payload);
  if (buffer.length > 100) buffer.shift();
  try {
    const layer = (window as unknown as { dataLayer?: unknown[] }).dataLayer;
    if (Array.isArray(layer)) layer.push({ event: event.name, ...event });
  } catch { /* no GTM */ }
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    const url = env?.VITE_ANALYTICS_URL;
    if (url && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(url, new Blob([JSON.stringify(payload)], { type: 'application/json' }));
    }
  } catch { /* beacon unavailable */ }
}

export function recentEvents(): readonly Payload[] { return buffer; }
