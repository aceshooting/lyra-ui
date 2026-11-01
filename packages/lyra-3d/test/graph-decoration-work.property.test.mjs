import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { createGraphDecorationWork } from '../dist/graph/data-appearance-work.js';

function drain(input, budget) {
  const work = createGraphDecorationWork(input, input.labels.length, input.edgeLabels.length);
  let bytes = 0, units = 0;
  for (let calls = 0; calls < 100000; calls++) {
    const step = work.step(budget);
    assert.ok(Number.isSafeInteger(step.operations) && step.operations >= 0 && step.operations <= budget);
    bytes += step.allocatedBytes; units += step.copiedTextUnits;
    if (step.done) return { value: step.value, bytes, units };
    assert.ok(step.operations > 0);
  }
  assert.fail('generated decoration work did not finish');
}
const text = fc.tuple(fc.string({ maxLength: 380 }), fc.integer({ min: 0, max: 150 })).map(([value, moons]) => value + '🌙'.repeat(moons));

test('decoration ownership and UTF-16 truncation are independent of operation chunking', () => {
  fc.assert(fc.property(fc.record({ labels: fc.array(text, { maxLength: 12 }), edgeLabels: fc.array(text, { maxLength: 12 }),
    bit: fc.integer({ min: 0, max: 1 }), mode: fc.constantFrom('always', 'zoom', 'none'), visible: fc.boolean(),
    zoom: fc.integer({ min: 1, max: 1000000 }), particles: fc.integer({ min: 0, max: 8 }), speed: fc.integer({ min: 0, max: 100 }) }),
  ({ labels, edgeLabels, bit, mode, visible, zoom, particles, speed }) => {
    const input = { labels, edgeLabels, directed: Uint8Array.from(edgeLabels, (_, row) => (row + bit) % 2), nodeLabels: mode,
      withEdgeLabels: visible, edgeLabelMinZoom: zoom / 1000, particlesPerEdge: particles, particleSpeed: speed / 10 };
    const before = structuredClone(input), expected = { ...before, labels: labels.map(value => value.slice(0, 256)), edgeLabels: edgeLabels.map(value => value.slice(0, 256)) };
    const units = [...expected.labels, ...expected.edgeLabels].reduce((sum, value) => sum + value.length, 0);
    for (const budget of [1, 7, 4096]) {
      const result = drain(input, budget);
      assert.deepEqual(result.value, expected); assert.deepEqual(input, before);
      assert.equal(result.bytes, edgeLabels.length); assert.equal(result.units, units);
      assert.notEqual(result.value.labels, input.labels); assert.notEqual(result.value.edgeLabels, input.edgeLabels);
      assert.notEqual(result.value.directed.buffer, input.directed.buffer);
    }
  }), { seed: 20261028, numRuns: 200 });
});
