import assert from 'node:assert/strict';
import test from 'node:test';
import { admitModel, ModelAdmissionError } from '../dist/model/admission.js';
import { MODEL_LIMITS } from '../dist/model/limits.js';
import { dataUri, png, utf8 } from './model-fixtures.mjs';

const refused = (action, code) => assert.throws(action, (error) => error instanceof ModelAdmissionError && (!code || error.code === code));

/**
 * One authored buffer holding every attribute and index encoding glTF allows, with an accessor
 * for each. Cases pick the accessors they need, so each admission rule is exercised in isolation.
 */
function gltfParts() {
  const regions = [];
  let total = 0;
  const region = (typed, view = {}) => {
    const bytes = new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength);
    regions.push({ offset: total, bytes, view });
    const index = regions.length - 1;
    total += Math.ceil(bytes.length / 4) * 4;
    return index;
  };
  const accessors = [];
  const accessor = (name, view, extra) => { accessors.push({ name, ...extra, bufferView: view }); return accessors.length - 1; };
  const ids = {};
  const position = region(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), { target: 34962 });
  ids.POSITION = accessor('position', position, { componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] });
  ids.NORMAL = accessor('normal', region(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1])), { componentType: 5126, count: 3, type: 'VEC3' });
  ids.UV_FLOAT = accessor('uv', region(new Float32Array([0, 0, 1, 0, 0, 1])), { componentType: 5126, count: 3, type: 'VEC2' });
  ids.UV_USHORT = accessor('uv16', region(new Uint16Array([0, 0, 65535, 0, 0, 65535])), { componentType: 5123, count: 3, type: 'VEC2', normalized: true });
  ids.COLOR_VEC3 = accessor('color3', region(new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1])), { componentType: 5126, count: 3, type: 'VEC3' });
  ids.COLOR_UBYTE = accessor('color4', region(new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255])), { componentType: 5121, count: 3, type: 'VEC4', normalized: true });
  ids.TANGENT = accessor('tangent', region(new Float32Array([1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1])), { componentType: 5126, count: 3, type: 'VEC4' });
  ids.INDEX_USHORT = accessor('indices16', region(new Uint16Array([0, 1, 2, 0, 2, 1]), { target: 34963 }), { componentType: 5123, count: 6, type: 'SCALAR' });
  ids.INDEX_UBYTE = accessor('indices8', region(new Uint8Array([0, 1, 2, 0])), { componentType: 5121, count: 4, type: 'SCALAR' });
  ids.INDEX_UINT = accessor('indices32', region(new Uint32Array([0, 1, 2, 1, 2])), { componentType: 5125, count: 5, type: 'SCALAR' });
  ids.INT8 = accessor('int8', region(new Int8Array([1, -2, 3, -4])), { componentType: 5120, count: 4, type: 'SCALAR' });
  ids.INT16 = accessor('int16', region(new Int16Array([1, -2, 3, -4])), { componentType: 5122, count: 4, type: 'SCALAR' });
  ids.UINT32 = accessor('uint32', region(new Uint32Array([1, 2, 3, 4])), { componentType: 5125, count: 4, type: 'SCALAR' });
  const interleaved = region(new Float32Array([0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1]), { byteStride: 24, target: 34962 });
  ids.PACKED_POSITION = accessor('packed position', interleaved, { componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] });
  ids.PACKED_NORMAL = accessor('packed normal', interleaved, { componentType: 5126, count: 3, type: 'VEC3', byteOffset: 12 });
  // A single trailing byte makes the declared buffer length differ from its four byte padded chunk.
  const last = region(new Uint8Array([9]));
  const binary = new Uint8Array(total);
  for (const { offset, bytes } of regions) binary.set(bytes, offset);
  const exactLength = regions[last].offset + 1;
  const make = (primitive = {}, change = () => {}) => {
    const bytes = binary.slice(0, exactLength);
    const placeholder = 'data:application/octet-stream;base64,placeholder';
    const document = {
      asset: { version: '2.0' },
      buffers: [{ byteLength: exactLength, uri: placeholder }],
      bufferViews: regions.map(({ offset, bytes, view }) => ({ buffer: 0, byteOffset: offset, byteLength: bytes.length, ...view })),
      accessors: accessors.map(({ name: _name, ...entry }) => entry),
      meshes: [{ primitives: [{ attributes: { POSITION: ids.POSITION }, ...primitive }] }],
      nodes: [{ mesh: 0 }], scenes: [{ nodes: [0] }], scene: 0,
    };
    change(document, bytes);
    if (document.buffers[0]?.uri === placeholder) document.buffers[0].uri = dataUri(bytes);
    return utf8(JSON.stringify(document));
  };
  return { ids, make, binary, exactLength };
}

