import assert from 'node:assert/strict';
import test from 'node:test';
import { BufferGeometry, Float32BufferAttribute, Group, LoadingManager, Mesh, MeshStandardMaterial, Texture } from 'three';
import { admitModel } from '../dist/model/admission.js';
import { parseModel } from '../dist/model/model-parsers.js';
import { validateParsedModel } from '../dist/model/model-validation.js';
import { EmbeddedTextureLoader } from '../dist/model/embedded-texture-loader.js';

const utf8 = (text) => new TextEncoder().encode(text);
const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
const uri = (bytes) => `data:application/octet-stream;base64,${Buffer.from(bytes).toString('base64')}`;
function triangle() {
  return { asset: { version: '2.0' }, buffers: [{ byteLength: 36, uri: uri(new Uint8Array(positions.buffer)) }], bufferViews: [{ buffer: 0, byteLength: 36 }], accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] }], meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], nodes: [{ mesh: 0 }], scenes: [{ nodes: [0] }], scene: 0 };
}
function glb() {
  const document = triangle(); delete document.buffers[0].uri;
  const text = JSON.stringify(document); const json = utf8(text.padEnd(Math.ceil(text.length / 4) * 4, ' '));
  const bytes = new Uint8Array(28 + json.length + 36); const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, bytes.length, true);
  view.setUint32(12, json.length, true); view.setUint32(16, 0x4e4f534a, true); bytes.set(json, 20);
  view.setUint32(20 + json.length, 36, true); view.setUint32(24 + json.length, 0x004e4942, true); bytes.set(new Uint8Array(positions.buffer), 28 + json.length); return bytes;
}
const fixtures = [
  ['gltf', utf8(JSON.stringify(triangle()))], ['glb', glb()],
  ['obj', utf8('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n')],
  ['stl', utf8('solid triangle\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid triangle\n')],
  ['ply', utf8('ply\nformat ascii 1.0\nelement vertex 3\nproperty float x\nproperty float y\nproperty float z\nelement face 1\nproperty list uchar int vertex_indices\nend_header\n0 0 0\n1 0 0\n0 1 0\n3 0 1 2\n')],
  ['xyz', utf8('0 0 0\n1 0 0\n0 1 0\n')],
  ['pcd', utf8('VERSION .7\nFIELDS x y z\nSIZE 4 4 4\nTYPE F F F\nCOUNT 1 1 1\nWIDTH 3\nHEIGHT 1\nPOINTS 3\nDATA ascii\n0 0 0\n1 0 0\n0 1 0\n')],
];

test('actual standard loaders parse every admitted minimal format with zero fetches', async () => {
  const fetch = globalThis.fetch; let requests = 0;
  globalThis.fetch = () => { requests++; throw new Error('Unexpected model resource fetch'); };
  try {
    for (const [format, bytes] of fixtures) {
      const result = await parseModel(admitModel(bytes, format));
      assert.equal(result.vertices, 3, format); assert.ok(result.indices <= 3, format);
      assert.deepEqual(result.bounds.min.toArray(), [0, 0, 0]); assert.deepEqual(result.bounds.max.toArray(), [1, 1, 0]);
      result.dispose(); result.dispose();
    }
    assert.equal(requests, 0);
  } finally { globalThis.fetch = fetch; }
});

test('parsed geometry and material disposal happens exactly once', async () => {
  const result = await parseModel(admitModel(fixtures[2][1], 'obj'));
  let geometries = 0; let materials = 0;
  result.object.traverse((object) => {
    object.geometry?.addEventListener('dispose', () => geometries++);
    if (object.material) object.material.addEventListener('dispose', () => materials++);
  });
  result.dispose(); result.dispose(); assert.equal(geometries, 1); assert.equal(materials, 1);
});

test('cancellation rejects before parsing and after asynchronous glTF completion', async () => {
  const receipt = admitModel(fixtures[0][1], 'gltf');
  const before = new AbortController(); before.abort();
  await assert.rejects(parseModel(receipt, { signal: before.signal }), { name: 'AbortError' });
  const during = new AbortController(); const pending = parseModel(receipt, { signal: during.signal }); during.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});

