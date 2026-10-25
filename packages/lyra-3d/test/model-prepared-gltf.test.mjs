import assert from 'node:assert/strict';
import test from 'node:test';
import { Color, ColorManagement, LinearSRGBColorSpace, SRGBColorSpace } from 'three';
import { LinearDisplayP3ColorSpace, LinearDisplayP3ColorSpaceImpl } from 'three/addons/math/ColorSpaces.js';
import { parseModel } from '../dist/model/model-parsers.js';
import { createPreparedGltf } from '../dist/model/parsers/prepared-gltf.js';
import { admittedFixture, basicFixture, interleavedFixture, primitiveFixture, richFixture, stridedIndexFixture } from './fixtures/model-prepared-gltf.mjs';

const constructors = { i8: Int8Array, u8: Uint8Array, u8c: Uint8ClampedArray, i16: Int16Array, u16: Uint16Array, i32: Int32Array, u32: Uint32Array, f32: Float32Array, f64: Float64Array };
function services() { const allocations = []; return { allocations, allocateAttribute(kind, length) { allocations.push([kind, length]); return new constructors[kind](length); }, allocateIndex(kind, length) { allocations.push([kind, length]); return new constructors[kind](length); } }; }
function drain(input, quota) {
  const allocation = services(); const work = createPreparedGltf(input, allocation); let steps = 0;
  try { for (;;) {
    const step = work.step({ bytes: quota, scalars: quota, records: quota }); steps++;
    for (const value of Object.values(step.used)) assert.ok(value <= quota && value >= 0);
    if (step.done) return { value: step.value, steps, allocation, work };
    assert.ok(Object.values(step.used).some(value => value > 0), 'unfinished step must make progress');
  } } catch (error) { work.dispose(); throw error; }
}
function expanded(attribute) { const values = []; for (let i = 0; i < attribute.count; i++) for (let c = 0; c < attribute.itemSize; c++) values.push(attribute.array[i * attribute.stride + attribute.offset + c]); return values; }
function nativeAttribute(attribute) { const array = attribute.isInterleavedBufferAttribute ? attribute.data.array : attribute.array; const stride = attribute.isInterleavedBufferAttribute ? attribute.data.stride : attribute.itemSize; return { array, stride, offset: attribute.offset ?? 0, count: attribute.count, itemSize: attribute.itemSize, normalized: attribute.normalized }; }
function converted(values, conversion) { return conversion ? new Color().setRGB(...values, conversion === 'srgb' ? SRGBColorSpace : LinearSRGBColorSpace).toArray() : values; }
function compareTree(descriptor, id, object) {
  const node = descriptor.nodes[id]; object.updateMatrix();
  assert.equal(node.name, object.name); assert.deepEqual(node.matrix, object.matrix.toArray());
  const expected = object.isPoints ? 'points' : object.isLineSegments ? 'line-segments' : object.isLineLoop ? 'line-loop' : object.isLine ? 'line' : object.isMesh ? 'mesh' : object.isGroup ? 'group' : 'object';
  assert.equal(node.kind, expected); assert.equal(node.children.length, object.children.length);
  if (object.geometry) {
    const geometry = descriptor.geometries[node.geometry];
    assert.deepEqual(Object.keys(geometry.attributes).sort(), Object.keys(object.geometry.attributes).sort());
    for (const [name, actual] of Object.entries(object.geometry.attributes)) {
      const attribute = geometry.attributes[name]; assert.equal(attribute.itemSize, actual.itemSize); assert.equal(attribute.normalized, actual.normalized);
      assert.equal(attribute.array.constructor.name, nativeAttribute(actual).array.constructor.name); assert.deepEqual(expanded(attribute), expanded(nativeAttribute(actual)));
    }
    if (geometry.indexAttribute) {
      assert.equal(geometry.index, null); assert.equal(object.geometry.index.isInterleavedBufferAttribute, true);
      const actual = nativeAttribute(object.geometry.index); assert.equal(geometry.indexAttribute.stride, actual.stride); assert.equal(geometry.indexAttribute.offset, actual.offset); assert.equal(geometry.indexAttribute.count, actual.count); assert.equal(geometry.indexAttribute.itemSize, 1); assert.equal(geometry.indexAttribute.normalized, false);
      assert.equal(geometry.indexAttribute.array.constructor.name, actual.array.constructor.name); assert.deepEqual(Array.from(geometry.indexAttribute.array), Array.from(actual.array)); assert.deepEqual(expanded(geometry.indexAttribute), expanded(actual));
    } else {
      assert.deepEqual(geometry.index && Array.from(geometry.index), object.geometry.index && Array.from(object.geometry.index.array));
      if (geometry.index) assert.equal(geometry.index.constructor.name, object.geometry.index.array.constructor.name);
    }
    assert.deepEqual(geometry.groups, object.geometry.groups); assert.deepEqual(geometry.drawRange, { start: object.geometry.drawRange.start, count: Number.isFinite(object.geometry.drawRange.count) ? object.geometry.drawRange.count : null });
    const material = descriptor.materials[node.materials[0]]; const native = object.material;
    assert.equal(material.name, native.name); assert.deepEqual(converted(material.color, material.colorConversion), native.color.toArray());
    for (const key of ['opacity', 'transparent', 'alphaTest', 'depthWrite', 'side', 'vertexColors']) assert.equal(material[key], native[key], key);
    if (native.isPointsMaterial) { assert.equal(material.kind, 'points'); assert.equal(material.size, native.size); assert.equal(material.sizeAttenuation, native.sizeAttenuation); }
    else if (native.isLineBasicMaterial) { assert.equal(material.kind, 'line-basic'); assert.equal(material.linewidth, native.linewidth); }
    else { assert.equal(material.kind, 'mesh-standard'); for (const key of ['flatShading', 'roughness', 'metalness', 'aoMapIntensity']) assert.equal(material[key], native[key], key); assert.deepEqual(converted(material.emissive, material.emissiveConversion), native.emissive.toArray()); assert.deepEqual(material.normalScale, native.normalScale.toArray()); }
    const slots = material.kind === 'mesh-standard' ? [['baseColor', 'map'], ['normal', 'normalMap'], ['metalness', 'metalnessMap'], ['roughness', 'roughnessMap'], ['emissive', 'emissiveMap'], ['ao', 'aoMap']] : [['map', 'map']];
    for (const [slot, property] of slots) {
      const reference = material.kind === 'mesh-standard' ? material.maps[slot] : material.map;
      assert.equal(reference !== null, Boolean(native[property]), property);
      if (reference !== null) { const texture = descriptor.textures[reference]; assert.equal(texture.texCoord, native[property].channel); assert.equal(texture.colorSpace, native[property].colorSpace === 'srgb' ? 'srgb' : 'none'); assert.equal(texture.flipY, native[property].flipY); assert.equal(texture.generateMipmaps, native[property].generateMipmaps); assert.equal(texture.name, native[property].name);
        const filters = { 9728: 1003, 9729: 1006, 9984: 1004, 9985: 1007, 9986: 1005, 9987: 1008 }; const wraps = { 10497: 1000, 33071: 1001, 33648: 1002 };
        assert.equal(filters[texture.magFilter], native[property].magFilter); assert.equal(filters[texture.minFilter], native[property].minFilter); assert.equal(wraps[texture.wrapS], native[property].wrapS); assert.equal(wraps[texture.wrapT], native[property].wrapT); }
    }
  }
  node.children.forEach((child, index) => compareTree(descriptor, child, object.children[index]));
}
async function compare(document, format = 'gltf') {
  const fixture = admittedFixture(document, format); const reference = await parseModel(fixture.receipt);
  try { let previous; for (const quota of [1, 2, 7, 4096]) {
    const result = drain(fixture.input, quota); compareTree(result.value, result.value.selectedRoot, reference.object);
    if (previous) assert.deepEqual(result.value, previous); previous = result.value;
    assert.throws(() => result.work.step({ bytes: 1, scalars: 1, records: 1 }), /no longer active/);
  } } finally { reference.dispose(); }
}

