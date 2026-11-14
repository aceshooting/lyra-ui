import assert from 'node:assert/strict';
import test from 'node:test';
import { createSceneResourceLedger, planSceneAllocations } from '../src/scene/resource-ledger.mjs';

const bytes = (key, byteLength, pool = 'cpu-buffer') => ({ kind: 'bytes', key, pool, byteLength });
const texture = (key, change = {}) => ({ kind: 'texture', key, pool: 'gpu-texture', width: 2, height: 2,
  layers: 1, faces: 1, bytesPerPixel: 4, mipLevels: 1, ...change });
const invalid = { name: 'TypeError', message: 'Invalid scene allocation.' };

test('allocation plans require a declaration list of plain records', () => {
  for (const resources of [undefined, null, 'cpu', { length: 1, 0: bytes('a', 1) }]) {
    assert.throws(() => planSceneAllocations(resources, { bytes: 10 }), invalid);
  }
  for (const entry of [null, 'bytes', 7]) assert.throws(() => planSceneAllocations([entry], { bytes: 10 }), invalid);
  class Declaration { constructor() { Object.assign(this, bytes('a', 1)); } }
  assert.throws(() => planSceneAllocations([new Declaration()], { bytes: 10 }), invalid);
  const bare = Object.assign(Object.create(null), bytes('bare', 4));
  assert.equal(planSceneAllocations([bare], { bytes: 10 }).knownBytes, 4);
  for (const options of [null, 10, Object.assign(Object.create({ inherited: 1 }), { bytes: 10 })]) {
    assert.throws(() => planSceneAllocations([], options), invalid);
  }
});

test('declaration lists are bounded to 100000 entries', () => {
  const list = Array.from({ length: 100000 }, () => bytes('shared', 0));
  assert.equal(planSceneAllocations(list, { bytes: 0 }).allocations.length, 1);
  list.push(bytes('shared', 0));
  assert.throws(() => planSceneAllocations(list, { bytes: 0 }), invalid);
});

test('allocation keys are bounded non-blank strings', () => {
  for (const key of ['', '   ', 'k'.repeat(1025), 7]) assert.throws(() => planSceneAllocations([bytes(key, 1)], { bytes: 10 }), invalid);
  assert.equal(planSceneAllocations([bytes('k'.repeat(1024), 1)], { bytes: 10 }).knownBytes, 1);
});

test('byte declarations use buffer pools and texture declarations the texture pool', () => {
  assert.throws(() => planSceneAllocations([bytes('a', 1, 'gpu-texture')], { bytes: 10 }), invalid);
  assert.throws(() => planSceneAllocations([bytes('a', 1, 'disk')], { bytes: 10 }), invalid);
  for (const pool of ['cpu-buffer', 'worker-buffer', 'gpu-buffer']) {
    assert.equal(planSceneAllocations([texture('t'), bytes('b', 1, pool)], { bytes: 100 }).pools[pool], 1);
    assert.throws(() => planSceneAllocations([texture('t', { pool })], { bytes: 100 }), invalid);
  }
});

test('a ledger reservation is validated before any live reference changes', () => {
  const ledger = createSceneResourceLedger({ bytes: 100 });
  const held = ledger.reserve([bytes('held', 10)]);
  for (const resources of ['held', [null], [bytes('held', 10, 'gpu-texture')]]) assert.throws(() => ledger.reserve(resources), invalid);
  assert.equal(ledger.usage.knownBytes, 10);
  held.release();
  assert.equal(ledger.usage.knownBytes, 0);
});