test('post-parser validation rejects nonfinite attributes, invalid indices and count inflation', () => {
  const receipt = admitModel(fixtures[2][1], 'obj');
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  const mesh = new Mesh(geometry, new MeshStandardMaterial());
  try {
    geometry.attributes.position.array[0] = NaN; assert.throws(() => validateParsedModel([mesh], receipt));
    geometry.attributes.position.array[0] = 0; geometry.setIndex([0, 1, 4]); assert.throws(() => validateParsedModel([mesh], receipt));
    geometry.setIndex(null); geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(12), 3)); assert.throws(() => validateParsedModel([mesh], receipt));
  } finally { geometry.dispose(); mesh.material.dispose(); }
});

test('composed transform overflow rejects before camera fitting or rendering', async () => {
  const json = triangle();
  json.nodes = Array.from({ length: 17 }, (_, i) => i === 16 ? { mesh: 0, scale: [1e20, 1e20, 1e20] } : { children: [i + 1], scale: [1e20, 1e20, 1e20] });
  await assert.rejects(parseModel(admitModel(utf8(JSON.stringify(json)), 'gltf')));
});

test('post-parser validation accepts empty groups and rejects nonfinite root matrices', () => {
  const receipt = admitModel(utf8(''), 'xyz'); const group = new Group();
  assert.equal(validateParsedModel([group], receipt).bounds, null);
  group.scale.x = Infinity; assert.throws(() => validateParsedModel([group], receipt));
});

const pngUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==';
function texturedTriangle() {
  const json = triangle(); json.images = [{ uri: pngUri }]; json.textures = [{ source: 0 }];
  json.materials = [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }]; json.meshes[0].primitives[0].material = 0;
  return admitModel(utf8(JSON.stringify(json)), 'gltf');
}

test('embedded texture handler prevents fetches and closes decoded images on disposal and rejection', async () => {
  const original = { bitmap: globalThis.createImageBitmap, self: globalThis.self, fetch: globalThis.fetch };
  let closed = 0; let requests = 0; let decoded = 0;
  globalThis.self = globalThis;
  globalThis.fetch = () => { requests++; throw new Error('Unexpected resource fetch'); };
  globalThis.createImageBitmap = async () => { decoded++; return { width: 1, height: 1, close() { closed++; } }; };
  try {
    const parsed = await parseModel(texturedTriangle()); let map;
    parsed.object.traverse((object) => { if (object.material?.map) map = object.material.map; });
    assert.ok(map); let disposed = 0; map.addEventListener('dispose', () => disposed++);
    parsed.dispose(); parsed.dispose(); assert.equal(disposed, 1); assert.equal(closed, 1); assert.equal(decoded, 1); assert.equal(requests, 0);
    globalThis.createImageBitmap = async () => ({ width: 9000, height: 1, close() { closed++; } });
    await assert.rejects(parseModel(texturedTriangle())); assert.equal(closed, 2);
  } finally {
    if (original.bitmap === undefined) delete globalThis.createImageBitmap; else globalThis.createImageBitmap = original.bitmap;
    if (original.self === undefined) delete globalThis.self; else globalThis.self = original.self;
    globalThis.fetch = original.fetch;
  }
});

test('aborting during image decode closes the late bitmap without constructing a model', async () => {
  const original = globalThis.createImageBitmap; let complete; let closed = 0;
  globalThis.createImageBitmap = () => new Promise((resolve) => { complete = resolve; });
  try {
    const controller = new AbortController(); const parsing = parseModel(texturedTriangle(), { signal: controller.signal });
    controller.abort(); complete({ width: 1, height: 1, close() { closed++; } });
    await assert.rejects(parsing, { name: 'AbortError' }); assert.equal(closed, 1);
  } finally { if (original === undefined) delete globalThis.createImageBitmap; else globalThis.createImageBitmap = original; }
});

