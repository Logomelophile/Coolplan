import type { ProductConfig } from '../../../types';
import { generateWoodPixels } from '../../../textures/wood';
import { generateMarblePixels } from '../../../textures/marble';

/**
 * A vertical atlas of distinct planks for one product, generated from the same
 * procedural material as the 3D viewer, so the photo visualizer shows the real
 * SPC décor instead of a cropped swatch. Row i covers v ∈ [i/planks, (i+1)/planks].
 */
export interface PlankAtlas {
  canvas: HTMLCanvasElement;
  planks: number;
  /** Physical plank size in metres: [length, width]. */
  plankSize: [number, number];
  productId: string;
  dispose(): void;
}

export interface PlankAtlasOptions {
  planks?: number;
  /** Texels along the plank length (768 ≈ 1.6 mm/texel; ~0.4 s per product on a laptop). */
  width?: number;
}

const cache = new Map<string, PlankAtlas>();

export function buildPlankAtlas(product: ProductConfig, options: PlankAtlasOptions = {}): PlankAtlas {
  const planks = Math.max(1, Math.min(8, Math.round(options.planks ?? 4)));
  const width = Math.max(64, Math.round(options.width ?? 768));
  const key = `${product.id}:${planks}:${width}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const { lengthMm, widthMm } = product.dimensions;
  const rowHeight = Math.max(8, Math.round(width * widthMm / lengthMm));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = rowHeight * planks;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('เบราว์เซอร์นี้ไม่รองรับการสร้างลายพื้น');
  for (let row = 0; row < planks; row++) {
    // Distinct boards: re-seed the material so grain, knots and tone vary per plank.
    const variant: ProductConfig = { ...product, seed: (product.seed + row * 7919) >>> 0 };
    const pixels = product.surface.family === 'wood' ? generateWoodPixels(variant, width, rowHeight) : generateMarblePixels(variant, width, rowHeight);
    const image = ctx.createImageData(width, rowHeight);
    image.data.set(pixels.albedo);
    ctx.putImageData(image, 0, row * rowHeight);
  }
  const atlas: PlankAtlas = {
    canvas, planks, productId: product.id,
    plankSize: [lengthMm / 1000, widthMm / 1000],
    dispose() { cache.delete(key); canvas.width = canvas.height = 1; },
  };
  cache.set(key, atlas);
  return atlas;
}

export function disposePlankAtlases(): void {
  for (const atlas of [...cache.values()]) atlas.dispose();
}
