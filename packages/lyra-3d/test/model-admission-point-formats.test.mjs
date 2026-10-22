import assert from 'node:assert/strict';
import test from 'node:test';
import { admitModel, ModelAdmissionError } from '../dist/model/admission.js';
import { utf8 } from './model-fixtures.mjs';

const refused = (action, code) => assert.throws(action, (error) => error instanceof ModelAdmissionError && (!code || error.code === code));

/** Binary PLY with one of every scalar family the admission and the loader both understand. */
function binaryPly({ little = true, faces = [[0, 1, 1]], vertexName = 'vertex_index', change = (header) => header } = {}) {
  const header = change([
    'ply', `format binary_${little ? 'little' : 'big'}_endian 1.0`,
    'element vertex 2',
    'property double x', 'property double y', 'property double z',
    'property uchar red', 'property uchar green', 'property uchar blue', 'property uchar alpha',
    'property short s', 'property ushort t', 'property char u', 'property uint v',
    `element face ${faces.length}`, `property list uchar uint ${vertexName}`,
    'end_header', '',
  ]).join('\n');
  const vertexBytes = 8 * 3 + 4 + 2 + 2 + 1 + 4;
  const faceBytes = faces.reduce((total, face) => total + 1 + 4 * face.length, 0);
  const body = new Uint8Array(2 * vertexBytes + faceBytes);
  const view = new DataView(body.buffer);
  let offset = 0;
  for (let vertex = 0; vertex < 2; vertex++) {
    for (const value of [vertex, vertex + 0.5, -vertex]) { view.setFloat64(offset, value, little); offset += 8; }
    for (const value of [255, 128, 0, 255]) { view.setUint8(offset++, value); }
    view.setInt16(offset, -3, little); offset += 2;
    view.setUint16(offset, 65535, little); offset += 2;
    view.setInt8(offset++, -5);
    view.setUint32(offset, 4_000_000_000, little); offset += 4;
  }
  for (const face of faces) {
    view.setUint8(offset++, face.length);
    for (const index of face) { view.setUint32(offset, index, little); offset += 4; }
  }
  return Buffer.concat([utf8(header), body]);
}

test('binary PLY reads doubles, bytes, shorts and unsigned integers in either byte order', () => {
  for (const little of [true, false]) {
    const plan = admitModel(binaryPly({ little, faces: [[0, 1, 1], [1, 0, 0, 1]] }), 'ply');
    assert.equal(plan.vertices, 2, `${little ? 'little' : 'big'} endian`);
    assert.equal(plan.indices, 3 + 6, 'a quad contributes two triangles');
  }
  assert.equal(admitModel(binaryPly({ vertexName: 'vertex_indices' }), 'ply').vertices, 2);
});

test('binary PLY faces and bodies are held to their declared structure', () => {
  refused(() => admitModel(binaryPly({ faces: [[0, 1]] }), 'ply'), 'invalid');
  refused(() => admitModel(binaryPly({ faces: [[0, 1, 1, 0, 0]] }), 'ply'), 'limit');
  refused(() => admitModel(binaryPly({ faces: [[0, 1, 9]] }), 'ply'), 'limit');
  refused(() => admitModel(binaryPly({ vertexName: 'material_index' }), 'ply'), 'unsupported');
  refused(() => admitModel(binaryPly({ change: (header) => header.map((line) => line.replace('property uchar alpha', 'property float alpha')) }), 'ply'), 'unsupported');
  refused(() => admitModel(binaryPly({ change: (header) => header.map((line) => line.replace('property uchar red', 'property char red')) }), 'ply'), 'unsupported');
  refused(() => admitModel(binaryPly({ change: (header) => header.map((line) => line.replace('property short s', 'property complex s')) }), 'ply'), 'unsupported');
  refused(() => admitModel(binaryPly({ change: (header) => header.map((line) => line.replace('property short s', 'property double x')) }), 'ply'));
  refused(() => admitModel(binaryPly({ change: (header) => header.map((line) => line.replace('property uchar red', 'property uchar colour')) }), 'ply'), 'unsupported');
  const body = binaryPly();
  refused(() => admitModel(Buffer.concat([body, Buffer.from([0])]), 'ply'), 'invalid');
  refused(() => admitModel(body.subarray(0, body.length - 3), 'ply'), 'invalid');
});

