import assert from 'node:assert/strict';
import test from 'node:test';
import { deflateSync } from 'node:zlib';
import { admitModel, readModelAdmission, ModelAdmissionError } from '../dist/model/admission.js';
import { MODEL_LIMITS } from '../dist/model/limits.js';

const utf8 = (text) => new TextEncoder().encode(text);
const bytesOf = (values) => new Uint8Array(new Float32Array(values).buffer);
const uri = (bytes, mime = 'application/octet-stream') => `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
const triangle = () => ({
  asset: { version: '2.0' },
  buffers: [{ byteLength: 36, uri: uri(bytesOf([0, 0, 0, 1, 0, 0, 0, 1, 0])) }],
  bufferViews: [{ buffer: 0, byteLength: 36 }],
  accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
  nodes: [{ mesh: 0 }], scenes: [{ nodes: [0] }], scene: 0,
});
const admitJson = (json) => admitModel(utf8(JSON.stringify(json)), 'gltf');
function rejected(action, code) {
  assert.throws(action, (error) => error instanceof ModelAdmissionError && (!code || error.code === code));
}
function glb(json = triangle(), binary = bytesOf([0, 0, 0, 1, 0, 0, 0, 1, 0])) {
  delete json.buffers[0].uri;
  const jsonText = JSON.stringify(json);
  const jsonBytes = utf8(jsonText.padEnd(Math.ceil(jsonText.length / 4) * 4, ' '));
  const result = new Uint8Array(12 + 8 + jsonBytes.length + 8 + Math.ceil(binary.length / 4) * 4);
  const view = new DataView(result.buffer);
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, result.length, true);
  view.setUint32(12, jsonBytes.length, true); view.setUint32(16, 0x4e4f534a, true); result.set(jsonBytes, 20);
  const offset = 20 + jsonBytes.length;
  view.setUint32(offset, result.length - offset - 8, true); view.setUint32(offset + 4, 0x004e4942, true); result.set(binary, offset + 8);
  return result;
}

// Project-authored one-pixel PNG, with independently computed chunk checksums.
function png(width = 1, height = 1) {
  const chunk = (type, data) => {
    const result = Buffer.alloc(data.length + 12);
    result.writeUInt32BE(data.length); result.write(type, 4, 4, 'ascii'); Buffer.from(data).copy(result, 8);
    let crc = 0xffffffff;
    for (const byte of result.subarray(4, -4)) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4); return result;
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.from([0, 255, 0, 0, 255]))), chunk('IEND', Buffer.alloc(0))]);
}

test('minimal authored glTF and GLB admit with expanded counts and isolated parser snapshots', () => {
  for (const [format, input] of [['gltf', utf8(JSON.stringify(triangle()))], ['glb', glb()]]) {
    const plan = admitModel(input, format);
    assert.equal(plan.format, format); assert.equal(plan.vertices, 3); assert.equal(plan.indices, 0);
    assert.ok(Object.isFrozen(plan)); assert.equal(plan.resources, 1);
    const before = readModelAdmission(plan).bytes;
    input.fill(0);
    const snapshot = readModelAdmission(plan); assert.deepEqual(snapshot.bytes, before);
    snapshot.bytes.fill(0); snapshot.resources[0].bytes.fill(0);
    assert.deepEqual(readModelAdmission(plan).bytes, before);
    assert.notEqual(readModelAdmission(plan).resources[0].bytes[12], undefined);
  }
  rejected(() => readModelAdmission({ format: 'gltf', vertices: 3 }), 'invalid');
});

test('encoded input, format and shared memory fail before any parser', () => {
  rejected(() => admitModel(new Uint8Array(MODEL_LIMITS.encodedBytes + 1), 'obj'), 'limit');
  rejected(() => admitModel(utf8(''), 'fbx'), 'unsupported');
  rejected(() => admitModel(new Uint8Array(new SharedArrayBuffer(8)), 'obj'), 'invalid');
  rejected(() => admitModel(utf8(''), 'gltf'), 'invalid');
});

test('glTF external buffers and image URLs reject regardless of scheme or spelling', () => {
  for (const reference of ['https://example.test/b.bin', '//example.test/b.bin', 'buffer.bin', '../x', 'file:///tmp/x', 'blob:x', 'javascript:x', 'data:text/html;base64,AA==']) {
    const json = triangle(); json.buffers[0].uri = reference;
    rejected(() => admitJson(json));
    const imageJson = triangle(); imageJson.images = [{ uri: reference }];
    rejected(() => admitJson(imageJson));
  }
});

test('extensions, sparse/bufferless accessors and unsupported compressed resources fail closed', () => {
  for (const mutate of [
    (j) => { j.extensionsUsed = ['KHR_draco_mesh_compression']; },
    (j) => { j.meshes[0].primitives[0].extensions = { EXT_meshopt_compression: {} }; },
    (j) => { j.accessors[0].sparse = { count: 1 }; },
    (j) => { delete j.accessors[0].bufferView; },
    (j) => { j.nodes[0].skin = 0; },
    (j) => { j.meshes[0].primitives[0].targets = []; },
  ]) { const json = triangle(); mutate(json); rejected(() => admitJson(json)); }
});

test('glTF accessor count, byte stride, component type, range and float bombs reject', () => {
  for (const mutate of [
    (j) => { j.accessors[0].count = 2 ** 40; },
    (j) => { j.accessors[0].byteOffset = 32; },
    (j) => { j.accessors[0].count = 3.5; },
    (j) => { j.accessors[0].componentType = 5130; },
    (j) => { j.bufferViews[0].byteStride = 1; },
    (j) => { j.buffers[0].byteLength = 2 ** 40; },
    (j) => { j.buffers[0].uri = uri(bytesOf([NaN, 0, 0, 1, 0, 0, 0, 1, 0])); },
    (j) => { j.meshes[0].primitives[0].attributes.NORMAL = 99; },
    (j) => { j.accessors[0].max = [1e300, 1, 0]; },
  ]) { const json = triangle(); mutate(json); rejected(() => admitJson(json)); }
});

test('glTF base64 syntax and exact decoded buffer length reject hidden or trailing data', () => {
  for (const value of ['A===', '!!!!', 'AA=A', 'AB==', 'AAA', 'AAAA\n', 'AAAA====']) {
    const json = triangle(); json.buffers[0].uri = `data:application/octet-stream;base64,${value}`;
    rejected(() => admitJson(json));
  }
  const json = triangle(); json.buffers[0].byteLength = 35; rejected(() => admitJson(json));
});

test('glTF rejects scene cycles, repeated parents, repeated roots and instantiation count bombs', () => {
  for (const nodes of [[{ mesh: 0, children: [0] }], [{ children: [1, 1] }, { mesh: 0 }], [{ children: [1] }, { children: [0] }]]) {
    const json = triangle(); json.nodes = nodes; rejected(() => admitJson(json));
  }
  const roots = triangle(); roots.scenes[0].nodes = [0, 0]; rejected(() => admitJson(roots));
  const json = triangle(); json.nodes = Array.from({ length: MODEL_LIMITS.entries + 1 }, () => ({ mesh: 0 })); rejected(() => admitJson(json), 'limit');
});

test('glTF validates primitive indices against positions before parser allocation', () => {
  const json = triangle();
  json.buffers.push({ byteLength: 6, uri: uri(new Uint8Array(new Uint16Array([0, 1, 2]).buffer)) });
  json.bufferViews.push({ buffer: 1, byteLength: 6 });
  json.accessors.push({ bufferView: 1, componentType: 5123, count: 3, type: 'SCALAR' });
  json.meshes[0].primitives[0].indices = 1;
  assert.equal(admitJson(json).indices, 3);
  json.buffers[1].uri = uri(new Uint8Array(new Uint16Array([0, 1, 3]).buffer)); rejected(() => admitJson(json));
});

test('GLB rejects malformed declared length, chunk type and truncated BIN before parsing', () => {
  const input = glb();
  rejected(() => admitModel(input.subarray(0, input.length - 1), 'glb'));
  const wrong = input.slice(); new DataView(wrong.buffer).setUint32(16, 0, true); rejected(() => admitModel(wrong, 'glb'));
  const version = input.slice(); new DataView(version.buffer).setUint32(4, 1, true); rejected(() => admitModel(version, 'glb'));
});

test('JSON complexity and dangerous object keys reject without recursive traversal overflow', () => {
  rejected(() => admitModel(utf8('['.repeat(MODEL_LIMITS.jsonDepth + 1) + '0' + ']'.repeat(MODEL_LIMITS.jsonDepth + 1)), 'gltf'), 'limit');
  rejected(() => admitModel(utf8('{"asset":{"version":"2.0"},"__proto__":{"uri":"https://example.test"}}'), 'gltf'));
});

const obj = 'v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n';
const stl = 'solid triangle\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid triangle\n';
const ply = 'ply\nformat ascii 1.0\nelement vertex 3\nproperty float x\nproperty float y\nproperty float z\nelement face 1\nproperty list uchar int vertex_indices\nend_header\n0 0 0\n1 0 0\n0 1 0\n3 0 1 2\n';
const pcd = 'VERSION .7\nFIELDS x y z\nSIZE 4 4 4\nTYPE F F F\nCOUNT 1 1 1\nWIDTH 3\nHEIGHT 1\nPOINTS 3\nDATA ascii\n0 0 0\n1 0 0\n0 1 0\n';

test('authored minimal OBJ, STL, PLY, XYZ and PCD fixtures admit bounded geometry', () => {
  for (const [format, text] of [['obj', obj], ['stl', stl], ['ply', ply], ['xyz', '0 0 0\n1 0 0\n0 1 0\n'], ['pcd', pcd]]) {
    const plan = admitModel(utf8(text), format); assert.equal(plan.vertices, 3); assert.equal(plan.resources, 0);
  }
});

test('OBJ material directives, invalid references, expansion and unknown directives fail closed', () => {
  for (const text of [`mtllib external.mtl\n${obj}`, `${obj}usemtl material\n`, obj.replace('f 1 2 3', 'f 1 2 4'), obj.replace('f 1 2 3', 'f 0 2 3'), `${obj}call https://example.test\n`, `${obj}surf 1 2 3\n`]) rejected(() => admitModel(utf8(text), 'obj'));
  assert.equal(admitModel(utf8(obj.replace('f 1 2 3', 'f -3 -2 -1')), 'obj').vertices, 3);
});

