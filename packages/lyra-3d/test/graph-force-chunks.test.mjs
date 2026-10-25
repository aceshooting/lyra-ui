import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGraphOctree, graphChargeForces, graphChargeForcesProgress } from '../dist/graph/octree.js';

function complete(tree, theta, softening, quanta) {
  const budget = { remaining: 0 }, work = graphChargeForcesProgress(tree, 7, theta, softening, budget);
  let operations = 0;
  for (let call = 0; call < 1_000_000; call++) {
    const quantum = quanta[call % quanta.length];
    budget.remaining = quantum;
    const result = work.next(), used = quantum - budget.remaining;
    assert.ok(used >= 0 && used <= quantum); operations += used;
    if (result.done) return { forces: result.value, operations };
    assert.equal(result.value, undefined); assert.equal(budget.remaining, 0);
  }
  assert.fail('force traversal did not complete');
}

for (const [name, positions] of [
  ['mixed cells', Float32Array.from({ length: 48 * 3 }, (_, index) => (index % 5 - 2) * 10 ** (index % 4))],
  ['coincident terminal', new Float32Array(24 * 3)],
  ['deep cluster', Float32Array.from({ length: 24 * 3 }, (_, index) => 2 ** -(index % 24))],
]) test(`chunk-local accumulation preserves force bytes and operation totals: ${name}`, () => {
  const tree = buildGraphOctree(positions);
  for (const theta of [0, 0.7, 2]) for (const softening of [1e-6, 1, 1e151]) {
    const reference = graphChargeForces(tree, 7, theta, softening);
    const scalar = complete(tree, theta, softening, [1]);
    assert.deepEqual(scalar.forces, reference);
    for (const quanta of [[2], [7], [256], [1, 2, 7, 256, 3]]) {
      const actual = complete(tree, theta, softening, quanta);
      assert.equal(actual.operations, scalar.operations);
      assert.deepEqual(actual.forces, reference);
      assert.notEqual(actual.forces.buffer, scalar.forces.buffer);
    }
  }
});
