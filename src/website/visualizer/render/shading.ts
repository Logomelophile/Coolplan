import { boxBlur } from '../mask/guidedFilter';

/**
 * Shading transfer (design §5.7). Splits the original floor's light into
 *  - detail: high-frequency ratio L / blur(L): contact shadows, furniture AO, seams
 *  - tone:   low-frequency illumination relative to the floor mean (window falloff)
 * Both are computed only from pixels inside the floor matte (mask-aware blur), so
 * furniture and walls never bleed into the floor lighting.
 */
export interface ShadingMap {
  width: number;
  height: number;
  /** RGBA bytes: R = detail/2, G = tone/2, B unused, A = 255. Ready for a texture upload. */
  rgba: Uint8ClampedArray;
  /** Mean linear colour of the original floor, 0..1. */
  meanRGB: [number, number, number];
  meanLuminance: number;
}

const toLinear = (byte: number): number => {
  const c = byte / 255;
  return c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4);
};

export interface ShadingOptions {
  /** Blur radius as a fraction of the image width (default 4%). */
  radiusFraction?: number;
  minDetail?: number;
  maxDetail?: number;
}

export function computeShading(photo: Uint8ClampedArray, alpha: Float32Array, width: number, height: number, options: ShadingOptions = {}): ShadingMap {
  const n = width * height;
  if (photo.length !== n * 4 || alpha.length !== n) throw new Error('computeShading: buffer sizes do not match.');
  const radius = Math.max(2, Math.round((options.radiusFraction ?? .04) * width));
  const minDetail = options.minDetail ?? .3, maxDetail = options.maxDetail ?? 1.8;
  const lum = new Float32Array(n), weight = new Float32Array(n);
  let sumR = 0, sumG = 0, sumB = 0, sumL = 0, sumW = 0;
  for (let i = 0; i < n; i++) {
    const r = toLinear(photo[i * 4]), g = toLinear(photo[i * 4 + 1]), b = toLinear(photo[i * 4 + 2]);
    const l = .2126 * r + .7152 * g + .0722 * b;
    const w = alpha[i] > .5 ? 1 : 0;
    lum[i] = l * w;
    weight[i] = w;
    if (w) { sumR += r; sumG += g; sumB += b; sumL += l; sumW++; }
  }
  const meanL = sumW ? sumL / sumW : .5;
  // Two box passes approximate a Gaussian; normalised convolution ignores non-floor pixels.
  const blurL = boxBlur(boxBlur(lum, width, height, radius), width, height, radius);
  const blurW = boxBlur(boxBlur(weight, width, height, radius), width, height, radius);
  const rgba = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    const base = blurW[i] > 1e-4 ? blurL[i] / blurW[i] : meanL;
    const own = weight[i] ? lum[i] : base;
    const detail = Math.min(maxDetail, Math.max(minDetail, own / Math.max(base, 1e-3)));
    const tone = Math.min(2, Math.max(.1, base / Math.max(meanL, 1e-3)));
    rgba[i * 4] = detail * 127.5;
    rgba[i * 4 + 1] = tone * 127.5;
    rgba[i * 4 + 2] = 0;
    rgba[i * 4 + 3] = 255;
  }
  return {
    width, height, rgba,
    meanRGB: sumW ? [sumR / sumW, sumG / sumW, sumB / sumW] : [.5, .5, .5],
    meanLuminance: meanL,
  };
}