test('text finite-number, row and line bounds apply before parsing', () => {
  for (const [format, text] of [['xyz', 'Infinity 0 0'], ['xyz', '1e300 0 0'], ['obj', obj.replace('v 0 0 0', 'v NaN 0 0')], ['stl', stl.replace('vertex 0 0 0', 'vertex Infinity 0 0')], ['xyz', '0'.repeat(MODEL_LIMITS.lineBytes + 1)]]) rejected(() => admitModel(utf8(text), format));
});

test('binary STL declared face counts and finite coordinate values are validated', () => {
  const bytes = new Uint8Array(134); const view = new DataView(bytes.buffer); view.setUint32(80, 1, true);
  view.setFloat32(96, 0, true); view.setFloat32(108, 1, true); view.setFloat32(124, 1, true);
  assert.equal(admitModel(bytes, 'stl').vertices, 3);
  view.setUint32(80, 0xffffffff, true); rejected(() => admitModel(bytes, 'stl'));
  view.setUint32(80, 1, true); view.setFloat32(84, Infinity, true); rejected(() => admitModel(bytes, 'stl'));
});

test('PLY/PCD header bombs, mismatched body counts and compressed PCD reject', () => {
  for (const [format, text] of [['ply', ply.replace('vertex 3', 'vertex 4294967295')], ['ply', ply.replace('3 0 1 2', '255 0 1 2')], ['ply', ply.replace('3 0 1 2', '3 0 1 99')], ['pcd', pcd.replace('POINTS 3', 'POINTS 4294967295')], ['pcd', pcd.replace('WIDTH 3', 'WIDTH 4')], ['pcd', pcd.replace('COUNT 1 1 1', 'COUNT 4294967295 1 1')], ['pcd', pcd.replace('DATA ascii', 'DATA binary_compressed')], ['pcd', pcd + '1 1 1\n']]) rejected(() => admitModel(utf8(text), format));
});

