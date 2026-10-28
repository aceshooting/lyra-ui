import assert from 'node:assert/strict';
import test from 'node:test';
import { snapshotSceneModels } from '../dist/map/admission.js';

const model = (id = 'model', bytes = new Uint8Array([1, 2, 3])) => ({ id, label: 'Model', kind: 'model',
  position: { lngLat: [6, 49], altitude: 10 }, source: { format: 'glb', bytes } });

test('model admission snapshots only the selected byte view and independent plain placement data', () => {
  const backing = new Uint8Array([99, 1, 2, 3, 88]);
  const input = model('model', backing.subarray(1, 4));
  const snapshot = snapshotSceneModels([input]);
  backing.fill(0); input.position.lngLat[0] = 20;
  assert.deepEqual([...snapshot[0].source.bytes], [1, 2, 3]);
  assert.equal(snapshot[0].source.bytes.byteLength, 3);
  assert.equal(snapshot[0].source.bytes.buffer.byteLength, 3);
  assert.deepEqual(snapshot[0].position.lngLat, [6, 49]);
  assert.ok(Object.isFrozen(snapshot) && Object.isFrozen(snapshot[0]) && Object.isFrozen(snapshot[0].position.lngLat));
});

test('duplicate IDs, URL authority, exotic bytes and invalid placement reject the entire snapshot', () => {
  assert.throws(() => snapshotSceneModels([model(), model()]));
  for (const change of [{ id: '' }, { label: '   ' }, { source: { format: 'glb', src: 'https://example.com/model.glb' } },
    { source: { format: 'other', bytes: new Uint8Array([1]) } }, { orientation: [0, 0, 0, 0] },
    { position: { lngLat: [0, 90] } }, { metersPerUnit: -1 }]) {
    assert.throws(() => snapshotSceneModels([{ ...model(), ...change }]));
  }
  if (typeof SharedArrayBuffer === 'function') assert.throws(() => snapshotSceneModels([model('shared', new Uint8Array(new SharedArrayBuffer(3)))]));
  if (typeof ArrayBuffer.prototype.resize === 'function') assert.throws(() => snapshotSceneModels([model('resizable', new Uint8Array(new ArrayBuffer(3, { maxByteLength: 6 })))]));
});

test('prepared boundary requires Uint8Array bytes and rejects detached backing and aggregate excess atomically', () => {
  assert.throws(() => snapshotSceneModels([model('buffer', new ArrayBuffer(3))]));
  const detached = new Uint8Array([1, 2, 3]);
  structuredClone(detached.buffer, { transfer: [detached.buffer] });
  assert.throws(() => snapshotSceneModels([model('detached', detached)]));
  const valid = model('valid');
  const before = structuredClone(valid);
  assert.throws(() => snapshotSceneModels([valid, { ...model('bad'), label: '' }]));
  assert.deepEqual(valid, before);
  assert.throws(() => snapshotSceneModels(Array.from({ length: 33 }, (_, index) => model(`m-${index}`))));
});

test('descriptor accessors are rejected without evaluating getters', () => {
  let reads = 0;
  const input = model();
  Object.defineProperty(input, 'orientation', { enumerable: true, get() { reads++; return [0, 0, 0, 1]; } });
  assert.throws(() => snapshotSceneModels([input]));
  assert.equal(reads, 0);
  const nestedPosition = model('position');
  Object.defineProperty(nestedPosition.position, 'lngLat', { get() { reads++; return [0, 0]; } });
  assert.throws(() => snapshotSceneModels([nestedPosition]));
  const nestedBytes = model('bytes');
  Object.defineProperty(nestedBytes.source, 'bytes', { get() { reads++; return new Uint8Array([1]); } });
  assert.throws(() => snapshotSceneModels([nestedBytes]));
  assert.equal(reads, 0);
});
