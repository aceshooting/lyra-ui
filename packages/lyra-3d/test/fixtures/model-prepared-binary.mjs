import assert from 'node:assert/strict';
import { Color, SRGBColorSpace } from 'three';
import { admitModel, readModelAdmission } from '../../dist/model/admission.js';

const utf8 = value => new TextEncoder().encode(value);
const scalars = {
  char: { bytes: 1, kind: 'signed' }, uchar: { bytes: 1, kind: 'unsigned' },
  short: { bytes: 2, kind: 'signed' }, ushort: { bytes: 2, kind: 'unsigned' },
  int: { bytes: 4, kind: 'signed' }, uint: { bytes: 4, kind: 'unsigned' },
  float: { bytes: 4, kind: 'float' }, double: { bytes: 8, kind: 'float' },
};
const scalar = type => scalars[type] ?? scalars[{ int8: 'char', uint8: 'uchar', int16: 'short', uint16: 'ushort', int32: 'int', uint32: 'uint', float32: 'float', float64: 'double' }[type]];
const write = (view, offset, type, value, little) => {
  const spec = scalar(type); const method = `set${spec.kind === 'float' ? 'Float' : spec.kind === 'signed' ? 'Int' : 'Uint'}${spec.bytes * 8}`;
  view[method](offset, value, little); return offset + spec.bytes;
};

// Plans here belong to isolated decoder tests; production plans must come from shared admission.
export function isolatedInput(bytes, format, plan) {
  const admission = admitModel(bytes, format); const snapshot = readModelAdmission(admission);
  const { format: admittedFormat, ...counts } = admission;
  assert.equal(admittedFormat, format);
  return { admission, input: { input: { format, bytes: snapshot.bytes }, counts, resources: snapshot.resources, plan } };
}

export function plyFixture({ variant = 'ascii', properties = [['float', 'x'], ['float', 'y'], ['float', 'z']], vertices = [[0, 0, 0], [1, 0, 0], [0, 1, 0]], faces = [], faceName = 'vertex_indices', countType = 'uchar', indexType = 'int', newline = '\n' } = {}) {
  const format = { ascii: 'ascii', 'binary-le': 'binary_little_endian', 'binary-be': 'binary_big_endian' }[variant];
  const header = ['ply', `format ${format} 1.0`, 'comment isolated decoder fixture', `element vertex ${vertices.length}`, ...properties.map(([type, name]) => `property ${type} ${name}`), ...(faces.length ? [`element face ${faces.length}`, `property list ${countType} ${indexType} ${faceName}`] : []), 'end_header', ''].join(newline);
  const prefix = utf8(header); let bytes;
  if (variant === 'ascii') bytes = utf8(header + [...vertices.map(row => row.join(' ')), ...faces.map(row => `${row.length} ${row.join(' ')}`)].join(newline) + newline);
  else {
    const length = prefix.length + vertices.length * properties.reduce((sum, [type]) => sum + scalar(type).bytes, 0) + faces.reduce((sum, face) => sum + scalar(countType).bytes + face.length * scalar(indexType).bytes, 0);
    bytes = new Uint8Array(length); bytes.set(prefix); const view = new DataView(bytes.buffer); let offset = prefix.length;
    for (const row of vertices) for (let i = 0; i < properties.length; i++) offset = write(view, offset, properties[i][0], row[i], variant === 'binary-le');
    for (const face of faces) { offset = write(view, offset, countType, face.length, variant === 'binary-le'); for (const index of face) offset = write(view, offset, indexType, index, variant === 'binary-le'); }
  }
  const elements = [{ name: 'vertex', count: vertices.length, properties: properties.map(([type, name]) => ({ name, kind: 'scalar', scalar: scalar(type) })) }];
  if (faces.length) elements.push({ name: 'face', count: faces.length, properties: [{ name: faceName, kind: 'list', count: scalar(countType), item: scalar(indexType) }] });
  return isolatedInput(bytes, 'ply', { format: 'ply', variant, dataOffset: prefix.length, elements });
}

export function pcdFixture({ variant = 'ascii', fields = [['x', 'F'], ['y', 'F'], ['z', 'F']], points = [[0, 0, 0], [1, 0, 0]], viewpoint = [1, 2, 3, 0.5, 0.5, 0.5, 0.5], count = true, width = points.length, height = 1 } = {}) {
  const header = ['# isolated decoder fixture', 'VERSION .7', `FIELDS ${fields.map(([name]) => name).join(' ')}`, `SIZE ${fields.map(() => 4).join(' ')}`, `TYPE ${fields.map(([, type]) => type).join(' ')}`, ...(count ? [`COUNT ${fields.map(() => 1).join(' ')}`] : []), `WIDTH ${width}`, `HEIGHT ${height}`, ...(viewpoint ? [`VIEWPOINT ${viewpoint.join(' ')}`] : []), `POINTS ${points.length}`, `DATA ${variant}`, ''].join('\n');
  const prefix = utf8(header); let bytes;
  if (variant === 'ascii') bytes = utf8(header + points.map(row => row.join(' ')).join('\n') + '\n');
  else {
    bytes = new Uint8Array(prefix.length + points.length * fields.length * 4); bytes.set(prefix); const view = new DataView(bytes.buffer); let offset = prefix.length;
    for (const row of points) for (let i = 0; i < fields.length; i++) {
      if (fields[i][0] === 'rgb') view.setUint32(offset, row[i], true);
      else view.setFloat32(offset, row[i], true);
      offset += 4;
    }
  }
  return isolatedInput(bytes, 'pcd', { format: 'pcd', variant, dataOffset: prefix.length, fields: fields.map(([name, type]) => ({ name, scalar: scalar(type === 'F' ? 'float' : 'uint') })), width, height, points: points.length, viewpoint });
}

