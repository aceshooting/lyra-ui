import assert from 'node:assert/strict';
import test from 'node:test';
import { admitModel, readModelAdmission, ModelAdmissionError } from '../dist/model/admission.js';
import { snapshotModelInput } from '../dist/model/model-admission-policy.js';
import { createModelAdmissionWork } from '../dist/model/model-admission-kernel.js';
import { drainModelWork } from '../dist/model/model-work.js';
import { plyFixture, pcdFixture } from './fixtures/model-prepared-binary.mjs';
import { binaryStl } from './fixtures/model-prepared-text.mjs';
import { utf8, triangleJson, glbWithImage, png, jpeg } from './model-fixtures.mjs';

const outcome = action => { try { return { value: action() }; } catch (error) { return { code: error instanceof ModelAdmissionError ? error.code : error.name }; } };
function compare(bytes, format, quota) {
  const original = outcome(() => admitModel(bytes, format));
  const candidate = outcome(() => drainModelWork(createModelAdmissionWork(snapshotModelInput(bytes, format)), { bytes: quota, scalars: quota, records: quota }));
  assert.equal(candidate.code, original.code, `${format}/${bytes.length}/${quota}`);
  if (original.value) {
    const { format: admitted, ...counts } = original.value;
    assert.equal(candidate.value.plan.format, admitted); assert.deepEqual(candidate.value.counts, counts);
    assert.deepEqual(candidate.value.input.bytes, readModelAdmission(original.value).bytes);
    assert.deepEqual(candidate.value.resources, readModelAdmission(original.value).resources);
  }
  return candidate.value;
}
const sources = () => [
  ['xyz', utf8('1 2 3\n4 5 6 255 128 0')],
  ['obj', utf8('v 0 0 0\nv 1 0 0\nv 0 1 0\nf -3 -2 -1\ng points\np 1 2\n')],
  ['stl', binaryStl({ color: true })],
  ['stl', utf8('solid example\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid example\n')],
  ...['ascii', 'binary-le', 'binary-be'].map(variant => ['ply', plyFixture({ variant, faces: [[0, 1, 2]] }).input.input.bytes]),
  ...['ascii', 'binary'].map(variant => ['pcd', pcdFixture({ variant }).input.input.bytes]),
  ['gltf', utf8(JSON.stringify(triangleJson()))], ['glb', glbWithImage(png(), 'image/png')], ['glb', glbWithImage(jpeg(), 'image/jpeg')],
];
test('shared format policies match original admission counts, resources and first errors across slicing', () => {
  for (const [format, bytes] of sources()) {
    for (const quota of [1, 7, 65536]) compare(bytes, format, quota);
    for (let i = 0; i < 24; i++) {
      const changed = bytes.slice(); const offset = Math.floor(i * changed.length / 24); changed[offset] ^= 0xff;
      compare(changed, format, 7);
      compare(bytes.subarray(0, offset), format, 7);
    }
  }
});
test('all extracted plans match isolated decoder fixture plans', () => {
  for (const variant of ['ascii', 'binary-le', 'binary-be']) {
    const fixture = plyFixture({ variant, faces: [[0, 1, 2]], faceName: 'vertex_index' });
    assert.deepEqual(compare(fixture.input.input.bytes, 'ply', 7).plan, fixture.input.plan);
  }
  for (const variant of ['ascii', 'binary']) {
    const fixture = pcdFixture({ variant });
    assert.deepEqual(compare(fixture.input.input.bytes, 'pcd', 7).plan, fixture.input.plan);
  }
});
test('glTF security refusals retain the original code before decoding', () => {
  const changes = [
    j => { j.buffers[0].uri = 'https://example.test/a.bin'; },
    j => { j.buffers[0].uri = 'data:application/octet-stream;base64'; },
    j => { j.buffers[0].uri = 'data:application/octet-stream;base64X'; },
    j => { j.accessors[0].count = 2 ** 40; },
    j => { j.accessors[0].sparse = { count: 1 }; },
    j => { j.extensionsUsed = ['KHR_draco_mesh_compression']; },
    j => { j.nodes[0].children = [0]; },
    j => { j.bufferViews[0].byteStride = 3; },
  ];
  for (const change of changes) { const source = triangleJson(); change(source); compare(utf8(JSON.stringify(source)), 'gltf', 1); }
});

test('accepted PLY face header whitespace remains valid when constructing the private plan', () => {
  const fixture = plyFixture({ faces: [[0, 1, 2]] });
  const source = new TextDecoder().decode(fixture.input.input.bytes);
  for (const separator of ['\t', '  ']) {
    const bytes = utf8(source.replace('property list ', `property${separator}list `));
    assert.equal(compare(bytes, 'ply', 1).plan.elements[1].properties[0].name, 'vertex_indices');
  }
});

test('the internal policy rejects an unknown format before reading bytes and remains terminal', () => {
  let reads = 0;
  const input = { format: 'unsupported', get bytes() { reads++; throw new Error('Unsupported input bytes must not be consumed'); } };
  const work = createModelAdmissionWork(input);
  const quota = { bytes: 1, scalars: 1, records: 1 };
  assert.throws(() => drainModelWork(work, quota), error => error instanceof ModelAdmissionError && error.code === 'unsupported');
  assert.equal(reads, 0);
  assert.throws(() => work.step(quota), /no longer active/);
  work.dispose(); work.dispose(); assert.equal(reads, 0);
});
