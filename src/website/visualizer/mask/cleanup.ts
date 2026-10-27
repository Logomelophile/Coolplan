/** Connected-component cleanup: keeps the dominant floor region(s) and drops stray blobs (tabletops, cushions). */
export function keepMajorComponents(mask: Float32Array, width: number, height: number, options: { threshold?: number; keepRatio?: number; step?: number } = {}): Float32Array {
  const threshold = options.threshold ?? .5, keepRatio = options.keepRatio ?? .08, step = options.step ?? 4;
  const w = Math.ceil(width / step), h = Math.ceil(height / step);
  const binary = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) binary[y * w + x] = mask[Math.min(height - 1, y * step) * width + Math.min(width - 1, x * step)] > threshold ? 1 : 0;
  const labels = new Int32Array(w * h).fill(-1);
  const areas: number[] = [];
  const stack: number[] = [];
  for (let start = 0; start < w * h; start++) {
    if (!binary[start] || labels[start] >= 0) continue;
    const label = areas.length;
    let area = 0;
    stack.push(start);
    labels[start] = label;
    while (stack.length) {
      const i = stack.pop()!;
      area++;
      const x = i % w, y = (i - x) / w;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = yy * w + xx;
        if (binary[j] && labels[j] < 0) { labels[j] = label; stack.push(j); }
      }
    }
    areas.push(area);
  }
  if (areas.length <= 1) return mask;
  const largest = Math.max(...areas);
  const keep = areas.map(area => area >= largest * keepRatio);
  const out = new Float32Array(mask.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const label = labels[Math.min(h - 1, Math.floor(y / step)) * w + Math.min(w - 1, Math.floor(x / step))];
    const i = y * width + x;
    out[i] = label >= 0 && !keep[label] ? 0 : mask[i];
  }
  return out;
}
