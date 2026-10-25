import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGraphOctree } from './graph-synchronous-fixture.mjs';

test('the octree accepts only finite interleaved Float32 coordinates within the supported size', () => {
  for (const [name, input] of [
    ['a Float64Array', new Float64Array(3)],
    ['a plain array', [0, 0, 0]],
    ['a length that is not a multiple of three', new Float32Array(4)],
    ['a NaN coordinate', new Float32Array([0, Number.NaN, 0])],
    ['an infinite coordinate', new Float32Array([0, 0, Number.POSITIVE_INFINITY])],
    ['more than 200,000 nodes', new Float32Array(600_003)],
  ]) {
    assert.throws(() => buildGraphOctree(input), (error) => error instanceof TypeError && /finite interleaved Float32/u.test(error.message), name);
  }
  assert.equal(buildGraphOctree(new Float32Array(0)).root, undefined);
  assert.ok(buildGraphOctree(new Float32Array(600_000)).root, 'the limit itself is allowed');
});

test('the octree owns a copy of its coordinates', () => {
  const input = new Float32Array([1, 2, 3, 4, 5, 6]);
  const tree = buildGraphOctree(input);
  input.fill(0);
  assert.deepEqual([...tree.positions], [1, 2, 3, 4, 5, 6]);
});