test('glTF hierarchy depth is bounded even when children appear before parents', () => {
  const json = triangle();
  json.nodes = Array.from({ length: MODEL_LIMITS.jsonDepth + 3 }, (_, index) => index ? { children: [index - 1] } : { mesh: 0 });
  json.scenes = [{ nodes: [json.nodes.length - 1] }];
  rejected(() => admitJson(json), 'limit');
});

test('OBJ comments and continuation syntax cannot change the downstream primitive count', () => {
  rejected(() => admitModel(utf8(obj.replace('f 1 2 3', 'f 1 2 3 # 1 2 3')), 'obj'));
  rejected(() => admitModel(utf8('o joined\\\n' + obj), 'obj'));
  assert.equal(admitModel(utf8('v 0 0 0\nv 1 0 0\n'), 'obj').vertices, 2);
});

test('PCD whitespace-only rows and incomplete normal fields cannot bypass point admission', () => {
  rejected(() => admitModel(utf8(pcd + '   \n'), 'pcd'));
  rejected(() => admitModel(utf8(pcd.replace('FIELDS x y z', 'FIELDS x y z normal_x').replace('SIZE 4 4 4', 'SIZE 4 4 4 4').replace('TYPE F F F', 'TYPE F F F F').replace('COUNT 1 1 1', 'COUNT 1 1 1 1').replaceAll('0 0 0\n', '0 0 0 1\n').replaceAll('1 0 0\n', '1 0 0 1\n').replaceAll('0 1 0\n', '0 1 0 1\n')), 'pcd'));
});