const ascii = (rows, header = []) => utf8(['ply', 'format ascii 1.0', 'element vertex 1', 'property float x', 'property float y', 'property float z', ...header, 'end_header', ...rows, ''].join('\n'));

test('ASCII PLY rows must carry exactly the declared columns, faces and integer indices', () => {
  assert.equal(admitModel(ascii(['0 0 0']), 'ply').vertices, 1);
  refused(() => admitModel(ascii(['0 0']), 'ply'), 'invalid');
  refused(() => admitModel(ascii(['0 0 0 0']), 'ply'), 'invalid');
  refused(() => admitModel(ascii(['0 0 0', '0 0 0']), 'ply'), 'invalid');
  refused(() => admitModel(ascii([]), 'ply'), 'invalid');
  const faced = (rows, vertices = 1) => utf8(['ply', 'format ascii 1.0', `element vertex ${vertices}`, 'property float x', 'property float y', 'property float z',
    'element face 1', 'property list uchar int vertex_indices', 'end_header', ...rows, ''].join('\n'));
  const triangle = admitModel(faced(['0 0 0', '1 0 0', '3 0 1 1'], 2), 'ply');
  assert.deepEqual([triangle.vertices, triangle.indices], [2, 3], 'a degenerate triangle still counts');
  assert.equal(admitModel(faced(['0 0 0', '3 0 0 0']), 'ply').indices, 3);
  refused(() => admitModel(faced(['0 0 0', '3 0 0']), 'ply'), 'invalid');
  refused(() => admitModel(faced(['0 0 0', '2 0 0']), 'ply'), 'invalid');
  refused(() => admitModel(faced(['0 0 0', '3 0 0 1']), 'ply'), 'limit');
});

test('PLY headers allow only the supported structure', () => {
  refused(() => admitModel(ascii(['0 0 0'], ['element edge 1']), 'ply'), 'unsupported');
  refused(() => admitModel(ascii(['0 0 0'], ['element vertex 1']), 'ply'));
  refused(() => admitModel(ascii(['0 0 0'], ['unknown directive']), 'ply'), 'unsupported');
  refused(() => admitModel(utf8('ply\nformat ascii 1.0\nelement face 1\nproperty list uchar int vertex_indices\nend_header\n3 0 0 0\n'), 'ply'));
  refused(() => admitModel(utf8('ply\nformat ascii 1.0\nelement vertex 1\nproperty float x\nproperty float y\nend_header\n0 0\n'), 'ply'));
  refused(() => admitModel(utf8('ply\nformat ascii 1.0\nelement vertex 1\nproperty float x\nproperty float x\nproperty float z\nend_header\n0 0 0\n'), 'ply'));
  refused(() => admitModel(utf8('ply\nformat ascii 1.0\nelement vertex 1\nproperty float x\nproperty float y\nproperty float z\nelement face 1\nproperty list uchar float vertex_indices\nend_header\n0 0 0\n3 0 0 0\n'), 'ply'));
  refused(() => admitModel(utf8('ply\nformat ascii 2.0\nend_header\n'), 'ply'), 'unsupported');
  refused(() => admitModel(utf8('ply\nformat ascii 1.0\nelement vertex 1\nproperty float x\nproperty float y\nproperty float z\n'), 'ply'), 'invalid');
  refused(() => admitModel(new Uint8Array([112, 108, 121, 10, 0, 10]), 'ply'));
  refused(() => admitModel(Buffer.concat([utf8('ply\n'), Buffer.alloc(70 * 1024, 32)]), 'ply'), 'limit');
});

