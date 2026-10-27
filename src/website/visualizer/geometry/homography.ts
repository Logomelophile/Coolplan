/**
 * Planar geometry for the floor visualizer. A room floor is one plane, so the
 * mapping between floor coordinates (metres) and image pixels is a single 3x3
 * homography. Everything here is dependency-free so it runs in unit tests,
 * the precompute script, the main thread and workers alike.
 */
export type Mat3 = [number, number, number, number, number, number, number, number, number];
export type Vec3 = [number, number, number];
export interface Point { x: number; y: number }

export const identity = (): Mat3 => [1, 0, 0, 0, 1, 0, 0, 0, 1];

export function multiply(a: Mat3, b: Mat3): Mat3 {
  const out = new Array(9).fill(0) as Mat3;
  for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
    out[row * 3 + col] = a[row * 3] * b[col] + a[row * 3 + 1] * b[3 + col] + a[row * 3 + 2] * b[6 + col];
  }
  return out;
}

export function invert(m: Mat3): Mat3 | null {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return null;
  const inv = 1 / det;
  return [
    A * inv, -(b * i - c * h) * inv, (b * f - c * e) * inv,
    B * inv, (a * i - c * g) * inv, -(a * f - c * d) * inv,
    C * inv, -(a * h - b * g) * inv, (a * e - b * d) * inv,
  ];
}

export function transform(m: Mat3, x: number, y: number): Point | null {
  const w = m[6] * x + m[7] * y + m[8];
  if (!Number.isFinite(w) || Math.abs(w) < 1e-12) return null;
  return { x: (m[0] * x + m[1] * y + m[2]) / w, y: (m[3] * x + m[4] * y + m[5]) / w };
}

export const scaled = (sx: number, sy: number): Mat3 => [sx, 0, 0, 0, sy, 0, 0, 0, 1];

const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const normalize = (a: Vec3): Vec3 => {
  const length = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / length, a[1] / length, a[2] / length];
};

/**
 * Homography sending the unit square (0,0),(1,0),(1,1),(0,1) to four image
 * points given in that order (clockwise from the top-left). Same derivation as
 * the classic projective quad mapping; returns null for degenerate quads.
 */
export function homographyFromQuad(quad: readonly Point[]): Mat3 | null {
  if (quad.length !== 4) return null;
  const [p0, p1, p2, p3] = quad;
  const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y, dy3 = p0.y - p1.y + p2.y - p3.y;
  const denominator = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(denominator) < 1e-12) return null;
  const g = (dx3 * dy2 - dx2 * dy3) / denominator;
  const h = (dx1 * dy3 - dx3 * dy1) / denominator;
  const a = p1.x - p0.x + g * p1.x, b = p3.x - p0.x + h * p3.x, c = p0.x;
  const d = p1.y - p0.y + g * p1.y, e = p3.y - p0.y + h * p3.y, f = p0.y;
  return [a, b, c, d, e, f, g, h, 1];
}

export interface FloorFrameOptions {
  /** Image size in pixels (the coordinate frame the homography maps into). */
  width: number;
  height: number;
  /** Horizon line height as a fraction of image height (camera roll assumed zero). */
  horizonY: number;
  /** Focal length as a multiple of image width; phone cameras sit around 0.8–1.0. */
  focal?: number;
  /** A pixel known to lie on the floor (normalized 0..1); becomes the texture origin. */
  anchor: Point;
  /** Camera height above the floor in metres; fixes the physical scale of the planks. */
  cameraHeight?: number;
  /** Plank direction rotation around the floor normal, radians. */
  rotation?: number;
}

export interface FloorFrame {
  /** (s, t, 1) metres on the floor -> homogeneous pixel. */
  H: Mat3;
  /** Pixel -> (s, t) metres. */
  Hinv: Mat3;
  normal: Vec3;
  horizonY: number;
}

/**
 * Builds a metric floor frame from a horizon line and a floor anchor, following
 * the design document (§5.5). The floor normal is n ∝ Kᵀ·l for the horizon line
 * l, the anchor ray is intersected with the plane n·P = cameraHeight, and the
 * plank axis is the camera forward direction projected onto the plane.
 */
export function floorFrame(options: FloorFrameOptions): FloorFrame | null {
  const { width, height, anchor } = options;
  const focal = (options.focal ?? 0.85) * width;
  const cameraHeight = options.cameraHeight ?? 1.5;
  const rotation = options.rotation ?? 0;
  const cx = width / 2, cy = height / 2;
  const horizonPx = options.horizonY * height;
  // Horizon line y = horizonPx -> l = (0, 1, -horizonPx); n ∝ Kᵀ l = (0, f, cy - horizonPx).
  const n = normalize([0, focal, cy - horizonPx]);
  if (n[1] <= 0) return null;
  const ray = (px: number, py: number): Vec3 => [(px - cx) / focal, (py - cy) / focal, 1];
  const anchorRay = ray(anchor.x * width, anchor.y * height);
  const depth = dot(n, anchorRay);
  if (depth <= 1e-6) return null; // anchor above the horizon: not on the floor
  const P0: Vec3 = [anchorRay[0] * cameraHeight / depth, anchorRay[1] * cameraHeight / depth, anchorRay[2] * cameraHeight / depth];
  const forward: Vec3 = [0, 0, 1];
  const fn = dot(forward, n);
  let u = normalize([forward[0] - fn * n[0], forward[1] - fn * n[1], forward[2] - fn * n[2]]);
  const side = cross(n, u);
  const c = Math.cos(rotation), s = Math.sin(rotation);
  u = [u[0] * c + side[0] * s, u[1] * c + side[1] * s, u[2] * c + side[2] * s];
  const v = cross(n, u);
  const K: Mat3 = [focal, 0, cx, 0, focal, cy, 0, 0, 1];
  const frame: Mat3 = [u[0], v[0], P0[0], u[1], v[1], P0[1], u[2], v[2], P0[2]];
  const H = multiply(K, frame);
  const Hinv = invert(H);
  if (!Hinv) return null;
  return { H, Hinv, normal: n, horizonY: options.horizonY };
}

/**
 * Rotation (radians, around the floor normal) that turns the frame's plank axis
 * towards the floor direction whose vanishing point is the given pixel. Lets the
 * planks follow the room's dominant seam direction found by `estimateHorizon`.
 */
export function rotationTowards(options: FloorFrameOptions, vanishingPixel: Point): number {
  const focal = (options.focal ?? 0.85) * options.width;
  const cx = options.width / 2, cy = options.height / 2;
  const horizonPx = options.horizonY * options.height;
  const n = normalize([0, focal, cy - horizonPx]);
  const forward: Vec3 = [0, 0, 1];
  const fn = dot(forward, n);
  const u = normalize([forward[0] - fn * n[0], forward[1] - fn * n[1], forward[2] - fn * n[2]]);
  const ray: Vec3 = [(vanishingPixel.x - cx) / focal, (vanishingPixel.y - cy) / focal, 1];
  const rn = dot(ray, n);
  const d = normalize([ray[0] - rn * n[0], ray[1] - rn * n[1], ray[2] - rn * n[2]]);
  const angle = Math.atan2(dot(cross(u, d), n), dot(u, d));
  // Planks have no front/back: fold into (-90°, 90°].
  return ((angle + Math.PI / 2) % Math.PI + Math.PI) % Math.PI - Math.PI / 2;
}

/** Whether a pixel maps to a point in front of the camera on the floor plane. */
export function pixelOnFloor(frame: FloorFrame, x: number, y: number): boolean {
  const w = frame.Hinv[6] * x + frame.Hinv[7] * y + frame.Hinv[8];
  return w > 1e-9;
}
