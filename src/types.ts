export type Locale = 'en' | 'th';
export type ViewPreset = 'front' | 'perspective34' | 'stacked' | 'closeup' | 'back' | 'exploded' | 'profile';
export type ExplodeMode = 'lift' | 'stair';
export interface LocalizedText { en: string; th: string }
export interface LayerConfig {
  id: string;
  label: LocalizedText;
  description: LocalizedText;
  thicknessMm: number;
  material: { kind: 'wear' | 'decor' | 'core' | 'backing' | 'coating'; color?: string; roughness?: number; opacity?: number };
  order: number;
}
export interface ProductConfig {
  id: string;
  name: string;
  nameTh: string;
  description: LocalizedText;
  dimensions: { lengthMm: number; widthMm: number; thicknessMm: number };
  seed: number;
  surface: {
    family: 'wood' | 'marble';
    palette: { base: string; light: string; dark: string; speckle?: string };
    grain: { scale: number; contrast: number; cathedral: number; relief: number; flecks: number };
    knots: { count: number; radius: number; strength: number };
    roughness: number;
    clearcoat: number;
    clearcoatRoughness: number;
  };
  backingPattern: 'crosshatch' | 'pebble';
  profile: { tongueMm: number; grooveMm: number; bevelMm: number; backingInsetMm: number };
  maps?: { albedo?: string; normal?: string; roughness?: string };
  layers: LayerConfig[];
}
export interface ViewerOptions {
  productId?: string;
  products?: ProductConfig[];
  view?: ViewPreset;
  autoRotate?: boolean;
  locale?: Locale;
  stackCount?: number;
  pixelRatio?: number;
  dimensions?: boolean;
  textureBaseUrl?: string;
  discoverMaps?: boolean;
}
export interface ViewerEventMap {
  ready: { productId: string };
  productchange: { productId: string; product: ProductConfig };
  viewchange: { view: ViewPreset };
  layerselect: { layerId: string | null };
}
