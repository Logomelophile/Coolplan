/**
 * Horizon estimation from a single photo (design §5.5, method C2).
 * Sobel edges inside (a dilation of) the floor matte → gradient-oriented Hough
 * lines → RANSAC-style vanishing point from converging line pairs → horizon
 * y = VP.y under the zero-roll assumption. Pure arrays; runs in a worker.
 */
export interface HorizonEstimate {
  /** Horizon height as a fraction of image height. */
  horizonY: number;
  /** 0..1, share of line votes explained by the chosen vanishing point. */
  confidence: number;
  /** Vanishing point in normalized image coordinates (x may fall outside 0..1). */
  vanishingPoint: { x: number; y: number } | null;
  lines: number;
  inliers: number;
}

interface HoughLine { theta: number; rho: number; votes: number }

export interface HorizonOptions {
  /** Downscaled working width for edge detection. */
  workWidth?: number;
  /** Pixels (in the downscaled frame) to grow the floor matte before looking for edges. */
  dilate?: number;
  minLines?: number;
}

export function downscale(source: Float32Array, width: number, height: number, targetWidth: number): { data: Float32Array; width: number; height: number } {
  const scale = Math.min(1, targetWidth / width);
  const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
  if (w === width && h === height) return { data: source, width, height };
  const data = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * height / h), y1 = Math.max(y0 + 1, Math.floor((y + 1) * height / h));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * width / w), x1 = Math.max(x0 + 1, Math.floor((x + 1) * width / w));
      let sum = 0, n = 0;
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { sum += source[yy * width + xx]; n++; }
      data[y * w + x] = sum / n;
    }
  }
  return { data, width: w, height: h };
}

function houghLines(lum: Float32Array, region: Uint8Array | null, width: number, height: number, maxLines: number): HoughLine[] {
  const n = width * height;
  const magnitude = new Float32Array(n), angle = new Float32Array(n);
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const i = y * width + x;
    if (region && !region[i]) continue;
    const gx = -lum[i - width - 1] - 2 * lum[i - 1] - lum[i + width - 1] + lum[i - width + 1] + 2 * lum[i + 1] + lum[i + width + 1];
    const gy = -lum[i - width - 1] - 2 * lum[i - width] - lum[i - width + 1] + lum[i + width - 1] + 2 * lum[i + width] + lum[i + width + 1];
    magnitude[i] = Math.hypot(gx, gy);
    angle[i] = Math.atan2(gy, gx);
  }
  // Threshold at the 92nd percentile of non-zero magnitudes.
  const sorted = Array.from(magnitude).filter(v => v > 0).sort((a, b) => a - b);
  if (sorted.length < 50) return [];
  const threshold = Math.max(sorted[Math.floor(sorted.length * .92)], .05);
  const thetaSteps = 180, rhoStep = 1.5;
  const diagonal = Math.hypot(width, height), rhoCount = Math.ceil(2 * diagonal / rhoStep);
  const accumulator = new Float32Array(thetaSteps * rhoCount);
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const i = y * width + x;
    if (magnitude[i] < threshold) continue;
    // Non-maximum suppression along the gradient direction keeps edges one pixel wide.
    const dx = Math.round(Math.cos(angle[i])), dy = Math.round(Math.sin(angle[i]));
    if (magnitude[i] < magnitude[i + dy * width + dx] || magnitude[i] < magnitude[i - dy * width - dx]) continue;
    const normal = ((angle[i] * 180 / Math.PI) % 180 + 180) % 180;
    for (let d = -6; d <= 6; d++) {
      const theta = ((Math.round(normal) + d) % 180 + 180) % 180;
      const rad = theta * Math.PI / 180;
      const rho = x * Math.cos(rad) + y * Math.sin(rad);
      const r = Math.round((rho + diagonal) / rhoStep);
      if (r >= 0 && r < rhoCount) accumulator[theta * rhoCount + r] += 1 - Math.abs(d) / 8;
    }
  }
  const peaks: HoughLine[] = [];
  const minVotes = Math.max(8, Math.min(width, height) * .08);
  for (let theta = 0; theta < thetaSteps; theta++) for (let r = 0; r < rhoCount; r++) {
    const votes = accumulator[theta * rhoCount + r];
    if (votes < minVotes) continue;
    let isPeak = true;
    for (let dt = -3; dt <= 3 && isPeak; dt++) for (let dr = -3; dr <= 3; dr++) {
      if (!dt && !dr) continue;
      const t = ((theta + dt) % thetaSteps + thetaSteps) % thetaSteps, rr = r + dr;
      if (rr < 0 || rr >= rhoCount) continue;
      const other = accumulator[t * rhoCount + rr];
      if (other > votes || (other === votes && (dt < 0 || (dt === 0 && dr < 0)))) { isPeak = false; break; }
    }
    if (isPeak) peaks.push({ theta, rho: r * rhoStep - diagonal, votes });
  }
  peaks.sort((a, b) => b.votes - a.votes);
  return peaks.slice(0, maxLines);
}

