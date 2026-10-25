import assert from 'node:assert/strict';
import test from 'node:test';
import { admitModel, ModelAdmissionError, readModelAdmission } from '../dist/model/admission.js';
import { triangleJson, utf8 } from './model-fixtures.mjs';

const keys = ['format', 'encodedBytes', 'decodedBytes', 'vertices', 'indices', 'resources', 'imagePixels'];
test('admission retains its exact frozen receipt shape and requires original receipt identity', () => {
  const input = utf8('0 0 0\n'); const receipt = admitModel(input, 'xyz');
  assert.equal(Object.getPrototypeOf(receipt), Object.prototype);
  assert.deepEqual(Reflect.ownKeys(receipt), keys);
  assert.deepEqual(receipt, { format: 'xyz', encodedBytes: input.length, decodedBytes: 160, vertices: 1, indices: 0, resources: 0, imagePixels: 0 });
  for (const key of keys) assert.deepEqual(Object.getOwnPropertyDescriptor(receipt, key), { value: receipt[key], writable: false, enumerable: true, configurable: false });
  for (const forged of [{ ...receipt }, Object.create(receipt), new Proxy(receipt, {}), null, undefined]) {
    assert.throws(() => readModelAdmission(forged), error => error instanceof ModelAdmissionError && error.code === 'invalid');
  }
  assert.notEqual(admitModel(input, 'xyz'), receipt);
});
test('long URI resources remain exact native strings and every parser read owns its byte copies', () => {
  const payload = new Uint8Array(8192); payload[12] = 128; payload[15] = 63;
  const document = triangleJson(); document.buffers[0].byteLength = payload.length;
  const uri = `data:application/octet-stream;base64,${Buffer.from(payload).toString('base64')}`;
  document.buffers[0].uri = uri;
  const input = utf8(JSON.stringify(document)); const expectedBytes = input.slice();
  const receipt = admitModel(input, 'gltf'); input.fill(0);
  const first = readModelAdmission(receipt); const second = readModelAdmission(receipt);
  assert.equal(typeof first.resources[0].uri, 'string'); assert.equal(first.resources[0].uri, uri);
  assert.deepEqual(first.resources[0].bytes, payload); assert.deepEqual(first.bytes, expectedBytes);
  assert.notEqual(first.bytes.buffer, second.bytes.buffer);
  assert.notEqual(first.resources[0].bytes.buffer, second.resources[0].bytes.buffer);
  assert.notEqual(first.bytes.buffer, first.resources[0].bytes.buffer);
  first.bytes.fill(0); first.resources[0].bytes.fill(0); first.resources[0].uri = 'changed'; first.resources.length = 0;
  assert.deepEqual(second.resources[0].bytes, payload);
  const third = readModelAdmission(receipt); assert.deepEqual(third.bytes, expectedBytes); assert.equal(third.resources[0].uri, uri); assert.deepEqual(third.resources[0].bytes, payload);
});
test('offset views snapshot only their admitted range and detached backing stores keep native failure timing', () => {
  const payload = utf8('0 0 0\n'); const backing = new Uint8Array(payload.length + 8); backing.fill(255); backing.set(payload, 4);
  const receipt = admitModel(backing.subarray(4, 4 + payload.length), 'xyz');
  assert.deepEqual(readModelAdmission(receipt).bytes, payload);
  for (const asView of [false, true]) {
    const buffer = new ArrayBuffer(8); const source = asView ? new Uint8Array(buffer) : buffer;
    structuredClone(buffer, { transfer: [buffer] });
    assert.throws(() => admitModel(source, 'xyz'), TypeError);
    assert.throws(() => admitModel(source, 'unknown'), error => error instanceof ModelAdmissionError && error.code === 'unsupported');
  }
  assert.throws(() => admitModel(null, 'unknown'), error => error instanceof ModelAdmissionError && error.code === 'unsupported');
  assert.throws(() => admitModel(null, 'xyz'), error => error instanceof ModelAdmissionError && error.code === 'invalid');
});
