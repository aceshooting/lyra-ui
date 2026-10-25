import assert from 'node:assert/strict';
import test from 'node:test';
import { ModelAdmissionError } from '../dist/model/admission.js';
import { snapshotModelInput } from '../dist/model/model-admission-policy.js';
import { createModelAdmissionWork } from '../dist/model/model-admission-kernel.js';
import { createModelDescriptorValidation } from '../dist/model/model-descriptor-validation.js';
import { createPreparedXyz } from '../dist/model/parsers/prepared-xyz.js';
import { createModelDecoderServices } from '../dist/model/model-decoder-services.js';
import { drainModelWork } from '../dist/model/model-work.js';

function fixture() {
  const admitted = drainModelWork(createModelAdmissionWork(snapshotModelInput(new TextEncoder().encode('0 0 0'), 'xyz')));
  const descriptor = drainModelWork(createPreparedXyz(admitted, createModelDecoderServices(admitted).services));
  return { admitted, descriptor };
}
const validate = (descriptor, admitted) => drainModelWork(createModelDescriptorValidation(descriptor, admitted));
test('contiguous attribute tails cannot add unchecked rows to materialized geometry', () => {
  for (const tail of [[1, 2, 3], [NaN, 0, 0]]) {
    const { admitted, descriptor } = fixture();
    descriptor.geometries[0].attributes.position.array = Float32Array.from([0, 0, 0, ...tail]);
    assert.throws(() => validate(descriptor, admitted), ModelAdmissionError);
  }
});
test('interleaved attribute tails and fractional native counts are rejected', () => {
  for (const values of [[0, 0, 0, 7, NaN, 0, 0, 8], [0, 0, 0, 7, 8]]) {
    const { admitted, descriptor } = fixture();
    descriptor.geometries[0].attributes.position.array = Float32Array.from(values);
    descriptor.geometries[0].attributes.position.stride = 4;
    assert.throws(() => validate(descriptor, admitted), ModelAdmissionError);
  }
});
test('exact interleaved extent keeps padding outside the rendered components', () => {
  const { admitted, descriptor } = fixture();
  descriptor.geometries[0].attributes.position.array = Float32Array.of(0, 0, 0, NaN);
  descriptor.geometries[0].attributes.position.stride = 4;
  assert.equal(validate(descriptor, admitted), descriptor);
});
test('interleaved index tails cannot hide unchecked indices beyond declared count', () => {
  const { admitted, descriptor } = fixture();
  const expanded = { ...admitted, counts: { ...admitted.counts, indices: 1 } };
  descriptor.geometries[0].indexAttribute = { array: Uint16Array.of(0, 9, 999, 9), itemSize: 1, normalized: false, count: 1, stride: 2, offset: 0 };
  assert.throws(() => validate(descriptor, expanded), ModelAdmissionError);
});
test('sparse numeric material tuples cannot pass finite-value validation', () => {
  const { admitted, descriptor } = fixture();
  descriptor.materials[0].color = new Array(3);
  const transferred = structuredClone(descriptor);
  assert.throws(() => validate(transferred, admitted), ModelAdmissionError);
});

test('distinct texture instances cannot exceed the genuine admitted pixel reservation', async () => {
  const { createPreparedGltf } = await import('../dist/model/parsers/prepared-gltf.js');
  const { glbWithImage, png } = await import('./model-fixtures.mjs');
  const admitted = drainModelWork(createModelAdmissionWork(snapshotModelInput(glbWithImage(png(), 'image/png'), 'glb')));
  const descriptor = drainModelWork(createPreparedGltf(admitted, createModelDecoderServices(admitted).services));
  assert.equal(validate(descriptor, admitted), descriptor);
  descriptor.materials[0].maps.emissive = descriptor.materials[0].maps.baseColor;
  assert.equal(validate(descriptor, admitted), descriptor, 'another reference to the same texture ID is not another texture');
  const texture = descriptor.textures[0];
  descriptor.textures = Array.from({ length: 4 }, (_, index) => ({ ...texture, wrapS: index & 1 ? 10497 : 33071, colorSpace: index & 2 ? 'srgb' : 'none' }));
  assert.throws(() => validate(descriptor, admitted), ModelAdmissionError);
});
test('detached empty attribute storage is rejected while genuine empty storage remains valid', () => {
  const admitted = drainModelWork(createModelAdmissionWork(snapshotModelInput(new Uint8Array(), 'xyz')));
  const descriptor = drainModelWork(createPreparedXyz(admitted, createModelDecoderServices(admitted).services));
  assert.equal(validate(descriptor, admitted), descriptor);
  const array = descriptor.geometries[0].attributes.position.array;
  structuredClone(array.buffer, { transfer: [array.buffer] });
  assert.equal(array.byteLength, 0);
  assert.throws(() => validate(descriptor, admitted), ModelAdmissionError);
});

test('cached matrix ancestry cannot bypass the actual graph-depth limit', () => {
  for (const reverse of [false, true]) {
    const { admitted, descriptor } = fixture(); const leaf = descriptor.nodes[0]; const count = 128;
    descriptor.nodes = Array.from({ length: count }, (_, index) => index === count - 1 ? { ...leaf, children: [] } : { kind: 'group', name: '', matrix: leaf.matrix.slice(), children: [index + 1], geometry: null, materials: [] });
    if (reverse) { descriptor.nodes.reverse(); for (const node of descriptor.nodes) node.children = node.children.map(index => count - 1 - index); descriptor.roots = [count - 1]; descriptor.selectedRoot = count - 1; }
    assert.throws(() => validate(descriptor, admitted), ModelAdmissionError);
  }
});
test('node kind must be an exact enum string rather than a coercible array', () => {
  const { admitted, descriptor } = fixture(); descriptor.nodes[0].kind = ['points'];
  assert.throws(() => validate(descriptor, admitted), ModelAdmissionError);
});
test('XYZ final attributes cannot substitute unsupported storage for the admitted format', () => {
  const { admitted, descriptor } = fixture(); descriptor.geometries[0].attributes.position.array = Float64Array.of(0, 0, 0);
  descriptor.materials[0].opacity = 0.5; descriptor.materials[0].transparent = true;
  assert.throws(() => validate(descriptor, admitted), ModelAdmissionError);
});
test('texture descriptors for the same admitted image share the native texture Source', async () => {
  const { createPreparedGltf } = await import('../dist/model/parsers/prepared-gltf.js');
  const { createModelMaterialization } = await import('../dist/model/model-materialization.js');
  const { glbWithImage, png } = await import('./model-fixtures.mjs');
  const admitted = drainModelWork(createModelAdmissionWork(snapshotModelInput(glbWithImage(png(), 'image/png'), 'glb')));
  const descriptor = drainModelWork(createPreparedGltf(admitted, createModelDecoderServices(admitted).services));
  const first = descriptor.textures[0]; descriptor.textures.push({ ...first, texCoord: 1 }); descriptor.materials[0].maps.normal = 1;
  validate(descriptor, admitted);
  const parsed = drainModelWork(createModelMaterialization(descriptor, admitted, new Map([[first.resource, { width: 1, height: 1, close() {} }]])));
  try { let material; parsed.object.traverse(node => { if (node.material) material = node.material; }); assert.equal(material.map.source, material.normalMap.source); } finally { parsed.dispose(); }
});