const admit = (bytes) => admitModel(bytes, 'gltf');

test('every primitive mode and index width is counted into the vertex and index budget', () => {
  const { ids, make } = gltfParts();
  const cases = [
    ['triangles with 16-bit indices', { indices: ids.INDEX_USHORT }, [3, 6]],
    ['non-indexed triangles', {}, [3, 0]],
    ['points', { mode: 0 }, [3, 0]],
    ['lines with 8-bit indices', { mode: 1, indices: ids.INDEX_UBYTE }, [3, 4]],
    ['a line loop', { mode: 2 }, [3, 0]],
    ['a line strip', { mode: 3 }, [3, 0]],
    ['a triangle strip', { mode: 5 }, [3, 3]],
    ['a triangle fan with 32-bit indices', { mode: 6, indices: ids.INDEX_UINT }, [3, 9]],
  ];
  for (const [name, primitive, expected] of cases) {
    const plan = admit(make(primitive));
    assert.deepEqual([plan.vertices, plan.indices], expected, name);
  }
});

test('primitive modes demand a whole number of their elements', () => {
  const { ids, make } = gltfParts();
  refused(() => admit(make({ indices: ids.INDEX_UBYTE })), 'invalid');
  refused(() => admit(make({ mode: 4, indices: ids.INDEX_UINT })), 'invalid');
  refused(() => admit(make({ mode: 1 })), 'invalid');
  refused(() => admit(make({ mode: 1, indices: ids.INDEX_USHORT }, (document) => { document.accessors[ids.INDEX_USHORT].count = 5; })), 'invalid');
  refused(() => admit(make({ mode: 3, indices: ids.INDEX_UBYTE }, (document) => { document.accessors[ids.INDEX_UBYTE].count = 1; })), 'invalid');
  refused(() => admit(make({ mode: 5, indices: ids.INDEX_UBYTE }, (document) => { document.accessors[ids.INDEX_UBYTE].count = 2; })), 'invalid');
  refused(() => admit(make({ mode: 7 })), 'limit');
  refused(() => admit(make({ mode: -1 })), 'invalid');
});

test('attributes must match the position count, component width and a legal encoding', () => {
  const { ids, make } = gltfParts();
  const plan = admit(make({ attributes: {
    POSITION: ids.POSITION, NORMAL: ids.NORMAL, TANGENT: ids.TANGENT, TEXCOORD_0: ids.UV_FLOAT, TEXCOORD_1: ids.UV_USHORT, COLOR_0: ids.COLOR_UBYTE,
  } }));
  assert.equal(plan.vertices, 3);
  assert.equal(admit(make({ attributes: { POSITION: ids.POSITION, COLOR_0: ids.COLOR_VEC3 } })).vertices, 3, 'three-channel float colors');
  assert.equal(admit(make({ attributes: { POSITION: ids.PACKED_POSITION, NORMAL: ids.PACKED_NORMAL } })).vertices, 3, 'interleaved attributes share one strided view');
  const bad = (attributes) => refused(() => admit(make({ attributes })));
  bad({ POSITION: ids.NORMAL });
  bad({ POSITION: ids.POSITION, NORMAL: ids.UV_FLOAT });
  bad({ POSITION: ids.POSITION, TEXCOORD_0: ids.NORMAL });
  bad({ POSITION: ids.POSITION, COLOR_0: ids.UV_FLOAT });
  bad({ POSITION: ids.POSITION, TANGENT: ids.NORMAL });
  bad({ POSITION: ids.POSITION, NORMAL: ids.UV_USHORT });
  bad({ POSITION: ids.POSITION, TEXCOORD_0: ids.INT16 });
  bad({ POSITION: ids.POSITION, JOINTS_0: ids.UV_FLOAT });
  bad({ POSITION: ids.POSITION, NORMAL: 99 });
  refused(() => admit(make({}, (document) => { document.accessors[0].count = 2; document.accessors[1].count = 3; document.meshes[0].primitives[0].attributes.NORMAL = 1; })));
  refused(() => admit(make({ indices: ids.NORMAL })));
  refused(() => admit(make({ indices: ids.INDEX_UINT }, (document) => { document.accessors[ids.INDEX_UINT].normalized = true; })));
  refused(() => admit(make({ indices: ids.UINT32 })), 'invalid');
});

