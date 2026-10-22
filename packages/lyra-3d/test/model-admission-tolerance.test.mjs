import assert from 'node:assert/strict';
import test from 'node:test';
import { admitModel, ModelAdmissionError } from '../dist/model/admission.js';
import { MODEL_LIMITS } from '../dist/model/limits.js';
import { glbWithImage, jpeg, utf8 } from './model-fixtures.mjs';

const refused = (action, code) => assert.throws(action, (error) => error instanceof ModelAdmissionError && (!code || error.code === code));

test('comments and blank lines are skipped by every text format', () => {
  assert.equal(admitModel(utf8('# header\n\n0 0 0\n   \n1 1 1 255 0 0\n'), 'xyz').vertices, 2);
  const stl = 'solid one\n\nfacet normal 0 0 1\n\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\n\nendsolid one\n\n';
  assert.equal(admitModel(utf8(stl), 'stl').vertices, 3);
  const ply = 'ply\nformat ascii 1.0\ncomment made by hand\ncomment\nobj_info scanner 3\nelement vertex 2\nproperty float x\nproperty float y\nproperty float z\nend_header\n\n0 0 0\n\n1 1 1\n\n';
  assert.equal(admitModel(utf8(ply), 'ply').vertices, 2);
  const pcd = '# .PCD v0.7 - Point Cloud Data file format\nVERSION 0.7\nFIELDS x y z\nSIZE 4 4 4\nTYPE F F F\nCOUNT 1 1 1\nWIDTH 2\nHEIGHT 1\nPOINTS 2\nDATA ascii\n\n0 0 0\n\n1 1 1\n';
  assert.equal(admitModel(utf8(pcd), 'pcd').vertices, 2);
});

test('model bytes may arrive as an ArrayBuffer or a Uint8Array and nothing else', () => {
  const bytes = utf8('0 0 0\n1 1 1\n');
  const copy = new Uint8Array(bytes).buffer;
  assert.equal(admitModel(copy, 'xyz').vertices, 2);
  assert.equal(admitModel(bytes, 'xyz').vertices, 2);
  copy[0] = 0;
  assert.equal(admitModel(bytes, 'xyz').vertices, 2, 'the receipt owns a copy of what was admitted');
  refused(() => admitModel(new Float32Array(3), 'xyz'), 'invalid');
  refused(() => admitModel('0 0 0\n', 'xyz'), 'invalid');
  refused(() => admitModel(new Uint8Array(new SharedArrayBuffer(8)), 'xyz'), 'invalid');
  refused(() => admitModel(new Uint8Array(new ArrayBuffer(8, { maxByteLength: 16 })), 'xyz'), 'invalid');
  refused(() => admitModel(bytes, 'fbx'), 'unsupported');
  refused(() => admitModel(new Uint8Array(MODEL_LIMITS.encodedBytes + 1), 'xyz'), 'limit');
});

/** A baseline JPEG with a three-channel frame header and entropy data containing stuffing and restarts. */
function colorJpeg() {
  const bytes = [...jpeg()];
  const frame = bytes.findIndex((value, index) => value === 255 && bytes[index + 1] === 192);
  // The original frame header is 13 bytes long: marker, length, precision, size, one component.
  bytes.splice(frame, 13, 255, 192, 0, 17, 8, 0, 1, 0, 1, 3, 1, 17, 0, 2, 17, 0, 3, 17, 0);
  // Entropy-coded data may contain stuffed zero bytes and restart markers before the end marker.
  const scan = bytes.findIndex((value, index) => value === 255 && bytes[index + 1] === 218);
  const data = scan + 2 + 8;
  bytes.splice(data, bytes.length - data - 2, 63, 255, 0, 255, 208, 1);
  return new Uint8Array(bytes);
}

test('JPEG headers may pad markers with fill bytes, use three channels and carry stuffed or restart bytes', () => {
  const pack = (image) => glbWithImage(image, 'image/jpeg');
  assert.equal(admitModel(pack(jpeg([255])), 'glb').resources, 2, 'a fill byte before a marker');
  assert.equal(admitModel(pack(colorJpeg()), 'glb').resources, 2);
  refused(() => admitModel(pack(jpeg([255, 218])), 'glb'));
  const unterminated = jpeg().slice(0, -2);
  refused(() => admitModel(pack(unterminated), 'glb'));
});
