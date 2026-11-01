import assert from 'node:assert/strict';
import test from 'node:test';
import { planSceneAllocations, createSceneResourceLedger } from '../src/scene/resource-ledger.mjs';

const bytes = (key, byteLength, pool = 'cpu-buffer') => ({ kind: 'bytes', key, pool, byteLength });
const texture = (key, change = {}) => ({ kind: 'texture', key, pool: 'gpu-texture', width: 3, height: 5,
  layers: 1, faces: 1, bytesPerPixel: 4, mipLevels: 3, ...change });

test('fixed-format NPOT mips count every level, layer and face with separate payload pools', () => {
  const plan = planSceneAllocations([texture('small'), texture('array', { layers: 2, faces: 6 }),
    bytes('cpu', 10), bytes('worker', 20, 'worker-buffer'), bytes('gpu', 30, 'gpu-buffer')], { bytes: 1000 });
  assert.equal(plan.knownBytes, 996);
  assert.deepEqual(plan.pools, { 'cpu-buffer': 10, 'worker-buffer': 20, 'gpu-buffer': 30, 'gpu-texture': 936 });
  assert.deepEqual(plan.allocations.map(value => value.key), ['array', 'cpu', 'gpu', 'small', 'worker']);
  assert.ok(Object.isFrozen(plan) && Object.isFrozen(plan.pools) && Object.isFrozen(plan.allocations));
  assert.ok(plan.allocations.every(Object.isFrozen));
  const rgba32 = texture('old', { width: 1024, height: 1024, bytesPerPixel: 16, mipLevels: 1 });
  const overlap = planSceneAllocations([rgba32, { ...rgba32, key: 'candidate' }, bytes('readback', 16777216)], { bytes: 50331648 });
  assert.equal(overlap.knownBytes, 50331648);
  assert.equal(overlap.pools['gpu-texture'], 33554432);
  assert.equal(overlap.pools['cpu-buffer'], 16777216);
});

test('storage aliases require full shape and pool consistency, even at equal byte totals', () => {
  assert.equal(planSceneAllocations([texture('shared'), texture('shared')], { bytes: 72 }).knownBytes, 72);
  assert.equal(planSceneAllocations([texture('a'), texture('b')], { bytes: 144 }).knownBytes, 144);
  for (const conflict of [texture('shared', { width: 5, height: 3 }),
    bytes('shared', 72, 'gpu-buffer'), texture('shared', { width: 1, height: 18, mipLevels: 1 })]) {
    assert.throws(() => planSceneAllocations([texture('shared'), conflict], { bytes: 1000 }));
  }
  assert.throws(() => planSceneAllocations([bytes('shared', 4), bytes('shared', 4, 'worker-buffer')], { bytes: 100 }));
});

test('installed candidate and scratch union reservations are atomic with idempotent release', () => {
  const ledger = createSceneResourceLedger({ bytes: 100 });
  const old = ledger.reserve([bytes('old', 60)]), candidate = ledger.reserve([bytes('candidate', 30)]);
  const before = ledger.usage;
  assert.throws(() => ledger.reserve([bytes('scratch', 11)]));
  assert.deepEqual(ledger.usage, before);
  const scratch = ledger.reserve([bytes('scratch', 10)]);
  assert.equal(ledger.usage.knownBytes, 100);
  assert.ok(Object.isFrozen(ledger.usage) && Object.isFrozen(ledger.usage.pools));
  assert.notEqual(ledger.usage, ledger.usage);
  scratch.release(); scratch.release(); candidate.release();
  assert.equal(ledger.usage.knownBytes, 60);
  old.release(); assert.equal(ledger.usage.knownBytes, 0);
  const empty = ledger.reserve([]); empty.release(); assert.equal(ledger.usage.knownBytes, 0);
});

test('live alias refcounts preserve storage until last release and snapshot caller revisions', () => {
  const ledger = createSceneResourceLedger({ bytes: 100 });
  const descriptor = bytes('backing', 60), input = [descriptor];
  const first = ledger.reserve(input), alias = ledger.reserve([bytes('backing', 60)]);
  descriptor.byteLength = 1; input.length = 0;
  assert.equal(ledger.usage.knownBytes, 60);
  assert.throws(() => ledger.reserve([bytes('backing', 59)]));
  first.release(); assert.equal(ledger.usage.knownBytes, 60);
  alias.release(); assert.equal(ledger.usage.knownBytes, 0);
  const reused = ledger.reserve([bytes('backing', 1)]);
  assert.equal(ledger.usage.knownBytes, 1); reused.release();
});

test('invalid unknown image resources, unsafe arithmetic and descriptor accessors fail closed', () => {
  for (const resource of [texture('x', { mipLevels: 4 }), texture('x', { width: 0 }),
    texture('x', { width: Number.MAX_SAFE_INTEGER, height: 2 }), texture('x', { layers: 0.5 }),
    texture('x', { bytesPerPixel: 3 }), texture('x', { extra: true }), bytes('x', -1), bytes('x', Infinity),
    { kind: 'image', key: 'bitmap', pool: 'cpu-image', width: 3, height: 5 },
    { kind: 'image-bitmap', key: 'bitmap', byteLength: 60 }, { kind: 'bytes', key: 'missing', pool: 'cpu-buffer' }]) {
    assert.throws(() => planSceneAllocations([resource], { bytes: Number.MAX_SAFE_INTEGER }));
  }
  assert.throws(() => planSceneAllocations([bytes('a', Number.MAX_SAFE_INTEGER), bytes('b', 1)], { bytes: Number.MAX_SAFE_INTEGER }));
  let reads = 0;
  const resource = bytes('getter', 1);
  Object.defineProperty(resource, 'byteLength', { get() { reads++; return 0; } });
  assert.throws(() => planSceneAllocations([resource], { bytes: 100 }));
  assert.equal(reads, 0);
});
