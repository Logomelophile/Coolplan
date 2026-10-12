import type { ProductConfig } from '../types';
import { clamp, fbm, hash2, noise2, NoiseField, smoothstep } from './noise';
import { allocatePixels, hexToRgb, type SurfacePixels } from './types';

/** Domain-warped mineral boundaries with branching hairline veins and diffuse clouds. */
export function generateMarblePixels(product: ProductConfig, width: number, height: number): SurfacePixels {
  const result = allocatePixels(width, height);
  const { seed, surface } = product;
  const base = hexToRgb(surface.palette.base);
  const veinColor = hexToRgb(surface.palette.light);
  const deepColor = hexToRgb(surface.palette.dark);
  const speckleColor = hexToRgb(surface.palette.speckle ?? surface.palette.dark);
  const warpX = new NoiseField(256, 128, (u, v) => fbm(u * 8, v * 2.8, seed + 13));
  const warpY = new NoiseField(256, 128, (u, v) => fbm(u * 8, v * 2.8, seed + 41));
  const cloud = new NoiseField(384, 192, (u, v) => fbm(u * 19, v * 7, seed + 89));
  const branching = new NoiseField(384, 192, (u, v) => fbm(u * 29, v * 11, seed + 167));

  for (let y = 0; y < height; y++) {
    const v = y / (height - 1);
    for (let x = 0; x < width; x++) {
      const u = x / (width - 1);
      const i = y * width + x;
      const warpedX = u * 10.6 + (warpX.sample(u, v) - 0.5) * 1.5;
      const warpedY = v * 3.4 + (warpY.sample(u, v) - 0.5) * 1.35;
      const mineral = fbm(warpedX + warpedY * 0.7, warpedY - warpedX * 0.28, seed + 221, 4);
      const boundary = Math.abs(mineral - 0.5);
      const hairline = 1 - smoothstep(0.001, 0.006, boundary);
      const halo = 1 - smoothstep(0.008, 0.035, boundary);
      const interruption = smoothstep(0.28, 0.7, branching.sample(u, v));
      const vein = hairline * (0.12 + interruption * 0.55) + halo * 0.18;
      const deep = Math.pow(hairline, 2) * interruption * 0.25;
      const cloudValue = cloud.sample(u, v);
      const cloudShade = smoothstep(0.42, 0.82, cloudValue) * 0.12;
      const micro = hash2(x, y, seed + 397);
      const speckle = micro > 0.9988 && cloudValue > 0.4 ? (micro - 0.9988) / 0.0012 * 0.48 : 0;
      const j = i * 4;
      for (let c = 0; c < 3; c++) {
        const mineralTint = base[c] + (veinColor[c] - base[c]) * clamp(vein + cloudShade);
        const deepTint = mineralTint + (deepColor[c] - mineralTint) * deep;
        result.albedo[j + c] = deepTint + (speckleColor[c] - deepTint) * speckle + (micro - 0.5) * 1.6;
      }
      result.albedo[j + 3] = 255;
      // Printed marble stays optically flat: veins are colour, never carved grooves.
      result.heights[i] = 0;
      result.roughness[i] = clamp(surface.roughness + cloudShade * 0.07 + (micro - 0.5) * 0.012) * 255;
    }
  }
  return result;
}
