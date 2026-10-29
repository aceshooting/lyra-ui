import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { admitPointsData } from '../dist/points/data.js';
import { resolveLyra3dStyle } from '../dist/core/style.js';
import { createPointsXrProfile, createPointsXrPlacement } from '../dist/points/xr-profile.js';

test('points XR rounded Float32 profiles independently enclose admitted geometry and preserve world bounds', () => {
  fc.assert(fc.property(fc.record({
    rows: fc.array(fc.tuple(fc.integer({ min: -320, max: 320 }), fc.integer({ min: -320, max: 320 }), fc.integer({ min: -320, max: 320 })), { maxLength: 30 }),
    diameter: fc.integer({ min: 0, max: 128 }), width: fc.integer({ min: 0, max: 64 }), axes: fc.boolean(),
  }), value => {
    const rows = [[-10, 0, 0], [10, 0, 0], ...value.rows.map(row => row.map(entry => entry / 16))];
    const positions = Float32Array.from(rows.flat());
    const input = admitPointsData({ positions, sizes: new Float32Array(rows.length).fill(value.diameter),
      segments: new Uint32Array([0, 1]), axes: value.axes ? [
        { axis: 'x', min: -12, max: 12, ticks: [{ value: 0, label: '' }], grid: true },
        { axis: 'y', min: -7, max: 7, ticks: [{ value: 0, label: '' }], grid: true },
      ] : [],
    });
    const profile = createPointsXrProfile(input, resolveLyra3dStyle({ lineWidth: value.width }));
    // Authored endpoints, not production pointsAxes or renderer transforms, form this oracle.
    const endpoints = value.axes ? [...rows, [-12, 0, 0], [12, 0, 0], [0, -7, 0], [0, 7, 0]] : rows;
    const min = [0, 1, 2].map(axis => Math.min(...endpoints.map(point => point[axis])));
    const max = [0, 1, 2].map(axis => Math.max(...endpoints.map(point => point[axis])));
    const center = min.map((entry, axis) => (entry + max[axis]) / 2);
    const radius = Math.hypot(...min.map((entry, axis) => (max[axis] - entry) / 2));
    assert.deepEqual(profile.min, min); assert.deepEqual(profile.max, max); assert.deepEqual(profile.center, center);
    assert.equal(profile.radius, radius); assert.equal(profile.padding, Math.max(value.diameter, value.width) * .001);
    const ideal = (.75 - profile.padding - .001) / radius;
    assert.ok(profile.scale <= ideal); assert.equal(Math.fround(profile.scale), profile.scale);
    assert.ok(Number.isFinite(profile.scale) && profile.scale >= 2 ** -126);
    assert.ok(profile.scale * radius + profile.padding <= .749 + 1e-14);
    const viewer = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1.6, 0, 1];
    const root = createPointsXrPlacement(profile, viewer, 0);
    for (const point of endpoints) {
      for (let axis = 0; axis < 3; axis++) assert.ok(Math.abs(point[axis] * profile.scale) <= 64);
      const reference = [root[0] * point[0] + root[4] * point[1] + root[8] * point[2] + root[12],
        root[1] * point[0] + root[5] * point[1] + root[9] * point[2] + root[13],
        root[2] * point[0] + root[6] * point[1] + root[10] * point[2] + root[14]];
      const expected = [(point[0] - center[0]) * profile.scale,
        1.6 - (point[1] - center[1]) * profile.scale, -2 + (point[2] - center[2]) * profile.scale];
      reference.forEach((entry, axis) => assert.ok(Math.abs(entry - expected[axis]) <= 1e-12));
      assert.ok(Math.hypot(reference[0], reference[1] - 1.6, reference[2] + 2) + profile.padding <= .749 + 1e-12);
    }
    for (const coordinate of center) assert.ok(Math.abs(coordinate * profile.scale) <= 64);
    assert.deepEqual([...positions], rows.flat(), 'profiling and placement do not rewrite owned geometry');
  }), { seed: 20261029, numRuns: 200, includeErrorInReport: true });
});