const pcdHeader = (extra = {}, rows = ['0 0 0']) => {
  const { DATA = 'ascii', ...fields } = {
    VERSION: '0.7', FIELDS: 'x y z', SIZE: '4 4 4', TYPE: 'F F F', COUNT: '1 1 1', WIDTH: String(rows.length), HEIGHT: '1',
    VIEWPOINT: '0 0 0 1 0 0 0', POINTS: String(rows.length), ...extra,
  };
  // The DATA line ends the header, so it always comes last.
  const lines = Object.entries(fields).filter(([, value]) => value !== undefined).map(([key, value]) => `${key} ${value}`);
  if (DATA !== null) lines.push(`DATA ${DATA}`);
  return utf8(`${lines.join('\n')}\n${rows.join('\n')}\n`);
};

test('PCD files may declare a viewpoint, colors and normals and are otherwise tightly specified', () => {
  assert.equal(admitModel(pcdHeader(), 'pcd').vertices, 1);
  assert.equal(admitModel(pcdHeader({ VIEWPOINT: undefined }), 'pcd').vertices, 1);
  assert.equal(admitModel(pcdHeader({ COUNT: undefined }), 'pcd').vertices, 1, 'COUNT defaults to one per field');
  assert.equal(admitModel(pcdHeader({ FIELDS: 'x y z rgb', SIZE: '4 4 4 4', TYPE: 'F F F U', COUNT: '1 1 1 1' }, ['0 0 0 4294901760']), 'pcd').vertices, 1);
  assert.equal(admitModel(pcdHeader({ FIELDS: 'x y z normal_x normal_y normal_z', SIZE: '4 4 4 4 4 4', TYPE: 'F F F F F F', COUNT: '1 1 1 1 1 1' }, ['0 0 0 0 0 1']), 'pcd').vertices, 1);
  const bad = (extra, rows, code) => refused(() => admitModel(pcdHeader(extra, rows), 'pcd'), code);
  bad({ VIEWPOINT: '0 0 0 1 0 0' });
  bad({ VIEWPOINT: '0 0 0 1 0 0 x' });
  bad({ VERSION: '0.6' });
  bad({ FIELDS: 'x y', SIZE: '4 4', TYPE: 'F F', COUNT: '1 1' });
  bad({ FIELDS: 'x y z normal_x', SIZE: '4 4 4 4', TYPE: 'F F F F', COUNT: '1 1 1 1' }, ['0 0 0 0']);
  bad({ FIELDS: 'x y z intensity', SIZE: '4 4 4 4', TYPE: 'F F F F', COUNT: '1 1 1 1' }, ['0 0 0 0'], 'unsupported');
  bad({ SIZE: '4 4 8' }, undefined, 'unsupported');
  bad({ COUNT: '1 1 2' }, undefined, 'unsupported');
  bad({ TYPE: 'F F U' }, undefined, 'unsupported');
  bad({ FIELDS: 'x y z rgb', SIZE: '4 4 4 4', TYPE: 'F F F U', COUNT: '1 1 1 1' }, ['0 0 0 4294967296'], 'limit');
  assert.equal(admitModel(pcdHeader({ FIELDS: 'x y z rgb', SIZE: '4 4 4 4', TYPE: 'F F F F', COUNT: '1 1 1 1' }, ['0 0 0 1']), 'pcd').vertices, 1, 'floating point colors are allowed too');
  bad({ WIDTH: '2', HEIGHT: '2' });
  bad({ HEIGHT: '0', WIDTH: '0', POINTS: '0' }, []);
  bad({ DATA: 'binary_compressed' }, undefined, 'unsupported');
  bad({ DATA: null });
  bad({ UNKNOWN: '1' }, undefined, 'unsupported');
  bad({ FIELDS: 'x y z x', SIZE: '4 4 4 4', TYPE: 'F F F F', COUNT: '1 1 1 1' }, ['0 0 0 0']);
  bad({ FIELDS: 'a b c d e f g h i', SIZE: '4 4 4 4 4 4 4 4 4', TYPE: 'F F F F F F F F F', COUNT: '1 1 1 1 1 1 1 1 1' }, ['0 0 0 0 0 0 0 0 0']);
  refused(() => admitModel(utf8('VERSION 0.7\nVERSION 0.7\n'), 'pcd'));
  refused(() => admitModel(utf8(`# comment\n${new TextDecoder().decode(pcdHeader()).replace('0 0 0\n', ' 0 0 0\n')}`), 'pcd'), 'unsupported');
});

