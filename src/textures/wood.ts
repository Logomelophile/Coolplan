import type { ProductConfig } from '../types';
import { clamp, fbm, hash2, noise2, NoiseField, randomSequence, smoothstep } from './noise';
import { allocatePixels, hexToRgb, type SurfacePixels } from './types';

interface Knot { u: number; v: number; radiusU: number; radiusV: number; phase: number }

/**
 * A growth-ring field bends fine longitudinal vessels and ray flecks together.
 * Knots displace the same field, so the surrounding fibres wrap around them.
 * No photographs, tiled stripe images, or unseeded randomness are involved.
 */
export function generateWoodPixels(product: ProductConfig, width: number, height: number): SurfacePixels {
  const result = allocatePixels(width, height);
  const { surface, seed, dimensions } = product;
  const { grain } = surface;
  const base = hexToRgb(surface.palette.base);
  const light = hexToRgb(surface.palette.light);
  const dark = hexToRgb(surface.palette.dark);
  const random = randomSequence(seed);
  const pithDepth = 0.035 + random() * 0.025;
  const centerV = 0.42 + random() * 0.16;
  const knots: Knot[] = Array.from({ length: surface.knots.count }, (_, i) => ({
    u: (i + 0.5 + random() * 0.25) / Math.max(surface.knots.count, 1),
    v: 0.2 + random() * 0.6,
    radiusU: surface.knots.radius * dimensions.widthMm / dimensions.lengthMm * (2.5 + random()),
    radiusV: surface.knots.radius * (0.8 + random() * 0.4),
    phase: random() * 6.28,
  }));
  const drift = new NoiseField(192, 128, (u, v) => fbm(u * 4, v * 3.6, seed + 7));
  const curl = new NoiseField(256, 192, (u, v) => fbm(u * 13, v * 8, seed + 17, 3));
  const broad = new NoiseField(128, 128, (u, v) => fbm(u * 4.4, v * 8, seed + 31));
  const micro = new NoiseField(256, 256, (u, v) => fbm(u * 26, v * 110, seed + 57, 3));
  const scale = grain.scale;

  for (let y = 0; y < height; y++) {
    const v = y / (height - 1);
    for (let x = 0; x < width; x++) {
      const u = x / (width - 1);
      const i = y * width + x;
      const warp = (drift.sample(u, v) - 0.5) * 0.18 + (curl.sample(u, v) - 0.5) * 0.026;
      const localV = v + warp;
      // A tapered log cut produces open parabolic cathedrals: the pith remains
      // below the surface and its distance from the cut increases along the board.
      const dv = localV - centerV;
      const radius = Math.sqrt(dv * dv + pithDepth + u * 0.66);
      let growth = localV * (1 - grain.cathedral) + radius * grain.cathedral;
      let knotShade = 0;
      let knotRidge = 0;
      let knotCore = 0;
      for (const knot of knots) {
        if (knot.radiusU <= 0 || Math.abs(u - knot.u) > knot.radiusU * 6 || Math.abs(v - knot.v) > knot.radiusV * 6) continue;
        const ku = (u - knot.u) / knot.radiusU;
        const kv = (v - knot.v) / knot.radiusV;
        const r = Math.sqrt(ku * ku + kv * kv);
        const influence = Math.exp(-r * r * 0.16);
        // Continuous lateral flow pushes vessels aside, tapering into the grain at each end.
        growth += Math.sign(kv || 1) * knot.radiusV * 1.1 * influence * (1 - Math.exp(-Math.abs(kv) * 2));
        if (r < 2.8) {
          const irregular = r + noise2(ku * 1.4, kv * 0.8, seed + 87) * 0.35;
          const rings = Math.pow(0.5 + 0.5 * Math.sin(irregular * 16 + knot.phase), 6);
          const envelope = 1 - smoothstep(0.55, 2.7, r);
          knotShade += (rings * 0.3 + Math.exp(-r * r * 3.5) * 0.65) * envelope * surface.knots.strength;
          knotRidge += rings * envelope * 0.13;
          // Darker end-grain is confined to an irregular small knot centre.
          const coreShape = r + (noise2(ku * 2.7, kv * 2.1, seed + 97) - 0.5) * 0.24;
          knotCore = Math.max(knotCore, Math.exp(-coreShape * coreShape * 2.6) * surface.knots.strength);
        }
      }
      const phase = growth * 36 * scale;
      const band = noise2(u * 7.4, phase * 1.25, seed + 101);
      const rings = noise2(u * 3.1, phase * 3.3, seed + 193);
      const fine = noise2(u * 48, phase * 5.6, seed + 211);
      const fine2 = noise2(u * 112, phase * 8.3 + (micro.sample(u, v) - 0.5) * 0.7, seed + 229);
      // Cellular fibres continue through the broad earlywood at cathedral tips.
      const cellular = noise2(u * 72, localV * 190 * scale + radius * grain.cathedral * 4, seed + 251);
      const shortPores = smoothstep(0.59, 0.83, noise2(u * 310, localV * 245 * scale + (curl.sample(u, v) - 0.5) * 9, seed + 263));
      const pores = Math.pow(clamp((rings - 0.31) / 0.69), 2.8);
      const vessels = Math.pow(clamp((fine - 0.28) / 0.72), 2.6);
      const broadTone = broad.sample(u, v) - 0.5;
      const earlywood = (band - 0.48) * 0.3;
      const grainDark = pores * 0.86 + vessels * 0.72 + (fine2 - 0.5) * 0.14 + (cellular - 0.5) * 0.34 + shortPores * 0.19;
      let tone = 0.095 + broadTone * 0.7 + earlywood - grainDark * grain.contrast - knotShade;
      // Sparse medullary rays run across the fine grain with unequal lengths and spacing.
      const rayX = Math.floor(u * 330);
      const rayY = Math.floor(v * 20);
      const rayRandom = hash2(rayX, rayY, seed + 307);
      const rayLocalX = u * 330 - rayX;
      const rayLocalY = v * 20 - rayY;
      const ray = rayRandom > 1 - grain.flecks * 0.12
        ? Math.sin(rayLocalX * Math.PI) ** 5 * Math.sin(rayLocalY * Math.PI) ** 2 * grain.flecks
        : 0;
      tone += ray * 0.26;
      // Brushed surfaces have pale shoulders beside dark vessel grooves.
      const shoulder = grain.relief > 0.75 ? smoothstep(0.44, 0.64, fine) * (1 - smoothstep(0.64, 0.84, fine)) * 0.26 : 0;
      tone += shoulder;
      const tint = tone >= 0 ? light : dark;
      const blend = clamp(Math.abs(tone) * (tone >= 0 ? 1.7 : 2.3));
      const sensorGrain = (hash2(x, y, seed + 401) - 0.5) * 3.1;
      const j = i * 4;
      for (let c = 0; c < 3; c++) {
        const timber = base[c] + (tint[c] - base[c]) * blend;
        const knotPigment = dark[c] * 0.58;
        result.albedo[j + c] = timber + (knotPigment - timber) * knotCore * 0.87 + sensorGrain;
      }
      result.albedo[j + 3] = 255;
      result.heights[i] = (-pores * 0.8 - vessels * 0.32 - shortPores * 0.15 + fine2 * 0.15 + cellular * 0.12 + knotRidge + shoulder) * grain.relief * 0.095;
      result.roughness[i] = clamp(surface.roughness + pores * 0.105 + vessels * 0.045 - ray * 0.025 + broadTone * 0.04) * 255;
    }
  }
  return result;
}
