import assert from 'node:assert/strict';
import test from 'node:test';
import { planSceneAllocations } from '../src/scene/resource-ledger.mjs';
import { createTerrainPointQueue } from '../src/scene/terrain-points.mjs';

const sample = (x, y = 0.5, offsetMeters = 0) => ({ coordinate: [x, y], offsetMeters });
const rgba = values => new Float32Array(values.flatMap(value => [value, 0, 0, 1]));
function setup(options = {}) {
  const events = [], reservations = [];
  const reserve = request => {
    const plan = planSceneAllocations(request, { bytes: Number.MAX_SAFE_INTEGER });
    assert.ok(plan.knownBytes > 0);
    const record = { resources: request, bytes: plan.knownBytes, released: false }; reservations.push(record); events.push('reserve');
    return { release() { assert.equal(record.released, false); record.released = true; events.push('release'); } };
  };
  const storage = Type => length => { assert.ok(reservations.some(item => !item.released)); events.push('construct'); return new Type(length); };
  const queue = createTerrainPointQueue({ reserve, allocateFloat64: storage(Float64Array), allocateFloat32: storage(Float32Array), ...options });
  const stamp = {}; queue.setStamp(stamp);
  return { queue, stamp, reservations, events };
}

test('deduplicates selected coordinates independently of authored offsets and retains same-stamp cache', () => {
  const { queue, stamp } = setup();
  const input = [sample(0.5, 0.5, 20)], a = queue.request('a', input), b = queue.request('b', [sample(0.5, 0.5, -3)]);
  input[0].coordinate[0] = 0.8;
  const batch = queue.beginBatch(); assert.deepEqual(batch.points, [[0.5, 0.5]]);
  assert.ok(Object.isFrozen(batch) && Object.isFrozen(batch.points) && Object.isFrozen(batch.points[0]));
  assert.equal(queue.complete(batch.token, { rgba: rgba([0]), count: 1 }), true);
  assert.deepEqual(a.resolve(), { status: 'resolved', altitudes: [20] });
  assert.deepEqual(b.resolve(), { status: 'resolved', altitudes: [-3] });
  queue.setStamp(stamp); assert.equal(queue.beginBatch(), null);
  const c = queue.request('c', [sample(0.5)]); assert.deepEqual(c.resolve(), { status: 'resolved', altitudes: [0] });
  assert.equal(queue.beginBatch(), null); queue.dispose();
});

test('one in-flight FIFO batch has at most eight points and prefix completion preserves queue order', () => {
  const { queue } = setup(); const owner = queue.request('route', Array.from({ length: 20 }, (_, i) => sample(i / 100)));
  const first = queue.beginBatch(); assert.equal(first.points.length, 8); assert.equal(queue.beginBatch(), null);
  assert.equal(queue.complete(first.token, { rgba: rgba([1, 2]), count: 2 }), true);
  assert.deepEqual(owner.resolve(), { status: 'terrain-pending' });
  const second = queue.beginBatch(); assert.deepEqual(second.points.map(point => point[0]), [.02, .03, .04, .05, .06, .07, .08, .09]);
  assert.equal(queue.complete(first.token, { rgba: rgba([99]), count: 1 }), false);
  queue.cancelBatch(second.token); assert.deepEqual(queue.beginBatch().points, second.points); queue.dispose();
});

test('absent coverage blocks only its coordinates until an external stamp change', () => {
  const { queue } = setup(); const a = queue.request('a', [sample(.1)]), b = queue.request('b', [sample(.2)]);
  const batch = queue.beginBatch(); queue.complete(batch.token, { count: 2, rgba: new Float32Array([NaN, 0, 0, 0, 0, 0, 0, 1]) });
  assert.deepEqual(a.resolve(), { status: 'terrain-pending' }); assert.deepEqual(b.resolve(), { status: 'resolved', altitudes: [0] });
  for (let i = 0; i < 20; i++) assert.equal(queue.beginBatch(), null);
  queue.request('later', [sample(.3)]); const next = queue.beginBatch(); assert.deepEqual(next.points, [[.3, .5]]);
  queue.complete(next.token, { count: 1, rgba: rgba([3]) });
  queue.setStamp({}); assert.deepEqual(b.resolve(), { status: 'terrain-pending' }); assert.ok(queue.beginBatch()); queue.dispose();
});

test('view changes invalidate opaque batch tokens; own completion and no-op stamps never invalidate siblings', () => {
  const { queue, stamp } = setup(); const owner = queue.request('a', [sample(.1)]), stale = queue.beginBatch();
  assert.equal(queue.complete({}, { count: 1, rgba: rgba([7]) }), false);
  queue.setStamp({}); assert.equal(queue.complete(stale.token, { count: 1, rgba: rgba([7]) }), false);
  assert.deepEqual(owner.resolve(), { status: 'terrain-pending' });
  const current = queue.beginBatch(); queue.complete(current.token, { count: 1, rgba: rgba([8]) });
  assert.deepEqual(owner.resolve(), { status: 'resolved', altitudes: [8] });
  queue.setStamp(stamp); assert.deepEqual(owner.resolve(), { status: 'terrain-pending' }); queue.dispose();
});

