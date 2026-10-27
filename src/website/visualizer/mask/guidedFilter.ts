/**
 * Guided image filtering (He, Sun, Tang 2010/2013), single-channel guide.
 * Turns a coarse floor probability map into an alpha matte that snaps to the
 * edges of the photograph. O(N) via box filters; pure arrays so it runs in
 * Node (precompute) and in browser workers alike.
 */

/** Separable box blur with edge clamping, in place on a scratch buffer. */
export function boxBlur(source: Float32Array, width: number, height: number, radius: number, target = new Float32Array(width * height)): Float32Array {
  const r = Math.max(0, Math.round(radius));
  if (r === 0) { target.set(source); return target; }
  const temp = new Float32Array(width * height);
  const window = 2 * r + 1;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    let sum = 0;
    for (let k = -r; k <= r; k++) sum += source[row + Math.min(width - 1, Math.max(0, k))];
    for (let x = 0; x < width; x++) {
      temp[row + x] = sum / window;
      sum += source[row + Math.min(width - 1, x + r + 1)] - source[row + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let k = -r; k <= r; k++) sum += temp[Math.min(height - 1, Math.max(0, k)) * width + x];
    for (let y = 0; y < height; y++) {
      target[y * width + x] = sum / window;
      sum += temp[Math.min(height - 1, y + r + 1) * width + x] - temp[Math.max(0, y - r) * width + x];
    }
  }
  return target;
}

export interface GuidedFilterOptions {
  radius?: number;
  /** Regularisation; smaller values follow guide edges more aggressively. */
  epsilon?: number;
}

/**
 * @param guide   luminance 0..1, width*height
 * @param input   coarse mask 0..1, width*height (already resized to the guide)
 * @returns       filtered mask, same size, clamped to 0..1
 */
export function guidedFilter(guide: Float32Array, input: Float32Array, width: number, height: number, options: GuidedFilterOptions = {}): Float32Array {
  const radius = options.radius ?? 8;
  const epsilon = options.epsilon ?? 1e-3;
  const n = width * height;
  if (guide.length !== n || input.length !== n) throw new Error('guidedFilter: guide and input must match the given size.');
  const meanI = boxBlur(guide, width, height, radius);
  const meanP = boxBlur(input, width, height, radius);
  const II = new Float32Array(n), IP = new Float32Array(n);
  for (let i = 0; i < n; i++) { II[i] = guide[i] * guide[i]; IP[i] = guide[i] * input[i]; }
  const corrI = boxBlur(II, width, height, radius);
  const corrIP = boxBlur(IP, width, height, radius);
  const a = new Float32Array(n), b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const varI = corrI[i] - meanI[i] * meanI[i];
    const covIP = corrIP[i] - meanI[i] * meanP[i];
    a[i] = covIP / (varI + epsilon);
    b[i] = meanP[i] - a[i] * meanI[i];
  }
  const meanA = boxBlur(a, width, height, radius);
  const meanB = boxBlur(b, width, height, radius);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.min(1, Math.max(0, meanA[i] * guide[i] + meanB[i]));
  return out;
}

/** Bilinear resize of a single-channel map. */
export function resizeMap(source: Float32Array, sw: number, sh: number, dw: number, dh: number): Float32Array {
  const out = new Float32Array(dw * dh);
  for (let y = 0; y < dh; y++) {
    const sy = Math.min(sh - 1, Math.max(0, (y + .5) * sh / dh - .5));
    const y0 = Math.floor(sy), y1 = Math.min(sh - 1, y0 + 1), fy = sy - y0;
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(sw - 1, Math.max(0, (x + .5) * sw / dw - .5));
      const x0 = Math.floor(sx), x1 = Math.min(sw - 1, x0 + 1), fx = sx - x0;
      out[y * dw + x] = (source[y0 * sw + x0] * (1 - fx) + source[y0 * sw + x1] * fx) * (1 - fy) + (source[y1 * sw + x0] * (1 - fx) + source[y1 * sw + x1] * fx) * fy;
    }
  }
  return out;
}

/** Smoothstep contrast so the matte is crisp without hard aliasing. */
export function sharpenMatte(mask: Float32Array, low = .35, high = .65): Float32Array {
  const out = new Float32Array(mask.length);
  for (let i = 0; i < mask.length; i++) {
    const t = Math.min(1, Math.max(0, (mask[i] - low) / (high - low)));
    out[i] = t * t * (3 - 2 * t);
  }
  return out;
}

/** Rec. 601 luminance from RGBA bytes, 0..1. */
export function luminanceOf(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): Float32Array {
  const out = new Float32Array(width * height);
  for (let i = 0; i < out.length; i++) out[i] = (rgba[i * 4] * .299 + rgba[i * 4 + 1] * .587 + rgba[i * 4 + 2] * .114) / 255;
  return out;
}