test('accessors read every legal component type and refuse malformed ones', () => {
  const { ids, make } = gltfParts();
  // The authored document carries signed byte, signed short and unsigned int accessors that no
  // primitive uses; admission still reads every value of every accessor.
  assert.equal(admit(make()).vertices, 3);
  const mutate = (change) => refused(() => admit(make({}, (document) => change(document.accessors))));
  mutate((accessors) => { accessors[ids.NORMAL].componentType = 5124; });
  mutate((accessors) => { accessors[ids.NORMAL].type = 'MAT4'; });
  mutate((accessors) => { accessors[ids.NORMAL].type = 7; });
  mutate((accessors) => { accessors[ids.NORMAL].normalized = true; });
  mutate((accessors) => { accessors[ids.NORMAL].normalized = 'yes'; });
  mutate((accessors) => { accessors[ids.NORMAL].count = 0; });
  mutate((accessors) => { accessors[ids.NORMAL].count = 4; });
  mutate((accessors) => { accessors[ids.NORMAL].byteOffset = 2; });
  mutate((accessors) => { accessors[ids.NORMAL].min = [0]; });
  mutate((accessors) => { accessors[ids.NORMAL].max = [0, 0, Number.POSITIVE_INFINITY]; });
  mutate((accessors) => { accessors[ids.NORMAL].bufferView = 99; });
  // A non-finite float hidden in the binary data is found even when no primitive uses it.
  refused(() => admit(make({}, (document, bytes) => {
    void document;
    new DataView(bytes.buffer).setFloat32(36, Number.NaN, true);
  })), 'invalid');
});

test('buffer views keep their stride, target and extent inside the buffer', () => {
  const { make } = gltfParts();
  const mutate = (change) => refused(() => admit(make({}, (document) => change(document.bufferViews))));
  mutate((views) => { views[0].target = 1234; });
  mutate((views) => { views[0].byteStride = 2; });
  mutate((views) => { views[0].byteStride = 253; });
  mutate((views) => { views[0].byteLength = 0; });
  mutate((views) => { views[0].byteOffset = 10_000; });
  mutate((views) => { views[0].buffer = 3; });
  mutate((views) => { views[0].unknown = 1; });
});

