import assert from 'node:assert/strict';
import test from 'node:test';
import { ModelAdmissionError } from '../dist/model/admission.js';
import { snapshotModelInput } from '../dist/model/model-admission-policy.js';
import { createModelAdmissionWork } from '../dist/model/model-admission-kernel.js';
import { createModelDescriptorValidation } from '../dist/model/model-descriptor-validation.js';
import { decodePreparedModel } from '../dist/model/model-preparation-kernel.js';
import { drainModelWork } from '../dist/model/model-work.js';
import { encodeGltf, interleavedFixture, stridedIndexFixture } from './fixtures/model-prepared-gltf.mjs';
import { binaryStl, encode } from './fixtures/model-prepared-text.mjs';
import { pcdFixture, plyFixture } from './fixtures/model-prepared-binary.mjs';
import { triangleJson } from './model-fixtures.mjs';

const solid = name => `solid ${name}\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid ${name}\n`;
async function decoded(bytes, format) {
  const admitted = drainModelWork(createModelAdmissionWork(snapshotModelInput(bytes, format)));
  return { admitted, descriptor: await decodePreparedModel(admitted) };
}
const validate = (descriptor, admitted) => drainModelWork(createModelDescriptorValidation(descriptor, admitted), { bytes: 1, scalars: 1, records: 1 });
async function rejects(bytes, format, mutate) {
  const { admitted, descriptor } = await decoded(bytes, format);
  assert.equal(validate(structuredClone(descriptor), admitted).protocol, 1, 'the genuine descriptor validates');
  mutate(descriptor, admitted);
  assert.throws(() => validate(descriptor, admitted), ModelAdmissionError);
}
const plyBytes = () => plyFixture({ properties: [['double', 'x'], ['double', 'y'], ['double', 'z'], ['double', 'u'], ['double', 'v'], ['uchar', 'red'], ['uchar', 'green'], ['uchar', 'blue']],
  vertices: [[0, 0, 0, 0, 0, 255, 0, 0], [1, 0, 0, 1, 0, 0, 255, 0], [0, 1, 0, 0, 1, 0, 0, 255]], faces: [[0, 1, 2]] }).input.input.bytes;

test('multi-solid STL descriptors validate per-group material references and STL-only geometry facts', async () => {
  const { admitted, descriptor } = await decoded(encode(solid('first') + solid('second')), 'stl');
  assert.equal(descriptor.geometries[0].groups.length, 2);
  assert.equal(validate(descriptor, admitted), descriptor);
  await rejects(encode(solid('first') + solid('second')), 'stl', d => { d.geometries[0].groupNames = [7]; });
  await rejects(binaryStl({ color: true }), 'stl', d => { d.geometries[0].alpha = 2; });
  await rejects(binaryStl({ color: true }), 'stl', d => { d.geometries[0].hasColors = 'yes'; });
});

test('a node with several materials requires every group to reference one of them', async () => {
  const bytes = encode(solid('first') + solid('second'));
  const { admitted, descriptor } = await decoded(bytes, 'stl');
  const mesh = descriptor.nodes.find(node => node.geometry !== null);
  mesh.materials = [0, 0];
  descriptor.geometries[0].groups = [{ start: 0, count: 3, materialIndex: 0 }, { start: 3, count: 3, materialIndex: 1 }];
  assert.equal(validate(descriptor, admitted), descriptor);
  descriptor.geometries[0].groups[1].materialIndex = 2;
  assert.throws(() => validate(descriptor, admitted), ModelAdmissionError);
});

test('STL-only geometry facts are refused on other formats', async () => {
  const obj = encode('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n');
  for (const [key, value] of [['groupNames', ['solid']], ['hasColors', true], ['alpha', 1]]) {
    await rejects(obj, 'obj', d => { d.geometries[0][key] = value; });
  }
});

