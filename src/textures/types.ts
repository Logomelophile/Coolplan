import type { Texture } from 'three';

export interface SurfacePixels {
  readonly width: number;
  readonly height: number;
  readonly albedo: Uint8ClampedArray;
  /** Physical surface displacement, in millimetres. */
  readonly heights: Float32Array;
  readonly roughness: Uint8ClampedArray;
}

export interface TextureSet {
  readonly albedo: Texture;
  readonly normal: Texture;
  readonly roughness: Texture;
  readonly thumbnail: string;
  dispose(): void;
}

export function hexToRgb(hex: string): [number, number, number] {
  const expanded = hex.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(expanded)) throw new Error(`Expected a six-digit hexadecimal colour, received ${hex}`);
  return [parseInt(expanded.slice(0, 2), 16), parseInt(expanded.slice(2, 4), 16), parseInt(expanded.slice(4, 6), 16)];
}

export function allocatePixels(width: number, height: number): SurfacePixels {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 2 || height < 2 || width > 8192 || height > 8192) {
    throw new Error('Texture dimensions must be integers between 2 and 8192 pixels.');
  }
  return { width, height, albedo: new Uint8ClampedArray(width * height * 4), heights: new Float32Array(width * height), roughness: new Uint8ClampedArray(width * height) };
}