test('prepared glTF and GLB preserve actual minimal loader output across work quotas', async () => { await compare(basicFixture()); await compare(basicFixture(), 'glb'); });
test('prepared glTF preserves all admitted primitive modes and unsigned index widths', async () => { for (let mode = 0; mode <= 6; mode++) for (const width of ['u8', 'u16', 'u32']) await compare(primitiveFixture(mode, width)); });
test('prepared glTF preserves interleaved buffers, aliases and transforms', async () => {
  const document = interleavedFixture(); document.nodes = [{ name: 'Parent node', children: [1], translation: [2, 3, 4] }, { mesh: 0, rotation: [0, 0, Math.SQRT1_2, Math.SQRT1_2] }, { mesh: 0, scale: [2, 3, 4] }];
  document.scenes = [{ nodes: [0] }, { nodes: [2] }]; document.scene = 1; await compare(document);
  const result = drain(admittedFixture(document).input, 1).value; assert.equal(result.roots.length, 2);
  const geometryNodes = result.nodes.filter(node => node.geometry !== null); assert.equal(geometryNodes[0].geometry, geometryNodes[1].geometry);
  const attrs = result.geometries[geometryNodes[0].geometry].attributes; assert.equal(attrs.position.array, attrs.normal.array);
});
test('prepared glTF preserves normalized colors, UV channels and textured material variants', async () => {
  const before = { bitmap: globalThis.createImageBitmap, self: globalThis.self, fetch: globalThis.fetch }; let fetches = 0;
  globalThis.self = globalThis; globalThis.createImageBitmap = async () => ({ width: 1, height: 1, close() {} }); globalThis.fetch = () => { fetches++; throw new Error('Unexpected fetch'); };
  try { for (const mode of [0, 1, 2, 3, 4]) for (const tangent of [false, true]) for (const channel of [0, 1]) await compare(richFixture(mode, tangent, channel)); assert.equal(fetches, 0); }
  finally { for (const [key, value] of [['createImageBitmap', before.bitmap], ['self', before.self], ['fetch', before.fetch]]) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } }
});
test('prepared glTF performs no allocations before stepping and disposes partial ownership', () => {
  const input = admittedFixture(interleavedFixture()).input;
  for (const cutoff of [0, 1, 7, 30]) { const allocation = services(); const work = createPreparedGltf(input, allocation); assert.equal(allocation.allocations.length, 0); for (let i = 0; i < cutoff; i++) assert.equal(work.step({ bytes: 1, scalars: 1, records: 1 }).done, false); work.dispose(); work.dispose(); assert.throws(() => work.step({ bytes: 1, scalars: 1, records: 1 }), /no longer active/); }
  assert.throws(() => createPreparedGltf({ ...input, plan: { format: 'xyz', rows: 1 } }, services()));
});

