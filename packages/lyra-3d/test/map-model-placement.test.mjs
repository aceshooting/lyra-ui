import assert from 'node:assert/strict';
import test from 'node:test';
import { placeModelVertex } from '../dist/map/model-placement.js';

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
