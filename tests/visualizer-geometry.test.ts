import assert from 'node:assert/strict';
import { test } from 'node:test';
import { floorFrame, homographyFromQuad, invert, multiply, transform } from '../src/website/visualizer/geometry/homography';

const close = (actual: number, expected: number, tolerance = 1e-6): void => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);
};

test('homographyFromQuad maps unit square corners onto the quad and inverts cleanly', () => {
  const quad = [{ x: 100, y: 300 }, { x: 540, y: 290 }, { x: 760, y: 560 }, { x: -60, y: 580 }];
  const H = homographyFromQuad(quad);
  assert.ok(H);
  const corners = [[0, 0], [1, 0], [1, 1], [0, 1]];
  corners.forEach(([u, v], index) => {
    const p = transform(H, u, v);
    assert.ok(p);
    close(p.x, quad[index].x, 1e-6);
    close(p.y, quad[index].y, 1e-6);
  });
  const Hinv = invert(H);
  assert.ok(Hinv);
  const back = transform(Hinv, 300, 450);
  const forward = transform(H, back!.x, back!.y);
  close(forward!.x, 300, 1e-6);
  close(forward!.y, 450, 1e-6);
  const product = multiply(H, Hinv);
  close(product[0] / product[8], 1, 1e-9);
  close(product[1] / product[8], 0, 1e-9);
});

test('homographyFromQuad rejects degenerate quads', () => {
  assert.equal(homographyFromQuad([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }]), null);
  assert.equal(homographyFromQuad([{ x: 0, y: 0 }]), null);
});

test('floorFrame: level camera puts the horizon at mid-height and keeps straight-ahead points on the centre column', () => {
  const frame = floorFrame({ width: 1600, height: 1200, horizonY: .5, focal: 1, anchor: { x: .5, y: .8 }, cameraHeight: 1.5 });
  assert.ok(frame);
  close(frame.normal[0], 0);
  close(frame.normal[1], 1);
  close(frame.normal[2], 0);
  // The anchor maps to the texture origin.
  const origin = transform(frame.Hinv, 800, 960);
  assert.ok(origin);
  close(origin.x, 0, 1e-6);
  close(origin.y, 0, 1e-6);
  // Walking forward one metre along the plank axis stays on the centre column and rises towards the horizon.
  const ahead = transform(frame.H, 1, 0);
  assert.ok(ahead);
  close(ahead.x, 800, 1e-6);
  assert.ok(ahead.y < 960 && ahead.y > 600, `expected ${ahead.y} between horizon and anchor`);
  // The floor is 1.5 m below a 1600 px-focal camera: a point 1.5 m ahead sits exactly at 45°.
  const anchorMetres = transform(frame.Hinv, 800, 600 + 1600);
  assert.ok(anchorMetres);
  const forwardOfAnchor = transform(frame.Hinv, 800, 960);
  assert.ok(forwardOfAnchor);
  // Pixels above the horizon are not on the floor and must map behind the camera.
  const w = frame.Hinv[6] * 800 + frame.Hinv[7] * 100 + frame.Hinv[8];
  assert.ok(w < 0);
});

test('floorFrame: lowering the horizon tilts the camera down and a 90° rotation swaps plank axes', () => {
  const base = floorFrame({ width: 1000, height: 800, horizonY: .4, focal: .85, anchor: { x: .5, y: .85 } });
  const turned = floorFrame({ width: 1000, height: 800, horizonY: .4, focal: .85, anchor: { x: .5, y: .85 }, rotation: Math.PI / 2 });
  assert.ok(base && turned);
  assert.ok(base.normal[2] > 0, 'camera tilted down: normal gains a forward component');
  const alongBase = transform(base.H, 1, 0)!;
  const acrossTurned = transform(turned.H, 0, 1)!;
  // The same world direction (base u == turned v up to sign) projects to the same pixel column.
  close(Math.abs(alongBase.x - 500), Math.abs(acrossTurned.x - 500), 1e-6);
  assert.equal(floorFrame({ width: 1000, height: 800, horizonY: .9, anchor: { x: .5, y: .2 } }), null, 'anchor above the horizon is rejected');
});
