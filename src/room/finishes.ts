import { MeshPhysicalMaterial, MeshStandardMaterial, Vector2 } from 'three';
import { getProduct } from '../data/products';
import { generateSurfaceTextures, type TextureSet } from '../textures';
import type { ProductConfig } from '../types';

export interface RoomFinish {
  id: string;
  name: string;
  subtitle: string;
  color: string;
  reference: string;
  product: ProductConfig;
}

export interface FloorMaterialBundle {
  top: MeshPhysicalMaterial;
  edge: MeshStandardMaterial;
  thumbnail: string;
  dispose(): void;
}

interface FinishRecipe {
  number: number;
  subtitle: string;
  template: string;
  palette: ProductConfig['surface']['palette'];
  grain: ProductConfig['surface']['grain'];
  knots: ProductConfig['surface']['knots'];
  roughness: number;
}

/**
 * These identifiers preserve the supplied filenames, not inferred commercial SKUs.
 * The reference photographs contain warm sunlight, shadows and reflections. Their
 * neutral diffuse tones are estimated here; the scene supplies its own lighting.
 * The original product catalogue is never mutated by these room-only variations.
 */
function makeFinish(recipe: FinishRecipe): RoomFinish {
  const template = getProduct(recipe.template);
  const id = `floor-${String(recipe.number).padStart(2, '0')}`;
  const name = `พื้นปก${recipe.number}`;
  const product: ProductConfig = {
    ...template,
    id,
    name,
    nameTh: name,
    description: {
      en: `Approximate procedural floor finish matched to reference image ${recipe.number}.`,
      th: `ลวดลายและโทนสีโดยประมาณจากภาพอ้างอิง ${name}`,
    },
    dimensions: { ...template.dimensions },
    profile: { ...template.profile },
    seed: 21863 + recipe.number * 7937,
    surface: {
      family: 'wood',
      palette: { ...recipe.palette },
      grain: { ...recipe.grain },
      knots: { ...recipe.knots },
      roughness: recipe.roughness,
      clearcoat: 0.14,
      clearcoatRoughness: 0.58,
    },
    layers: template.layers.map((layer) => ({
      ...layer,
      label: { ...layer.label },
      description: { ...layer.description },
      material: { ...layer.material },
    })),
  };
  delete product.maps;
  return {
    id,
    name,
    subtitle: recipe.subtitle,
    color: recipe.palette.base,
    reference: `/room/references/${id}.png`,
    product,
  };
}

export const roomFinishes: RoomFinish[] = [
  makeFinish({
    number: 1,
    subtitle: 'น้ำตาลเทาธรรมชาติ',
    template: 'warm-taupe-oak',
    palette: { base: '#A4937E', light: '#C5B59E', dark: '#746756' },
    grain: { scale: 1.04, contrast: 0.58, cathedral: 0.25, relief: 0.65, flecks: 0.22 },
    knots: { count: 1, radius: 0.03, strength: 0.58 },
    roughness: 0.66,
  }),
  makeFinish({
    number: 2,
    subtitle: 'ครีมไม้ธรรมชาติ',
    template: 'light-natural-oak',
    palette: { base: '#CBBB9F', light: '#E1D4BC', dark: '#A18E70' },
    grain: { scale: 1.1, contrast: 0.5, cathedral: 0.2, relief: 0.49, flecks: 0.2 },
    knots: { count: 1, radius: 0.025, strength: 0.48 },
    roughness: 0.63,
  }),
  makeFinish({
    number: 3,
    subtitle: 'น้ำตาลเข้มอบอุ่น',
    template: 'warm-taupe-oak',
    palette: { base: '#7D6C59', light: '#A08B72', dark: '#50483E' },
    grain: { scale: 1.02, contrast: 0.63, cathedral: 0.28, relief: 0.62, flecks: 0.18 },
    knots: { count: 1, radius: 0.034, strength: 0.65 },
    roughness: 0.61,
  }),
  makeFinish({
    number: 4,
    subtitle: 'ขาวนวลลายไม้',
    template: 'whitewashed-ash-oak',
    palette: { base: '#D3CEC3', light: '#EAE6DC', dark: '#A8A094' },
    grain: { scale: 1.06, contrast: 0.55, cathedral: 0.24, relief: 0.56, flecks: 0.2 },
    knots: { count: 2, radius: 0.028, strength: 0.55 },
    roughness: 0.69,
  }),
  makeFinish({
    number: 5,
    subtitle: 'น้ำผึ้งอ่อนนุ่ม',
    template: 'golden-honey-oak',
    palette: { base: '#C8AD87', light: '#E0C9A5', dark: '#A18A68' },
    grain: { scale: 0.99, contrast: 0.5, cathedral: 0.37, relief: 0.5, flecks: 0.25 },
    knots: { count: 1, radius: 0.023, strength: 0.45 },
    roughness: 0.64,
  }),
  makeFinish({
    number: 6,
    subtitle: 'เทาเบจละมุน',
    template: 'greige-oak',
    palette: { base: '#A19686', light: '#C1B7A8', dark: '#756C60' },
    grain: { scale: 1.08, contrast: 0.61, cathedral: 0.22, relief: 0.74, flecks: 0.21 },
    knots: { count: 1, radius: 0.03, strength: 0.59 },
    roughness: 0.7,
  }),
];

interface CachedTextures {
  textures: TextureSet;
  users: number;
}

// A second room can share the same GPU maps while retaining independent materials.
// The final owner's disposal releases both GPU textures and their source canvases.
const textureCache = new WeakMap<ProductConfig, CachedTextures>();

export function createFloorMaterial(finish: RoomFinish, anisotropy: number): FloorMaterialBundle {
  let cached = textureCache.get(finish.product);
  if (!cached) {
    cached = { textures: generateSurfaceTextures(finish.product, 1024, 256), users: 0 };
    textureCache.set(finish.product, cached);
  }
  cached.users++;
  const entry = cached;
  const { textures } = entry;
  const requestedAnisotropy = Number.isFinite(anisotropy) ? Math.max(1, Math.min(16, Math.floor(anisotropy))) : 1;
  for (const texture of [textures.albedo, textures.normal, textures.roughness]) {
    if (texture.anisotropy < requestedAnisotropy) {
      texture.anisotropy = requestedAnisotropy;
      texture.needsUpdate = true;
    }
  }

  const top = new MeshPhysicalMaterial({
    name: `${finish.id}:floor-top`,
    color: '#ffffff',
    map: textures.albedo,
    normalMap: textures.normal,
    normalScale: new Vector2(0.9, 0.9),
    // The map already encodes the requested absolute roughness.
    roughnessMap: textures.roughness,
    roughness: 1,
    metalness: 0,
    clearcoat: finish.product.surface.clearcoat,
    clearcoatRoughness: finish.product.surface.clearcoatRoughness,
    ior: 1.48,
    envMapIntensity: 0.45,
  });
  const edge = new MeshStandardMaterial({
    name: `${finish.id}:floor-edge`,
    color: '#8A8278',
    roughness: 0.94,
    metalness: 0,
    envMapIntensity: 0.25,
  });
  let disposed = false;
  return {
    top,
    edge,
    thumbnail: textures.thumbnail,
    dispose() {
      if (disposed) return;
      disposed = true;
      top.dispose();
      edge.dispose();
      entry.users--;
      if (entry.users === 0) {
        textures.dispose();
        textureCache.delete(finish.product);
      }
    },
  };
}
