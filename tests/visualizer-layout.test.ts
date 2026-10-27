import test from 'node:test';
import assert from 'node:assert/strict';
import { herringboneTile } from '../src/website/visualizer/texture/layout';

test('herringbone covers positive and negative floor coordinates with complete perpendicular rectangular boards', () => {
  const width = .12, length = .72, ratio = 6;
  const boards = new Map<string, { horizontal: boolean; cells: [number, number][] }>();
  for (let y = -36; y < 36; y++) for (let x = -36; x < 36; x++) {
    const tile = herringboneTile((x + .5) * width, (y + .5) * width, width, length);
    assert.ok(tile.u > 0 && tile.u < 1 && tile.v > 0 && tile.v < 1);
    assert.ok(Math.abs(tile.length - length) < 1e-9);
    const key = `${tile.horizontal}:${tile.idX}:${tile.idY}`;
    const board = boards.get(key) ?? { horizontal: tile.horizontal, cells: [] };
    board.cells.push([x, y]); boards.set(key, board);
  }
  let complete = 0;
  for (const board of boards.values()) {
    if (board.cells.some(([x, y]) => Math.abs(x) > 29 || Math.abs(y) > 29)) continue;
    const xs = board.cells.map(([x]) => x), ys = board.cells.map(([, y]) => y);
    assert.equal(board.cells.length, ratio, 'Every interior board occupies exactly its rectangular area');
    assert.equal(Math.max(...xs) - Math.min(...xs) + 1, board.horizontal ? ratio : 1);
    assert.equal(Math.max(...ys) - Math.min(...ys) + 1, board.horizontal ? 1 : ratio);
    complete++;
  }
  assert.ok(complete > 300, 'Exercise hundreds of full boards on both sides of the origin');
});

test('herringbone grain follows the long axis of both board orientations', () => {
  const h1 = herringboneTile(.03, .03, .12, .72);
  const h2 = herringboneTile(.51, .03, .12, .72);
  assert.equal(h1.horizontal, true); assert.equal(h2.horizontal, true);
  assert.equal(h1.idX, h2.idX); assert.equal(h1.idY, h2.idY);
  assert.equal(h1.v, h2.v); assert.ok(h2.u > h1.u);
  const v1 = herringboneTile(.75, .03, .12, .72);
  const v2 = herringboneTile(.75, .51, .12, .72);
  assert.equal(v1.horizontal, false); assert.equal(v2.horizontal, false);
  assert.equal(v1.idX, v2.idX); assert.equal(v1.idY, v2.idY);
  assert.equal(v1.v, v2.v); assert.ok(v2.u > v1.u);
});

test('herringbone scales physically without changing tile identities or texture coordinates', () => {
  for (const [x, y] of [[.023, .347], [-1.37, .37], [2.81, -3.019], [-4.11, -2.23]]) {
    const first = herringboneTile(x, y, .12, .72);
    const scaled = herringboneTile(x * 2.5, y * 2.5, .3, 1.8);
    assert.equal(first.horizontal, scaled.horizontal);
    assert.equal(first.idX, scaled.idX); assert.equal(first.idY, scaled.idY);
    assert.ok(Math.abs(first.u - scaled.u) < 1e-10 && Math.abs(first.v - scaled.v) < 1e-10);
  }
});