test('embedded PNG dimensions and bytes are admitted before any image decode', () => {
  const json = triangle(); json.images = [{ uri: uri(png(), 'image/png') }];
  json.textures = [{ source: 0 }]; json.materials = [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }];
  json.meshes[0].primitives[0].material = 0;
  const plan = admitJson(json); assert.equal(plan.resources, 2); assert.equal(plan.imagePixels, 3);
  const image = readModelAdmission(plan).resources.find((entry) => entry.kind === 'image');
  assert.equal(image.width, 1); assert.equal(image.height, 1); assert.deepEqual(image.bytes, new Uint8Array(png()));
  json.images[0].uri = uri(png(MODEL_LIMITS.textureAxis + 1, 1), 'image/png'); rejected(() => admitJson(json), 'limit');
  json.images[0].uri = uri(png().subarray(0, -1), 'image/png'); rejected(() => admitJson(json));
  json.images[0].uri = uri(png(), 'image/jpeg'); rejected(() => admitJson(json));
});

test('image/texture aliases and decoded buffer views cannot amplify past the decoded budget', () => {
  const json = triangle(); json.images = [{ uri: uri(png(4096, 4096), 'image/png') }];
  json.textures = [{ source: 0 }, { source: 0 }]; rejected(() => admitJson(json), 'limit');
  const views = triangle(); const bytes = new Uint8Array(1024 * 1024);
  views.buffers = [{ byteLength: bytes.length, uri: uri(bytes) }];
  views.bufferViews = Array.from({ length: 257 }, () => ({ buffer: 0, byteLength: bytes.length }));
  rejected(() => admitJson(views), 'limit');
  const resources = triangle(); resources.images = Array.from({ length: MODEL_LIMITS.resources }, () => ({ uri: uri(png(), 'image/png') }));
  rejected(() => admitJson(resources), 'limit');
});

