import assert from 'node:assert/strict';
import test from 'node:test';
import { placeModelVertex } from '../dist/map/model-placement.js';
import * as placement from '../dist/map/model-placement.js';

const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const near = (actual, expected) => {
  assert.equal(actual.length, 3);
  actual.forEach((value, index) => {
    assert.ok(Number.isFinite(value));
    assert.ok(Math.abs(value - expected[index]) < 1e-9, `${actual} differs from ${expected}`);
  });
};

test('placement preserves authored source origin and applies full parent and child transforms before unit conversion', () => {
  const parent = [...identity]; parent[12] = 10; parent[13] = 20; parent[14] = 30;
  const child = [2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 4, 0, 1, 2, 3, 1];
  near(placeModelVertex([1, 1, 1], { nodeTransforms: [parent, child], metersPerUnit: 2 }), [26, -74, 50]);
  near(placeModelVertex([0, 0, 0], { nodeTransforms: [parent], metersPerUnit: 1 }), [10, -30, 20]);
});

test('source axes map x east, y up, negative z north before ENU quaternion', () => {
  near(placeModelVertex([1, 2, 3], {}), [1, -3, 2]);
  const q = Math.SQRT1_2;
  near(placeModelVertex([1, 0, 0], { orientation: [0, 0, q * 2, q * 2] }), [0, 1, 0]);
});

test('invalid, projective and overflowing composed transforms fail before producing geometry', () => {
  const projective = [...identity]; projective[3] = 0.1;
  const huge = [...identity]; huge[0] = 1e308;
  for (const options of [{ metersPerUnit: 0 }, { orientation: [0, 0, 0, 0] },
    { orientation: [0, NaN, 0, 1] }, { nodeTransforms: [projective] },
    { nodeTransforms: [huge, huge] }]) assert.throws(() => placeModelVertex([1, 0, 0], options));
  assert.throws(() => placeModelVertex([Infinity, 0, 0], {}));
});

test('composed placement snapshots options and retains the established point transform', () => {
  assert.equal(typeof placement.createModelPlacementTransform, 'function');
  const parent = [...identity]; parent[12] = 10; parent[13] = 20; parent[14] = 30;
  const child = [2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 4, 0, 1, 2, 3, 1];
  const options = { nodeTransforms: [parent, child], metersPerUnit: 2 };
  const transform = placement.createModelPlacementTransform(options);
  assert.ok(Object.isFrozen(transform)); assert.equal(transform.determinantSign, 1);
  near(transform.point([1, 1, 1]), [26, -74, 50]);
  near(transform.point([1, 1, 1]), placeModelVertex([1, 1, 1], options));
  parent[12] = 999; child[0] = 999; options.metersPerUnit = 999;
  near(transform.point([1, 1, 1]), [26, -74, 50]);
});

test('composed normals use inverse transpose and tangent orientation follows determinant', () => {
  assert.equal(typeof placement.createModelPlacementTransform, 'function');
  const matrix = [-2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 4, 0, 7, 8, 9, 1];
  const transform = placement.createModelPlacementTransform({ nodeTransforms: [matrix] });
  assert.equal(transform.determinantSign, -1);
  const n = transform.normal([1, 1, 0]), length = Math.hypot(-0.5, 1 / 3);
  near(n, [-0.5 / length, 0, (1 / 3) / length]);
  const tangent = transform.tangent([0, 0, 1, 1], n);
  near(tangent.slice(0, 3), [0, -1, 0]); assert.equal(tangent[3], -1);
  assert.throws(() => transform.normal([0, 0, 0]));
  assert.throws(() => transform.tangent([1, 0, 0, 0], n));
});

test('singular composed transform preserves position-only placement but refuses required normals', () => {
  assert.equal(typeof placement.createModelPlacementTransform, 'function');
  const matrix = [...identity]; matrix[0] = 0;
  const transform = placement.createModelPlacementTransform({ nodeTransforms: [matrix] });
  assert.equal(transform.determinantSign, 0);
  near(transform.point([2, 3, 4]), [0, -4, 3]);
  near(placeModelVertex([2, 3, 4], { nodeTransforms: [matrix] }), [0, -4, 3]);
  assert.throws(() => transform.normal([0, 0, 1]));
});

test('composed placement retains intermediate point overflow refusal despite cancelling scales', () => {
  assert.equal(typeof placement.createModelPlacementTransform, 'function');
  const parent = [...identity], child = [...identity]; parent[0] = 1e-308; child[0] = 1e308;
  const options = { nodeTransforms: [parent, child] };
  const transform = placement.createModelPlacementTransform(options);
  assert.throws(() => placeModelVertex([2, 0, 0], options));
  assert.throws(() => transform.point([2, 0, 0]));
  near(transform.point([0.5, 0, 0]), [0.5, 0, 0]);
});
