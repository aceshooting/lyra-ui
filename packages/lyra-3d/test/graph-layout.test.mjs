import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGraphOctree, graphChargeForces } from './graph-synchronous-fixture.mjs';
import { createGraphLayoutKernel } from './graph-synchronous-fixture.mjs';

const edges = () => ({ source: new Uint32Array(), target: new Uint32Array() });

test('exact octree traversal matches independently summed softened inverse-square forces', () => {
  const positions = new Float32Array(Array.from({ length: 60 }, (_, i) => Math.sin(i * 1.7) * 20));
  const actual = graphChargeForces(buildGraphOctree(positions), 7, 0, 0.5);
  const expected = new Float64Array(positions.length);
  for (let a = 0; a < 20; a += 1) for (let b = 0; b < 20; b += 1) {
    if (a === b) continue;
    const delta = [0, 1, 2].map((axis) => positions[a * 3 + axis] - positions[b * 3 + axis]);
    const denominator = (delta.reduce((sum, value) => sum + value * value, 0) + 0.25) ** 1.5;
    for (let axis = 0; axis < 3; axis += 1) expected[a * 3 + axis] += 7 * delta[axis] / denominator;
  }
  for (let i = 0; i < actual.length; i += 1) assert.ok(Math.abs(actual[i] - expected[i]) < 1e-10);
});

test('approximation remains close to exact forces without including self mass', () => {
  const positions = new Float32Array(Array.from({ length: 900 }, (_, i) => Math.sin(i * 2.17) * 100));
  const tree = buildGraphOctree(positions);
  const exact = graphChargeForces(tree, 1, 0, 1);
  const approximate = graphChargeForces(tree, 1, 0.4, 1);
  let error = 0;
  let magnitude = 0;
  for (let i = 0; i < exact.length; i += 1) {
    error += (approximate[i] - exact[i]) ** 2;
    magnitude += exact[i] ** 2;
  }
  assert.ok(Math.sqrt(error / magnitude) < 0.1);
  assert.deepEqual([...graphChargeForces(buildGraphOctree(new Float32Array([4, 5, 6])), 1, 100, 1)], [0, 0, 0]);
});

test('seeded layout is repeatable and emitted buffers never alias live state or earlier frames', () => {
  const input = { nodeCount: 12, ...edges(), options: { seed: 71, maxSteps: 5 } };
  const a = createGraphLayoutKernel(input);
  const b = createGraphLayoutKernel(input);
  const first = a.step().output;
  const saved = first.positions.slice();
  assert.deepEqual(first, b.step().output);
  for (let i = 0; i < 4; i += 1) assert.deepEqual(a.step(), b.step());
  assert.deepEqual(first.positions, saved);
  first.positions.fill(999);
  assert.deepEqual(a.step(), b.step());
  const transferable = a.step().output;
  const received = structuredClone(transferable, { transfer: [transferable.positions.buffer] });
  assert.equal(transferable.positions.byteLength, 0);
  assert.deepEqual(received, b.step().output);
  assert.deepEqual(a.step(), b.step(), 'transferring an output never detaches live positions');
  const other = createGraphLayoutKernel({ ...input, options: { seed: 72 } });
  assert.notDeepEqual(other.step().output.positions, saved);
});

test('explicit positions stay pinned and pin updates are atomic, copied and restart convergence', () => {
  const positions = new Float32Array([1, 2, 3, 20, 0, 0]);
  const kernel = createGraphLayoutKernel({ nodeCount: 2, positions, ...edges() });
  positions.fill(500);
  assert.deepEqual([...kernel.step().output.positions], [1, 2, 3, 20, 0, 0]);
  assert.equal(kernel.step().done, true);
  const update = { indices: new Uint32Array([0]), positions: new Float32Array([7, 8, 9]), pinned: new Uint8Array([1]) };
  kernel.update(update);
  update.positions.fill(100);
  assert.deepEqual([...kernel.step().output.positions], [7, 8, 9, 20, 0, 0]);
  assert.throws(() => kernel.update({ indices: new Uint32Array([0, 0]), positions: new Float32Array(6), pinned: new Uint8Array([0, 0]) }), /index/u);
  assert.deepEqual([...kernel.step().output.positions], [7, 8, 9, 20, 0, 0]);
  assert.throws(() => kernel.update({ indices: new Uint32Array([0, 9]), positions: new Float32Array(6), pinned: new Uint8Array([0, 0]) }), /index/u);
  assert.deepEqual([...kernel.step().output.positions], [7, 8, 9, 20, 0, 0]);
  kernel.update({ indices: new Uint32Array([0]), positions: new Float32Array([7, 8, 9]), pinned: new Uint8Array([0]) });
  const moved = kernel.step();
  assert.equal(moved.done, false);
  assert.notDeepEqual([...moved.output.positions.slice(0, 3)], [7, 8, 9]);
  assert.deepEqual([...moved.output.positions.slice(3)], [20, 0, 0]);
});

