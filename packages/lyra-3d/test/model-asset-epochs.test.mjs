import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareModelAsset, instantiatePreparedModel } from '../dist/model/model-asset.js';
import { glbWithImage, png } from './model-fixtures.mjs';

test('retained textured CPU asset survives two epochs without another decode or closing borrowed images', async () => {
  let decoded = 0, closed = 0, serial = 0;
  const live = new Set();
  const budget = { reserve() { const key = `buffer-${serial++}`; live.add(key); let released = false;
    return { key, release() { if (!released) { released = true; assert.ok(live.delete(key)); } } }; },
    admitCounts() {}, noteNativeImage(resource, width, height) { assert.equal(width, 1); assert.equal(height, 1); } };
  const textured = glbWithImage(png(), 'image/png', document => {
    document.bufferViews[0].byteStride = 12;
    document.accessors.push({ bufferView: 0, componentType: 5126, count: 3, type: 'VEC2' });
    document.meshes[0].primitives[0].attributes.TEXCOORD_0 = 1;
  });
  const asset = await prepareModelAsset({ format: 'glb', bytes: textured },
    { execution: 'local', budget }, { async decodeImage() { decoded++; return { width: 1, height: 1, close() { closed++; } }; } });
  assert.equal(asset.storage.filter(row => row.purpose === 'encoded').length, 1);
  assert.equal(asset.storage.filter(row => row.purpose === 'embedded').length, 0, 'GLB views alias encoded backing');
  assert.deepEqual(asset.unknownNativeImages.map(row => [row.width, row.height]), [[1, 1]]);
  const encodedKey = asset.storage.find(row => row.purpose === 'encoded').key;
  let previous;
  for (let epoch = 0; epoch < 2; epoch++) {
    const instance = await instantiatePreparedModel(asset, { budget });
    assert.notEqual(instance.object, previous); previous = instance.object;
    let textured = 0;
    instance.object.traverse(node => { if (node.material?.map) { textured++; assert.ok(node.geometry.getAttribute('uv')); } });
    assert.ok(textured > 0, 'actual model material retains admitted texture and UV');
    instance.dispose(); instance.dispose();
    assert.equal(closed, 0); assert.ok(live.has(encodedKey));
  }
  assert.equal(decoded, 1);
  const final = await instantiatePreparedModel(asset, { budget });
  asset.dispose(); assert.equal(closed, 0, 'live epoch retains native image');
  await assert.rejects(instantiatePreparedModel(asset, { budget }));
  final.dispose(); assert.equal(closed, 1); asset.dispose(); assert.equal(closed, 1);
  assert.equal(live.size, 0);
  await assert.rejects(instantiatePreparedModel({}, { budget }));
});
