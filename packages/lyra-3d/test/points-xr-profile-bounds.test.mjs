import assert from 'node:assert/strict';
import test from 'node:test';
import { admitPointsData } from '../dist/points/data.js';
import { resolveLyra3dStyle } from '../dist/core/style.js';
import { createPointsXrProfile } from '../dist/points/xr-profile.js';

const scene = extra => admitPointsData({ positions: new Float32Array([0, 0, 0]), ...extra });

test('points XR grid lines toward a z axis enclose the tick plane along z, not y', () => {
  const profile = createPointsXrProfile(scene({ axes: [
    { axis: 'x', min: -2, max: 2, ticks: [{ value: 1.5, label: '' }], grid: true },
    { axis: 'z', min: -3, max: 4, ticks: [{ value: 2, label: '' }], grid: true },
  ] }), resolveLyra3dStyle());
  assert.deepEqual(profile.min, [-2, 0, -3]);
  assert.deepEqual(profile.max, [2, 0, 4]);
});
