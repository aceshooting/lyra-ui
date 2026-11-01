import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { createTerrainPointQueue } from '../src/scene/terrain-points.mjs';

const runs = { seed: 0x5eed_1e57, numRuns: 200, includeErrorInReport: true };
const reserve = () => ({ release() {} });
test('exact coordinate deduplication and offset addition preserve generated owner inputs', () => {
  fc.assert(fc.property(fc.array(fc.record({ x: fc.integer({ min: 0, max: 30 }), offset: fc.integer({ min: -100, max: 100 }) }), { minLength: 1, maxLength: 40 }), values => {
    const queue = createTerrainPointQueue({ reserve }); queue.setStamp({});
    const owner = queue.request('owner', values.map(value => ({ coordinate: [value.x / 100, .5], offsetMeters: value.offset })));
    const expectedOrder = [...new Set(values.map(value => value.x / 100))], actualOrder = [];
    for (let batch; (batch = queue.beginBatch());) {
      assert.ok(batch.points.length <= 8); actualOrder.push(...batch.points.map(point => point[0]));
      queue.complete(batch.token, { count: batch.points.length, rgba: Float32Array.from(batch.points.flatMap(point => [Math.round(point[0] * 100), 0, 0, 1])) });
    }
    assert.deepEqual(actualOrder, expectedOrder);
    assert.deepEqual(owner.resolve(), { status: 'resolved', altitudes: values.map(value => value.x + value.offset) });
    assert.equal(queue.beginBatch(), null); queue.dispose();
  }), runs);
});

test('partial completions neither reorder FIFO coordinates nor publish partial object geometry', () => {
  fc.assert(fc.property(fc.integer({ min: 2, max: 40 }), fc.integer({ min: 1, max: 8 }), (count, prefix) => {
    const queue = createTerrainPointQueue({ reserve }); queue.setStamp({});
    const owner = queue.request('route', Array.from({ length: count }, (_, i) => ({ coordinate: [i / 100, .5], offsetMeters: 0 })));
    let completed = 0;
    for (let batch; (batch = queue.beginBatch());) {
      const taken = Math.min(prefix, batch.points.length);
      assert.deepEqual(batch.points.slice(0, taken).map(point => Math.round(point[0] * 100)), Array.from({ length: taken }, (_, i) => completed + i));
      queue.complete(batch.token, { count: taken, rgba: new Float32Array(Array.from({ length: taken }, () => [0, 0, 0, 1]).flat()) }); completed += taken;
      assert.equal(owner.resolve().status, completed === count ? 'resolved' : 'terrain-pending');
    }
    assert.equal(completed, count); queue.dispose();
  }), runs);
});
