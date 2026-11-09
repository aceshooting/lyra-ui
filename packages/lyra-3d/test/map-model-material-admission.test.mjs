import assert from 'node:assert/strict';
import test from 'node:test';
import { ShaderLib } from 'three';
import { validateModelMaterialChannels, patchModelMaterialShader } from '../dist/map/model-material-adapter.js';
import { attribute, fixture, frame } from './map-model-material-fixture.mjs';

const phong = input => {
  input.material = { kind: 'mesh-phong', name: 'Phong', color: [1, 1, 1], opacity: 1, transparent: false,
    alphaTest: 0, depthWrite: true, side: 0, vertexColors: false, emissive: [0, 0, 0],
    specular: [0.1, 0.1, 0.1], shininess: 30, aoMapIntensity: 1 };
};
const tangent = () => attribute([1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1], 4);
const invalidInputs = [
  ['null geometry', input => { input.geometry = null; }],
  ['null material', input => { input.material = null; }],
  ['prototype-bearing geometry', input => { Object.setPrototypeOf(input.geometry, { inherited: true }); }],
  ['unknown geometry member', input => { input.geometry.execute = () => assert.fail('Executed'); }],
  ['symbol member', input => { input.geometry[Symbol('extra')] = true; }],
  ['non-array color', input => { input.material.color = new Float32Array([1, 1, 1]); }],
  ['short color', input => { input.material.color = [1, 1]; }],
  ['non-string material name', input => { input.material.name = 1; }],
  ['overlong material name', input => { input.material.name = 'x'.repeat(16385); }],
  ['unsupported color conversion', input => { input.material.colorConversion = 'display-p3'; }],
  ['unsupported emissive conversion', input => { input.material.emissiveConversion = 'srgb'; }],
  ['negative shininess', input => { phong(input); input.material.shininess = -1; }],
  ['unsupported specular conversion', input => { phong(input); input.material.specularConversion = 'linear-srgb'; }],
  ['negative metalness', input => { input.material.metalness = -0.01; }],
  ['excessive roughness', input => { input.material.roughness = 1.01; }],
  ['non-boolean depth writing', input => { input.material.depthWrite = 1; }],
  ['non-boolean vertex colors', input => { input.material.vertexColors = 1; }],
  ['non-boolean flat shading', input => { input.material.flatShading = 'true'; }],
  ['missing vertex color channel', input => { input.material.vertexColors = true; }],
  ['preconverted attribute', input => { input.geometry.attributes.position.colorConversion = 'srgb'; }],
  ['short attribute storage', input => { input.geometry.attributes.position.array = new Float32Array(3); }],
  ['unsigned 32-bit vertex storage', input => { input.geometry.attributes.position.array = new Uint32Array(9); }],
  ['normalized float storage', input => { input.geometry.attributes.position.normalized = true; }],
  ['unsupported float precision', input => { input.geometry.attributes.position.array = new Float64Array(9); }],
  ['array masquerading as typed storage', input => { input.geometry.attributes.position.array = Array(9).fill(0); }],
  ['resizable storage', input => { input.geometry.attributes.position.array = new Float32Array(new ArrayBuffer(36, { maxByteLength: 72 })); }],
  ['detached storage', input => { const buffer = input.geometry.attributes.position.array.buffer; structuredClone(buffer, { transfer: [buffer] }); }],
  ['inconsistent UV count', input => { input.geometry.attributes.uv = attribute([0, 0, 1, 0], 2); }],
  ['zero normal', input => { input.geometry.attributes.normal.array.fill(0, 0, 3); }],
  ['zero tangent', input => { input.geometry.attributes.tangent = tangent(); input.geometry.attributes.tangent.array.fill(0, 0, 3); }],
  ['parallel tangent', input => { input.geometry.attributes.tangent = tangent(); input.geometry.attributes.tangent.array.set([0, 0, 1, 1]); }],
  ['invalid tangent handedness', input => { input.geometry.attributes.tangent = tangent(); input.geometry.attributes.tangent.array[3] = 0; }],
  ['signed index', input => { input.geometry.index = new Int16Array([0, 1, 2]); }],
  ['oversized index', input => { input.geometry.index = new Uint8Array(6000001); }],
  ['empty draw range', input => { input.geometry.drawRange.count = 0; }],
  ['unaligned draw start', input => { input.geometry.drawRange = { start: 1, count: 0 }; }],
  ['unaligned group start', input => { input.geometry.groups = [{ start: 1, count: 0, materialIndex: 0 }]; }],
  ['unaligned group count', input => { input.geometry.groups[0].count = 1; }],
  ['unsupported group material', input => { input.geometry.groups[0].materialIndex = 1; }],
  ['non-string texture name', input => { input.textures[0].name = null; }],
  ['overlong texture name', input => { input.textures[0].name = 'x'.repeat(16385); }],
  ['non-boolean texture orientation', input => { input.textures[0].flipY = 0; }],
  ['non-boolean mipmap policy', input => { input.textures[0].generateMipmaps = 'true'; }],
  ['unsupported texture coordinate channel', input => { input.textures[0].texCoord = 2; }],
  ['degenerate flat face', input => { input.material.flatShading = true; input.geometry.attributes.position.array.fill(0); }],
  ['flat face with reversed normal', input => { input.material.flatShading = true; input.geometry.attributes.normal.array[2] = -1; }],
];