test('PLY little- and big-endian and PCD binary bodies have exact lengths and finite coordinates', () => {
  for (const little of [true, false]) {
    const head = utf8(ply.slice(0, ply.indexOf('end_header') + 11).replace('format ascii', `format binary_${little ? 'little' : 'big'}_endian`));
    const body = new Uint8Array(49); const view = new DataView(body.buffer);
    view.setFloat32(12, 1, little); view.setFloat32(28, 1, little); body[36] = 3;
    view.setInt32(37, 0, little); view.setInt32(41, 1, little); view.setInt32(45, 2, little);
    const bytes = Buffer.concat([head, body]); const plan = admitModel(bytes, 'ply');
    assert.equal(plan.vertices, 3); assert.equal(plan.indices, 3);
    rejected(() => admitModel(bytes.subarray(0, -1), 'ply'));
  }
  const head = utf8(pcd.slice(0, pcd.indexOf('DATA ascii') + 11).replace('DATA ascii', 'DATA binary'));
  const body = bytesOf([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  const bytes = Buffer.concat([head, body]); assert.equal(admitModel(bytes, 'pcd').vertices, 3);
  rejected(() => admitModel(Buffer.concat([bytes, new Uint8Array([0])]), 'pcd'));
  new DataView(body.buffer).setFloat32(0, NaN, true); rejected(() => admitModel(Buffer.concat([head, body]), 'pcd'));
});

test('unsupported metadata and compressed image/container formats remain fail closed', () => {
  const json = triangle(); json.images = [{ uri: uri(new Uint8Array([0, 0, 0, 0]), 'image/webp') }]; rejected(() => admitJson(json));
  const image = png(); const altered = image.slice(); altered[28] = 1;
  json.images[0].uri = uri(altered, 'image/png'); rejected(() => admitJson(json), 'unsupported');
  const extra = triangle(); extra.nodes[0].extras = { uri: 'https://example.test/external' }; rejected(() => admitJson(extra), 'unsupported');
  const normalized = triangle(); normalized.accessors[0].normalized = false; assert.equal(admitJson(normalized).vertices, 3);
});

// Baseline grayscale 1x1 JPEG: constant zero DCT, one DC symbol and one end-of-block symbol.
function jpeg() {
  const segment = (marker, data) => { const length = data.length + 2; return [255, marker, length >> 8, length & 255, ...data]; };
  const huffman = [1, ...Array(15).fill(0), 0];
  return new Uint8Array([255, 216,
    ...segment(224, [74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]),
    ...segment(219, [0, ...Array(64).fill(1)]),
    ...segment(192, [8, 0, 1, 0, 1, 1, 1, 17, 0]),
    ...segment(196, [0, ...huffman, 16, ...huffman]),
    ...segment(218, [1, 1, 0, 0, 63, 0]), 63, 255, 217]);
}

test('bounded JPEG frame metadata admits an authored image and rejects dimensions or DNL overrides', () => {
  const json = triangle(); const image = jpeg(); json.images = [{ uri: uri(image, 'image/jpeg') }];
  const admission = admitJson(json); const resource = readModelAdmission(admission).resources[1];
  assert.equal(resource.width, 1); assert.equal(resource.height, 1);
  const oversized = image.slice();
  const sof = oversized.findIndex((value, index) => value === 255 && oversized[index + 1] === 192);
  new DataView(oversized.buffer).setUint16(sof + 7, 4097);
  json.images[0].uri = uri(oversized, 'image/jpeg'); rejected(() => admitJson(json), 'limit');
  const dnl = Buffer.concat([image.subarray(0, -2), new Uint8Array([255, 220, 0, 4, 255, 255, 255, 217])]);
  json.images[0].uri = uri(dnl, 'image/jpeg'); rejected(() => admitJson(json), 'unsupported');
});

test('PCD header whitespace cannot diverge from the downstream parser layout', () => {
  for (const value of [pcd.replaceAll('\n', '\r\n'), pcd.replace('FIELDS x y z', 'FIELDS x  y z'), pcd.replace('DATA ascii', ' DATA ascii')]) rejected(() => admitModel(utf8(value), 'pcd'), 'unsupported');
  for (const row of [' 0 0 0', '0\t0\t0', '0  0 0']) rejected(() => admitModel(utf8(pcd.replace('0 0 0\n', `${row}\n`)), 'pcd'), 'unsupported');
});

test('STL solid names cannot hide facets from admission', () => {
  const hidden = 'solid facet normal 0 0 1 outer loop vertex 0 0 0 vertex 1 0 0 vertex 0 1 0 endloop endfacet\nendsolid\n';
  rejected(() => admitModel(utf8(hidden), 'stl'));
});

test('glTF primitive instantiation is bounded independently of vertex counts', () => {
  const json = triangle(); json.accessors[0].count = 1;
  json.meshes[0].primitives = Array.from({ length: MODEL_LIMITS.entries }, () => ({ attributes: { POSITION: 0 }, mode: 0 }));
  json.nodes = [{ mesh: 0 }, { mesh: 0 }]; json.scenes[0].nodes = [0, 1];
  rejected(() => admitJson(json), 'limit');
});

test('PLY integer tokens use decimal syntax understood identically by loaders', () => {
  rejected(() => admitModel(utf8(ply.replace('3 0 1 2', '3e0 0 1 2')), 'ply'));
  rejected(() => admitModel(utf8(ply.replace('property float x', 'property int x').replace('1 0 0\n', '1e2 0 0\n')), 'ply'));
});


test('PCD rgba fields reject instead of silently losing colors in the standard loader', () => {
  const source = 'VERSION .7\nFIELDS x y z rgba\nSIZE 4 4 4 4\nTYPE F F F U\nWIDTH 1\nHEIGHT 1\nPOINTS 1\nDATA ascii\n0 0 0 4294901760\n';
  rejected(() => admitModel(utf8(source), 'pcd'), 'unsupported');
});


test('glTF POSITION accessors require finite declared bounds before reaching the loader', () => {
  for (const key of ['min', 'max']) {
    const json = triangle(); delete json.accessors[0][key];
    rejected(() => admitJson(json), 'invalid');
  }
});

test('PLY header boundaries accept consistent LF and CRLF with an exact terminator', () => {
  const point = 'ply\nformat ascii 1.0\nelement vertex 1\nproperty float x\nproperty float y\nproperty float z\nend_header\n0 0 0\n';
  for (const value of [point, point.replaceAll('\n', '\r\n')]) {
    assert.equal(admitModel(utf8(value), 'ply').vertices, 1);
    for (const endian of ['little', 'big']) {
      const header = value.slice(0, value.indexOf('end_header') + 'end_header'.length) + (value.includes('\r') ? '\r\n' : '\n');
      const binary = Buffer.concat([utf8(header.replace('format ascii', `format binary_${endian}_endian`)), new Uint8Array(12)]);
      assert.equal(admitModel(binary, 'ply').vertices, 1);
    }
  }
});

for (const [name, change] of [
  ['leading terminator whitespace', value => value.replace('end_header', ' end_header')],
  ['trailing terminator whitespace', value => value.replace('end_header', 'end_header ')],
  ['lone CR in a comment', value => value.replace('element vertex', 'comment a\rb\nelement vertex')],
  ['LF magic with CRLF header line', value => value.replace('format ascii 1.0\n', 'format ascii 1.0\r\n')],
  ['CRLF magic with LF header lines', value => value.replace('ply\n', 'ply\r\n')],
  ['padded magic', value => value.replace('ply\n', 'ply \n')],
  ['terminator text in a comment', value => value.replace('element vertex', 'comment end_header note\nelement vertex')],
  ['terminator text in object information', value => value.replace('element vertex', 'obj_info end_header note\nelement vertex')],
]) {
  test(`PLY header boundaries reject ${name}`, () => {
    const point = 'ply\nformat ascii 1.0\nelement vertex 1\nproperty float x\nproperty float y\nproperty float z\nend_header\n0 0 0\n';
    rejected(() => admitModel(utf8(change(point)), 'ply'), 'unsupported');
  });
}

for (const directive of ['p', 'l']) {
  test(`OBJ point/line ${directive} records accept single-space positive and negative references`, () => {
    const vertices = 'v 0 0 0\nv 1 0 0\n';
    for (const refs of ['1 2', '-2 -1']) {
      assert.equal(admitModel(utf8(`${vertices}${directive} ${refs}\n`), 'obj').vertices, 2);
    }
  });
  for (const [name, refs] of [['repeated spaces', '1  2'], ['tabs', '1\t2']]) {
    test(`OBJ point/line ${directive} records reject ${name}`, () => {
      rejected(() => admitModel(utf8(`v 0 0 0\nv 1 0 0\n${directive} ${refs}\n`), 'obj'), 'unsupported');
    });
  }
}

test('model numeric channels retain signed decimal and exponent grammar', () => {
  for (const token of ['0', '-0', '+1', '1.', '.5', '-.5', '1.25', '1e2', '1E-2', '+.5e+1', '01']) {
    assert.equal(admitModel(utf8(`${token} 0 0\n`), 'xyz').vertices, 1, token);
  }
  for (const token of ['.', '+', '1e', '1e+', '1..0', '0x10', '1_000', 'NaN', 'Infinity', '1e999']) {
    rejected(() => admitModel(utf8(`${token} 0 0\n`), 'xyz'), 'invalid');
  }
});