test('double-precision PLY channels are admitted only where the plan declares 8-byte float properties', async () => {
  const { admitted, descriptor } = await decoded(plyBytes(), 'ply');
  const attributes = descriptor.geometries[0].attributes;
  assert.equal(attributes.position.array.constructor, Float64Array);
  assert.equal(attributes.uv.array.constructor, Float64Array);
  assert.equal(validate(descriptor, admitted), descriptor);
  await rejects(plyBytes(), 'ply', (d, a) => { a.plan.elements[0].properties.find(property => property.name === 'u').scalar = { kind: 'float', bytes: 4 }; });
  await rejects(plyBytes(), 'ply', d => { d.geometries[0].attributes.normal = { ...d.geometries[0].attributes.position, array: new Float64Array(d.geometries[0].attributes.position.array) }; });
  await rejects(plyBytes(), 'ply', d => { d.geometries[0].attributes.color.colorConversion.output = 'f32'; });
  await rejects(plyBytes(), 'ply', d => { d.geometries[0].attributes.color.normalized = false; });
});

test('index attributes must be unnormalized unsigned scalars', async () => {
  const document = stridedIndexFixture();
  const bytes = encodeGltf(document);
  const { admitted, descriptor } = await decoded(bytes, 'gltf');
  assert.ok(descriptor.geometries[0].indexAttribute, 'a strided index is retained as an attribute');
  assert.equal(validate(descriptor, admitted), descriptor);
  await rejects(bytes, 'gltf', d => { d.geometries[0].indexAttribute.normalized = true; });
  await rejects(bytes, 'gltf', d => { const index = d.geometries[0].indexAttribute; index.array = new Float32Array(index.array); });
});

test('glTF material conversions and line materials are validated by kind', async () => {
  const document = interleavedFixture(); document.meshes[0].primitives[0].mode = 3;
  document.materials = [{ pbrMetallicRoughness: { baseColorFactor: [0.2, 0.4, 0.6, 1] }, emissiveFactor: [0.1, 0.2, 0.3] }];
  document.meshes[0].primitives[0].material = 0;
  const line = encodeGltf(document);
  const { admitted, descriptor } = await decoded(line, 'gltf');
  assert.equal(descriptor.materials[0].kind, 'line-basic');
  assert.equal(validate(descriptor, admitted), descriptor);
  await rejects(line, 'gltf', d => { d.materials[0].linewidth = Number.NaN; });
  await rejects(line, 'gltf', d => { d.materials[0].colorConversion = 'display-p3'; });
  const mesh = triangleJson(); mesh.materials = document.materials; mesh.meshes[0].primitives[0].material = 0;
  const standard = encodeGltf(mesh);
  const parsed = await decoded(standard, 'gltf');
  assert.equal(parsed.descriptor.materials[0].emissiveConversion, 'linear-srgb');
  await rejects(standard, 'gltf', d => { d.materials[0].emissiveConversion = 'srgb'; });
  await rejects(encode('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n'), 'obj', d => { d.materials[0].colorConversion = 'srgb'; });
});

test('plain descriptor records may have a null prototype but never a class prototype', async () => {
  const { admitted, descriptor } = await decoded(encode('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n'), 'obj');
  descriptor.geometries[0].drawRange = Object.assign(Object.create(null), descriptor.geometries[0].drawRange);
  assert.equal(validate(descriptor, admitted), descriptor);
  descriptor.geometries[0].drawRange = new (class Range { start = 0; count = null; })();
  assert.throws(() => validate(descriptor, admitted), ModelAdmissionError);
});

test('packed PCD colors keep their byte storage and float output conversion', async () => {
  const bytes = pcdFixture({ fields: [['x', 'F'], ['y', 'F'], ['z', 'F'], ['rgb', 'U']], points: [[0, 0, 0, 0x00ff8040], [1, 2, 3, 0x000102fe]] }).input.input.bytes;
  const { descriptor } = await decoded(bytes, 'pcd');
  assert.deepEqual(descriptor.geometries[0].attributes.color.colorConversion, { space: 'srgb', scale: 255, output: 'f32' });
  await rejects(bytes, 'pcd', d => { d.geometries[0].attributes.color.colorConversion.output = 'u8-normalized'; });
  await rejects(bytes, 'pcd', d => { d.geometries[0].attributes.color.normalized = true; });
});