test('strided indices preserve accepted legacy geometry and full interleaved storage', async () => {
  const document = stridedIndexFixture(); await compare(document);
  const fixture = admittedFixture(document); const reference = await parseModel(fixture.receipt);
  try {
    const descriptor = drain(fixture.input, 1).value; const geometry = descriptor.geometries[0]; let actual;
    reference.object.traverse(object => { if (object.geometry) actual = object.geometry.index; });
    assert.equal(actual.isInterleavedBufferAttribute, true); assert.equal(actual.array, actual.data.array);
    assert.equal(geometry.index, null); assert.equal(geometry.indexAttribute.stride, 4); assert.equal(geometry.indexAttribute.offset, 0);
    assert.deepEqual(expanded(geometry.indexAttribute), [actual.getX(0), actual.getX(1), actual.getX(2)]);
    assert.deepEqual(expanded(geometry.indexAttribute), [0, 1, 2]);
    assert.deepEqual(Array.from(geometry.indexAttribute.array), [0, 19, 20, 21, 1, 22, 23, 24, 2, 25, 26, 27]);
  } finally { reference.dispose(); }
});


test('authored glTF material colors retain precision until main-realm conversion', async () => {
  const previous = { enabled: ColorManagement.enabled, space: ColorManagement.workingColorSpace, p3: Object.getOwnPropertyDescriptor(ColorManagement.spaces, LinearDisplayP3ColorSpace) };
  try {
    ColorManagement.define({ [LinearDisplayP3ColorSpace]: LinearDisplayP3ColorSpaceImpl });
    for (const enabled of [true, false]) {
      ColorManagement.enabled = enabled; ColorManagement.workingColorSpace = LinearDisplayP3ColorSpace;
      await compare(basicFixture());
      const uncolored = basicFixture(); uncolored.materials = [{}]; uncolored.meshes[0].primitives[0].material = 0; await compare(uncolored);
      assert.equal(drain(admittedFixture(basicFixture()).input, 1).value.materials[0].colorConversion, 'srgb');
      assert.equal(drain(admittedFixture(uncolored).input, 1).value.materials[0].colorConversion, undefined);
      const document = basicFixture(); document.materials = [{ pbrMetallicRoughness: { baseColorFactor: [0.123456789012345, 0.345678901234567, 0.987654321098765, 1] }, emissiveFactor: [0.234567890123456, 0.456789012345678, 0.67890123456789] }]; document.meshes[0].primitives[0].material = 0;
      await compare(document);
      const descriptor = drain(admittedFixture(document).input, 1).value; const material = descriptor.materials[0];
      assert.equal(material.colorConversion, 'linear-srgb'); assert.equal(material.emissiveConversion, 'linear-srgb');
      assert.deepEqual(material.color, document.materials[0].pbrMetallicRoughness.baseColorFactor.slice(0, 3));
      assert.notEqual(ColorManagement.workingColorSpace, LinearSRGBColorSpace);
      const actualConversion = converted(material.color, material.colorConversion);
      if (enabled) assert.notDeepEqual(actualConversion, material.color); else assert.deepEqual(actualConversion, material.color);
    }
  } finally {
    ColorManagement.enabled = previous.enabled; ColorManagement.workingColorSpace = previous.space;
    if (previous.p3) Object.defineProperty(ColorManagement.spaces, LinearDisplayP3ColorSpace, previous.p3); else delete ColorManagement.spaces[LinearDisplayP3ColorSpace];
  }
});