test('retired embedded handler rejects queued and newly requested textures without using closed images', async () => {
  const source = { width: 1, height: 1 }; const textures = new Set();
  const handler = new EmbeddedTextureLoader(new LoadingManager(), new Map([['owned', source]]), textures);
  let loaded = 0; let errors = 0; let disposed = 0;
  const pending = handler.load('owned', () => loaded++, undefined, () => errors++);
  pending.addEventListener('dispose', () => disposed++);
  handler.retire(); pending.dispose(); await Promise.resolve();
  assert.equal(loaded, 0); assert.equal(errors, 1); assert.equal(disposed, 1); assert.equal(pending.image, null);
  const original = Texture.prototype.dispose; let lateDisposals = 0;
  Texture.prototype.dispose = function () { lateDisposals++; return original.call(this); };
  try {
    const late = handler.load('owned', () => loaded++, undefined, () => errors++); await Promise.resolve();
    assert.equal(lateDisposals, 1); assert.equal(late.image, null); assert.equal(textures.has(late), false); assert.equal(loaded, 0); assert.equal(errors, 2);
  } finally { Texture.prototype.dispose = original; }
});

test('throwing disposal listeners do not prevent remaining owned resources from releasing', async () => {
  const input = utf8('v 0 0 0\nv 1 0 0\nv 0 1 0\no first\nf 1 2 3\no second\nf 1 2 3\n');
  const parsed = await parseModel(admitModel(input, 'obj')); const geometries = []; const materials = new Set(); let released = 0;
  parsed.object.traverse((object) => { if (object.geometry) geometries.push(object.geometry); if (object.material) materials.add(object.material); });
  geometries.forEach((geometry, i) => geometry.addEventListener('dispose', () => { released++; if (!i) throw new Error('Listener failure'); }));
  materials.forEach((material) => material.addEventListener('dispose', () => { released++; throw new Error('Material listener failure'); }));
  assert.throws(() => parsed.dispose(), AggregateError); assert.equal(released, geometries.length + materials.size);
  parsed.dispose(); assert.equal(released, geometries.length + materials.size);
});

test('cleanup failure preserves the original image-validation error', async () => {
  const original = globalThis.createImageBitmap;
  globalThis.createImageBitmap = async () => ({ width: 9000, height: 1, close() { throw new Error('Close listener failure'); } });
  try { await assert.rejects(parseModel(texturedTriangle()), (error) => error.code === 'invalid'); }
  finally { if (original === undefined) delete globalThis.createImageBitmap; else globalThis.createImageBitmap = original; }
});

test('XYZ byte colors enter the same linear working color space as standard PLY/PCD loaders', async () => {
  const parsed = await parseModel(admitModel(utf8('0 0 0 128 128 128\n'), 'xyz'));
  try {
    const colors = parsed.object.geometry.getAttribute('color').array;
    for (const value of colors) assert.ok(Math.abs(value - 0.2158605) < 1e-6);
  } finally { parsed.dispose(); }
});

test('all scenes are validated but displayed bounds and counts belong to the selected scene', async () => {
  const json = triangle(); json.nodes.push({ mesh: 0, translation: [1000, 0, 0] }); json.scenes.push({ nodes: [1] });
  const parsed = await parseModel(admitModel(utf8(JSON.stringify(json)), 'gltf'));
  try { assert.equal(parsed.vertices, 3); assert.deepEqual(parsed.bounds.max.toArray(), [1, 1, 0]); }
  finally { parsed.dispose(); }
});

test('loader culling bounds are recomputed from validated positions instead of declared accessor extrema', async () => {
  const json = triangle(); json.accessors[0].min = [1000, 1000, 1000]; json.accessors[0].max = [1001, 1001, 1001];
  const parsed = await parseModel(admitModel(utf8(JSON.stringify(json)), 'gltf'));
  try {
    let geometry; parsed.object.traverse((object) => { if (object.geometry) geometry = object.geometry; });
    assert.deepEqual(geometry.boundingBox.min.toArray(), [0, 0, 0]); assert.deepEqual(geometry.boundingBox.max.toArray(), [1, 1, 0]);
    assert.deepEqual(geometry.boundingSphere.center.toArray(), [0.5, 0.5, 0]);
  } finally { parsed.dispose(); }
});


test('normal-less PLY meshes use flat shading', async () => {
  const parsed = await parseModel(admitModel(fixtures[4][1], 'ply'));
  try { assert.equal(parsed.object.material.flatShading, true); }
  finally { parsed.dispose(); }
});
