import assert from 'node:assert/strict';
import test from 'node:test';
import { ModelAdmissionError } from '../dist/model/admission.js';
import { snapshotModelInput } from '../dist/model/model-admission-policy.js';
import { createModelAdmissionWork } from '../dist/model/model-admission-kernel.js';
import { createModelDescriptorValidation } from '../dist/model/model-descriptor-validation.js';
import { createModelMaterialization } from '../dist/model/model-materialization.js';
import { createModelDecoderServices } from '../dist/model/model-decoder-services.js';
import { createPreparedGltf } from '../dist/model/parsers/prepared-gltf.js';
import { drainModelWork } from '../dist/model/model-work.js';
import { triangleJson, png, dataUri, utf8 } from './model-fixtures.mjs';

function fixture(document) {
  const admitted = drainModelWork(createModelAdmissionWork(snapshotModelInput(utf8(JSON.stringify(document)), 'gltf')));
  const descriptor = drainModelWork(createPreparedGltf(admitted, createModelDecoderServices(admitted).services));
  return { admitted, descriptor };
}
const validate = (descriptor, admitted) => drainModelWork(createModelDescriptorValidation(descriptor, admitted));
test('texture variant pixel limits apply even within the admitted texture-instance count', () => {
  const document = triangleJson();
  document.images = [{ uri: dataUri(png(4, 4), 'image/png') }, { uri: dataUri(png(), 'image/png') }];
  document.textures = [{ source: 0 }, { source: 1 }];
  document.materials = [{ pbrMetallicRoughness: { baseColorTexture: { index: 1 } } }]; document.meshes[0].primitives[0].material = 0;
  const { admitted, descriptor } = fixture(document); validate(descriptor, admitted);
  const resource = admitted.resources.findIndex(value => value.kind === 'image' && value.index === 0);
  const first = descriptor.textures[0];
  descriptor.textures = [33071, 33648, 10497].map(wrapS => ({ ...first, resource, wrapS }));
  assert.equal(descriptor.textures.length, 3); assert.equal(admitted.counts.imagePixels, 35);
  assert.throws(() => validate(descriptor, admitted), ModelAdmissionError);
});
test('genuine metallic/roughness UV variants share a Source without multiplying pixel charges', () => {
  const document = triangleJson(); document.images = [{ uri: dataUri(png(), 'image/png') }]; document.textures = [{ source: 0 }];
  document.materials = [0.25, 0.75].map(roughnessFactor => ({ pbrMetallicRoughness: { roughnessFactor, metallicRoughnessTexture: { index: 0, texCoord: 1 } } }));
  document.meshes[0].primitives = [0, 1].map(material => ({ attributes: { POSITION: 0 }, material }));
  const { admitted, descriptor } = fixture(document);
  assert.equal(descriptor.textures.length, 5); assert.equal(admitted.counts.imagePixels, 4); validate(descriptor, admitted);
  const resource = admitted.resources.findIndex(value => value.kind === 'image');
  const parsed = drainModelWork(createModelMaterialization(descriptor, admitted, new Map([[resource, { width: 1, height: 1, close() {} }]])));
  try { const sources = new Set(); parsed.object.traverse(node => { if (node.material) { sources.add(node.material.metalnessMap.source); sources.add(node.material.roughnessMap.source); } }); assert.equal(sources.size, 1); } finally { parsed.dispose(); }
});
