import assert from 'node:assert/strict';
import test from 'node:test';
import { admitModel, readModelAdmission, ModelAdmissionError } from '../dist/model/admission.js';
import { adobeSegment, glbWithImage, jpeg, png, utf8 } from './model-fixtures.mjs';

function rejected(action, code) {
  assert.throws(action, (error) => error instanceof ModelAdmissionError && (!code || error.code === code));
}
const imageOf = (plan) => readModelAdmission(plan).resources.find((resource) => resource.kind === 'image');

test('images packed into a GLB buffer view are measured, owned and counted like embedded data URIs', () => {
  for (const [bytes, mime] of [[png(2, 3), 'image/png'], [jpeg(), 'image/jpeg']]) {
    const plan = admitModel(glbWithImage(bytes, mime), 'glb');
    const image = imageOf(plan);
    assert.equal(image.mimeType, mime);
    assert.equal(image.uri, null, 'a packed image has no URI of its own');
    assert.deepEqual(image.bytes, bytes);
    assert.deepEqual([image.width, image.height], mime === 'image/png' ? [2, 3] : [1, 1]);
    assert.ok(plan.imagePixels >= image.width * image.height, 'the reservation covers at least the image itself');
    assert.equal(plan.resources, 2, 'the geometry buffer and the image');
  }
});

test('packed images need an exact supported media type, no stride and no second source', () => {
  const image = png();
  rejected(() => admitModel(glbWithImage(image, undefined, (json) => delete json.images[0].mimeType), 'glb'), 'unsupported');
  rejected(() => admitModel(glbWithImage(image, 'image/webp'), 'glb'), 'unsupported');
  rejected(() => admitModel(glbWithImage(image, 'image/png', (json) => { json.bufferViews[1].byteStride = 4; }), 'glb'));
  rejected(() => admitModel(glbWithImage(image, 'image/png', (json) => { json.images[0].uri = 'data:image/png;base64,AAAA'; }), 'glb'));
  rejected(() => admitModel(glbWithImage(image, 'image/png', (json) => { json.images[0].bufferView = 7; }), 'glb'));
  // The declared type must describe the bytes.
  rejected(() => admitModel(glbWithImage(image, 'image/jpeg'), 'glb'));
  rejected(() => admitModel(glbWithImage(jpeg(), 'image/png'), 'glb'));
});

test('an embedded URI may restate its media type but not contradict it', () => {
  const image = png();
  const uri = `data:image/png;base64,${Buffer.from(image).toString('base64')}`;
  const document = (change) => {
    const json = JSON.parse(new TextDecoder().decode(utf8(JSON.stringify({
      asset: { version: '2.0' },
      buffers: [{ byteLength: 36, uri: `data:application/octet-stream;base64,${Buffer.from(new Uint8Array(36)).toString('base64')}` }],
      bufferViews: [{ buffer: 0, byteLength: 36 }],
      accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [0, 0, 0] }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], nodes: [{ mesh: 0 }], scenes: [{ nodes: [0] }], scene: 0,
      images: [{ uri }],
    }))));
    change(json);
    return utf8(JSON.stringify(json));
  };
  assert.equal(admitModel(document((json) => { json.images[0].mimeType = 'image/png'; }), 'gltf').resources, 2);
  rejected(() => admitModel(document((json) => { json.images[0].mimeType = 'image/jpeg'; }), 'gltf'));
});

test('Adobe colour-transform metadata is the only extra JPEG application segment', () => {
  const json = (image) => glbWithImage(image, 'image/jpeg');
  assert.equal(imageOf(admitModel(json(jpeg(adobeSegment())), 'glb')).width, 1);
  rejected(() => admitModel(json(jpeg(adobeSegment('Adobo'))), 'glb'), 'unsupported');
  const longer = adobeSegment(); longer[3] = 15; longer.push(0);
  rejected(() => admitModel(json(jpeg(longer)), 'glb'), 'unsupported');
  rejected(() => admitModel(json(jpeg([255, 225, 0, 4, 0, 0])), 'glb'), 'unsupported');
});

test('OBJ normals and texture coordinates are validated and counted, not skipped', () => {
  const faces = 'f 1/1/1 2/2/2 3/3/3\n';
  const complete = `v 0 0 0\nv 1 0 0\nv 0 1 0\nvn 0 0 1\nvn 0 0 1\nvn 0 0 1\nvt 0 0\nvt 1 0\nvt 0 1\n${faces}`;
  const plan = admitModel(utf8(complete), 'obj');
  assert.equal(plan.vertices, 3);
  assert.equal(plan.indices, 0, 'OBJ faces expand into vertices instead of an index buffer');
  rejected(() => admitModel(utf8(complete.replace('vn 0 0 1\n', 'vn 0 0\n')), 'obj'), 'unsupported');
  rejected(() => admitModel(utf8(complete.replace('vt 0 0\n', 'vt 0 0 0\n')), 'obj'), 'unsupported');
  rejected(() => admitModel(utf8(complete.replace('vn 0 0 1\n', 'vn 0 0 nope\n')), 'obj'), 'invalid');
  rejected(() => admitModel(utf8(complete.replace('vt 0 0\n', 'vt 0 Infinity\n')), 'obj'), 'invalid');
});

test('PLY files with elements beyond vertices and faces are refused', () => {
  const header = 'ply\nformat ascii 1.0\nelement vertex 1\nproperty float x\nproperty float y\nproperty float z\n';
  assert.equal(admitModel(utf8(`${header}end_header\n0 0 0\n`), 'ply').vertices, 1);
  rejected(() => admitModel(utf8(`${header}element edge 1\nproperty int vertex1\nend_header\n0 0 0\n0\n`), 'ply'), 'unsupported');
  rejected(() => admitModel(utf8(`${header}element face 1\nelement material 1\nend_header\n0 0 0\n`), 'ply'), 'unsupported');
});
