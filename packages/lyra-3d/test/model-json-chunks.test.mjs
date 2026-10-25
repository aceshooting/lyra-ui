import assert from 'node:assert/strict';
import test from 'node:test';
import { admitModel, ModelAdmissionError } from '../dist/model/admission.js';
import { createModelJsonWork } from '../dist/model/model-json-work.js';
import { ModelJsonString } from '../dist/model/model-json-string.js';
import { createModelAdmissionWork } from '../dist/model/model-admission-kernel.js';
import { snapshotModelInput } from '../dist/model/model-admission-policy.js';
import { drainModelWork } from '../dist/model/model-work.js';
import { triangleJson, utf8 } from './model-fixtures.mjs';

const outcome = action => { try { return action(); } catch (error) { return error instanceof ModelAdmissionError ? error.code : error.name; } };
const shared = text => drainModelWork(createModelAdmissionWork(snapshotModelInput(utf8(text), 'gltf')));
test('multi-MiB unknown keys preserve policy ordering after complete syntax validation', () => {
  const key = 'x'.repeat(2 * 1024 * 1024);
  for (const source of [`{"${key}":0,"name":4}`, `{"name":4,"${key}":0}`, `{"name":4,"${key}":0,"1":0}`, `{"${key}":0,"${key}":1}`, `{"${key}":0,`, `{"${key}":0,"name":4,"\\u0000oversized-json-key":1}`]) {
    assert.equal(outcome(() => shared(source)), outcome(() => admitModel(utf8(source), 'gltf')));
  }
});
test('large JSON scalars and embedded data URIs remain chunk-backed through shared admission', () => {
  const source = triangleJson();
  const payload = new Uint8Array(2 * 1024 * 1024); payload.set(new Uint8Array(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]).buffer));
  source.buffers[0].byteLength = payload.length; source.buffers[0].uri = `data:application/octet-stream;base64,${Buffer.from(payload).toString('base64')}`;
  const text = JSON.stringify(source);
  const decoded = drainModelWork(createModelJsonWork(utf8(text)));
  const uri = decoded.buffers[0].uri;
  assert.ok(uri instanceof ModelJsonString); assert.equal(uri.length, source.buffers[0].uri.length);
  assert.ok(uri.chunks.every(chunk => chunk.length <= 1024)); assert.equal(uri.chunks.join(''), source.buffers[0].uri);
  for (const index of [0, 35, 1023, 1024, 1048576, uri.length - 1]) assert.equal(uri.charAt(index), source.buffers[0].uri.charAt(index));
  const admitted = shared(text); const original = admitModel(utf8(text), 'gltf');
  const { format, ...counts } = original; assert.equal(format, 'gltf'); assert.deepEqual(admitted.counts, counts);
  assert.ok(admitted.resources[0].uri instanceof ModelJsonString); assert.deepEqual(admitted.resources[0].bytes, payload);
  assert.equal(admitted.resources[0].uri.chunks.join(''), source.buffers[0].uri);
});

test('long scalar wrappers never become JSON objects at schema boundaries', () => {
  const scalar = 'x'.repeat(8192);
  for (const source of [JSON.stringify(scalar), JSON.stringify({ asset: scalar }), JSON.stringify({ asset: { version: '2.0' }, buffers: [scalar] })]) {
    assert.equal(outcome(() => shared(source)), outcome(() => admitModel(utf8(source), 'gltf')));
  }
});

test('long accessor type retains the unsupported refusal after the string-kind guard', () => {
  const source = triangleJson(); source.accessors[0].type = 'x'.repeat(8192);
  const text = JSON.stringify(source);
  assert.equal(outcome(() => shared(text)), 'unsupported');
  assert.equal(outcome(() => shared(text)), outcome(() => admitModel(utf8(text), 'gltf')));
});
