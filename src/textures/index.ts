import { CanvasTexture, NoColorSpace, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';
import type { ProductConfig } from '../types';
import { BACKING_PITCH_MM, generateBackingPixels } from './backing';
import { generateMarblePixels } from './marble';
import { generateWoodPixels } from './wood';
import type { SurfacePixels, TextureSet } from './types';
import { roughnessToRgba, sobelNormals } from './normals';

export type { SurfacePixels, TextureSet } from './types';
export { generateBackingPixels } from './backing';
export { generateMarblePixels } from './marble';
export { generateWoodPixels } from './wood';
export { sobelNormals, roughnessToRgba } from './normals';

function makeCanvas(width: number, height: number): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('A Canvas 2D context is required to generate SPC textures.');
  return { canvas, context };
}

function textureFromPixels(pixels: Uint8ClampedArray, width: number, height: number, srgb: boolean, name: string): CanvasTexture {
  const { canvas, context } = makeCanvas(width, height);
  const image = context.createImageData(width, height);
  image.data.set(pixels);
  context.putImageData(image, 0, 0);
  const texture = new CanvasTexture(canvas);
  texture.name = name;
  texture.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  return texture;
}

function buildTextureSet(product: ProductConfig, pixels: SurfacePixels, prefix: string): TextureSet {
  const { width, height } = pixels;
  const albedo = textureFromPixels(pixels.albedo, width, height, true, `${product.id}:${prefix}:albedo`);
  const normal = textureFromPixels(sobelNormals(pixels.heights, width, height, product.dimensions.lengthMm, product.dimensions.widthMm), width, height, false, `${product.id}:${prefix}:normal`);
  const roughness = textureFromPixels(roughnessToRgba(pixels.roughness), width, height, false, `${product.id}:${prefix}:roughness`);
  const thumb = makeCanvas(280, 84);
  thumb.context.drawImage(albedo.image, 0, 0, width, height, 0, 0, 280, 84);
  const thumbnail = thumb.canvas.toDataURL('image/jpeg', 0.86);
  let disposed = false;
  return {
    albedo, normal, roughness, thumbnail,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const texture of [albedo, normal, roughness]) {
        texture.dispose();
        const canvas = texture.image as HTMLCanvasElement;
        canvas.width = 1;
        canvas.height = 1;
      }
    },
  };
}

export function generateSurfaceTextures(product: ProductConfig, width = 2048, height = 512): TextureSet {
  const pixels = product.surface.family === 'wood'
    ? generateWoodPixels(product, width, height)
    : generateMarblePixels(product, width, height);
  return buildTextureSet(product, pixels, 'surface');
}

/**
 * A full 1220 mm map undersamples a 2.5 mm embossed groove. Crosshatch backings
 * therefore render a physically sized periodic tile (a multiple of pitch * sqrt(2)
 * closes both +/-45 degree families at the seam) and repeat it across the plank.
 */
export function backingTilePlan(product: ProductConfig): { product: ProductConfig; repeat: [number, number] | null } {
  if (product.backingPattern !== 'crosshatch') return { product, repeat: null };
  const tileMm = BACKING_PITCH_MM * Math.SQRT2 * 16;
  const tileProduct: ProductConfig = { ...product, dimensions: { ...product.dimensions, lengthMm: tileMm, widthMm: tileMm } };
  const lengthMm = product.dimensions.lengthMm - product.profile.backingInsetMm * 2;
  const uvWidthMm = product.dimensions.widthMm - product.profile.tongueMm;
  return { product: tileProduct, repeat: [lengthMm / tileMm, uvWidthMm / tileMm] };
}

export function generateBackingTextures(product: ProductConfig, width = 2048, height = 512): TextureSet {
  const plan = backingTilePlan(product);
  const textures = buildTextureSet(plan.product, generateBackingPixels(plan.product, width, height), 'backing');
  if (plan.repeat) for (const texture of [textures.albedo, textures.normal, textures.roughness]) texture.repeat.set(plan.repeat[0], plan.repeat[1]);
  return textures;
}

function textureFromBitmap(bitmap: ImageBitmap, srgb: boolean, name: string): Texture {
  const texture = new CanvasTexture(bitmap);
  texture.name = name;
  texture.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  return texture;
}

/** Wraps maps produced by the texture worker (see textureWorkerPool) into the same TextureSet shape the generators return. */
export function textureSetFromBitmaps(product: ProductConfig, maps: { albedo: ImageBitmap; normal: ImageBitmap; roughness: ImageBitmap }, prefix: 'surface' | 'backing'): TextureSet {
  const albedo = textureFromBitmap(maps.albedo, true, `${product.id}:${prefix}:albedo`);
  const normal = textureFromBitmap(maps.normal, false, `${product.id}:${prefix}:normal`);
  const roughness = textureFromBitmap(maps.roughness, false, `${product.id}:${prefix}:roughness`);
  if (prefix === 'backing') {
    const plan = backingTilePlan(product);
    if (plan.repeat) for (const texture of [albedo, normal, roughness]) texture.repeat.set(plan.repeat[0], plan.repeat[1]);
  }
  const thumb = makeCanvas(280, 84);
  thumb.context.drawImage(maps.albedo, 0, 0, maps.albedo.width, maps.albedo.height, 0, 0, 280, 84);
  const thumbnail = thumb.canvas.toDataURL('image/jpeg', 0.86);
  let disposed = false;
  return {
    albedo, normal, roughness, thumbnail,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const texture of [albedo, normal, roughness]) {
        texture.dispose();
        (texture.image as { close?: () => void }).close?.();
      }
    },
  };
}