test('default and MASK alpha behavior, named empty nodes and empty scenes remain distinct', async () => {
  const document = basicFixture(); document.materials = [{ alphaMode: 'MASK' }]; document.meshes[0].primitives[0].material = 0;
  document.nodes = [{ name: 'Plain node', children: [1] }, { mesh: 0, name: 'Triangle' }]; await compare(document);
  document.materials[0].alphaCutoff = 0.25; await compare(document);
  await compare({ asset: { version: '2.0' }, scenes: [{ name: 'Empty' }] });
  await compare({ asset: { version: '2.0' } });
});

test('authored glTF matrices retain native decomposition with rotation, scale and shear', async () => {
  const document = basicFixture();
  const authored = [0, 2, 0, 0, -3, 0.75, 0, 0, 0.5, 0, 4, 0, 5, -2, 7, 1];
  document.nodes[0].matrix = authored;
  await compare(document);
  const descriptor = drain(admittedFixture(document).input, 1).value;
  const mesh = descriptor.nodes.find(node => node.kind === 'mesh');
  assert.notDeepEqual(mesh.matrix, authored, 'native decomposition must not be replaced with an unprocessed matrix copy');
  assert.deepEqual(mesh.matrix.slice(12, 15), [5, -2, 7]);
});

test('an allocator failure closes glTF work without publishing or touching partial resources again', async () => {
  const document = primitiveFixture(); const fixture = admittedFixture(document);
  const failure = new Error('Attribute allocation refused'); const retained = []; let calls = 0; let resourceReads = 0; let retired = false;
  const input = { ...fixture.input, get resources() { resourceReads++; assert.equal(retired, false, 'retired work must release resource access'); return fixture.input.resources; } };
  const work = createPreparedGltf(input, {
    allocateAttribute(kind, length) { calls++; if (calls === 2) throw failure; const array = new constructors[kind](length); retained.push(array); return array; },
    allocateIndex() { assert.fail('indexed attribute allocation must fail before output allocation'); },
  });
  let caught; let completed = false;
  for (let step = 0; step < 10000; step++) {
    try { if (work.step({ bytes: 1, scalars: 1, records: 1 }).done) { completed = true; break; } }
    catch (error) { caught = error; break; }
  }
  assert.equal(caught, failure); assert.equal(completed, false); assert.equal(calls, 2); assert.equal(retained.length, 1);
  assert.deepEqual(Array.from(retained[0]), [0, 0, 0, 1, 0, 0, 0, 1, 0]);
  const partial = retained[0].slice(); const readsAtFailure = resourceReads; retired = true;
  assert.doesNotThrow(() => { work.dispose(); work.dispose(); });
  assert.throws(() => work.step({ bytes: 1, scalars: 1, records: 1 }), /no longer active/);
  assert.equal(resourceReads, readsAtFailure); assert.equal(calls, 2); assert.deepEqual(retained[0], partial);
  await compare(document);
});