const intersect = (a: HoughLine, b: HoughLine): { x: number; y: number } | null => {
  const ta = a.theta * Math.PI / 180, tb = b.theta * Math.PI / 180;
  const det = Math.cos(ta) * Math.sin(tb) - Math.sin(ta) * Math.cos(tb);
  if (Math.abs(det) < 1e-6) return null;
  return { x: (a.rho * Math.sin(tb) - b.rho * Math.sin(ta)) / det, y: (b.rho * Math.cos(ta) - a.rho * Math.cos(tb)) / det };
};

/**
 * @param lum   luminance 0..1 at full working resolution
 * @param mask  floor alpha 0..1 (same size) or null for the whole image
 */
export function estimateHorizon(lum: Float32Array, mask: Float32Array | null, width: number, height: number, options: HorizonOptions = {}): HorizonEstimate | null {
  const workWidth = options.workWidth ?? 480;
  const small = downscale(lum, width, height, workWidth);
  const w = small.width, h = small.height;
  let region: Uint8Array | null = null;
  let maskTop = 0;
  if (mask) {
    const m = downscale(mask, width, height, workWidth);
    const radius = options.dilate ?? Math.round(w * .04);
    region = new Uint8Array(w * h);
    const rows: number[] = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m.data[y * w + x] > .5) { region[y * w + x] = 1; rows.push(y); }
    if (!rows.length) return null;
    maskTop = Math.min(...rows) / h;
    // Dilate so the floor/wall boundary and skirting lines are included.
    const grown = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!region[y * w + x]) continue;
      for (let dy = -radius; dy <= radius; dy += 2) {
        const yy = y + dy; if (yy < 0 || yy >= h) continue;
        for (let dx = -radius; dx <= radius; dx += 2) { const xx = x + dx; if (xx >= 0 && xx < w) grown[yy * w + xx] = 1; }
      }
    }
    region = grown;
  }
  const lines = houghLines(small.data, region, w, h, 40)
    // Drop near-vertical lines (door frames, furniture legs): normal angle near 0°/180°.
    .filter(line => line.theta > 12 && line.theta < 168);
  const minLines = options.minLines ?? 3;
  const slanted = lines.filter(line => Math.abs(line.theta - 90) > 6);
  if (slanted.length < 2) return null;
  const totalVotes = lines.reduce((sum, line) => sum + line.votes, 0);
  let best: { point: { x: number; y: number }; score: number; inliers: number } | null = null;
  const tolerance = Math.max(2.5, w * .008);
  for (let i = 0; i < slanted.length; i++) for (let j = i + 1; j < slanted.length; j++) {
    if (Math.abs(slanted[i].theta - slanted[j].theta) < 4) continue;
    const point = intersect(slanted[i], slanted[j]);
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    // The horizon of a floor seen from above must lie above the floor region and within a sane band.
    if (point.y < -h * .5 || point.y > h * .95 || point.y / h > maskTop + .02) continue;
    let score = 0, inliers = 0;
    for (const line of slanted) {
      const rad = line.theta * Math.PI / 180;
      const distance = Math.abs(point.x * Math.cos(rad) + point.y * Math.sin(rad) - line.rho);
      if (distance <= tolerance) { score += line.votes; inliers++; }
    }
    if (inliers >= minLines && (!best || score > best.score)) best = { point, score, inliers };
  }
  if (!best) return null;
  const confidence = Math.min(1, best.score / Math.max(1e-6, totalVotes));
  return {
    horizonY: Math.min(.95, Math.max(-.5, best.point.y / h)),
    confidence,
    vanishingPoint: { x: best.point.x / w, y: best.point.y / h },
    lines: lines.length,
    inliers: best.inliers,
  };
}
