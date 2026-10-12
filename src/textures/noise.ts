/** Small deterministic noise primitives shared by both surface families. */
export function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

export function randomSequence(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function noise2(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

export function fbm(x: number, y: number, seed: number, octaves = 4): number {
  let amplitude = 0.5;
  let sum = 0;
  let weight = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise2(x, y, seed + i * 113) * amplitude;
    weight += amplitude;
    x = x * 2.031 + 7.1;
    y = y * 2.031 + 11.7;
    amplitude *= 0.5;
  }
  return sum / weight;
}

export const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));
export const smoothstep = (min: number, max: number, value: number): number => {
  const t = clamp((value - min) / (max - min));
  return t * t * (3 - 2 * t);
};

/** Bilinear cache keeps full-resolution texture synthesis inexpensive. */
export class NoiseField {
  private readonly samples: Float32Array;
  constructor(private readonly width: number, private readonly height: number, build: (u: number, v: number) => number) {
    this.samples = new Float32Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) this.samples[y * width + x] = build(x / (width - 1), y / (height - 1));
    }
  }
  sample(u: number, v: number): number {
    const px = clamp(u) * (this.width - 1);
    const py = clamp(v) * (this.height - 1);
    const x = Math.min(Math.floor(px), this.width - 2);
    const y = Math.min(Math.floor(py), this.height - 2);
    const fx = px - x;
    const fy = py - y;
    const i = y * this.width + x;
    const a = this.samples[i];
    const b = this.samples[i + 1];
    const c = this.samples[i + this.width];
    const d = this.samples[i + this.width + 1];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
}
