import { CanvasTexture, NoColorSpace, RepeatWrapping, SRGBColorSpace } from 'three';
import type { ProductConfig } from '../types';
import { BACKING_PITCH_MM, generateBackingPixels } from './backing';
import { generateMarblePixels } from './marble';
import { generateWoodPixels } from './wood';
import type { SurfacePixels, TextureSet } from './types';

export type { SurfacePixels, TextureSet } from './types';
export { generateBackingPixels } from './backing';
export { generateMarblePixels } from './marble';
export { generateWoodPixels } from './wood';

function makeCanvas(width: number, height: number): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('A Canvas 2D context is required to generate SPC textures.');
  return { canvas, context };
}

/** Physical derivatives keep relief independent of the requested map resolution. */
export function sobelNormals(heights: Float32Array, width: number, height: number, lengthMm: number, widthMm: number): Uint8ClampedArray {
  if (heights.length !== width * height) throw new Error('Height field dimensions do not match.');
  const normals = new Uint8ClampedArray(width * height * 4);
  const mmPerX = lengthMm / (width - 1);
  const mmPerY = widthMm / (height - 1);
  for (let y = 0; y < height; y++) {
    const up = Math.max(0, y - 1) * width;
    const middle = y * width;
    const down = Math.min(height - 1, y + 1) * width;
    for (let x = 0; x < width; x++) {
      const left = Math.max(0, x - 1);
      const right = Math.min(width - 1, x + 1);
      const tl = heights[up + left];
      const tr = heights[up + right];
      const bl = heights[down + left];
      const br = heights[down + right];
      const dx = (tr + 2 * heights[middle + right] + br - tl - 2 * heights[middle + left] - bl) / (8 * mmPerX);
      const dy = (bl + 2 * heights[down + x] + br - tl - 2 * heights[up + x] - tr) / (8 * mmPerY);
      const inverseLength = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const i = (middle + x) * 4;
      normals[i] = (0.5 - dx * inverseLength * 0.5) * 255;
      // Canvas Y is downward; texture V is upward after Three's default flipY.
      normals[i + 1] = (0.5 + dy * inverseLength * 0.5) * 255;
      normals[i + 2] = (0.5 + inverseLength * 0.5) * 255;
      normals[i + 3] = 255;
    }
  }
  return normals;
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
  const roughPixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < pixels.roughness.length; i++) {
    roughPixels[i * 4] = pixels.roughness[i];
    roughPixels[i * 4 + 1] = pixels.roughness[i];
    roughPixels[i * 4 + 2] = pixels.roughness[i];
    roughPixels[i * 4 + 3] = 255;
  }
  const roughness = textureFromPixels(roughPixels, width, height, false, `${product.id}:${prefix}:roughness`);
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

export function generateBackingTextures(product: ProductConfig, width = 2048, height = 512): TextureSet {
  if (product.backingPattern !== 'crosshatch') {
    return buildTextureSet(product, generateBackingPixels(product, width, height), 'backing');
  }
  // A full 1220 mm map undersamples a 2.5 mm embossed groove. Sampling a
  // physically sized periodic tile preserves its normal and albedo at close range.
  // A multiple of pitch * sqrt(2) closes both +/-45 degree families at the seam.
  const tileMm = BACKING_PITCH_MM * Math.SQRT2 * 16;
  const tileProduct: ProductConfig = {
    ...product,
    dimensions: { ...product.dimensions, lengthMm: tileMm, widthMm: tileMm },
  };
  const textures = buildTextureSet(tileProduct, generateBackingPixels(tileProduct, width, height), 'backing');
  const lengthMm = product.dimensions.lengthMm - product.profile.backingInsetMm * 2;
  const uvWidthMm = product.dimensions.widthMm - product.profile.tongueMm;
  for (const texture of [textures.albedo, textures.normal, textures.roughness]) {
    texture.repeat.set(lengthMm / tileMm, uvWidthMm / tileMm);
  }
  return textures;
}
