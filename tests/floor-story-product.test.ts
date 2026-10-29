import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, MeshPhysicalMaterial, Vector3 } from 'three';
import { products, validateProduct } from '../src/data/products';
import { createPlank } from '../src/geometry/plankGeometry';
import { createFloorStoryProduct } from '../src/website/floorStoryProduct';

test('website cutaways have five contiguous physical layers and preserve the original catalogue', () => {
  const snapshot = structuredClone(products);
  for (const source of products.filter(product => product.surface.family === 'wood')) {
    const product = createFloorStoryProduct(source.id);
    validateProduct(product);
    assert.deepEqual(product.layers.map(layer => layer.id), ['uv', 'wear', 'decor', 'core', 'backing']);
    assert.equal(product.layers[0].label.en, 'UV Layer');
    const materials = new Map(product.layers.map(layer => [layer.id, new MeshPhysicalMaterial()]));
    const model = createPlank(product, materials);
    try {
      assert.equal(model.layers.size, 5);
      const size = new Box3().setFromObject(model.group).getSize(new Vector3());
      for (const [actual, expected] of [[size.x, 60], [size.y, .5], [size.z, 30]]) {
        assert.ok(Math.abs(actual - expected) < 1e-6, 'The assembled sample must remain 600 × 300 × 5 mm');
      }
      let top = .5;
      for (const layer of product.layers) {
        const entry = model.layers.get(layer.id)!;
        const bounds = new Box3().setFromObject(entry.mesh);
        assert.ok(bounds.max.y > bounds.min.y, `${layer.id} needs its own positive-thickness geometry`);
        assert.ok(Math.abs(bounds.max.y - top) < 1e-6, `${layer.id} must meet the layer above without a gap or overlap`);
        top = bounds.min.y;
        for (const attribute of Object.values(entry.mesh.geometry.attributes)) assert.ok([...attribute.array].every(Number.isFinite));
      }
      assert.ok(Math.abs(top) < 1e-6);
    } finally {
      model.dispose();
      materials.forEach(material => material.dispose());
    }
  }
  assert.deepEqual(products, snapshot, 'The V1 explanation must not change catalogue or V2 dimensions');
});
