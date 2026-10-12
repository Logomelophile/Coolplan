import type { ProductConfig } from '../types';
import { clamp, hash2, noise2 } from './noise';
import { allocatePixels, type SurfacePixels } from './types';

export const BACKING_PITCH_MM = 2.5;

/** IXPE cells and the diagonal tooling are evaluated in physical millimetres. */
export function generateBackingPixels(product: ProductConfig, width: number, height: number): SurfacePixels {
  const result = allocatePixels(width, height);
  const { dimensions, seed } = product;
  const baseRoughness = product.layers.find((layer) => layer.material.kind === 'backing')?.material.roughness ?? 0.85;
  const pitchMm = BACKING_PITCH_MM;
  for (let y = 0; y < height; y++) {
    const py = y / (height - 1) * dimensions.widthMm;
    for (let x = 0; x < width; x++) {
      const px = x / (width - 1) * dimensions.lengthMm;
      const i = y * width + x;
      const foam = noise2(px * 2.1, py * 2.1, seed + 151);
      let groove: number;
      let heightMm: number;
      if (product.backingPattern === 'crosshatch') {
        const d1 = Math.abs(((px + py) / Math.SQRT2 / pitchMm + 0.5) % 1 - 0.5);
        const d2 = Math.abs(((px - py) / Math.SQRT2 / pitchMm + 2000.5) % 1 - 0.5);
        const ridge1 = Math.exp(-d1 * d1 * 110);
        const ridge2 = Math.exp(-d2 * d2 * 110);
        groove = Math.max(ridge1, ridge2);
        heightMm = -groove * 0.18 + (foam - 0.5) * 0.01;
      } else {
        const cells = noise2(px / 1.15, py / 1.15, seed + 191);
        const small = noise2(px / 0.65 + 21.6, py / 0.65 + 9.7, seed + 239);
        groove = Math.pow(clamp(1 - cells * 0.75 - small * 0.25), 1.5);
        heightMm = (cells * 0.72 + small * 0.28) * 0.085 + foam * 0.008;
      }
      const value = (product.backingPattern === 'crosshatch' ? 30 - groove * 19 : 24 - groove * 7)
        + (foam - 0.5) * 4 + (hash2(x, y, seed + 271) - 0.5) * 1.2;
      const j = i * 4;
      result.albedo[j] = value;
      result.albedo[j + 1] = value;
      result.albedo[j + 2] = value;
      result.albedo[j + 3] = 255;
      result.heights[i] = heightMm;
      result.roughness[i] = clamp(baseRoughness - 0.05 + groove * 0.12 + (foam - 0.5) * 0.02) * 255;
    }
  }
  return result;
}
