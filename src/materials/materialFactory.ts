import { CanvasTexture, Color, MeshPhysicalMaterial, NoColorSpace, RepeatWrapping, SRGBColorSpace, TextureLoader, Vector2, type Texture } from 'three';
import type { ProductConfig } from '../types';
import { generateBackingTextures, generateSurfaceTextures } from '../textures';

export interface MaterialOptions {
  /** Prefix for relative image URLs. Absolute and protocol URLs are unchanged. */
  textureBaseUrl?: string;
  /** Manifest lookup is performed by the host, so missing optional maps never 404. */
  discoveredMaps?: ProductConfig['maps'];
  discoverMaps?: boolean;
  maxAnisotropy?: number;
}

export interface MaterialBundle {
  materials: Map<string, MeshPhysicalMaterial>;
  thumbnail: string;
  dispose(): void;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function makeCoreTexture(seed: number): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d')!;
  const pixels = context.createImageData(128, 128);
  let state = seed >>> 0;
  for (let i = 0; i < pixels.data.length; i += 4) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const n = state / 4294967296;
    const value = Math.round(242 + (n - 0.5) * 16 + (n > 0.98 ? 4 : 0));
    pixels.data[i] = value;
    pixels.data[i + 1] = value;
    pixels.data[i + 2] = value - 2;
    pixels.data[i + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(40, 6);
  return texture;
}

function resolveMapPath(path: string, prefix = ''): string {
  if (/^(?:[a-z][a-z\d+.-]*:|\/)/i.test(path) || !prefix) return path;
  return `${prefix.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

function textureThumbnail(texture: Texture, fallback: string): string {
  const source = texture.image as CanvasImageSource | undefined;
  if (!source) return fallback;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 80;
    canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.87);
  } catch {
    // A cross-origin image without CORS still displays; it cannot be re-exported.
    return fallback;
  }
}

export async function createMaterials(product: ProductConfig, options: MaterialOptions = {}): Promise<MaterialBundle> {
  const surface = generateSurfaceTextures(product);
  const backing = generateBackingTextures(product);
  const coreTexture = makeCoreTexture(product.seed ^ 0x4e21bd);
  const externalTextures = new Set<Texture>();
  const anisotropy = Math.max(1, Math.min(options.maxAnisotropy ?? 8, 16));
  for (const texture of [surface.albedo, surface.normal, surface.roughness, backing.albedo, backing.normal, backing.roughness, coreTexture]) texture.anisotropy = anisotropy;
  const maps: Record<'albedo' | 'normal' | 'roughness', Texture> = { albedo: surface.albedo, normal: surface.normal, roughness: surface.roughness };
  const configuredMaps = { ...options.discoveredMaps, ...product.maps };
  const loader = new TextureLoader();
  await Promise.all((['albedo', 'normal', 'roughness'] as const).map(async role => {
    const path = configuredMaps[role];
    if (!path) return;
    try {
      const texture = await loader.loadAsync(resolveMapPath(path, options.textureBaseUrl));
      texture.colorSpace = role === 'albedo' ? SRGBColorSpace : NoColorSpace;
      texture.wrapS = texture.wrapT = RepeatWrapping;
      texture.anisotropy = anisotropy;
      maps[role] = texture;
      externalTextures.add(texture);
    } catch {
      console.warn(`[SPCPlankViewer] Unable to load configured ${role} map for ${product.id}; using the deterministic procedural map.`);
    }
  }));

  const materials = new Map<string, MeshPhysicalMaterial>();
  for (const layer of product.layers) {
    const spec = layer.material;
    let material: MeshPhysicalMaterial;
    switch (spec.kind) {
      case 'decor':
        material = new MeshPhysicalMaterial({
          color: spec.color ?? '#ffffff',
          map: maps.albedo,
          normalMap: maps.normal,
          normalScale: new Vector2(product.surface.family === 'marble' ? 0.12 : 0.60, product.surface.family === 'marble' ? 0.12 : 0.60),
          roughnessMap: maps.roughness,
          // The generated map already contains the desired roughness range.
          // Multiplying by the same scalar again would make oak unnaturally glossy.
          roughness: spec.roughness === undefined ? 1 : clamp01(spec.roughness),
          metalness: 0,
          clearcoat: clamp01(product.surface.clearcoat),
          clearcoatRoughness: clamp01(product.surface.clearcoatRoughness),
          ior: 1.48,
          envMapIntensity: 0.65,
        });
        break;
      case 'wear':
        material = new MeshPhysicalMaterial({
          color: spec.color ?? '#edf3f6',
          transparent: true,
          opacity: clamp01(spec.opacity ?? 0.35),
          depthWrite: false,
          roughness: spec.roughness ?? 0.18,
          metalness: 0,
          clearcoat: 0.65,
          clearcoatRoughness: 0.16,
          ior: 1.48,
          envMapIntensity: 0.7,
        });
        break;
      case 'core':
        material = new MeshPhysicalMaterial({
          // A near-white aggregate map modulates the configured grey gently.
          color: spec.color ?? '#d5d7d8',
          map: coreTexture,
          roughness: spec.roughness ?? 0.83,
          metalness: 0,
          clearcoat: 0,
          envMapIntensity: 0.35,
        });
        break;
      case 'backing':
        material = new MeshPhysicalMaterial({
          // Albedo already holds the final black; normalize the configured tint
          // so the default black is not multiplied by black a second time.
          color: new Color(spec.color ?? '#161616').multiplyScalar(1 / new Color('#161616').r),
          map: backing.albedo,
          normalMap: backing.normal,
          normalScale: new Vector2(1.2, 1.2),
          roughnessMap: backing.roughness,
          roughness: 1,
          metalness: 0,
          clearcoat: 0,
          envMapIntensity: 0.35,
        });
        break;
      default:
        // Configured extra coatings participate in layout and animation without
        // a hard-coded layer index or an extra branch in the viewer.
        material = new MeshPhysicalMaterial({
          color: spec.color ?? '#f1eee8',
          roughness: spec.roughness ?? 0.55,
          metalness: 0,
          opacity: clamp01(spec.opacity ?? 1),
          transparent: (spec.opacity ?? 1) < 1,
          depthWrite: (spec.opacity ?? 1) >= 1,
          clearcoat: 0.12,
          clearcoatRoughness: 0.28,
        });
    }
    material.name = `${product.id}:${layer.id}`;
    material.userData.baseColor = new Color(material.color);
    material.userData.baseOpacity = material.opacity;
    material.userData.baseTransparent = material.transparent;
    material.userData.baseDepthWrite = material.depthWrite;
    material.userData.layerKind = spec.kind;
    materials.set(layer.id, material);
  }
  let disposed = false;
  return {
    materials,
    thumbnail: maps.albedo === surface.albedo ? surface.thumbnail : textureThumbnail(maps.albedo, surface.thumbnail),
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const material of materials.values()) material.dispose();
      for (const texture of externalTextures) texture.dispose();
      surface.dispose();
      backing.dispose();
      coreTexture.dispose();
    },
  };
}