test('result validation is atomic and requires native Float32 coverage zero or one and finite covered heights', () => {
  for (const value of [new Float64Array([1, 0, 0, 1]), new Float32Array([1, 0, 0, .5]), new Float32Array([Infinity, 0, 0, 1]), new Float32Array(3)]) {
    const { queue } = setup(); const owner = queue.request('a', [sample(.1)]), batch = queue.beginBatch();
    assert.throws(() => queue.complete(batch.token, { count: 1, rgba: value })); assert.deepEqual(owner.resolve(), { status: 'terrain-pending' }); queue.dispose();
  }
  const { queue } = setup(); queue.request('a', [sample(.1), sample(.2)]); const batch = queue.beginBatch();
  for (const count of [0, 3, 1.5]) assert.throws(() => queue.complete(batch.token, { count, rgba: rgba([1, 2]) })); queue.dispose();
});

test('replacement and releases retire old object candidates without discarding shared coordinates', () => {
  const { queue, reservations } = setup(); const old = queue.request('a', [sample(.1)]), shared = queue.request('b', [sample(.1)]);
  const replacement = queue.request('a', [sample(.2)]); old.release(); old.release();
  assert.deepEqual(old.resolve(), { status: 'terrain-pending' });
  const batch = queue.beginBatch(); queue.complete(batch.token, { count: 2, rgba: rgba([1, 2]) });
  assert.deepEqual(shared.resolve(), { status: 'resolved', altitudes: [1] }); assert.deepEqual(replacement.resolve(), { status: 'resolved', altitudes: [2] });
  shared.release(); replacement.release(); queue.dispose(); queue.dispose(); assert.ok(reservations.length > 0 && reservations.every(item => item.released));
});

test('admission rejects invalid coordinates and offsets without canonical-copy fallback', () => {
  const { queue } = setup();
  for (const value of [sample(NaN), sample(Infinity), sample(.5, -1), sample(.5, 2), sample(.5, .5, Infinity)]) assert.throws(() => queue.request('bad', [value]));
  queue.request('wrap', [sample(1.01), sample(.01)]); assert.deepEqual(queue.beginBatch().points, [[1.01, .5], [.01, .5]]); queue.dispose();
});

test('unique-coordinate cap rejects atomically while deduplicated offsets do not consume extra coordinates', () => {
  const { queue } = setup(); const existing = queue.request('existing', [sample(.5)]);
  assert.throws(() => queue.request('too-many', Array.from({ length: 65537 }, (_, i) => sample(i / 65537))));
  assert.deepEqual(queue.beginBatch().points, [[.5, .5]]); assert.deepEqual(existing.resolve(), { status: 'terrain-pending' }); queue.dispose();
});

test('storage constructor failures release their admission reservation', () => {
  const released = []; let reserved = 0;
  const queue = createTerrainPointQueue({ reserve(request) { const bytes = planSceneAllocations(request, { bytes: Number.MAX_SAFE_INTEGER }).knownBytes; reserved += bytes; return { release() { released.push(bytes); } }; },
    allocateFloat64() { throw new Error('allocation failed'); }, allocateFloat32() { throw new Error('allocation failed'); } });
  queue.setStamp({}); assert.throws(() => queue.request('a', [sample(.1)])); queue.dispose();
  assert.ok(reserved > 0); assert.equal(released.reduce((sum, value) => sum + value, 0), reserved);
});

test('a reservation callback can synchronously retire the queue before returning its owned lease', () => {
  let queue, constructorCalls = 0, releases = 0;
  queue = createTerrainPointQueue({ reserve(resources) {
    planSceneAllocations(resources, { bytes: Number.MAX_SAFE_INTEGER });
    queue.dispose();
    return { release() { releases++; } };
  }, allocateFloat64(length) { constructorCalls++; return new Float64Array(length); },
  allocateFloat32(length) { constructorCalls++; return new Float32Array(length); } });
  queue.setStamp({});
  try { queue.request('owner', [sample(.1)]); } catch (error) { assert.ok(error instanceof Error); }
  assert.equal(constructorCalls, 0); assert.equal(releases, 1); queue.dispose(); assert.equal(releases, 1);
});

test('a reservation callback changing the stamp cannot allocate or publish the retired admission', () => {
  let queue, reset = false, constructorCalls = 0, releases = 0;
  queue = createTerrainPointQueue({ reserve() {
    if (!reset) { reset = true; queue.setStamp({}); }
    return { release() { releases++; } };
  }, allocateFloat64(length) { constructorCalls++; return new Float64Array(length); },
  allocateFloat32(length) { constructorCalls++; return new Float32Array(length); } });
  queue.setStamp({});
  try { queue.request('owner', [sample(.1)]); } catch (error) { assert.ok(error instanceof Error); }
  assert.equal(constructorCalls, 0); assert.equal(releases, 1); queue.dispose();
});

