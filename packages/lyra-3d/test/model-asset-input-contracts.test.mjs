import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareModelAsset } from '../dist/model/model-asset.js';
import { utf8, triangleJson, glbWithImage, png } from './model-fixtures.mjs';

function ledger() {
  const live = new Set(), released = [], requests = [];
  return { live, released, requests,
    reserve(request) {
      requests.push(request);
      const key = `owned-${requests.length}`; live.add(key);
      return { key, release() { assert.equal(live.delete(key), true); released.push(key); } };
    }, admitCounts() {}, noteNativeImage() {},
  };
}
const valid = () => ({ format: 'xyz', bytes: utf8('1 2 3\n') });

for (const [name, make] of [
  ['null input', () => null], ['primitive input', () => 'xyz'], ['missing format', () => ({ bytes: utf8('1 2 3') })],
  ['missing bytes', () => ({ format: 'xyz' })], ['inherited format', () => Object.assign(Object.create({ format: 'xyz' }), { bytes: utf8('1 2 3') })],
  ['unsupported format', () => ({ ...valid(), format: 'svg' })],
  ['empty bytes', () => ({ format: 'xyz', bytes: new Uint8Array() })],
  ['wrong element type', () => ({ format: 'xyz', bytes: new Uint8ClampedArray([1]) })],
  ['plain array', () => ({ format: 'xyz', bytes: [1, 2, 3] })],
  ['typed array proxy', () => ({ format: 'xyz', bytes: new Proxy(utf8('1 2 3'), {}) })],
  ['shared backing store', () => ({ format: 'xyz', bytes: new Uint8Array(new SharedArrayBuffer(12)) })],
  ['resizable backing store', () => ({ format: 'xyz', bytes: new Uint8Array(new ArrayBuffer(12, { maxByteLength: 24 })) })],
  ['detached backing store', () => {
    const bytes = utf8('1 2 3'); structuredClone(bytes.buffer, { transfer: [bytes.buffer] });
    return { format: 'xyz', bytes };
  }],
]) {
  test(`model assets reject ${name} before reserving storage and accept a subsequent valid input`, async () => {
    const budget = ledger();
    await assert.rejects(prepareModelAsset(make(), { execution: 'local', budget }), { code: 'invalid' });
    assert.equal(budget.requests.length, 0);
    const asset = await prepareModelAsset(valid(), { execution: 'local', budget });
    assert.ok(asset.storage.length > 0); asset.dispose(); assert.equal(budget.live.size, 0);
  });
}

for (const key of ['format', 'bytes']) {
  test(`model assets reject an accessor ${key} without executing application code`, async () => {
    const input = valid(), budget = ledger(); let reads = 0;
    Object.defineProperty(input, key, { get() { reads++; throw new Error('application accessor ran'); } });
    await assert.rejects(prepareModelAsset(input, { execution: 'local', budget }), { code: 'invalid' });
    assert.equal(reads, 0); assert.equal(budget.requests.length, 0);
  });
}

test('unsupported model execution policy is rejected before retaining input storage', async () => {
  const budget = ledger();
  await assert.rejects(prepareModelAsset(valid(), { execution: 'worker', budget }), { code: 'invalid' });
  assert.equal(budget.requests.length, 0);
});

for (const key of ['', null, 17]) {
  test(`an invalid model reservation key (${String(key)}) releases its newly acquired lease`, async () => {
    const budget = ledger(), reserve = budget.reserve;
    budget.reserve = request => ({ ...reserve(request), key });
    await assert.rejects(prepareModelAsset(valid(), { execution: 'local', budget }), { code: 'invalid' });
    assert.equal(budget.requests.length, 1); assert.equal(budget.released.length, 1);
    assert.equal(budget.live.size, 0);
  });
}

test('a model reservation without a release capability is rejected before parsing', async () => {
  let requests = 0, counts = 0;
  const budget = { reserve() { requests++; return { key: 'unreleasable' }; }, admitCounts() { counts++; }, noteNativeImage() {} };
  await assert.rejects(prepareModelAsset(valid(), { execution: 'local', budget }), { code: 'invalid' });
  assert.equal(requests, 1); assert.equal(counts, 0);
});

test('cancellation from validation scratch reservation releases both scratch and retained model storage', async () => {
  const budget = ledger(), reserve = budget.reserve, controller = new AbortController();
  budget.reserve = request => {
    const lease = reserve(request); if (request.purpose === 'scratch') controller.abort(); return lease;
  };
  await assert.rejects(prepareModelAsset({ format: 'gltf', bytes: utf8(JSON.stringify(triangleJson())) },
    { execution: 'local', budget, signal: controller.signal }), { name: 'AbortError' });
  assert.equal(budget.requests.filter(request => request.purpose === 'scratch').length, 1);
  assert.equal(budget.released.length, budget.requests.length); assert.equal(budget.live.size, 0);
});

test('model retirement keeps releasing remaining storage and images after individual cleanup failures', async () => {
  const budget = ledger(), reserve = budget.reserve; let closed = 0;
  budget.reserve = request => {
    const lease = reserve(request);
    return { key: lease.key, release() { lease.release(); if (request.purpose !== 'scratch') throw new Error('storage cleanup failed'); } };
  };
  const bytes = glbWithImage(png(), 'image/png', document => { document.images.push({ ...document.images[0] }); });
  const asset = await prepareModelAsset({ format: 'glb', bytes }, { execution: 'local', budget }, {
    async decodeImage() { return { width: 1, height: 1, close() { closed++; throw new Error('image cleanup failed'); } }; },
  });
  assert.doesNotThrow(() => asset.dispose()); asset.dispose();
  assert.equal(closed, 2); assert.equal(budget.live.size, 0);
  assert.equal(budget.released.length, budget.requests.length);
});
