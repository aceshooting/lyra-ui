import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { createGraphDataPreparationWork } from '../dist/graph/data-preparation.js';
import { createGraphEngine } from '../dist/graph/engine.js';
import { triangleMesh } from './graph-node-mesh-fixtures.mjs';

function drain(input, budget) {
  const work = createGraphDataPreparationWork(input); let operations = 0, bytes = 0, textUnits = 0, keys = 0, dashValues = 0;
  for (let calls = 0; calls < 100000; calls++) {
    const step = work.step(budget);
    assert.ok(Number.isSafeInteger(step.operations) && step.operations >= 0 && step.operations <= budget);
    operations += step.operations; bytes += step.allocatedBytes;
    textUnits += step.copiedTextUnits; keys += step.reflectedKeys; dashValues += step.copiedDashValues;
    if (step.done) return { value: step.value, operations, bytes, textUnits, keys, dashValues };
    assert.ok(step.operations > 0);
  }
  assert.fail('generated data preparation did not finish');
}
function legacyPositions(input) {
  const engine = createGraphEngine();
  try {
    engine.setData(input, 1);
    return Float32Array.from(Array.from({ length: input.nodeCount }, (_, row) => {
      const point = engine.positionOf(row); return [point.x, point.y, point.z];
    }).flat());
  } finally { engine.dispose(); }
}

test('owned pre-scene data and start snapshots match independent legacy initialization across chunks', () => {
  fc.assert(fc.property(fc.record({ nodes: fc.integer({ min: 1, max: 8 }), edges: fc.integer({ min: 0, max: 10 }),
    seed: fc.integer({ min: 0, max: 0xffffffff }), explicit: fc.boolean(), pins: fc.boolean(), spatial: fc.boolean(), custom: fc.boolean(), dashCount: fc.integer({ min: 0, max: 3 }),
    coordinate: fc.integer({ min: -1000, max: 1000 }), size: fc.integer({ min: 0, max: 1024 }) }),
  ({ nodes, edges, seed, explicit, pins, spatial, custom, dashCount, coordinate, size }) => {
    const input = { nodeCount: nodes, source: Uint32Array.from({ length: edges }, (_, row) => row % nodes),
      target: Uint32Array.from({ length: edges }, (_, row) => (row + 1) % nodes), options: { seed },
      labels: Array.from({ length: nodes }, (_, row) => `node ${row}`), sizes: new Float32Array(nodes).fill(size),
      ...(explicit ? { positions: Float32Array.from({ length: nodes * 3 }, (_, row) => coordinate + row / 8) } : {}),
      ...(pins ? { pinned: Uint8Array.from({ length: nodes }, (_, row) => row % 2) } : {}),
      ...(spatial ? { spatialAppearance: { edgeCurvatures: new Float32Array(edges).fill(.5), dangling: new Uint8Array(edges),
        edgeDashes: Array.from({ length: edges }, () => Array.from({ length: dashCount }, (_, index) => index + 1)),
        ...(custom ? { nodeMeshes: Array.from({ length: nodes }, (_, row) => row === 0 ? triangleMesh() : null) } : {}) } } : {}) };
    const before = structuredClone(input), expectedPositions = legacyPositions(input);
    const expectedPins = input.pinned ?? new Uint8Array(nodes).fill(explicit ? 1 : 0);
    let expectedOperations;
    for (const budget of [1, 7, 4096]) {
      const result = drain(input, budget), { data, start } = result.value;
      assert.deepEqual(data.positions, expectedPositions); assert.deepEqual(data.pinned, expectedPins); assert.deepEqual(input, before);
      assert.deepEqual(start.data.positions, expectedPositions); assert.deepEqual(start.data.pinned, expectedPins);
      assert.notEqual(data.positions.buffer, start.data.positions.buffer); assert.notEqual(data.pinned.buffer, start.data.pinned.buffer);
      assert.notEqual(data.source.buffer, input.source.buffer); assert.notEqual(data.target.buffer, input.target.buffer);
      assert.notEqual(data.options, input.options); assert.equal(start.data.source, data.source); assert.equal(start.data.target, data.target);
      if (explicit) assert.notEqual(data.positions.buffer, input.positions.buffer);
      if (pins) assert.notEqual(data.pinned.buffer, input.pinned.buffer);
      assert.equal(result.bytes, edges * 8 + nodes * 30 + (spatial ? edges * 5 + (custom ? 48 : 0) : 0));
      assert.equal(result.textUnits, nodes * 6); assert.equal(result.keys, spatial && custom ? nodes + 3 : 0);
      assert.equal(result.dashValues, spatial ? edges * dashCount : 0);
      if (expectedOperations === undefined) expectedOperations = result.operations; else assert.equal(result.operations, expectedOperations);
    }
  }), { seed: 20261028, numRuns: 200 });
});


test('generated invalid spatial cross-rules fail after owned admission at every budget', () => {
  fc.assert(fc.property(fc.record({ nodes: fc.integer({ min: 2, max: 8 }), world: fc.boolean(), excess: fc.integer({ min: 1, max: 100 }) }),
  ({ nodes, world, excess }) => {
    const base = { nodeCount: nodes, source: new Uint32Array([0]), target: new Uint32Array([1]), positions: new Float32Array(nodes * 3) };
    const invalidSize = { ...base, sizes: new Float32Array(nodes).fill((world ? 20000000 : 1024) + excess * 2), spatialAppearance: { sizeUnits: world ? 'world' : 'css' } };
    const invalidDangling = { ...base, spatialAppearance: { dangling: new Uint8Array([1]) } };
    for (const budget of [1, 7, 4096]) {
      assert.throws(() => drain(invalidSize, budget), { name: 'RangeError', message: 'Graph spatial diameters exceed the supported range' });
      assert.throws(() => drain(invalidDangling, budget), { name: 'RangeError', message: 'Dangling layout endpoints must share the source row' });
    }
  }), { seed: 20261028, numRuns: 200 });
});