test('binary PCD stores float coordinates and raw packed colors back to back', () => {
  const header = 'VERSION 0.7\nFIELDS x y z rgb\nSIZE 4 4 4 4\nTYPE F F F U\nCOUNT 1 1 1 1\nWIDTH 2\nHEIGHT 1\nPOINTS 2\nDATA binary\n';
  const body = new Uint8Array(32);
  const view = new DataView(body.buffer);
  [0, 1, 2, 0, 4, 5, 6, 0].forEach((value, index) => { if (index % 4 !== 3) view.setFloat32(index * 4, value, true); });
  view.setUint32(12, 0xffff0000, true);
  view.setUint32(28, 0x7fc00000, true);
  const bytes = Buffer.concat([utf8(header), body]);
  assert.equal(admitModel(bytes, 'pcd').vertices, 2, 'packed color bits may look like NaN');
  refused(() => admitModel(bytes.subarray(0, bytes.length - 4), 'pcd'));
  const corrupt = Buffer.from(bytes);
  corrupt.writeFloatLE(Number.POSITIVE_INFINITY, utf8(header).length);
  refused(() => admitModel(corrupt, 'pcd'));
});

test('binary STL measures facets exactly and refuses non-finite floats', () => {
  const facet = (values) => { const bytes = new Uint8Array(50); const view = new DataView(bytes.buffer); values.forEach((value, index) => view.setFloat32(index * 4, value, true)); return bytes; };
  const header = (count) => { const bytes = new Uint8Array(84); new DataView(bytes.buffer).setUint32(80, count, true); return bytes; };
  const valid = Buffer.concat([header(1), facet([0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0])]);
  assert.equal(admitModel(valid, 'stl').vertices, 3);
  refused(() => admitModel(Buffer.concat([header(1), facet([0, 0, 1, 0, 0, 0, 1, 0, 0, 0, Number.NaN, 0])]), 'stl'), 'invalid');
  refused(() => admitModel(valid.subarray(0, valid.length - 1), 'stl'));
});

test('OBJ polygons accept the slash forms and are bounded and checked against the declared data', () => {
  const base = 'v 0 0 0\nv 1 0 0\nv 0 1 0\nvt 0 0\nvn 0 0 1\n';
  for (const face of ['f 1 2 3', 'f 1/1 2/1 3/1', 'f 1//1 2//1 3//1', 'f 1/1/1 2/1/1 3/1/1', 'f -3 -2 -1']) assert.equal(admitModel(utf8(`${base}${face}\n`), 'obj').vertices, 3, face);
  assert.equal(admitModel(utf8('v 0 0 0 0.5 0.5 0.5\nv 1 0 0\nv 0 1 0\nf 1 2 3\ns off\ng group\no object\n'), 'obj').vertices, 3);
  assert.equal(admitModel(utf8('# comment only\n\nv 0 0 0\n'), 'obj').vertices, 1);
  const bad = (face, code) => refused(() => admitModel(utf8(`${base}${face}\n`), 'obj'), code);
  bad('f 1 2');
  bad('f 1 2 0');
  bad('f 1 2 4');
  bad('f 1 2 -4');
  bad('f 1/2/3/4 2 3');
  bad('f /1 2 3');
  bad('f 1/2 2/2 3/2');
  bad('f 1//2 2//1 3//1');
  bad('l 1/1/1 2/1/1');
  bad('p 1/1');
  bad('s maybe');
  bad('curv 0 1 1');
  bad('mtllib materials.mtl', 'external-resource');
  bad('f 1 2 3 # trailing comment', 'unsupported');
  bad('f 1 2 3 \\', 'unsupported');
  bad(`f ${Array.from({ length: 257 }, () => '1').join(' ')}`, 'limit');
  assert.equal(admitModel(utf8(`${base}l 1/1 2/1\np 1 2 3\n`), 'obj').vertices, 5);
});
