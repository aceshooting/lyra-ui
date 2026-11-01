import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { createGraphDataColumnWork } from '../dist/graph/data-columns-work.js';

function drain(input, budget) {
  const work = createGraphDataColumnWork(input);
  for (let calls = 0; calls < 100000; calls++) {
    const step = work.step(budget);
    assert.ok(step.operations >= 0 && step.operations <= budget);
    if (step.done) return step.value;
    assert.ok(step.operations > 0);
  }
  assert.fail('bounded fixture did not terminate');
}

test('owned column results and endpoint rejection do not depend on step budget', () => {
  const cases = fc.record({
    count: fc.integer({ min: 1, max: 24 }),
    endpoints: fc.array(fc.tuple(fc.nat(1000), fc.nat(1000)), { maxLength: 48 }),
    coordinate: fc.integer({ min: -10000000, max: 10000000 }),
    seed: fc.integer({ min: 0, max: 0xffffffff }),
  });
  fc.assert(fc.property(cases, ({ count, endpoints, coordinate, seed }) => {
    const input = { nodeCount: count, source: Uint32Array.from(endpoints, pair => pair[0] % count),
      target: Uint32Array.from(endpoints, pair => pair[1] % count),
      positions: new Float32Array(count * 3).fill(coordinate), pinned: new Uint8Array(count),
      sizes: new Float32Array(count).fill(3), categories: new Uint16Array(count), options: { seed } };
    const before = structuredClone(input);
    for (const budget of [1, 7, 4096]) {
      const result = drain(input, budget);
      assert.deepEqual(result, before);
      assert.notEqual(result.source.buffer, input.source.buffer);
      assert.notEqual(result.positions.buffer, input.positions.buffer);
      assert.deepEqual(input, before);
      assert.throws(() => drain({ ...input, source: new Uint32Array([count]), target: new Uint32Array([0]) }, budget), RangeError);
    }
  }), { seed: 20261028, numRuns: 200 });
});
