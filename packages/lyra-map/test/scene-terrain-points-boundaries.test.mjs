import assert from 'node:assert/strict';
import test from 'node:test';
import { planSceneAllocations } from '../src/scene/resource-ledger.mjs';
import { createTerrainPointQueue } from '../src/scene/terrain-points.mjs';

const sample = (x, y = 0.5) => ({ coordinate: [x, y], offsetMeters: 0 });
function ledger({ failRelease = false } = {}) {
  const reservations = [];
  const reserve = request => {
    const record = { bytes: planSceneAllocations(request, { bytes: Number.MAX_SAFE_INTEGER }).knownBytes, releases: 0 };
    reservations.push(record);
    return { release() { record.releases++; if (failRelease) throw new Error('release refused'); } };
  };
  return { reservations, reserve };
}

test('terrain queues require reservation and storage factories', () => {
  const { reserve } = ledger();
  for (const options of [undefined, {}, { reserve: 'reserve' }, { reserve, allocateFloat64: 1 }, { reserve, allocateFloat32: null }]) {
    assert.throws(() => createTerrainPointQueue(options), TypeError);
  }
  const queue = createTerrainPointQueue({ reserve });
  for (const stamp of [null, undefined, 0, 'stamp']) assert.throws(() => queue.setStamp(stamp), TypeError);
  assert.throws(() => queue.request('a', [sample(0.1)]), /unavailable/);
  queue.dispose();
});

test('disposing from inside a storage factory releases the in-flight reservation exactly once', () => {
  const { reservations, reserve } = ledger();
  let queue;
  queue = createTerrainPointQueue({ reserve, allocateFloat64(length) { queue.dispose(); return new Float64Array(length); } });
  queue.setStamp({});
  assert.throws(() => queue.request('owner', [sample(0.1), sample(0.2)]), /retired/);
  assert.equal(reservations.length, 1);
  assert.equal(reservations[0].releases, 1);
  assert.equal(queue.beginBatch(), null);
});

test('a refused in-flight release during reentrant disposal surfaces as a cleanup failure', () => {
  const { reservations, reserve } = ledger({ failRelease: true });
  let queue, failure;
  queue = createTerrainPointQueue({ reserve, allocateFloat64(length) {
    try { queue.dispose(); } catch (error) { failure = error; }
    return new Float64Array(length);
  } });
  queue.setStamp({});
  assert.throws(() => queue.request('owner', [sample(0.1)]), /retired/);
  assert.match(failure?.message ?? '', /Terrain cleanup unavailable/);
  assert.deepEqual(reservations.map(record => record.releases), [1]);
});

test('a refused lease release during disposal is reported after every lease was attempted', () => {
  const { reservations, reserve } = ledger({ failRelease: true });
  const queue = createTerrainPointQueue({ reserve });
  queue.setStamp({});
  queue.request('a', [sample(0.1)]); queue.request('b', [sample(0.2)]);
  assert.equal(reservations.length, 4);
  assert.throws(() => queue.dispose(), /Terrain cleanup unavailable/);
  assert.deepEqual(reservations.map(record => record.releases), [1, 1, 1, 1]);
  queue.dispose();
  assert.deepEqual(reservations.map(record => record.releases), [1, 1, 1, 1]);
});
