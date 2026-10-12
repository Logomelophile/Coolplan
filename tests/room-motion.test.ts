import test from 'node:test';
import assert from 'node:assert/strict';
import { Euler, Matrix4 } from 'three';
import { boardPose, boardTransition, createBoards, FLOOR, sampleStory, type Board } from '../src/room/motion';

const EPSILON = 1e-10;
const nearly = (actual: number, expected: number, label: string) => {
  assert.ok(Math.abs(actual - expected) <= EPSILON, `${label}: expected ${expected}, received ${actual}`);
};

function rearEdge(board: Board, pose: ReturnType<typeof boardPose>): number {
  const rotation = new Matrix4().makeRotationFromEuler(new Euler(pose.rx, pose.ry, pose.rz)).elements;
  const halfDepth = Math.abs(rotation[2]) * board.length / 2
    + Math.abs(rotation[6]) * FLOOR.thickness / 2
    + Math.abs(rotation[10]) * FLOOR.plankWidth / 2;
  return pose.z - halfDepth;
}

function assertInstalled(board: Board, amount: number) {
  const pose = boardPose(board, amount);
  nearly(pose.x, board.x, 'installed X');
  nearly(pose.z, board.z, 'installed Z');
  nearly(pose.y, FLOOR.thickness / 2, 'installed centre height');
  nearly(pose.rx, 0, 'installed pitch');
  nearly(pose.ry, 0, 'installed yaw');
  nearly(pose.rz, 0, 'installed roll');
}

test('installed staggered boards cover the complete 7.32 × 7.20 m nominal floor without gaps or overlap', () => {
  const boards = createBoards();
  assert.equal(FLOOR.rows, 40);
  nearly(FLOOR.plankLength, 1.22, 'full plank length');
  nearly(FLOOR.plankWidth, 0.18, 'plank width');
  nearly(FLOOR.thickness, 0.0053, 'plank thickness');
  nearly(FLOOR.rows * FLOOR.plankWidth, FLOOR.depth, 'floor depth');
  const rows = new Map<number, Board[]>();
  for (const board of boards) {
    assert.ok(board.length > 0 && board.length <= FLOOR.plankLength + EPSILON);
    assert.ok(board.seed >= 0 && board.seed <= 1);
    const row = rows.get(board.row) ?? [];
    row.push(board);
    rows.set(board.row, row);
    assertInstalled(board, 0);
  }
  assert.equal(rows.size, FLOOR.rows);
  for (const [rowIndex, row] of rows) {
    row.sort((a, b) => a.x - b.x);
    let rightEdge = -FLOOR.width / 2;
    for (const board of row) {
      nearly(board.x - board.length / 2, rightEdge, `row ${rowIndex} contiguous joint`);
      rightEdge = board.x + board.length / 2;
      nearly(board.z, FLOOR.back + (rowIndex + 0.5) * FLOOR.plankWidth, `row ${rowIndex} centre`);
    }
    nearly(rightEdge, FLOOR.width / 2, `row ${rowIndex} right boundary`);
  }
  const area = boards.reduce((sum, board) => sum + board.length * FLOOR.plankWidth, 0);
  nearly(area, 52.704, 'nominal covered square metres');
  nearly(area, FLOOR.width * FLOOR.depth, 'nominal floor area');
  nearly(Math.min(...boards.map(board => board.z - FLOOR.plankWidth / 2)), FLOOR.back, 'back boundary');
  nearly(Math.max(...boards.map(board => board.z + FLOOR.plankWidth / 2)), FLOOR.back + FLOOR.depth, 'front boundary');
  assert.notEqual(rows.get(0)![0].length, rows.get(1)![0].length, 'adjacent rows must stagger their end joints');
  nearly(rows.get(0)![0].length, rows.get(3)![0].length, 'three-row stagger repetition');
});

test('each transition endpoint fully installs one finish and clears the other from the room', () => {
  for (const board of createBoards()) {
    assertInstalled(board, boardTransition(board, 0, false));
    assertInstalled(board, boardTransition(board, 1, true));
    for (const amount of [boardTransition(board, 0, true), boardTransition(board, 1, false)]) {
      assert.equal(amount, 1);
      const pose = boardPose(board, amount);
      assert.ok(rearEdge(board, pose) > FLOOR.back + FLOOR.depth + 2, 'the complete exited plank must clear the foreground');
      assert.ok(pose.y > 0.4, 'exited planks remain lifted');
      assert.ok(Object.values(pose).every(Number.isFinite));
    }
  }
});