test('injected typed storage requires the declared fixed constructor type and exact length', () => {
  for (const wrong of [() => [], () => new Float32Array(0), length => new Float64Array(length + 1)]) {
    const { queue, reservations } = setup({ allocateFloat64: wrong, allocateFloat32: wrong });
    assert.throws(() => queue.request('owner', [sample(.1)])); queue.dispose();
    assert.ok(reservations.every(value => value.released));
  }
});

test('cross-owner reserve reentry cannot bypass the aggregate coordinate ceiling', () => {
  let queue, nested = false, releases = 0, reservations = 0;
  queue = createTerrainPointQueue({ reserve(resources) {
    planSceneAllocations(resources, { bytes: Number.MAX_SAFE_INTEGER }); reservations++;
    if (!nested) {
      nested = true;
      queue.request('full', Array.from({ length: 65536 }, (_, i) => sample(i / 65536)));
    }
    return { release() { releases++; } };
  } });
  queue.setStamp({});
  assert.throws(() => queue.request('outer', [sample(2)]));
  assert.deepEqual(queue.beginBatch().points, Array.from({ length: 8 }, (_, i) => [i / 65536, .5]));
  queue.dispose(); assert.equal(releases, reservations);
});

test('request admission rejects accessors and never invokes caller array methods', () => {
  const { queue } = setup(); let accesses = 0;
  const getterSample = { offsetMeters: 0 }; Object.defineProperty(getterSample, 'coordinate', { get() { accesses++; return [.1, .5]; } });
  assert.throws(() => queue.request('getter', [getterSample])); assert.equal(accesses, 0);
  const values = [sample(.1)]; values.map = () => { accesses++; return []; };
  try { queue.request('methods', values); } catch (error) { assert.ok(error instanceof Error); }
  assert.equal(accesses, 0); queue.dispose();
});

test('a completion accessor cannot replace the active stamp and publish an old token', () => {
  const { queue } = setup(); const owner = queue.request('owner', [sample(.1)]), old = queue.beginBatch(); let accesses = 0;
  const value = { rgba: rgba([123]) };
  Object.defineProperty(value, 'count', { get() { accesses++; queue.setStamp({}); queue.beginBatch(); return 1; } });
  assert.throws(() => queue.complete(old.token, value)); assert.equal(accesses, 0);
  assert.deepEqual(owner.resolve(), { status: 'terrain-pending' }); queue.dispose();
});

test('owned typed storage rejects oversized, shared, resizable and reused backing without calling custom set', () => {
  const factories = [length => new Float64Array(new ArrayBuffer(length * 8 + 8), 0, length)];
  if (typeof SharedArrayBuffer === 'function') factories.push(length => new Float64Array(new SharedArrayBuffer(length * 8)));
  if (typeof ArrayBuffer.prototype.resize === 'function') factories.push(length => new Float64Array(new ArrayBuffer(length * 8, { maxByteLength: length * 16 })));
  for (const allocateFloat64 of factories) {
    const { queue, reservations } = setup({ allocateFloat64 }); assert.throws(() => queue.request('owner', [sample(.1)])); queue.dispose();
    assert.ok(reservations.every(value => value.released));
  }
  let customSetCalls = 0;
  const { queue } = setup({ allocateFloat64(length) { const storage = new Float64Array(length); storage.set = () => { customSetCalls++; }; return storage; } });
  try { queue.request('owner', [sample(.1)]); } catch (error) { assert.ok(error instanceof Error); }
  assert.equal(customSetCalls, 0); queue.dispose();
  const backing = new Float64Array(3), shared = setup({ allocateFloat64: () => backing });
  shared.queue.request('a', [sample(.1)]); assert.throws(() => shared.queue.request('b', [sample(.2)])); shared.queue.dispose();
});

test('a retired owner throwing release cannot free a replacement that already committed', () => {
  const records = []; let throwOld = false;
  const queue = createTerrainPointQueue({ reserve() {
    const record = { releases: 0 }; records.push(record);
    return { release() { record.releases++; if (throwOld && record === records[0]) throw new Error('release failed'); } };
  } });
  queue.setStamp({}); queue.request('owner', [sample(.1)]); throwOld = true;
  assert.throws(() => queue.request('owner', [sample(.2)]));
  assert.deepEqual(queue.beginBatch().points, [[.2, .5]]);
  assert.ok(records.slice(2).every(record => record.releases === 0), 'new committed reservations remain owned');
  assert.ok(records.slice(0, 2).every(record => record.releases === 1), 'all old cleanup attempted');
  queue.dispose(); assert.ok(records.every(record => record.releases === 1));
});

test('dispose attempts every owned lease once after a release callback throws', () => {
  const records = [];
  const queue = createTerrainPointQueue({ reserve() {
    const record = { releases: 0 }; records.push(record);
    return { release() { record.releases++; if (record === records[0]) throw new Error('release failed'); } };
  } });
  queue.setStamp({}); queue.request('a', [sample(.1)]); queue.request('b', [sample(.2)]);
  assert.throws(() => queue.dispose()); assert.ok(records.every(record => record.releases === 1));
  assert.doesNotThrow(() => queue.dispose()); assert.ok(records.every(record => record.releases === 1));
});
