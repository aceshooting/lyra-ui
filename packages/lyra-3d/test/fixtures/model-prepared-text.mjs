import assert from 'node:assert/strict';
import { admitModel, readModelAdmission } from '../../dist/model/admission.js';
import { parseModel } from '../../dist/model/model-parsers.js';
import { Color, SRGBColorSpace } from 'three';

export const encode = value => new TextEncoder().encode(value);
export function isolatedInput(bytes, format) {
  const admission = admitModel(bytes, format);
  const { format: admittedFormat, ...counts } = admission;
  const input = readModelAdmission(admission);
  const text = format === 'obj' ? new TextDecoder().decode(bytes) : '';
  const rows = text.split('\n').map(line => line.trim().split(/\s+/));
  const binary = bytes.length >= 84 && 84 + new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(80, true) * 50 === bytes.length;
  // Test-only plans isolate decoder behavior; production plans come from shared admission.
  const plan = format === 'obj' ? {
    format, vertices: rows.filter(row => row[0] === 'v').length,
    normals: rows.filter(row => row[0] === 'vn').length, uvs: rows.filter(row => row[0] === 'vt').length,
    outputVertices: counts.vertices, entries: rows.filter(row => ['o', 'g', 's'].includes(row[0])).length,
  } : { format: admittedFormat, variant: binary ? 'binary' : 'ascii', facets: counts.vertices / 3, dataOffset: binary ? 84 : 0 };
  return { admission, prepared: { input, counts, resources: input.resources, plan } };
}
export function services() {
  const allocations = [];
  const constructors = { i8: Int8Array, u8: Uint8Array, u8c: Uint8ClampedArray, i16: Int16Array, u16: Uint16Array, i32: Int32Array, u32: Uint32Array, f32: Float32Array, f64: Float64Array };
  return {
    allocations,
    allocateAttribute(kind, length) { const result = new constructors[kind](length); allocations.push(result); return result; },
    allocateIndex(kind, length) { const result = new constructors[kind](length); allocations.push(result); return result; },
    convertSrgb(r, g, b) { const value = new Color().setRGB(r, g, b, SRGBColorSpace); return [value.r, value.g, value.b]; },
  };
}
export function drain(work, quota) {
  let steps = 0;
  for (;;) {
    const result = work.step({ bytes: quota, scalars: quota, records: quota });
    for (const value of Object.values(result.used)) assert.ok(value >= 0 && value <= quota);
    if (result.done) return { value: result.value, steps };
    assert.ok(Object.values(result.used).some(value => value > 0));
    assert.ok(++steps < 1000000, 'bounded fixture completes');
  }
}
const materialKeys = ['name', 'opacity', 'transparent', 'alphaTest', 'depthWrite', 'side', 'vertexColors', 'flatShading', 'size', 'sizeAttenuation', 'linewidth', 'shininess', 'roughness', 'metalness', 'aoMapIntensity'];
function materialData(material) {
  const result = {};
  for (const key of materialKeys) if (key in material) result[key] = material[key];
  for (const key of ['color', 'emissive', 'specular']) if (material[key]) result[key] = material[key].toArray();
  return result;
}
export async function assertParity(bytes, format, factory, quota) {
  const { admission, prepared } = isolatedInput(bytes, format);
  const reference = await parseModel(admission);
  try {
    const allocator = services();
    const candidate = drain(factory(prepared, allocator), quota).value;
    assert.ok(allocator.allocations.reduce((sum, array) => sum + array.byteLength, 0) <= admission.decodedBytes);
    const actualNodes = [];
    reference.object.traverse(node => actualNodes.push(node));
    assert.equal(candidate.nodes.length, actualNodes.length);
    for (let i = 0; i < actualNodes.length; i++) {
      const actual = actualNodes[i]; const node = candidate.nodes[i];
      assert.equal(node.name, actual.name);
      const kind = actual.isGroup ? 'group' : actual.isPoints ? 'points' : actual.isLineSegments ? 'line-segments' : 'mesh';
      assert.equal(node.kind, kind);
      assert.deepEqual(node.children, actual.children.map(child => actualNodes.indexOf(child)));
      assert.deepEqual(node.matrix, actual.matrix.toArray());
      if (!actual.geometry) { assert.equal(node.geometry, null); continue; }
      const geometry = candidate.geometries[node.geometry];
      assert.deepEqual(Object.keys(geometry.attributes).sort(), Object.keys(actual.geometry.attributes).sort());
      for (const [name, attribute] of Object.entries(actual.geometry.attributes)) {
        const got = geometry.attributes[name];
        assert.equal(got.itemSize, attribute.itemSize, name);
        assert.equal(got.count, attribute.count, name);
        assert.equal(got.normalized, attribute.normalized, name);
        let values = got.array;
        if (got.colorConversion) {
          values = new Float32Array(got.array.length);
          for (let offset = 0; offset < got.array.length; offset += 3) {
            const color = new Color().setRGB(got.array[offset], got.array[offset + 1], got.array[offset + 2], SRGBColorSpace);
            values.set([color.r, color.g, color.b], offset);
          }
        }
        assert.deepEqual(Array.from(values), Array.from(attribute.array), name);
      }
      assert.deepEqual(geometry.groups, actual.geometry.groups);
      assert.equal(geometry.index, null); assert.equal(actual.geometry.index, null);
      assert.deepEqual(geometry.drawRange, { start: actual.geometry.drawRange.start, count: actual.geometry.drawRange.count === Infinity ? null : actual.geometry.drawRange.count });
      assert.deepEqual(geometry.groupNames, actual.geometry.userData.groupNames);
      assert.equal(geometry.hasColors, actual.geometry.hasColors);
      assert.equal(geometry.alpha, actual.geometry.alpha);
      const actualMaterial = Array.isArray(actual.material) ? actual.material : [actual.material];
      assert.equal(node.materials.length, actualMaterial.length);
      for (let j = 0; j < actualMaterial.length; j++) {
        const got = candidate.materials[node.materials[j]];
        const expected = materialData(actualMaterial[j]);
        const materialKind = actualMaterial[j].isMeshPhongMaterial ? 'mesh-phong' : actualMaterial[j].isMeshStandardMaterial ? 'mesh-standard' : actualMaterial[j].isPointsMaterial ? 'points' : 'line-basic';
        assert.equal(got.kind, materialKind);
        for (let previous = 0; previous < i; previous++) {
          const prior = actualNodes[previous];
          if (prior.material === actualMaterial[j]) assert.equal(node.materials[j], candidate.nodes[previous].materials[0]);
        }
        for (const [key, value] of Object.entries(expected)) {
          const received = key === 'specular' && got.specularConversion ? new Color().setRGB(...got.specular, SRGBColorSpace).toArray() : got[key];
          assert.deepEqual(received, value, `material ${key}`);
        }
      }
    }
    return candidate;
  } finally { reference.dispose(); }
}
export function binaryStl({ color = false, facets = 2 } = {}) {
  const result = new Uint8Array(84 + facets * 50); const view = new DataView(result.buffer);
  if (color) result.set([...encode('COLOR='), 128, 64, 255, 100], 5);
  view.setUint32(80, facets, true);
  for (let face = 0; face < facets; face++) {
    const offset = 84 + face * 50;
    [0, 0, 1, face, 0, 0, face + 1, 0, 0, face, 1, 0].forEach((value, index) => view.setFloat32(offset + index * 4, value, true));
    view.setUint16(offset + 48, face % 2 ? 0x8000 : 0x4210, true);
  }
  return result;
}

export function asciiStlWithBinaryProbe(facets) {
  const bytes = encode(`     solid ${'x'.repeat(160)}\nendsolid end\n`);
  bytes.fill(0, 80, 134);
  new DataView(bytes.buffer).setUint32(80, facets, true);
  return bytes;
}