export function allocationServices() {
  const requests = [];
  const classes = { i8: Int8Array, u8: Uint8Array, u8c: Uint8ClampedArray, i16: Int16Array, u16: Uint16Array, i32: Int32Array, u32: Uint32Array, f32: Float32Array, f64: Float64Array };
  const allocate = (kind, length) => { assert.ok(Number.isSafeInteger(length) && length >= 0); requests.push({ kind, length }); return new classes[kind](length); };
  return { requests, services: { allocateAttribute: allocate, allocateIndex: allocate } };
}

export function drainBounded(work, quota) {
  const budget = { bytes: quota, scalars: quota, records: quota }; let steps = 0;
  for (;;) {
    const step = work.step(budget); steps++;
    for (const key of Object.keys(budget)) assert.ok(Number.isSafeInteger(step.used[key]) && step.used[key] >= 0 && step.used[key] <= budget[key], `${key} cap`);
    if (step.done) return { value: step.value, steps };
    assert.ok(step.used.bytes + step.used.scalars + step.used.records > 0, 'unfinished step makes progress');
    assert.ok(steps < 1000000, 'small fixture has bounded total work');
  }
}

export function assertReferenceDescriptor(descriptor, object) {
  assert.equal(descriptor.protocol, 1); assert.deepEqual(descriptor.roots, [0]); assert.equal(descriptor.selectedRoot, 0);
  assert.equal(descriptor.nodes.length, 1); assert.equal(descriptor.geometries.length, 1); assert.equal(descriptor.materials.length, 1); assert.deepEqual(descriptor.textures, []);
  const node = descriptor.nodes[0]; assert.equal(node.kind, object.isPoints ? 'points' : 'mesh'); assert.equal(node.name, object.name);
  assert.deepEqual(node.matrix, object.matrix.elements); assert.deepEqual(node.children, []); assert.equal(node.geometry, 0); assert.deepEqual(node.materials, [0]);
  const geometry = descriptor.geometries[0]; const reference = object.geometry;
  assert.deepEqual(Object.keys(geometry.attributes).sort(), Object.keys(reference.attributes).sort());
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    const expected = reference.getAttribute(name);
    assert.equal(attribute.itemSize, expected.itemSize); assert.equal(attribute.count, expected.count); assert.equal(attribute.stride, expected.itemSize); assert.equal(attribute.offset, 0);
    let values = attribute.array;
    if (attribute.colorConversion) {
      const color = new Color(); const output = attribute.colorConversion.output === 'u8-normalized' ? new Uint8Array(values.length) : new Float32Array(values.length);
      for (let i = 0; i < values.length; i += 3) {
        color.setRGB(values[i] / 255, values[i + 1] / 255, values[i + 2] / 255, SRGBColorSpace);
        [color.r, color.g, color.b].forEach((value, j) => { output[i + j] = attribute.colorConversion.output === 'u8-normalized' ? Math.round(value * 255) : value; });
      }
      values = output;
    }
    assert.equal(values.constructor.name, expected.array.constructor.name, name); assert.deepEqual(values, expected.array, name);
    assert.equal(attribute.normalized, expected.normalized);
  }
  assert.deepEqual(geometry.index, reference.index?.array ?? null); assert.deepEqual(geometry.groups, reference.groups);
  assert.deepEqual(geometry.drawRange, { start: reference.drawRange.start, count: Number.isFinite(reference.drawRange.count) ? reference.drawRange.count : null });
  const material = descriptor.materials[0]; const expected = object.material;
  const kinds = { PointsMaterial: 'points', MeshStandardMaterial: 'mesh-standard' };
  assert.equal(material.kind, kinds[expected.type]);
  for (const key of ['name', 'opacity', 'transparent', 'alphaTest', 'depthWrite', 'side', 'vertexColors']) assert.equal(material[key], expected[key], key);
  assert.deepEqual(material.color, expected.color.toArray());
  if (material.kind === 'points') { assert.equal(material.size, expected.size); assert.equal(material.sizeAttenuation, expected.sizeAttenuation); assert.equal(material.map, null); }
  else {
    for (const key of ['flatShading', 'roughness', 'metalness', 'aoMapIntensity']) assert.equal(material[key], expected[key], key);
    assert.deepEqual(material.emissive, expected.emissive.toArray()); assert.deepEqual(material.normalScale, expected.normalScale.toArray());
    assert.deepEqual(material.maps, { baseColor: null, normal: null, metalness: null, roughness: null, emissive: null, ao: null });
  }
}
