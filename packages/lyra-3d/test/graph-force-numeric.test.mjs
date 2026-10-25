import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGraphOctree, graphChargeForces } from './graph-synchronous-fixture.mjs';

test('exact charge agrees with scaled norms across Float32 coordinate and finite softening ranges', () => {
  for (const scale of [2 ** -149, 1e-20, 1, 1e20, 3e38]) {
    const positions = new Float32Array([scale, -scale, scale, -scale, scale, -scale]);
    const tree = buildGraphOctree(positions);
    const delta = [0, 1, 2].map((axis) => positions[axis] - positions[axis + 3]);
    for (const softening of [1e-6, 1, 1e12, 1e150, 1e151, 1e200, Number.MAX_VALUE]) {
      const actual = graphChargeForces(tree, 7, 0, softening);
      const denominator = Math.hypot(Math.hypot(...delta), softening);
      const force = 7 / (denominator * denominator);
      for (let axis = 0; axis < 3; axis += 1) {
        const expected = force * delta[axis] / denominator;
        assert.ok(Number.isFinite(actual[axis]));
        assert.ok(Math.abs(actual[axis] - expected) <= Math.max(Number.MIN_VALUE, Math.abs(expected) * 1e-14), `${scale}/${softening}/${axis}`);
        assert.ok(actual[axis] === -actual[axis + 3]);
      }
    }
  }
});

test('coincident pair forces retain their softening magnitude and opposite directions', () => {
  const tree = buildGraphOctree(new Float32Array(6));
  for (const softening of [1e-6, 1, 1e12, 1e150, 1e151, 1e200, Number.MAX_VALUE]) {
    const actual = graphChargeForces(tree, 7, 0, softening);
    const denominator = Math.hypot(softening, softening);
    const expected = (7 / (denominator * denominator)) * softening / denominator;
    const magnitude = Math.hypot(...actual.slice(0, 3));
    assert.ok(actual.every(Number.isFinite));
    assert.ok(Math.abs(magnitude - expected) <= Math.max(Number.MIN_VALUE, expected * 1e-14));
    for (let axis = 0; axis < 3; axis += 1) assert.ok(actual[axis] === -actual[axis + 3]);
  }
});
