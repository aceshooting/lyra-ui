import { admitModel, readModelAdmission } from '../../dist/model/admission.js';
import { triangleJson, bytesOf, dataUri, png, utf8 } from '../model-fixtures.mjs';

export function encodeGltf(document, format = 'gltf') {
  if (format === 'gltf') return utf8(JSON.stringify(document));
  const copy = structuredClone(document);
  const binary = Uint8Array.from(Buffer.from(copy.buffers[0].uri.split(',')[1], 'base64'));
  delete copy.buffers[0].uri;
  const encoded = utf8(JSON.stringify(copy)); const size = Math.ceil(encoded.length / 4) * 4;
  const result = new Uint8Array(28 + size + Math.ceil(binary.length / 4) * 4); const view = new DataView(result.buffer);
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, result.length, true);
  view.setUint32(12, size, true); view.setUint32(16, 0x4e4f534a, true); result.fill(32, 20, 20 + size); result.set(encoded, 20);
  view.setUint32(20 + size, result.length - 28 - size, true); view.setUint32(24 + size, 0x004e4942, true); result.set(binary, 28 + size);
  return result;
}

// This projection exercises the isolated decoder after genuine legacy admission; production uses the shared kernel.
export function admittedFixture(document, format = 'gltf') {
  const bytes = encodeGltf(document, format); const receipt = admitModel(bytes, format); const input = readModelAdmission(receipt);
  const { format: ignored, ...counts } = receipt; void ignored;
  const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  const plan = { format, document: structuredClone(document),
    views: (document.bufferViews ?? []).map(v => ({ resource: input.resources.findIndex(r => r.kind === 'buffer' && r.index === v.buffer), offset: v.byteOffset ?? 0, length: v.byteLength, stride: v.byteStride ?? null })),
    accessors: (document.accessors ?? []).map(a => ({ view: a.bufferView, offset: a.byteOffset ?? 0, count: a.count, components: components[a.type], component: a.componentType, normalized: a.normalized === true, type: a.type })),
  };
  return { receipt, input: { input: { format, bytes: input.bytes }, resources: input.resources, counts, plan } };
}

export function appendAttribute(document, array, itemSize, componentType = 5126, normalized = false) {
  const binary = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
  const index = document.buffers.length; document.buffers.push({ byteLength: binary.length, uri: dataUri(binary) });
  const view = document.bufferViews.length; document.bufferViews.push({ buffer: index, byteLength: binary.length });
  const accessor = document.accessors.length; document.accessors.push({ bufferView: view, componentType, count: array.length / itemSize, type: ['SCALAR', 'VEC2', 'VEC3', 'VEC4'][itemSize - 1], normalized });
  return accessor;
}

export function primitiveFixture(mode = 4, indexKind = 'u8') {
  const document = triangleJson(); const primitive = document.meshes[0].primitives[0]; primitive.mode = mode;
  const indices = mode === 1 ? [0, 1] : [0, 1, 2];
  const ctor = { u8: Uint8Array, u16: Uint16Array, u32: Uint32Array }[indexKind];
  primitive.indices = appendAttribute(document, new ctor(indices), 1, { u8: 5121, u16: 5123, u32: 5125 }[indexKind]);
  return document;
}

export function richFixture(mode = 4, tangent = false, texCoord = 0) {
  const document = primitiveFixture(mode); const primitive = document.meshes[0].primitives[0];
  primitive.attributes.COLOR_0 = appendAttribute(document, new Uint8Array([255, 128, 0, 255, 0, 255, 128, 192, 128, 0, 255, 64]), 4, 5121, true);
  primitive.attributes.TEXCOORD_0 = appendAttribute(document, new Uint16Array([0, 0, 65535, 0, 0, 65535]), 2, 5123, true);
  primitive.attributes.TEXCOORD_1 = primitive.attributes.TEXCOORD_0;
  if (tangent) primitive.attributes.TANGENT = appendAttribute(document, new Float32Array([1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1]), 4);
  document.images = [{ uri: dataUri(png(), 'image/png'), name: 'Embedded' }];
  document.samplers = [{ magFilter: 9728, minFilter: 9729, wrapS: 33071, wrapT: 33648 }];
  document.textures = [{ source: 0, sampler: 0, name: 'Swatch' }];
  const info = { index: 0, texCoord };
  document.materials = [{ name: 'Surface', alphaMode: 'BLEND', doubleSided: true,
    pbrMetallicRoughness: { baseColorFactor: [0.25, 0.5, 0.75, 0.4], baseColorTexture: info, metallicFactor: 0.2, roughnessFactor: 0.7, metallicRoughnessTexture: info },
    normalTexture: { ...info, scale: 0.3 }, occlusionTexture: { ...info, strength: 0.6 }, emissiveTexture: info, emissiveFactor: [0.1, 0.2, 0.3],
  }]; primitive.material = 0;
  return document;
}

export function interleavedFixture() {
  const document = triangleJson();
  const data = new Float32Array([0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1]);
  document.buffers[0] = { byteLength: data.byteLength, uri: dataUri(bytesOf(data)) };
  document.bufferViews[0] = { buffer: 0, byteLength: data.byteLength, byteStride: 24 };
  document.accessors.push({ bufferView: 0, byteOffset: 12, componentType: 5126, count: 3, type: 'VEC3' });
  document.meshes[0].primitives[0].attributes.NORMAL = 1;
  return document;
}

export const basicFixture = triangleJson;

export function stridedIndexFixture() {
  const document = basicFixture(); const data = new Uint8Array([0, 19, 20, 21, 1, 22, 23, 24, 2, 25, 26, 27]);
  const buffer = document.buffers.length; document.buffers.push({ byteLength: data.length, uri: dataUri(data) });
  const view = document.bufferViews.length; document.bufferViews.push({ buffer, byteLength: data.length, byteStride: 4 });
  const accessor = document.accessors.length; document.accessors.push({ bufferView: view, componentType: 5121, count: 3, type: 'SCALAR' });
  document.meshes[0].primitives[0].indices = accessor;
  return document;
}
