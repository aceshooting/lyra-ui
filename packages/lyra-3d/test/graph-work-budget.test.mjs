import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGraphOctree, graphChargeForces } from './graph-synchronous-fixture.mjs';
import { buildGraphOctreeProgress, graphChargeForcesProgress } from '../dist/graph/octree.js';
import { createGraphIncrementalTaskKernel } from '../dist/graph/layout-task.js';
import { createGraphLayoutKernel } from './graph-synchronous-fixture.mjs';

function consume(factory, quantum) {
  const budget = { remaining: 0 }, work = factory(budget);
  let calls = 0, operations = 0;
  for (;;) {
    budget.remaining = quantum;
    const result = work.next(); calls++;
    const used = quantum - budget.remaining;
    assert.ok(used >= 0 && used <= quantum, 'one resume cannot exceed its primitive quota');
    operations += used;
    if (result.done) return { value: result.value, calls, operations };
    assert.equal(budget.remaining, 0, 'suspension consumes the quota rather than yielding per primitive');
  }
}

const positions = Float32Array.from({ length: 96 * 3 }, (_, index) => ((index * 17) % 101) - 50);

test('tree and force traversal batch resumes without changing primitive accounting or numeric output', () => {
  const tree = buildGraphOctree(positions), force = graphChargeForces(tree, 80, 0, 1);
  for (const factory of [budget => buildGraphOctreeProgress(positions, budget),
    budget => graphChargeForcesProgress(tree, 80, 0, 1, budget)]) {
    const scalar = consume(factory, 1);
    assert.ok(scalar.operations > 256);
    for (const quantum of [7, 256]) {
      const batched = consume(factory, quantum);
      assert.equal(batched.operations, scalar.operations, 'every original primitive is still charged');
      assert.equal(batched.calls, Math.floor(scalar.operations / quantum) + 1);
      assert.deepEqual(batched.value, scalar.value);
    }
  }
  const actual = consume(budget => graphChargeForcesProgress(tree, 80, 0, 1, budget), 7);
  assert.deepEqual(actual.value, force);
});

test('a quota can expire inside one target and resumes remain independently owned', () => {
  const tree = buildGraphOctree(new Float32Array([0, 0, 0, 10, 0, 0]));
  const budget = { remaining: 1 }, work = graphChargeForcesProgress(tree, 80, 0, 1, budget);
  const first = work.next();
  assert.equal(first.done, false); assert.equal(first.value, undefined); assert.equal(budget.remaining, 0);
  // The first target has two body visits, then one cell and one result write. One unit
  // cannot complete it; another solver must not replenish this suspended solver's quota.
  consume(other => graphChargeForcesProgress(tree, 80, 0, 1, other), 256);
  assert.equal(budget.remaining, 0);
  budget.remaining = 1; assert.equal(work.next().done, false); assert.equal(budget.remaining, 0);
  let result;
  do { budget.remaining = 1; result = work.next(); } while (!result.done);
  assert.deepEqual(result.value, graphChargeForces(tree, 80, 0, 1));
});

test('pinning inside a force target restarts from the last committed iteration', () => {
  const count = positions.length / 3;
  const data = { nodeCount: count, positions, pinned: new Uint8Array(count),
    source: Uint32Array.from({ length: count }, (_, index) => index),
    target: Uint32Array.from({ length: count }, (_, index) => (index + 1) % count),
    options: { theta: 0, maxSteps: 3, stableSteps: 1000, cooling: 1, minAlpha: 0 } };
  const incremental = createGraphIncrementalTaskKernel({ type: 'start', data }, { operationsPerStep: 1 });
  const reference = createGraphLayoutKernel(data);
  for (let attempts = 0; incremental.progress.phase !== 'charge' && attempts < 100_000; attempts++) {
    assert.equal(incremental.step().output, undefined);
  }
  assert.equal(incremental.progress.phase, 'charge');
  assert.equal(incremental.progress.committedIteration, 0);
  assert.equal(incremental.step().output, undefined);
  assert.equal(incremental.progress.phase, 'charge');
  const update = { indices: new Uint32Array([0]), positions: new Float32Array([7, 8, 9]), pinned: new Uint8Array([1]) };
  incremental.update({ type: 'pins', update }); reference.update(update);
  let result;
  for (let attempts = 0; attempts < 1_000_000; attempts++) {
    const before = incremental.progress.operations;
    result = incremental.step();
    assert.ok(incremental.progress.operations - before <= 1);
    if (result.output) break;
  }
  assert.ok(result?.output);
  const { epoch, ...output } = result.output;
  assert.equal(epoch, 1); assert.deepEqual(output, reference.step().output);
});

test('pins queued before and during initialization retain order, snapshots and bounded work', () => {
  for (const quantum of [1, 7, 256]) {
    const count = 32;
    const data = { nodeCount: count, positions: positions.slice(0, count * 3), pinned: new Uint8Array(count),
      source: Uint32Array.from({ length: count }, (_, index) => index),
      target: Uint32Array.from({ length: count }, (_, index) => (index + 1) % count),
      options: { theta: 0, maxSteps: 2, stableSteps: 1000, cooling: 1, minAlpha: 0 } };
    const kernel = createGraphIncrementalTaskKernel({ type: 'start', data }, { operationsPerStep: quantum });
    const reference = createGraphLayoutKernel(data);
    const queue = update => {
      kernel.update({ type: 'pins', update }); reference.update(update);
      update.indices.fill(count - 1); update.positions.fill(999); update.pinned.fill(0);
    };
    queue({ indices: new Uint32Array([0, 1]), positions: new Float32Array([1, 2, 3, 4, 5, 6]), pinned: new Uint8Array([1, 1]) });
    assert.deepEqual(kernel.step(), { done: false });
    assert.equal(kernel.progress.operations, quantum);
    assert.equal(kernel.progress.phase, 'initialize');
    assert.equal(kernel.progress.committedIteration, 0);
    queue({ indices: new Uint32Array([0]), positions: new Float32Array([7, 8, 9]), pinned: new Uint8Array([1]) });
    let previousOutput, previousSnapshot;
    for (let iteration = 1; iteration <= 2; iteration++) {
      let result;
      for (let calls = 0; calls < 100_000; calls++) {
        const before = kernel.progress.operations;
        result = kernel.step();
        const used = kernel.progress.operations - before;
        assert.ok(used >= 0 && used <= quantum, 'queued pins share the same primitive quota');
        if (result.output) break;
        assert.equal(result.done, false, 'partial initialization or iteration cannot publish completion');
      }
      assert.ok(result?.output, 'queued pins must not prevent completion');
      const expected = reference.step();
      const { epoch, ...output } = result.output;
      assert.equal(epoch, 2); assert.equal(output.iteration, iteration);
      assert.equal(result.done, expected.done); assert.deepEqual(output, expected.output);
      assert.deepEqual([...output.positions.slice(0, 6)], [7, 8, 9, 4, 5, 6], 'the later queued pin wins and both snapshots are owned');
      if (previousOutput) assert.deepEqual(previousOutput.positions, previousSnapshot, 'later work cannot mutate an earlier output');
      previousOutput = output; previousSnapshot = output.positions.slice();
    }
  }
});