test('link springs pull a free endpoint toward its rest distance from a pin', () => {
  const kernel = createGraphLayoutKernel({ nodeCount: 2, positions: new Float32Array([0, 0, 0, 100, 0, 0]), pinned: new Uint8Array([1, 0]), source: new Uint32Array([0]), target: new Uint32Array([1]), options: { charge: 0, centerStrength: 0, linkDistance: 10 } });
  const frame = kernel.step().output.positions;
  assert.equal(frame[0], 0);
  assert.ok(frame[3] < 100 && frame[3] > 10);
});

test('coincident linked nodes separate deterministically without charge and preserve their midpoint', () => {
  const input = { nodeCount: 2, positions: new Float32Array(6), pinned: new Uint8Array(2), source: new Uint32Array([0]), target: new Uint32Array([1]), options: { charge: 0, centerStrength: 0, linkDistance: 10 } };
  const first = createGraphLayoutKernel(input).step();
  const reversed = createGraphLayoutKernel({ ...input, source: input.target, target: input.source }).step();
  assert.equal(first.done, false);
  assert.deepEqual(first, reversed, 'edge orientation does not choose a different separation');
  const point = first.output.positions;
  assert.ok(Math.hypot(point[0] - point[3], point[1] - point[4], point[2] - point[5]) > 0);
  for (let axis = 0; axis < 3; axis += 1) assert.equal(point[axis] + point[axis + 3], 0);
  assert.deepEqual(first, createGraphLayoutKernel(input).step());
});

test('coincident clouds and extreme finite outliers stay bounded and finish at the step limit', () => {
  const positions = new Float32Array(3000);
  positions[positions.length - 1] = 3e38;
  const tree = buildGraphOctree(positions);
  assert.ok(tree.nodeCount < 100, 'coincident points share bounded terminal buckets');
  const force = graphChargeForces(tree, 5, 0.8, 1);
  assert.ok(force.every(Number.isFinite));
  const kernel = createGraphLayoutKernel({ nodeCount: 1000, positions, pinned: new Uint8Array(1000), ...edges(), options: { maxSteps: 3 } });
  for (let step = 1; step <= 3; step += 1) {
    const result = kernel.step();
    assert.equal(result.done, step === 3);
    assert.ok(result.output.positions.every(Number.isFinite));
  }
});

test('empty graphs finish immediately and invalid dimensions, indices and options fail before work', () => {
  assert.equal(createGraphLayoutKernel({ nodeCount: 0, ...edges() }).step().done, true);
  assert.throws(() => createGraphLayoutKernel(edges()), /node count/u);
  for (const change of [
    { nodeCount: -1 }, { nodeCount: undefined }, { nodeCount: null }, { positions: new Float32Array([NaN, 0, 0]) },
    { source: new Uint32Array([1]), target: new Uint32Array([0]) },
    { options: { maxSteps: Infinity } }, { pinned: new Uint8Array([2]) },
  ]) assert.throws(() => createGraphLayoutKernel({ nodeCount: 1, ...edges(), ...change }));
});

test('settled free graphs converge before their hard step limit', () => {
  const kernel = createGraphLayoutKernel({ nodeCount: 1, positions: new Float32Array([0, 0, 0]), pinned: new Uint8Array([0]), ...edges(), options: { stableSteps: 3, maxSteps: 100 } });
  assert.equal(kernel.step().done, false);
  assert.equal(kernel.step().done, false);
  const result = kernel.step();
  assert.equal(result.done, true);
  assert.equal(result.output.iteration, 3);
  assert.equal(result.output.maxSpeed, 0);
});
