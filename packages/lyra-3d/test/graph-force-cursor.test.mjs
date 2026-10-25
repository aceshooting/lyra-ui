import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGraphOctree, graphChargeForces } from './graph-synchronous-fixture.mjs';
import { graphChargeForcesProgress } from '../dist/graph/octree.js';

function finish(tree, strength, quotas, expectedOperations) {
  const budget = { remaining: 0 }, work = graphChargeForcesProgress(tree, strength, 0, 1, budget);
  let operations = 0, result;
  for (let call = 0; call < 1000; call++) {
    const quota = quotas[call % quotas.length];
    budget.remaining = quota;
    result = work.next();
    const used = quota - budget.remaining;
    assert.ok(used >= 0 && used <= quota);
    operations += used;
    if (result.done) break;
    assert.equal(result.value, undefined, 'partial targets never expose the force buffer');
    assert.equal(budget.remaining, 0);
  }
  assert.equal(result.done, true);
  assert.equal(operations, expectedOperations);
  assert.deepEqual(result.value, graphChargeForces(tree, strength, 0, 1));
  return result.value;
}

test('force cursor preserves separate body, cell and target-write quota boundaries', () => {
  const tree = buildGraphOctree(new Float32Array([0, 0, 0, 10, 0, 0]));
  // Each target visits two leaf bodies (including itself), completes one cell and writes once.
  for (const quotas of [[1], [2], [3], [4], [7], [8], [256], [1, 3, 2, 7]]) finish(tree, 80, quotas, 8);
  const budget = { remaining: 8 }, work = graphChargeForcesProgress(tree, 80, 0, 1, budget);
  const exhausted = work.next();
  assert.equal(exhausted.done, false); assert.equal(budget.remaining, 0);
  budget.remaining = 7;
  const complete = work.next();
  assert.equal(complete.done, true); assert.equal(budget.remaining, 7, 'zero-work completion cannot consume a new primitive');
  assert.deepEqual(complete.value, graphChargeForces(tree, 80, 0, 1));
});

test('large coincident terminal buckets charge one cell and one target write each', () => {
  const tree = buildGraphOctree(new Float32Array(9 * 3));
  for (const quotas of [[1], [2], [7], [18], [256], [1, 7, 2]]) finish(tree, 80, quotas, 18);
});

test('an inconsistent internal terminal count cannot invent force after excluding the target', () => {
  const built = buildGraphOctree(new Float32Array(9 * 3));
  // The builder always matches count to bodies.length. These deliberately inconsistent
  // internal snapshots exercise the defensive force boundary, not accepted coordinate input.
  for (const count of [0, 1]) {
    const tree = { ...built, root: { ...built.root, count } };
    const synchronous = graphChargeForces(tree, 80, 0, 1);
    assert.ok(synchronous.every(Number.isFinite));
    assert.deepEqual(synchronous, new Float64Array(9 * 3), 'nonpositive remaining mass contributes no force');
    for (const quotas of [[1], [2], [7], [256], [1, 7, 2]]) {
      // Even a skipped mass charges one cell visit and one target write per node.
      const resumed = finish(tree, 80, quotas, 18);
      assert.ok(resumed.every(Number.isFinite));
      assert.deepEqual(resumed, new Float64Array(9 * 3));
    }
  }
});

test('empty and zero-strength traversals complete without consuming quota', () => {
  finish(buildGraphOctree(new Float32Array()), 80, [1], 0);
  finish(buildGraphOctree(new Float32Array([0, 0, 0, 10, 0, 0])), 0, [7], 0);
});

test('implicit scalar quota and independent suspended leaves retain their previous results', () => {
  const tree = buildGraphOctree(new Float32Array([0, 0, 0, 10, 0, 0]));
  const first = graphChargeForcesProgress(tree, 80, 0, 1);
  const budget = { remaining: 2 }, second = graphChargeForcesProgress(tree, 7, 0, 1, budget);
  assert.equal(first.next().done, false);
  assert.equal(second.next().done, false); assert.equal(budget.remaining, 0);
  let scalar;
  for (let call = 0; call < 8; call++) scalar = first.next();
  assert.equal(scalar.done, true);
  const saved = scalar.value.slice();
  let other;
  do { budget.remaining = 3; other = second.next(); } while (!other.done);
  assert.deepEqual(other.value, graphChargeForces(tree, 7, 0, 1));
  assert.deepEqual(scalar.value, saved);
  assert.notEqual(scalar.value.buffer, other.value.buffer);
});
