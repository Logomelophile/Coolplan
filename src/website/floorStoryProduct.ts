import { getProduct } from '../data/products';
import type { LayerConfig, ProductConfig } from '../types';

export const FLOOR_STORY_LAYER_IDS = ['uv', 'wear', 'decor', 'core', 'backing'] as const;
export type FloorStoryLayerId = typeof FLOOR_STORY_LAYER_IDS[number];

/** Illustrative allocation for the 5 mm cutaway, not a per-layer manufacturing specification. */
export const FLOOR_STORY_THICKNESS_MM: Record<FloorStoryLayerId, number> = {
  uv: .02, wear: .5, decor: .1, core: 3.38, backing: 1,
};

/** Keep the website's explanatory sample separate from the original product catalogue. */
export function createFloorStoryProduct(id: string): ProductConfig {
  const product = structuredClone(getProduct(id));
  const uv: LayerConfig = {
    id: 'uv', order: 0, thicknessMm: FLOOR_STORY_THICKNESS_MM.uv,
    label: { en: 'UV Layer', th: 'ชั้นเคลือบป้องกันรังสี UV' },
    description: { en: 'A clear surface coating that helps reduce colour fading from UV exposure.', th: 'ชั้นเคลือบผิวใส ช่วยลดการซีดจางของสีพื้นจากรังสี UV' },
    // Reuse the lightweight clear-film shader with an independent coating mesh.
    material: { kind: 'wear', color: '#ebe3f5', roughness: .12, opacity: .10 },
  };
  product.dimensions = { lengthMm: 600, widthMm: 300, thicknessMm: 5 };
  product.layers = [uv, ...FLOOR_STORY_LAYER_IDS.slice(1).map((id, index) => {
    const layer = product.layers.find(layer => layer.id === id)!;
    layer.order = index + 1;
    layer.thicknessMm = FLOOR_STORY_THICKNESS_MM[id];
    if (id === 'wear') {
      layer.label = { en: 'Wear Layer', th: 'ชั้นป้องกันรอยขีดข่วน' };
      layer.description = { en: 'A clear protective layer that helps resist scratches from everyday use.', th: 'ชั้นใสป้องกันผิว ช่วยลดรอยขีดข่วนจากการใช้งานประจำวัน' };
      layer.material.opacity = .16;
    }
    if (id === 'decor') layer.label = { en: 'Color Film', th: 'ชั้นฟิล์มลวดลายไม้' };
    if (id === 'backing') layer.label = { en: 'IXPE Foam', th: 'ชั้นโฟมรองพื้น IXPE' };
    if (layer.material.kind === 'core') layer.material.color = '#e4e3df';
    return layer;
  })];
  product.maps = undefined;
  return product;
}
