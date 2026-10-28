import type { ProductConfig } from '../types';
import type { TextureJob, TextureJobResult } from './texture.worker';

/** Small pool of texture workers shared by the page; falls back to `null` where workers or ImageBitmap are unavailable. */
export interface GeneratedMaps { albedo: ImageBitmap; normal: ImageBitmap; roughness: ImageBitmap; ms: number }

class TextureWorkerPool {
  private readonly workers: Worker[] = [];
  private readonly idle: Worker[] = [];
  private readonly queue: { job: TextureJob; resolve: (maps: GeneratedMaps) => void; reject: (error: Error) => void }[] = [];
  private readonly pending = new Map<number, { resolve: (maps: GeneratedMaps) => void; reject: (error: Error) => void; worker: Worker }>();
  private nextId = 1;

  constructor(size: number) {
    for (let i = 0; i < size; i++) {
      const worker = new Worker(new URL('./texture.worker.ts', import.meta.url), { type: 'module' });
      worker.addEventListener('message', (event: MessageEvent<TextureJobResult | { id: number; error: string }>) => {
        const entry = this.pending.get(event.data.id);
        if (!entry) return;
        this.pending.delete(event.data.id);
        if ('error' in event.data) entry.reject(new Error(event.data.error));
        else entry.resolve({ albedo: event.data.albedo, normal: event.data.normal, roughness: event.data.roughness, ms: event.data.ms });
        this.idle.push(worker);
        this.pump();
      });
      worker.addEventListener('error', event => {
        for (const [id, entry] of this.pending) if (entry.worker === worker) { this.pending.delete(id); entry.reject(new Error(event.message || 'texture worker failed')); }
        this.idle.push(worker);
        this.pump();
      });
      this.workers.push(worker);
      this.idle.push(worker);
    }
  }

  generate(kind: TextureJob['kind'], product: ProductConfig, width: number, height: number): Promise<GeneratedMaps> {
    return new Promise((resolve, reject) => {
      this.queue.push({ job: { id: this.nextId++, kind, product, width, height }, resolve, reject });
      this.pump();
    });
  }

  private pump(): void {
    while (this.idle.length && this.queue.length) {
      const worker = this.idle.pop()!;
      const { job, resolve, reject } = this.queue.shift()!;
      this.pending.set(job.id, { resolve, reject, worker });
      worker.postMessage(job);
    }
  }

  dispose(): void {
    for (const worker of this.workers) worker.terminate();
    this.workers.length = 0;
    this.idle.length = 0;
  }
}

let shared: TextureWorkerPool | null | undefined;

/** The page-wide pool (2–4 workers), or null when the environment cannot run it. */
export function getTextureWorkerPool(): TextureWorkerPool | null {
  if (shared !== undefined) return shared;
  try {
    if (typeof Worker === 'undefined' || typeof createImageBitmap === 'undefined') { shared = null; return shared; }
    const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2;
    shared = new TextureWorkerPool(Math.max(2, Math.min(4, cores - 1)));
  } catch { shared = null; }
  return shared;
}
