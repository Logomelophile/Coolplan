import catalog from './products.json';
import type { ProductConfig } from '../types';

export const products = catalog as ProductConfig[];

const finiteRange = (value: number, minimum: number, maximum: number, key: string): void => {
  if (!Number.isFinite(value) || value < minimum || value > maximum) throw new Error(`${key} must be a finite number from ${minimum} to ${maximum}.`);
};
const localized = (value: { en: string; th: string } | undefined, key: string): void => {
  if (!value || typeof value.en !== 'string' || typeof value.th !== 'string' || !value.en.trim() || !value.th.trim()) {
    throw new Error(`${key} requires non-empty English and Thai strings.`);
  }
};

/** Throws for unusable configuration; thickness drift is intentionally a warning. */
export function validateProduct(product: ProductConfig): void {
  const name = product?.id || '(unnamed product)';
  if (!product || typeof product.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product.id)) {
    throw new Error('Product id must be a lowercase, hyphen-separated identifier.');
  }
  if (!product.name?.trim() || !product.nameTh?.trim()) throw new Error(`${name}: name and nameTh are required.`);
  localized(product.description, `${name}.description`);
  if (!product.dimensions || !product.profile || !product.surface) throw new Error(`${name}: dimensions, profile and surface are required.`);
  for (const key of ['lengthMm', 'widthMm', 'thicknessMm'] as const) {
    finiteRange(product.dimensions[key], 0.001, 100000, `${name}.dimensions.${key}`);
  }
  finiteRange(product.seed, 0, 4294967295, `${name}.seed`);
  if (!Number.isInteger(product.seed)) throw new Error(`${name}.seed must be an integer.`);
  if (!['wood', 'marble'].includes(product.surface.family)) throw new Error(`${name}: unsupported surface family.`);
  if (!['crosshatch', 'pebble'].includes(product.backingPattern)) throw new Error(`${name}: unsupported backing pattern.`);
  if (!product.surface.palette || !product.surface.grain || !product.surface.knots) throw new Error(`${name}: palette, grain and knots are required.`);
  for (const key of ['base', 'light', 'dark', 'speckle'] as const) {
    const color = product.surface.palette[key];
    if ((color === undefined && key !== 'speckle') || (color !== undefined && !/^#[0-9a-f]{6}$/i.test(color))) {
      throw new Error(`${name}.surface.palette.${key} must be a six-digit hexadecimal colour.`);
    }
  }
  finiteRange(product.surface.grain.scale, 0.05, 20, `${name}.surface.grain.scale`);
  for (const key of ['contrast', 'cathedral', 'relief', 'flecks'] as const) finiteRange(product.surface.grain[key], 0, 1, `${name}.surface.grain.${key}`);
  for (const key of ['roughness', 'clearcoat', 'clearcoatRoughness'] as const) finiteRange(product.surface[key], 0, 1, `${name}.surface.${key}`);
  finiteRange(product.surface.knots.count, 0, 30, `${name}.surface.knots.count`);
  if (!Number.isInteger(product.surface.knots.count)) throw new Error(`${name}.surface.knots.count must be an integer.`);
  finiteRange(product.surface.knots.radius, 0, 0.5, `${name}.surface.knots.radius`);
  finiteRange(product.surface.knots.strength, 0, 1, `${name}.surface.knots.strength`);
  for (const key of ['tongueMm', 'grooveMm', 'bevelMm', 'backingInsetMm'] as const) finiteRange(product.profile[key], 0, product.dimensions.widthMm / 4, `${name}.profile.${key}`);
  if (!Array.isArray(product.layers) || product.layers.length < 1) throw new Error(`${name}: layers must contain at least one layer.`);
  const ids = new Set<string>();
  const orders = new Set<number>();
  let total = 0;
  for (const layer of product.layers) {
    if (!layer.id || ids.has(layer.id)) throw new Error(`${name}: layer identifiers must be present and unique.`);
    if (!Number.isInteger(layer.order) || orders.has(layer.order)) throw new Error(`${name}: layer orders must be unique integers.`);
    ids.add(layer.id);
    orders.add(layer.order);
    finiteRange(layer.thicknessMm, 0.001, 10000, `${name}.${layer.id}.thicknessMm`);
    localized(layer.label, `${name}.${layer.id}.label`);
    localized(layer.description, `${name}.${layer.id}.description`);
    if (!layer.material || !['wear', 'decor', 'core', 'backing', 'coating'].includes(layer.material.kind)) throw new Error(`${name}.${layer.id}: unsupported material kind.`);
    if (layer.material.color && !/^#[0-9a-f]{6}$/i.test(layer.material.color)) throw new Error(`${name}.${layer.id}: material color must be a six-digit hexadecimal colour.`);
    if (layer.material.roughness !== undefined) finiteRange(layer.material.roughness, 0, 1, `${name}.${layer.id}.roughness`);
    if (layer.material.opacity !== undefined) finiteRange(layer.material.opacity, 0, 1, `${name}.${layer.id}.opacity`);
    total += layer.thicknessMm;
  }
  if (Math.abs(total - product.dimensions.thicknessMm) > 0.001) {
    console.warn(`[SPCPlankViewer] ${name}: layers total ${total.toFixed(3)} mm; declared thickness is ${product.dimensions.thicknessMm} mm.`);
  }
}

export function getProduct(id: string, source: ProductConfig[] = products): ProductConfig {
  const product = source.find((entry) => entry.id === id);
  if (!product) throw new Error(`Unknown SPC product '${id}'. Available products: ${source.map((entry) => entry.id).join(', ')}`);
  validateProduct(product);
  return product;
}

products.forEach(validateProduct);