test('both animation directions preserve row spacing instead of collecting boards into an overlapping pile', () => {
  const boards = createBoards();
  for (const incoming of [false, true]) {
    for (let step = 0; step <= 500; step++) {
      const phase = step / 500;
      const rowBounds = Array.from({ length: FLOOR.rows }, () => ({ min: Infinity, max: -Infinity }));
      for (const board of boards) {
        const pose = boardPose(board, boardTransition(board, phase, incoming));
        nearly(pose.x, board.x, 'lateral placement must remain stable');
        nearly(pose.ry, 0, 'no yaw into neighbouring boards');
        nearly(pose.rz, 0, 'no sideways roll into neighbouring boards');
        rowBounds[board.row].min = Math.min(rowBounds[board.row].min, pose.z);
        rowBounds[board.row].max = Math.max(rowBounds[board.row].max, pose.z);
      }
      for (let row = 1; row < FLOOR.rows; row++) {
        const separation = rowBounds[row].min - rowBounds[row - 1].max;
        assert.ok(separation >= FLOOR.plankWidth - EPSILON, `${incoming ? 'incoming' : 'outgoing'} phase ${phase}, rows ${row - 1}/${row} compressed to ${separation} m`);
      }
    }
  }
});

test('reverse scrolling reproduces the exact same story and board poses without hidden state', () => {
  const boards = createBoards().map(board => Object.freeze({ ...board }));
  assert.deepEqual(createBoards(), createBoards(), 'layout generation must be deterministic');
  const positions = [-2, 0, 0.12, 0.31, 0.58, 0.82, 1, 1.49, 2.17, 2.83, 3.55, 4.27, 4.95, 5, 8];
  const snapshot = (position: number) => {
    const state = sampleStory(position, 6);
    return {
      state,
      poses: boards.map(board => [
        boardPose(board, boardTransition(board, state.phase, false)),
        boardPose(board, boardTransition(board, state.phase, true)),
      ]),
    };
  };
  const forward = positions.map(snapshot);
  const reversed = [...positions].reverse().map(snapshot).reverse();
  assert.deepEqual(reversed, forward);
  for (let finish = 0; finish < 6; finish++) {
    const state = sampleStory(finish, 6);
    assert.equal(state.from, finish);
    assert.equal(state.selected, finish);
    assert.equal(state.phase, 0);
  }
  assert.deepEqual(sampleStory(-5, 6), sampleStory(0, 6));
  assert.deepEqual(sampleStory(10, 6), sampleStory(5, 6));
});

test('outgoing boards clear before any incoming boards start returning, without overshoot', () => {
  const boards = createBoards();
  const priorOutgoing = boards.map(() => 0);
  const priorIncoming = boards.map(() => 1);
  for (let step = 0; step <= 400; step++) {
    const phase = step / 400;
    const outgoing = boards.map(board => boardTransition(board, phase, false));
    const incoming = boards.map(board => boardTransition(board, phase, true));
    for (let i = 0; i < boards.length; i++) {
      assert.ok(outgoing[i] >= 0 && outgoing[i] <= 1);
      assert.ok(incoming[i] >= 0 && incoming[i] <= 1);
      assert.ok(outgoing[i] >= priorOutgoing[i], 'outgoing progression must be monotone');
      assert.ok(incoming[i] <= priorIncoming[i], 'incoming progression must be monotone');
      priorOutgoing[i] = outgoing[i];
      priorIncoming[i] = incoming[i];
    }
    if (incoming.some(amount => amount < 1)) assert.ok(outgoing.every(amount => amount === 1), 'floor finishes must not intersect during the handoff');
  }
});

test('boards stay at floor level until their complete footprint clears the furniture', () => {
  // From roomGeometry: the tabletop is centred at Z=-0.30 with radius 0.765.
  // It is the most forward furniture footprint; 0.10 m adds an independent margin.
  const safeFurnitureFront = -0.30 + 0.765 + 0.10;
  let coveredSamples = 0;
  let liftedSamples = 0;
  for (const board of createBoards()) {
    for (let step = 0; step <= 800; step++) {
      const pose = boardPose(board, step / 800);
      if (rearEdge(board, pose) < safeFurnitureFront) {
        coveredSamples++;
        nearly(pose.y, FLOOR.thickness / 2, 'height while under furniture');
        nearly(pose.rx, 0, 'pitch while under furniture');
        nearly(pose.ry, 0, 'yaw while under furniture');
        nearly(pose.rz, 0, 'roll while under furniture');
      }
      if (pose.y > FLOOR.thickness / 2 + EPSILON || Math.abs(pose.rx) + Math.abs(pose.ry) + Math.abs(pose.rz) > EPSILON) {
        liftedSamples++;
        assert.ok(rearEdge(board, pose) >= safeFurnitureFront, 'lifting and rotating require the whole plank to be in open foreground');
      }
      assert.ok(Object.values(pose).every(Number.isFinite));
    }
  }
  assert.ok(coveredSamples > 1000, 'exercise boards travelling beneath furniture');
  assert.ok(liftedSamples > 1000, 'exercise the raised path as well');
});
