import assert from 'node:assert/strict';
import test from 'node:test';
import { ShaderLib } from 'three';
import { validateModelMaterialChannels, patchModelMaterialShader } from '../dist/map/model-material-adapter.js';

import { attribute, fixture, frame } from './map-model-material-fixture.mjs';

test('pinned standard shader keeps physical view coordinates, native clip, texture UV and alpha coverage', () => {
  const profile = validateModelMaterialChannels(fixture());
  const shader = patchModelMaterialShader(ShaderLib.standard, frame(), profile);
  assert.equal(profile.coverage, 'mask'); assert.deepEqual(profile.uvChannels, [0]);
  assert.ok(shader.vertexShader.includes('modelViewMatrix'));
  assert.ok(shader.vertexShader.includes('vViewPosition = - mvPosition.xyz'));
  assert.ok(shader.vertexShader.includes('lrProjectPosition'));
  assert.ok(shader.fragmentShader.includes('lrHorizonOccluded'));
  for (const chunk of ['map_fragment', 'alphatest_fragment', 'normal_fragment_maps']) assert.ok(shader.fragmentShader.includes(`#include <${chunk}>`));
  assert.ok(shader.vertexShader.includes('#include <uv_vertex>'));
  assert.deepEqual(shader.materialConfiguration, { flatShading: false, premultipliedAlpha: true, transparent: false });
  assert.ok(Object.isFrozen(profile) && Object.isFrozen(shader));
  const changed = frame(); changed.key = 'other-origin'; changed.uniforms[0].value = 100;
  assert.equal(patchModelMaterialShader(ShaderLib.standard, changed, profile).programKey, shader.programKey);
  changed.defines = '#define GLOBE';
  assert.notEqual(patchModelMaterialShader(ShaderLib.standard, changed, profile).programKey, shader.programKey);
});

test('Phong mesh and verified face normals retain their supported material contract', () => {
  const input = fixture();
  input.material = { kind: 'mesh-phong', name: 'STL', color: [1, 1, 1], opacity: 1, transparent: false,
    alphaTest: 0, depthWrite: true, side: 2, vertexColors: false, flatShading: true,
    emissive: [0, 0, 0], specular: [0.1, 0.1, 0.1], shininess: 30, aoMapIntensity: 1 };
  const profile = validateModelMaterialChannels(input);
  assert.equal(profile.flatFaceNormals, true); assert.equal(profile.coverage, 'opaque');
  assert.ok(patchModelMaterialShader(ShaderLib.phong, frame(), profile).vertexShader.includes('vViewPosition'));
});

test('normal maps require an actual admitted tangent or nondegenerate derivative UV frame', () => {
  const input = fixture();
  input.textures.push({ ...input.textures[0], resource: 1, colorSpace: 'none' });
  input.material.maps.normal = 1;
  input.geometry.attributes.tangent = attribute([1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1], 4);
  assert.equal(validateModelMaterialChannels(input).normalMapFrame, 'tangent');
  delete input.geometry.attributes.tangent;
  assert.equal(validateModelMaterialChannels(input).normalMapFrame, 'derivative');
  input.geometry.attributes.uv.array.fill(0);
  assert.throws(() => validateModelMaterialChannels(input));
});

test('incompatible actual channels, unsupported coverage and fabricated profiles fail closed', () => {
  const variants = [input => { delete input.geometry.attributes.normal; },
    input => { delete input.geometry.attributes.uv; }, input => { input.textures[0].texCoord = 1; },
    input => { input.geometry.attributes.normal.count = 2; }, input => { input.geometry.attributes.position.array[0] = NaN; },
    input => { input.geometry.index[2] = 3; }, input => { input.material.transparent = true; },
    input => { input.geometry.attributes.tangent = attribute([1, 0, 0, 1, 0, 0, 1, 0, 0], 3); },
    input => { input.material.kind = 'points'; }, input => { input.geometry.drawRange.count = 4; }];
  for (const change of variants) { const input = fixture(); change(input); assert.throws(() => validateModelMaterialChannels(input)); }
  const profile = validateModelMaterialChannels(fixture());
  assert.throws(() => patchModelMaterialShader(ShaderLib.standard, frame(), { ...profile }));
  assert.throws(() => patchModelMaterialShader({ vertexShader: 'void main(){}', fragmentShader: 'void main(){}' }, frame(), profile));
  assert.throws(() => patchModelMaterialShader({ ...ShaderLib.standard,
    vertexShader: ShaderLib.standard.vertexShader + '\n#include <project_vertex>' }, frame(), profile));
});

test('otherwise valid pinned sources cannot override native clip or validated normal configuration', () => {
  const profile = validateModelMaterialChannels(fixture());
  const variants = [
    { ...ShaderLib.standard, vertexShader: ShaderLib.standard.vertexShader.replace('vViewPosition = - mvPosition.xyz;',
      'vViewPosition = - mvPosition.xyz;\ngl_Position = vec4(0.0);') },
    { ...ShaderLib.standard, vertexShader: '#define FLAT_SHADED\n' + ShaderLib.standard.vertexShader },
    { ...ShaderLib.standard, vertexShader: ShaderLib.standard.vertexShader.replace('#include <defaultnormal_vertex>', '') },
    { ...ShaderLib.standard, fragmentShader: ShaderLib.standard.fragmentShader.replace('#include <normal_fragment_begin>', '') }
  ];
  for (const variant of variants) assert.throws(() => patchModelMaterialShader(variant, frame(), profile));
});

test('only a normalized typed index reaches the material stage; a raw index attribute is refused either way', () => {
  const nonIndexed = fixture(); nonIndexed.geometry.index = null;
  assert.equal(validateModelMaterialChannels(nonIndexed).kind, 'mesh-standard');
  const indexAttribute = attribute([0, 1, 2], 1);
  const unnormalized = fixture(); unnormalized.geometry.index = null; unnormalized.geometry.indexAttribute = indexAttribute;
  assert.throws(() => validateModelMaterialChannels(unnormalized), TypeError);
  const both = fixture(); both.geometry.indexAttribute = indexAttribute;
  assert.throws(() => validateModelMaterialChannels(both), TypeError);
});
