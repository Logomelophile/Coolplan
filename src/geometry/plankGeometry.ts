import { BufferGeometry, Float32BufferAttribute, Group, Mesh, ShapeUtils, Vector2, type MeshPhysicalMaterial } from 'three';
import type { LayerConfig, ProductConfig } from '../types';

export interface LayerEntry {
  config: LayerConfig;
  mesh: Mesh<BufferGeometry, MeshPhysicalMaterial>;
  /** Unexploded mesh centre, in centimetres above the bottom of the plank. */
  baseY: number;
  /** Actual, unscaled layer thickness in centimetres. */
  height: number;
}

export interface PlankModel {
  group: Group;
  layers: Map<string, LayerEntry>;
  /** Geometry only. The material bundle owns its materials and textures. */
  dispose(): void;
}

type SectionPoint = readonly [z: number, y: number];

/** Extrude a physical Z/Y section along X, with long-axis UVs on both faces. */
function extrudeSection(points: SectionPoint[], length: number, textureWidth: number): BufferGeometry {
  points = points.filter((point, index) => {
    const previous = points[(index + points.length - 1) % points.length];
    return Math.hypot(point[0] - previous[0], point[1] - previous[1]) > 1e-10;
  });
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const halfLength = length / 2;
  const yMin = Math.min(...points.map(p => p[1]));
  const yMax = Math.max(...points.map(p => p[1]));
  const put = (x: number, y: number, z: number, nx: number, ny: number, nz: number, u: number, v: number) => {
    positions.push(x, y, z);
    normals.push(nx, ny, nz);
    uvs.push(u, v);
  };

  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const dz = b[0] - a[0];
    const dy = b[1] - a[1];
    const edgeLength = Math.hypot(dz, dy);
    const ny = -dz / edgeLength;
    const nz = dy / edgeLength;
    // Film texture is always longitudinal, including its top and underside.
    const isHorizontal = Math.abs(ny) >= Math.abs(nz);
    const va = isHorizontal ? a[0] / textureWidth + 0.5 : (a[1] - yMin) / (yMax - yMin);
    const vb = isHorizontal ? b[0] / textureWidth + 0.5 : (b[1] - yMin) / (yMax - yMin);
    const corners = [
      [-halfLength, a[1], a[0], 0, va], [halfLength, a[1], a[0], 1, va],
      [halfLength, b[1], b[0], 1, vb], [-halfLength, b[1], b[0], 0, vb],
    ];
    for (const c of [0, 1, 2, 0, 2, 3]) {
      const p = corners[c];
      put(p[0], p[1], p[2], 0, ny, nz, p[3], p[4]);
    }
  }

  const contour = points.map(p => new Vector2(p[0], p[1]));
  for (const triangle of ShapeUtils.triangulateShape(contour, [])) {
    const [a, b, c] = triangle.map(i => points[i]);
    const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const left = area > 0 ? [a, b, c] : [a, c, b];
    for (const sign of [-1, 1]) {
      const face = sign < 0 ? left : [...left].reverse();
      for (const p of face) put(sign * halfLength, p[1], p[0], sign, 0, 0, p[0] / textureWidth + 0.5, (p[1] - yMin) / (yMax - yMin));
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function rectangularSection(left: number, right: number, height: number): SectionPoint[] {
  return [[left, -height / 2], [right, -height / 2], [right, height / 2], [left, height / 2]];
}

function coreSection(width: number, height: number, tongue: number, groove: number, bevel: number): SectionPoint[] {
  const left = -width / 2;
  const shoulder = width / 2 - tongue;
  const right = width / 2;
  const bottom = -height / 2;
  const top = height / 2;
  const b = Math.min(Math.max(0, bevel), height * 0.19, (shoulder - left) * 0.02);
  if (tongue <= 0 || groove <= 0) {
    return [[left + b, bottom], [shoulder - b, bottom], [shoulder, bottom + b], [shoulder, top - b], [shoulder - b, top], [left + b, top], [left, top - b], [left, bottom + b]];
  }
  // The tongue and groove are part of the extrusion, not floating decorative rails.
  // Coordinates are intentionally approximate: the supplied references do not
  // contain a factory locking-profile drawing. The outer envelope remains exact.
  const lower = bottom + height * 0.30;
  const upper = bottom + height * 0.60;
  const grooveDepth = Math.min(groove, width * 0.10);
  return [
    [left + b, bottom], [shoulder - b, bottom], [shoulder, bottom + b],
    [shoulder, lower], [right, lower], [right, upper], [shoulder, upper],
    [shoulder, top - b], [shoulder - b, top], [left + b, top], [left, top - b],
    [left, upper + height * 0.035], [left + grooveDepth, upper + height * 0.035],
    [left + grooveDepth, lower - height * 0.035], [left, lower - height * 0.035],
    [left, bottom + b],
  ];
}

export function createPlank(product: ProductConfig, materials: Map<string, MeshPhysicalMaterial>): PlankModel {
  const group = new Group();
  group.name = `spc-plank:${product.id}`;
  const layers = new Map<string, LayerEntry>();
  const { lengthMm, widthMm, thicknessMm } = product.dimensions;
  const length = lengthMm / 10;
  const width = widthMm / 10;
  const summedThickness = product.layers.reduce((sum, layer) => sum + layer.thicknessMm, 0);
  if (Math.abs(summedThickness - thicknessMm) > 0.01) {
    console.warn(`[SPCPlankViewer] ${product.id}: layer thickness sum ${summedThickness.toFixed(3)} mm differs from declared ${thicknessMm} mm.`);
  }
  const tongue = Math.min(Math.max(0, product.profile.tongueMm / 10), width * 0.1);
  const groove = Math.max(0, product.profile.grooveMm / 10);
  const bevel = Math.max(0, product.profile.bevelMm / 10);
  const inset = Math.max(0, product.profile.backingInsetMm / 10);
  let bottomY = 0;

  // Highest order is the underside; no hard-coded four-layer array is required.
  for (const layer of [...product.layers].sort((a, b) => b.order - a.order)) {
    if (!(layer.thicknessMm > 0)) throw new Error(`Layer ${layer.id} must have positive thickness.`);
    const material = materials.get(layer.id);
    if (!material) throw new Error(`Missing material for layer ${layer.id}.`);
    const height = layer.thicknessMm / 10;
    const isBacking = layer.material.kind === 'backing';
    const left = -width / 2 + (isBacking ? inset : 0);
    const right = width / 2 - tongue - (isBacking ? inset : 0);
    const layerLength = isBacking ? Math.max(length - 2 * inset, length * 0.95) : length;
    const section = layer.material.kind === 'core'
      ? coreSection(width, height, tongue, groove, bevel)
      : rectangularSection(left, right, height);
    const geometry = extrudeSection(section, layerLength, width - tongue);
    // UV remap removes the half-tongue shift so the top's complete image runs 0..1.
    const uv = geometry.getAttribute('uv');
    const normal = geometry.getAttribute('normal');
    for (let i = 0; i < uv.count; i++) {
      if (Math.abs(normal.getY(i)) > 0.7) uv.setY(i, uv.getY(i) + tongue / (2 * (width - tongue)));
    }
    const baseY = bottomY + height / 2;
    const mesh = new Mesh(geometry, material);
    mesh.name = `layer:${layer.id}`;
    mesh.position.y = baseY;
    mesh.castShadow = layer.material.kind !== 'wear';
    mesh.receiveShadow = true;
    mesh.userData.layerId = layer.id;
    mesh.userData.layerKind = layer.material.kind;
    group.add(mesh);
    layers.set(layer.id, { config: layer, mesh, baseY, height });
    bottomY += height;
  }
  let disposed = false;
  return {
    group,
    layers,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const entry of layers.values()) entry.mesh.geometry.dispose();
    },
  };
}
