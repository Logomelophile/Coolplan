/**
 * Floor-plane consistency from relative inverse depth (design §5.5, method C3).
 *
 * Depth Anything returns affine-invariant inverse depth d ≈ a/Z + b. For points
 * on a plane n·P = h, 1/Z is linear in normalized image coordinates, so d is
 * linear too: d = αx' + βy' + γ. Fitting that plane (RANSAC) over the floor
 * matte needs no metric scale, and residuals single out objects standing on the
 * floor (closer than the plane → larger d), which the semantic mask often misses.
 */
import { resizeMap, boxBlur } from '../mask/guidedFilter';

export interface DepthPlaneResult {
  /** Matte with non-planar pixels (objects on the floor) removed. */
  alpha: Float32Array;
  /** Share of floor samples consistent with one plane (0..1). */
  planarity: number;
  /** Pixels removed as occluders, as a fraction of the original matte. */
  removed: number;
  plane: { alpha: number; beta: number; gamma: number; threshold: number } | null;
}

export interface DepthPlaneOptions {
  focal?: number;
  iterations?: number;
  /** Inlier threshold as a fraction of the robust depth range over the floor. */
  inlierFraction?: number;
  /** Multiples of the inlier threshold above which a pixel counts as an occluder. */
  occluderFactor?: number;
}

function solve3(rows: number[][], rhs: number[]): [number, number, number] | null {
  const [a, b, c] = rows;
  const det = a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
  if (Math.abs(det) < 1e-12) return null;
  const d = (m: number[][]): number => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const col = (k: number): number[][] => rows.map((row, i) => row.map((v, j) => j === k ? rhs[i] : v));
  return [d(col(0)) / det, d(col(1)) / det, d(col(2)) / det];
}

/** Least squares d = αx + βy + γ over the given samples. */
function leastSquares(xs: Float32Array, ys: Float32Array, ds: Float32Array, use: Uint8Array): [number, number, number] | null {
  let sxx = 0, sxy = 0, sx = 0, syy = 0, sy = 0, n = 0, sxd = 0, syd = 0, sd = 0;
  for (let i = 0; i < xs.length; i++) {
    if (!use[i]) continue;
    const x = xs[i], y = ys[i], d = ds[i];
    sxx += x * x; sxy += x * y; sx += x; syy += y * y; sy += y; n++; sxd += x * d; syd += y * d; sd += d;
  }
  if (n < 3) return null;
  return solve3([[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, n]], [sxd, syd, sd]);
}

export function refineWithDepth(depth: Float32Array, dw: number, dh: number, alpha: Float32Array, width: number, height: number, options: DepthPlaneOptions = {}): DepthPlaneResult {
  const focal = (options.focal ?? .85) * width;
  const iterations = options.iterations ?? 200;
  const inlierFraction = options.inlierFraction ?? .035;
  const occluderFactor = options.occluderFactor ?? 2.5;
  const d = dw === width && dh === height ? depth : resizeMap(depth, dw, dh, width, height);
  const cx = width / 2, cy = height / 2;
  // Subsample floor pixels for fitting.
  const step = Math.max(2, Math.round(Math.sqrt((width * height) / 20000)));
  const xs: number[] = [], ys: number[] = [], ds: number[] = [];
  for (let y = 0; y < height; y += step) for (let x = 0; x < width; x += step) {
    const i = y * width + x;
    if (alpha[i] > .8) { xs.push((x - cx) / focal); ys.push((y - cy) / focal); ds.push(d[i]); }
  }
  const n = xs.length;
  const fail: DepthPlaneResult = { alpha, planarity: 0, removed: 0, plane: null };
  if (n < 50) return fail;
  const X = Float32Array.from(xs), Y = Float32Array.from(ys), D = Float32Array.from(ds);
  const sorted = Float32Array.from(ds).sort();
  const range = sorted[Math.floor(n * .95)] - sorted[Math.floor(n * .05)];
  const threshold = Math.max(1e-4, range * inlierFraction);
  let seed = 12345;
  const random = (): number => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  let best: { plane: [number, number, number]; inliers: number } | null = null;
  for (let it = 0; it < iterations; it++) {
    const i = Math.floor(random() * n), j = Math.floor(random() * n), k = Math.floor(random() * n);
    if (i === j || j === k || i === k) continue;
    const plane = solve3([[X[i], Y[i], 1], [X[j], Y[j], 1], [X[k], Y[k], 1]], [D[i], D[j], D[k]]);
    if (!plane) continue;
    let inliers = 0;
    for (let s = 0; s < n; s++) if (Math.abs(plane[0] * X[s] + plane[1] * Y[s] + plane[2] - D[s]) <= threshold) inliers++;
    if (!best || inliers > best.inliers) best = { plane, inliers };
  }
  if (!best || best.inliers < n * .3) return fail;
  const use = new Uint8Array(n);
  for (let s = 0; s < n; s++) use[s] = Math.abs(best.plane[0] * X[s] + best.plane[1] * Y[s] + best.plane[2] - D[s]) <= threshold ? 1 : 0;
  const plane = leastSquares(X, Y, D, use) ?? best.plane;
  const planarity = best.inliers / n;
  // Occluders: pixels within the matte that are clearly nearer than the plane.
  const removal = new Float32Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x;
    if (alpha[i] < .05) continue;
    const predicted = plane[0] * (x - cx) / focal + plane[1] * (y - cy) / focal + plane[2];
    const residual = d[i] - predicted;
    const t = (residual - threshold * occluderFactor) / (threshold * occluderFactor);
    removal[i] = t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
  }
  const smooth = boxBlur(removal, width, height, Math.max(1, Math.round(width * .003)));
  const out = new Float32Array(width * height);
  let before = 0, after = 0;
  for (let i = 0; i < out.length; i++) {
    out[i] = alpha[i] * (1 - Math.min(1, smooth[i] * 1.2));
    before += alpha[i];
    after += out[i];
  }
  return { alpha: out, planarity, removed: before ? (before - after) / before : 0, plane: { alpha: plane[0], beta: plane[1], gamma: plane[2], threshold } };
}
