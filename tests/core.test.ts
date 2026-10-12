import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, MeshPhysicalMaterial, Vector3 } from 'three';
import { products, validateProduct } from '../src/data/products';
import { createPlank } from '../src/geometry/plankGeometry';
import { generateWoodPixels } from '../src/textures/wood';
import { generateMarblePixels } from '../src/textures/marble';
import { sobelNormals } from '../src/textures';
import { easeInOut } from '../src/cameraPresets';

test('a queued frame before animation start cannot produce negative progress', () => {
  assert.equal(easeInOut(-0.1),0);
  assert.equal(easeInOut(1.1),1);
  assert.equal(easeInOut(0.5),0.5);
});

test('all seven products have physically correct bounds, sums and finite geometry', () => {
  assert.equal(products.length,7);
  for (const product of products) {
    validateProduct(product);
    assert.ok(Math.abs(product.layers.reduce((sum,l) => sum+l.thicknessMm,0)-5.3)<1e-9);
    const materials = new Map(product.layers.map(layer => [layer.id,new MeshPhysicalMaterial()]));
    const model = createPlank(product,materials);
    const size = new Box3().setFromObject(model.group).getSize(new Vector3());
    for (const [actual,expected] of [[size.x,122],[size.y,0.53],[size.z,18]]) assert.ok(Math.abs(actual-expected)<0.00001);
    for (const layer of model.layers.values()) {
      for (const attr of Object.values(layer.mesh.geometry.attributes)) assert.ok([...attr.array].every(Number.isFinite));
    }
    model.dispose();
    materials.forEach(material=>material.dispose());
  }
});

test('a fifth layer works with data only and changes physical thickness accurately', () => {
  const product = structuredClone(products[0]);
  product.id = 'test-coating';
  product.dimensions.thicknessMm += 0.2;
  product.layers.push({id:'antibacterial',order:-1,thicknessMm:0.2,label:{en:'Antibacterial coat',th:'ชั้นเคลือบ'},description:{en:'Example extra coating',th:'ตัวอย่างชั้นเคลือบ'},material:{kind:'coating'}});
  validateProduct(product);
  const materials = new Map(product.layers.map(layer=>[layer.id,new MeshPhysicalMaterial()]));
  const model = createPlank(product,materials);
  assert.equal(model.layers.size,5);
  assert.ok(Math.abs(new Box3().setFromObject(model.group).getSize(new Vector3()).y-0.55)<1e-6);
  model.dispose();materials.forEach(material=>material.dispose());
});

test('wood and marble are deterministic and different products produce different maps', () => {
  for (const product of [products[0],products.find(p=>p.surface.family==='marble')!]) {
    const generate = product.surface.family === 'wood' ? generateWoodPixels : generateMarblePixels;
    const a = generate(product,128,32);
    const b = generate(product,128,32);
    assert.deepEqual(a.albedo,b.albedo);
    assert.deepEqual(a.heights,b.heights);
    assert.ok(new Set(a.albedo).size>30);
  }
  assert.notDeepEqual(generateWoodPixels(products[0],128,32).albedo,generateWoodPixels(products[1],128,32).albedo);
});

test('flat height field generates neutral normals without nonfinite values', () => {
  const map = sobelNormals(new Float32Array(64).fill(0.2),8,8,1220,180);
  for (let i=0;i<map.length;i+=4) assert.deepEqual([...map.slice(i,i+4)],[128,128,255,255]);
});
