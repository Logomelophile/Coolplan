import type { Point } from './geometry/homography';
import { HIGH_RES_ROOMS } from './samplePhotos';

/** Crop of the shared prototype sprite (public/website/assets/prototype-home.png). */
export interface Crop { x: number; y: number; width: number; height: number }

export interface FloorSpec {
  /** Horizon height as a fraction of the crop height (camera roll assumed 0). Hand-tuned per reference photo. */
  horizonY: number;
  /** Focal length as a multiple of crop width. */
  focal: number;
  /** A point on the floor (normalized) that anchors the plank grid. */
  anchor: Point;
  /** Plank direction in radians; 0 runs away from the camera. */
  rotation: number;
  /** Camera height in metres: sets how large a 1220 mm plank appears. */
  cameraHeight: number;
}

export interface SampleRoom {
  name?: string;
  image?: string;
  crop: Crop;
  /** Working-image scale applied to the crop. */
  scale: number;
  floor: FloorSpec;
  /** Hand-drawn fallback polygon (normalized) used when the precomputed matte is unavailable. */
  polygon: Point[];
  /** Regions of the reference photo that must stay untouched (normalized polygons). */
  holes?: Point[][];
  /** Elliptical hole: centre and radii, normalized. */
  ellipseHoles?: { cx: number; cy: number; rx: number; ry: number }[];
}

const normalized = (pairs: number[][]): Point[] => pairs.map(([x, y]) => ({ x, y }));
const thumb = (x: number): Crop => ({ x, y: 733, width: 130, height: 104 });

/** Matte files produced by scripts/precompute-rooms.mts live under public/website/rooms/. */
export const roomAlphaPath = (index: number): string | null => SAMPLE_ROOMS[index].image ? null : `/website/rooms/room-${index}-alpha.png`;

export const LEGACY_SAMPLE_ROOMS: SampleRoom[] = [
  {
    crop: { x: 563, y: 976, width: 494, height: 238 }, scale: 2,
    floor: { horizonY: .36, focal: .85, anchor: { x: .5, y: .86 }, rotation: Math.PI / 2, cameraHeight: .9 },
    polygon: normalized([[0, .705], [.079, .651], [.106, .642], [.124, .658], [.147, .659], [.170, .646], [.181, .665], [.697, .667], [.725, .657], [.747, .663], [.775, .650], [.842, .665], [.867, .691], [.886, .714], [1, .791], [1, 1], [0, 1]]),
    holes: [normalized([[.331, .617], [.358, .597], [.409, .587], [.528, .592], [.610, .617], [.646, .642], [.646, .681], [.618, .705], [.616, .802], [.579, .824], [.548, .820], [.514, .815], [.497, .805], [.467, .820], [.426, .818], [.405, .797], [.397, .778], [.374, .778], [.372, .709], [.357, .696], [.337, .673]])],
    // The supplied reference has a fullscreen control baked into the photo.
    ellipseHoles: [{ cx: .941, cy: .902, rx: .037, ry: .080 }],
  },
  { crop: thumb(207), scale: 4, floor: { horizonY: .52, focal: .85, anchor: { x: .5, y: .92 }, rotation: Math.PI / 2, cameraHeight: 1.4 }, polygon: normalized([[0, .85], [.15, .81], [.24, .88], [.77, .88], [.86, .83], [1, .88], [1, 1], [0, 1]]) },
  { crop: thumb(351), scale: 4, floor: { horizonY: .46, focal: .85, anchor: { x: .5, y: .9 }, rotation: 0, cameraHeight: 1.5 }, polygon: normalized([[0, .86], [.15, .76], [.56, .69], [.72, .76], [1, .90], [1, 1], [0, 1]]) },
  { crop: thumb(496), scale: 4, floor: { horizonY: .5, focal: .85, anchor: { x: .5, y: .92 }, rotation: Math.PI / 2, cameraHeight: 1.5 }, polygon: normalized([[.17, .80], [.31, .70], [.50, .70], [.64, .80], [.84, 1], [.07, 1]]) },
  { crop: thumb(641), scale: 4, floor: { horizonY: .5, focal: .85, anchor: { x: .5, y: .96 }, rotation: Math.PI / 2, cameraHeight: 1.5 }, polygon: normalized([[0, .93], [.21, .93], [.25, .98], [.81, .98], [.91, .88], [1, .91], [1, 1], [0, 1]]) },
  { crop: thumb(786), scale: 4, floor: { horizonY: .5, focal: .85, anchor: { x: .5, y: .94 }, rotation: Math.PI / 2, cameraHeight: 1.5 }, polygon: normalized([[.08, .84], [.27, .83], [.34, .90], [.71, .90], [.83, .80], [.93, .86], [1, 1], [0, 1]]) },
  { crop: thumb(931), scale: 4, floor: { horizonY: .5, focal: .85, anchor: { x: .5, y: .93 }, rotation: Math.PI / 2, cameraHeight: 1.5 }, polygon: normalized([[.14, .80], [.25, .73], [.32, .75], [.33, .87], [.73, .87], [.74, .75], [.83, .78], [1, 1], [0, 1]]) },
];

// Keep legacy sprite crops for callers with an explicit imageUrl override.
// Every default sample uses a full-resolution photo with its own contour.
export const SAMPLE_ROOMS: SampleRoom[] = LEGACY_SAMPLE_ROOMS.map((room, index) => ({
  ...room, ...HIGH_RES_ROOMS[index], scale: 1, ellipseHoles: [],
}));
