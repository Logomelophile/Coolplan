/** Deterministic choreography: scrolling backward samples the same path backward. */
export interface Board {
  x: number;
  z: number;
  length: number;
  row: number;
  seed: number;
}
export const FLOOR = { width: 7.32, depth: 7.20, back: -2.70, rows: 40, plankLength: 1.22, plankWidth: 0.18, thickness: 0.0053 };
export const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
export function smooth(value: number): number { const t = clamp01(value); return t * t * (3 - 2 * t); }
export function createBoards(): Board[] {
  const boards: Board[] = [];
  for (let row = 0; row < FLOOR.rows; row++) {
    const offset = (row % 3) * FLOOR.plankLength / 3;
    for (let start = -FLOOR.width / 2 - offset; start < FLOOR.width / 2 - 0.0001; start += FLOOR.plankLength) {
      const left = Math.max(start, -FLOOR.width / 2);
      const right = Math.min(start + FLOOR.plankLength, FLOOR.width / 2);
      const length = right - left;
      if (length < 0.001) continue;
      boards.push({x: (left + right) / 2, z: FLOOR.back + (row + 0.5) * FLOOR.plankWidth, length, row, seed: Math.abs(Math.sin(row * 81.73 + start * 39.27))});
    }
  }
  return boards;
}

/**
 * Every board follows the same forward displacement, preserving row spacing.
 * Lift is gated by its world-space position so rear boards remain flat beneath
 * furniture while the foreground boards rise into a gently spaced wave.
 */
export function boardPose(board: Board, amount: number) {
  const t = clamp01(amount);
  const z = board.z + 10.2 * smooth(t);
  const foregroundClearance = smooth((z - 1.08) / 0.85);
  const lift = smooth(t / 0.24) * foregroundClearance;
  return {
    x: board.x,
    y: FLOOR.thickness / 2 + lift * (0.44 + board.seed * 0.08),
    z,
    rx: lift * 0.045,
    ry: 0,
    rz: 0,
  };
}

export function sampleStory(position: number, finishCount: number) {
  const bounded = Math.max(0, Math.min(finishCount - 1, position));
  const from = Math.min(finishCount - 1, Math.floor(bounded));
  const to = Math.min(finishCount - 1, from + 1);
  const fraction = bounded - from;
  const phase = clamp01((fraction - 0.16) / 0.70);
  return {from, to, fraction, phase, selected: phase < 0.52 ? from : to};
}

export function boardTransition(board: Board, phase: number, incoming: boolean): number {
  // Front rows leave first; rear rows return first. In both directions a front
  // row always has at least as much forward displacement as the row behind it.
  const rowFraction = board.row / (FLOOR.rows - 1);
  const rowDelay = incoming ? rowFraction * 0.0325 : (1 - rowFraction) * 0.13;
  // Keep local variation below the smallest adjacent-row delay (0.0325 / 39).
  const grainDelay = board.seed * 0.0002;
  return incoming
    ? 1 - smooth((phase - 0.51 - rowDelay - grainDelay) / 0.42)
    : smooth((phase - rowDelay - grainDelay) / 0.35);
}
