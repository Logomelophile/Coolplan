import { Vector3 } from 'three';
import type { ViewPreset } from './types';

export interface CameraPresetConfig {
  position: [number, number, number];
  target: [number, number, number];
  up: [number, number, number];
  projection: 'perspective' | 'orthographic';
  fov: number;
  span: number;
}
export const cameraPresets: Record<ViewPreset, CameraPresetConfig> = {
  front: { position: [0, 170, 0], target: [0, 0, 0], up: [1, 0, 0], projection: 'orthographic', fov: 34, span: 145 },
  perspective34: { position: [78, 83, 105], target: [0, 0, 0], up: [0, 1, 0], projection: 'perspective', fov: 34, span: 100 },
  stacked: { position: [84, 91, 115], target: [0, 3, 0], up: [0, 1, 0], projection: 'perspective', fov: 34, span: 110 },
  closeup: { position: [5, 15.53, 15], target: [0, 0.53, 0], up: [0, 1, 0], projection: 'perspective', fov: 42, span: 30 },
  back: { position: [78, -83, 105], target: [0, 0, 0], up: [0, 1, 0], projection: 'perspective', fov: 34, span: 100 },
  exploded: { position: [75, 94, 122], target: [15, 9, 0], up: [0, 1, 0], projection: 'perspective', fov: 37, span: 110 },
  profile: { position: [170, 0.265, 0], target: [0, 0.265, 0], up: [0, 1, 0], projection: 'orthographic', fov: 34, span: 14 },
};
export const viewPresets = Object.keys(cameraPresets) as ViewPreset[];
export const easeInOut = (value: number) => {
  const t = Math.max(0,Math.min(1,value));
  return t < 0.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2;
};
export function interpolateDirection(from: Vector3, to: Vector3, t: number): Vector3 {
  const a = from.clone().normalize();
  const b = to.clone().normalize();
  if (a.dot(b) < -0.999) {
    const mid = new Vector3(0.6, 0.4, 0.7).normalize();
    return t < 0.5 ? a.lerp(mid, t * 2).normalize() : mid.lerp(b, (t - 0.5) * 2).normalize();
  }
  return a.lerp(b, t).normalize();
}
