import assert from 'node:assert/strict';
import { test } from 'node:test';
import { estimateHorizon } from '../src/website/visualizer/geometry/vanishing';

/** Draws dark plank seams converging at (vpX, vpY) on a light floor below `floorTop`. */
function syntheticRoom(width: number, height: number, vpX: number, vpY: number, floorTop: number): { lum: Float32Array; mask: Float32Array } {
  const lum = new Float32Array(width * height).fill(.85);
  const mask = new Float32Array(width * height);
  let seed = 7;
  const random = (): number => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x;
    if (y >= floorTop) { mask[i] = 1; lum[i] = .7 + (random() - .5) * .04; } else lum[i] = .9 + (random() - .5) * .02;
  }
  // Seams: lines from points along the bottom edge towards the vanishing point.
  for (let k = -4; k <= 8; k++) {
    const bottomX = width * .5 + k * width * .14;
    for (let y = floorTop; y < height; y++) {
      const t = (y - vpY) / (height - 1 - vpY);
      const x = Math.round(vpX + (bottomX - vpX) * t);
      for (let dx = -1; dx <= 1; dx++) if (x + dx >= 0 && x + dx < width) lum[y * width + x + dx] = .25;
    }
  }
  // A few vertical distractors (furniture legs) above and across the floor line.
  for (const x of [40, 230]) for (let y = floorTop - 60; y < floorTop + 40; y++) lum[y * width + x] = .2;
  return { lum, mask };
}

test('estimateHorizon recovers the vanishing-point height from converging floor seams', () => {
  const width = 320, height = 240;
  const { lum, mask } = syntheticRoom(width, height, 150, 70, 130);
  const estimate = estimateHorizon(lum, mask, width, height, { workWidth: 320 });
  assert.ok(estimate, 'an estimate is produced');
  assert.ok(Math.abs(estimate.horizonY - 70 / 240) < .04, `horizon ${estimate.horizonY} should be near ${70 / 240}`);
  assert.ok(estimate.inliers >= 3);
  assert.ok(estimate.confidence > .3, `confidence ${estimate.confidence}`);
});

test('estimateHorizon returns null for a featureless floor', () => {
  const width = 200, height = 150;
  const lum = new Float32Array(width * height).fill(.6);
  const mask = new Float32Array(width * height).fill(1);
  assert.equal(estimateHorizon(lum, mask, width, height), null);
});
