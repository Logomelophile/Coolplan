/**
 * Procedural texture worker. Generates a product's surface or backing maps off
 * the main thread and returns them as transferable ImageBitmaps, so building six
 * finishes no longer freezes scrolling. Pure maths only: no three.js here.
 */
import type { ProductConfig } from '../types';
import { generateWoodPixels } from './wood';
import { generateMarblePixels } from './marble';
import { generateBackingPixels } from './backing';
import { sobelNormals, roughnessToRgba } from './normals';

export interface TextureJob {
  id: number;
  kind: 'surface' | 'backing';
  /** The product to render; for crosshatch backings the caller passes the physical tile product. */
  product: ProductConfig;
  width: number;
  height: number;
}

export interface TextureJobResult {
  id: number;
  albedo: ImageBitmap;
  normal: ImageBitmap;
  roughness: ImageBitmap;
  ms: number;
}

interface WorkerScope { postMessage(message: unknown, transfer?: Transferable[]): void; addEventListener(type: 'message', listener: (event: MessageEvent<TextureJob>) => void): void }
const scope = self as unknown as WorkerScope;

async function run(job: TextureJob): Promise<void> {
  const started = performance.now();
  const { product, width, height } = job;
  const pixels = job.kind === 'backing' ? generateBackingPixels(product, width, height)
    : product.surface.family === 'wood' ? generateWoodPixels(product, width, height) : generateMarblePixels(product, width, height);
  const normals = sobelNormals(pixels.heights, width, height, product.dimensions.lengthMm, product.dimensions.widthMm);
  const [albedo, normal, roughness] = await Promise.all([
    createImageBitmap(new ImageData(pixels.albedo as unknown as Uint8ClampedArray<ArrayBuffer>, width, height)),
    createImageBitmap(new ImageData(normals as unknown as Uint8ClampedArray<ArrayBuffer>, width, height)),
    createImageBitmap(new ImageData(roughnessToRgba(pixels.roughness) as unknown as Uint8ClampedArray<ArrayBuffer>, width, height)),
  ]);
  const result: TextureJobResult = { id: job.id, albedo, normal, roughness, ms: Math.round(performance.now() - started) };
  scope.postMessage(result, [albedo, normal, roughness]);
}

scope.addEventListener('message', event => {
  const job = event.data;
  run(job).catch(error => scope.postMessage({ id: job.id, error: error instanceof Error ? error.message : String(error) }));
});