for (const [name, change] of invalidInputs) {
  test(`material admission rejects ${name} before returning a render profile`, () => {
    const input = fixture(); change(input);
    assert.throws(() => validateModelMaterialChannels(input), TypeError);
    assert.equal(validateModelMaterialChannels(fixture()).kind, 'mesh-standard', 'a rejection cannot poison the next model');
  });
}

test('material admission never invokes accessors on source records or numeric channels', () => {
  for (const route of ['geometry', 'material', 'attribute', 'tuple']) {
    const input = fixture(); let reads = 0;
    const [object, key] = route === 'geometry' ? [input, 'geometry'] : route === 'material' ? [input.material, 'name'] :
      route === 'attribute' ? [input.geometry.attributes.position, 'array'] : [input.material.color, '0'];
    Object.defineProperty(object, key, { get() { reads++; return 0; } });
    assert.throws(() => validateModelMaterialChannels(input), TypeError);
    assert.equal(reads, 0);
  }
});

test('material profiles preserve normalized signed colors, secondary UVs and open-ended ranges', () => {
  for (const ArrayType of [Int8Array, Int16Array, Uint8Array, Uint8ClampedArray, Uint16Array]) {
    for (const components of [3, 4]) {
      const input = fixture(), max = ArrayType === Int8Array ? 127 : ArrayType === Int16Array ? 32767 : ArrayType === Uint16Array ? 65535 : 255;
      const color = attribute(Array(3 * components).fill(1), components);
      color.array = new ArrayType(3 * components).fill(max); color.normalized = true;
      if (ArrayType === Int8Array || ArrayType === Int16Array) color.array[0] = -max - 1;
      input.geometry.attributes.color = color; input.material.vertexColors = true;
      input.geometry.attributes.uv1 = input.geometry.attributes.uv; delete input.geometry.attributes.uv;
      input.textures[0].texCoord = 1; input.geometry.drawRange.count = null;
      const original = [...color.array];
      const profile = validateModelMaterialChannels(input);
      assert.deepEqual(profile.uvChannels, [1]); assert.equal(profile.colorComponents, components);
      assert.equal(profile.normalMapFrame, 'none'); assert.deepEqual([...color.array], original);
      assert.ok(Object.isFrozen(profile.uvChannels));
      assert.ok(patchModelMaterialShader(ShaderLib.standard, frame(), profile).vertexShader.includes('lrProjectPosition'));
    }
  }
});

for (const [key, value] of [
  ['vertexPrelude', ''], ['fragmentPrelude', null], ['vertexPrelude', 'x'.repeat(1048577)],
  ['defines', 1], ['defines', 'x'.repeat(65537)], ['positionEncoding', 'screen'],
  ['projectFunction', 'otherProject'], ['horizonPositionFunction', 'otherPosition'], ['horizonOccludedFunction', 'otherOcclusion'],
]) {
  test(`shader patching rejects invalid ${key} without changing the pinned shader`, () => {
    const profile = validateModelMaterialChannels(fixture()), invalid = frame(); invalid[key] = value;
    const before = { vertexShader: ShaderLib.standard.vertexShader, fragmentShader: ShaderLib.standard.fragmentShader };
    assert.throws(() => patchModelMaterialShader(ShaderLib.standard, invalid, profile), TypeError);
    assert.deepEqual({ vertexShader: ShaderLib.standard.vertexShader, fragmentShader: ShaderLib.standard.fragmentShader }, before);
    assert.ok(patchModelMaterialShader(ShaderLib.standard, frame(), profile).programKey.startsWith('lr-map-material-1:'));
  });
}
