import assert from 'node:assert/strict';
import test from 'node:test';
import { BufferAttribute, BufferGeometry, Group, InterleavedBuffer, InterleavedBufferAttribute, LoadingManager, Mesh, MeshStandardMaterial, Points } from 'three';
import { admitModel, ModelAdmissionError } from '../dist/model/admission.js';
import { EmbeddedTextureLoader } from '../dist/model/embedded-texture-loader.js';
import { parseModel } from '../dist/model/model-parsers.js';
import { validateParsedModel } from '../dist/model/model-validation.js';
import { glbWithImage, png, utf8 } from './model-fixtures.mjs';

const OBJ = utf8('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n');

test('a glTF image cannot be decoded without the platform decoder and fails closed as unsupported', async (t) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'createImageBitmap');
  delete globalThis.createImageBitmap;
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'createImageBitmap', previous); });
  await assert.rejects(parseModel(admitModel(glbWithImage(png(), 'image/png'), 'glb')), (error) => error instanceof ModelAdmissionError && error.code === 'unsupported');
});

test('a glTF document without scenes, buffers or views parses to an empty model', async () => {
  const parsed = await parseModel(admitModel(utf8(JSON.stringify({ asset: { version: '2.0' } })), 'gltf'));
  try {
    assert.equal(parsed.vertices, 0);
    assert.equal(parsed.indices, 0);
    assert.equal(parsed.bounds, null);
    assert.ok(parsed.object instanceof Group, 'an empty document still yields something to add to a scene');
  } finally { parsed.dispose(); }
});

test('a PLY file without faces is a point cloud and one with faces is a mesh', async () => {
  const cloud = await parseModel(admitModel(utf8('ply\nformat ascii 1.0\nelement vertex 2\nproperty float x\nproperty float y\nproperty float z\nend_header\n0 0 0\n1 1 1\n'), 'ply'));
  const mesh = await parseModel(admitModel(utf8('ply\nformat ascii 1.0\nelement vertex 3\nproperty float x\nproperty float y\nproperty float z\nelement face 1\nproperty list uchar int vertex_indices\nend_header\n0 0 0\n1 0 0\n0 1 0\n3 0 1 2\n'), 'ply'));
  try {
    assert.ok(cloud.object instanceof Points);
    assert.ok(mesh.object instanceof Mesh);
    assert.deepEqual([cloud.vertices, cloud.indices, mesh.vertices, mesh.indices], [2, 0, 3, 3]);
  } finally { cloud.dispose(); mesh.dispose(); }
});

function triangleMesh(configure = () => {}) {
  const geometry = new BufferGeometry();
  configure(geometry);
  return new Mesh(geometry, new MeshStandardMaterial());
}

test('validation charges a buffer shared by several attributes once and understands interleaved attributes', () => {
  const receipt = admitModel(OBJ, 'obj');
  const shared = new ArrayBuffer(72);
  new Float32Array(shared).set([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1]);
  const sharing = triangleMesh((geometry) => {
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(shared, 0, 9), 3));
    geometry.setAttribute('normal', new BufferAttribute(new Float32Array(shared, 36, 9), 3));
  });
  const measured = validateParsedModel([sharing], receipt);
  assert.equal(measured.vertices, 3);
  assert.deepEqual(measured.bounds.max.toArray(), [1, 1, 0]);
  const interleaved = new InterleavedBuffer(new Float32Array([0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1]), 6);
  const packed = triangleMesh((geometry) => {
    geometry.setAttribute('position', new InterleavedBufferAttribute(interleaved, 3, 0));
    geometry.setAttribute('normal', new InterleavedBufferAttribute(interleaved, 3, 3));
  });
  const packedMeasure = validateParsedModel([packed], receipt);
  assert.equal(packedMeasure.vertices, 3);
  assert.deepEqual(packedMeasure.bounds.max.toArray(), [1, 1, 0]);
  const unfinished = triangleMesh((geometry) => {
    geometry.setAttribute('position', new InterleavedBufferAttribute(new InterleavedBuffer(new Float32Array([0, 0, 0, 0, Number.NaN, 0, 0, 1, 0, 0, 0, 0]), 4), 3, 0));
  });
  assert.throws(() => validateParsedModel([unfinished], receipt), (error) => error instanceof ModelAdmissionError && error.code === 'invalid');
});

test('objects reachable from several roots are measured once', () => {
  const receipt = admitModel(OBJ, 'obj');
  const mesh = triangleMesh((geometry) => geometry.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3)));
  const group = new Group().add(mesh);
  const measured = validateParsedModel([group, mesh, group], receipt);
  assert.equal(measured.vertices, 3, 'three vertices, not nine');
});

test('an embedded texture handler stops loading once its parse was aborted', async () => {
  const controller = new AbortController();
  const textures = new Set();
  const loader = new EmbeddedTextureLoader(new LoadingManager(), new Map([['owned', { width: 1, height: 1 }]]), textures, controller.signal);
  controller.abort();
  const outcomes = [];
  loader.load('owned', () => outcomes.push('loaded'), undefined, (error) => outcomes.push(error.name));
  await Promise.resolve();
  assert.deepEqual(outcomes, ['AbortError']);
  assert.equal(loader.failed, true);
});

test('disposal releases every material of a mesh that carries several', async () => {
  const parsed = await parseModel(admitModel(OBJ, 'obj'));
  let mesh;
  parsed.object.traverse((object) => { if (object instanceof Mesh) mesh = object; });
  const original = mesh.material;
  const extra = new MeshStandardMaterial();
  mesh.material = [original, extra];
  const released = [];
  original.addEventListener('dispose', () => released.push('original'));
  extra.addEventListener('dispose', () => released.push('extra'));
  parsed.dispose();
  assert.deepEqual(released.sort(), ['extra', 'original']);
  parsed.dispose();
  assert.equal(released.length, 2, 'a second disposal releases nothing again');
});