test('asset metadata, samplers, textures and materials accept the documented fields only', () => {
  const { make } = gltfParts();
  const image = { uri: dataUri(png(), 'image/png') };
  const richMaterial = (document) => {
    document.asset = { version: '2.0', minVersion: '2.0', generator: 'authored', copyright: 'public domain' };
    document.images = [image];
    document.samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33648 }, { magFilter: 9728, minFilter: 9728, wrapS: 10497 }];
    document.textures = [{ source: 0, sampler: 0 }, { source: 0, sampler: 1 }, { source: 0 }];
    document.materials = [{
      pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], baseColorTexture: { index: 0, texCoord: 1 }, metallicFactor: 0.5, roughnessFactor: 0.5, metallicRoughnessTexture: { index: 1 } },
      normalTexture: { index: 2, scale: 2 }, occlusionTexture: { index: 0, strength: 0.5 }, emissiveTexture: { index: 1 },
      emissiveFactor: [0, 0, 0], alphaMode: 'MASK', alphaCutoff: 0.5, doubleSided: true, name: 'authored',
    }];
    document.meshes[0].primitives[0].material = 0;
  };
  const plan = admit(make({}, richMaterial));
  assert.equal(plan.resources, 2);
  assert.ok(plan.imagePixels > 0);
  const mutations = [
    ['an unsupported minimum version', (document) => { document.asset.minVersion = '1.0'; }],
    ['a non-text generator', (document) => { document.asset.generator = 7; }],
    ['an oversized copyright', (document) => { document.asset.copyright = 'c'.repeat(4097); }],
    ['an unknown magnification filter', (document) => { document.samplers[0].magFilter = 1; }],
    ['an unknown minification filter', (document) => { document.samplers[0].minFilter = 1; }],
    ['an unknown wrap mode', (document) => { document.samplers[0].wrapT = 1; }],
    ['a texture sampler out of range', (document) => { document.textures[0].sampler = 9; }],
    ['a texture image out of range', (document) => { document.textures[0].source = 9; }],
    ['a third texture coordinate set', (document) => { document.materials[0].pbrMetallicRoughness.baseColorTexture.texCoord = 2; }],
    ['a non-numeric normal scale', (document) => { document.materials[0].normalTexture.scale = 'big'; }],
    ['a non-numeric occlusion strength', (document) => { document.materials[0].occlusionTexture.strength = Number.NaN; }],
    ['a short base color', (document) => { document.materials[0].pbrMetallicRoughness.baseColorFactor = [1, 1, 1]; }],
    ['a non-numeric metallic factor', (document) => { document.materials[0].pbrMetallicRoughness.metallicFactor = '1'; }],
    ['an emissive texture out of range', (document) => { document.materials[0].emissiveTexture.index = 9; }],
    ['a long emissive factor', (document) => { document.materials[0].emissiveFactor = [0, 0, 0, 0]; }],
    ['an unknown alpha mode', (document) => { document.materials[0].alphaMode = 'ADD'; }],
    ['a non-numeric alpha cutoff', (document) => { document.materials[0].alphaCutoff = null; }],
    ['a non-boolean double-sided flag', (document) => { document.materials[0].doubleSided = 1; }],
    ['an unknown material field', (document) => { document.materials[0].extensions = {}; }],
    ['a primitive material out of range', (document) => { document.meshes[0].primitives[0].material = 4; }],
  ];
  for (const [name, mutate] of mutations) refused(() => admit(make({}, (document) => { richMaterial(document); mutate(document); })), undefined, name);
});

test('nodes compose by matrix or by translation, rotation and scale and form a bounded forest', () => {
  const { make } = gltfParts();
  assert.equal(admit(make({}, (document) => { document.nodes = [{ mesh: 0, matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], name: 'authored' }]; })).vertices, 3);
  assert.equal(admit(make({}, (document) => { document.nodes = [{ mesh: 0, translation: [1, 2, 3], rotation: [0, 0, 0, 1], scale: [1, 1, 1] }]; })).vertices, 3);
  assert.equal(admit(make({}, (document) => { document.nodes = [{ mesh: 0 }, { mesh: 0 }]; document.scenes = [{ nodes: [0, 1] }]; })).vertices, 6, 'two instances count twice');
  const bad = (change) => refused(() => admit(make({}, change)));
  bad((document) => { document.nodes = [{ mesh: 0, matrix: new Array(16).fill(0), translation: [0, 0, 0] }]; });
  bad((document) => { document.nodes = [{ mesh: 0, rotation: [0, 0, 1] }]; });
  bad((document) => { document.nodes = [{ mesh: 0, matrix: [1] }]; });
  bad((document) => { document.nodes = [{ mesh: 0, children: [0] }]; });
  bad((document) => { document.nodes = [{ children: [1] }, { children: [0], mesh: 0 }]; document.scenes = [{ nodes: [0] }]; });
  bad((document) => { document.nodes = [{ children: [2] }, { children: [2] }, { mesh: 0 }]; document.scenes = [{ nodes: [0, 1] }]; });
  bad((document) => { document.nodes = [{ mesh: 0 }, { mesh: 0, children: [5] }]; });
  bad((document) => { document.scenes = [{ nodes: [0, 0] }]; });
  bad((document) => { document.scenes = [{ nodes: [3] }]; });
  bad((document) => { document.scene = 2; });
  bad((document) => { document.nodes = [{ mesh: 4 }]; });
  bad((document) => { document.meshes = [{ primitives: [] }]; });
  bad((document) => { document.meshes = [{ primitives: [{ attributes: { POSITION: 0 }, extras: {} }] }]; });
});

test('GLB buffer chunks are zero padded to a four byte boundary and consumed exactly once', () => {
  const { binary, exactLength, make } = gltfParts();
  const base = JSON.parse(new TextDecoder().decode(make()));
  delete base.buffers[0].uri;
  const pack = (document, chunk) => {
    const text = JSON.stringify(document);
    const json = utf8(text.padEnd(Math.ceil(text.length / 4) * 4, ' '));
    const bytes = new Uint8Array(12 + 8 + json.length + 8 + chunk.length);
    const view = new DataView(bytes.buffer);
    view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, bytes.length, true);
    view.setUint32(12, json.length, true); view.setUint32(16, 0x4e4f534a, true); bytes.set(json, 20);
    const offset = 20 + json.length;
    view.setUint32(offset, chunk.length, true); view.setUint32(offset + 4, 0x004e4942, true); bytes.set(chunk, offset + 8);
    return bytes;
  };
  assert.ok(binary.length > exactLength && binary.length - exactLength <= 3, 'the chunk has padding after the declared length');
  assert.equal(admitModel(pack(base, binary), 'glb').vertices, 3);
  const dirty = binary.slice(); dirty[binary.length - 1] = 7;
  refused(() => admitModel(pack(base, dirty), 'glb'), 'invalid');
  const long = new Uint8Array(binary.length + 4); long.set(binary);
  refused(() => admitModel(pack(base, long), 'glb'), 'invalid');
  refused(() => admitModel(pack(base, binary.subarray(0, exactLength - 1)), 'glb'), 'invalid');
  const withUri = JSON.parse(JSON.stringify(base)); withUri.buffers[0].uri = dataUri(binary.subarray(0, exactLength));
  refused(() => admitModel(pack(withUri, binary), 'glb'), 'invalid');
  const unused = JSON.parse(JSON.stringify(base));
  for (const key of ['buffers', 'bufferViews', 'accessors', 'meshes', 'nodes', 'scenes']) unused[key] = [];
  delete unused.scene;
  refused(() => admitModel(pack(unused, binary), 'glb'), 'invalid');
  refused(() => admitModel(pack(base, binary).subarray(0, 18), 'glb'), 'invalid');
});

test('buffers and base64 payloads are validated byte for byte', () => {
  const { make } = gltfParts();
  const bad = (change) => refused(() => admit(make({}, change)));
  bad((document) => { document.buffers[0].byteLength += 4; });
  bad((document) => { document.buffers[0].uri = 'https://example.test/model.bin'; });
  bad((document) => { document.buffers[0].uri = 'data:application/octet-stream;base64,'; });
  bad((document) => { document.buffers[0].uri = 'data:application/octet-stream;base64,AAA'; });
  bad((document) => { document.buffers[0].uri = `data:application/octet-stream;base64,${'A'.repeat(4)}!`; });
  bad((document) => { document.buffers[0].uri = 'data:application/octet-stream;base64,A==='; });
  bad((document) => { document.buffers[0].uri = 'data:application/octet-stream;base64,AB=='.replace('AB', 'AC'); });
  bad((document) => { document.buffers[0].uri = 7; });
  bad((document) => { document.buffers.push({ byteLength: 4, uri: dataUri(new Uint8Array(4)), unknown: true }); });
  const alias = admit(make({}, (document, bytes) => { document.buffers[0].uri = dataUri(bytes, 'application/gltf-buffer'); }));
  assert.equal(alias.vertices, 3, 'the registered glTF buffer media type is accepted');
});

test('documents are bounded in depth and token count before they are parsed', () => {
  refused(() => admit(utf8(`${'['.repeat(MODEL_LIMITS.jsonDepth + 1)}${']'.repeat(MODEL_LIMITS.jsonDepth + 1)}`)), 'limit');
  refused(() => admit(utf8(`{"asset":{"version":"2.0"},"extras":[${'0,'.repeat(MODEL_LIMITS.jsonTokens)}0]}`)), 'limit');
  refused(() => admit(utf8('{"asset":{"version":"2.0"')), 'invalid');
  refused(() => admit(utf8('{"asset":{"version":"2.0\\"}}')), 'invalid');
  refused(() => admit(utf8('[]')), 'invalid');
  refused(() => admit(new Uint8Array([0xff, 0xfe])), 'invalid');
});
