import assert from 'node:assert/strict';
import test from 'node:test';
import { admitPointsData } from '../dist/points/data.js';
import { resolveLyra3dStyle } from '../dist/core/style.js';
import { Lyra3dXrError } from '../dist/xr/types.js';
import { createPointsXrProfile, createPointsXrPlacement, validatePointsXrPose } from '../dist/points/xr-profile.js';

const identity = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const scene = extra => admitPointsData({ positions: new Float32Array([-1, 0, 0, 1, 0, 0]), ...extra });
const style = extra => resolveLyra3dStyle(extra);
const unsupported = error => error instanceof Lyra3dXrError && error.code === 'unsupported-scene' && error.message === 'This scene does not support immersive presentation.';
const failed = error => error instanceof Lyra3dXrError && error.code === 'failed' && error.message === 'Immersive presentation failed.';
function down32(value) {
  const buffer = new ArrayBuffer(4), floats = new Float32Array(buffer), bits = new Uint32Array(buffer);
  floats[0] = value; if (floats[0] > value) bits[0]--; return floats[0];
}
function transform(matrix, point) {
  return [0, 1, 2].map(row => matrix[row] * point[0] + matrix[row + 4] * point[1] + matrix[row + 8] * point[2] + matrix[row + 12]);
}
const near = (actual, expected, epsilon = 1e-10) => assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} differs from ${expected}`);

test('points XR profile refuses every label location 2D and point or explicit-segment ceilings without truncation', () => {
  const variants = [
    { labels: ['visible', ''] },
    { positions: new Float32Array(300 * 3), labels: Array.from({ length: 300 }, (_, row) => row === 299 ? 'outside visible subset' : '') },
    { axes: [{ axis: 'x', min: -1, max: 1, label: 'axis title', ticks: [] }] },
    { axes: [{ axis: 'x', min: -1, max: 1, ticks: [{ value: 0, label: 'tick title' }] }] },
    { mode: '2d' }, { positions: new Float32Array(100001 * 3) },
    { segments: new Uint32Array(100001 * 2) },
  ];
  for (const extra of variants) assert.throws(() => createPointsXrProfile(scene(extra), style()), unsupported);
  assert.doesNotThrow(() => createPointsXrProfile(scene({ positions: new Float32Array(100000 * 3) }), style()));
  assert.doesNotThrow(() => createPointsXrProfile(scene({ segments: new Uint32Array(100000 * 2) }), style()));
  assert.doesNotThrow(() => createPointsXrProfile(scene({ labels: ['', ''], axes: [{ axis: 'x', min: -1, max: 1, label: '', ticks: [{ value: 0, label: '' }] }] }), style()));
});

test('points XR profile encloses point centres and generated axis grid endpoints with fixed world padding and depth', () => {
  const profile = createPointsXrProfile(scene({ positions: new Float32Array([-1, -.5, 0, 1, .5, 0]), sizes: new Float32Array([4, 10]),
    axes: [{ axis: 'x', min: -2, max: 2, ticks: [{ value: 1, label: '' }], grid: true },
      { axis: 'y', min: -1, max: 1, ticks: [{ value: .5, label: '' }], grid: true }], segments: new Uint32Array([0, 1]),
  }), style({ lineWidth: 12 }));
  assert.deepEqual(Object.keys(profile).sort(), ['min', 'max', 'center', 'radius', 'scale', 'padding', 'units', 'near', 'far'].sort());
  assert.deepEqual(profile.min, [-2, -1, 0]); assert.deepEqual(profile.max, [2, 1, 0]); assert.deepEqual(profile.center, [0, 0, 0]);
  near(profile.radius, Math.sqrt(5)); near(profile.padding, .012);
  assert.equal(profile.scale, down32((.75 - .012 - .001) / Math.sqrt(5)));
  assert.equal(profile.units, .002); assert.equal(profile.near, .01); assert.equal(profile.far, 100);
  assert.ok(profile.radius * profile.scale + profile.padding <= .749 + 1e-15);
});

test('points XR fit rounds scale down to normal Float32 and handles empty zero-radius and protected padding', () => {
  const profile = createPointsXrProfile(scene(), style());
  assert.equal(profile.scale, down32(.743)); assert.equal(Math.fround(profile.scale), profile.scale);
  assert.ok(profile.scale > 0 && profile.scale >= 2 ** -126);
  const empty = createPointsXrProfile(scene({ positions: new Float32Array() }), style());
  assert.deepEqual(empty.min, [0, 0, 0]); assert.deepEqual(empty.max, [0, 0, 0]); assert.deepEqual(empty.center, [0, 0, 0]);
  assert.equal(empty.radius, 0); assert.equal(empty.scale, 1);
  const zero = createPointsXrProfile(scene({ positions: new Float32Array([2, -3, 4]) }), style());
  assert.deepEqual(zero.center, [2, -3, 4]); assert.equal(zero.radius, 0); assert.equal(zero.scale, 1);
  assert.throws(() => createPointsXrProfile(scene({ sizes: new Float32Array([749, 0]) }), style()), unsupported);
  assert.doesNotThrow(() => createPointsXrProfile(scene({ sizes: new Float32Array([748, 0]) }), style()));
  const invisible = createPointsXrProfile(scene({ sizes: new Float32Array([0, 0]) }), style({ pointSize: 1024 }));
  assert.equal(invisible.padding, 0);
});

test('points XR rejects subnormal geometry unsafe offset cancellation and unrepresentable scale without clamping', () => {
  for (const value of [2 ** -149, -(2 ** -127)]) {
    assert.throws(() => createPointsXrProfile(scene({ positions: new Float32Array([value, 0, 0]) }), style()), unsupported);
    assert.throws(() => createPointsXrProfile(scene({ axes: [{ axis: 'x', min: value, max: 1, ticks: [] }] }), style()), unsupported);
  }
  assert.throws(() => createPointsXrProfile(scene({ positions: new Float32Array([1000000, 0, 0, 1000000.125, 0, 0]) }), style()), unsupported);
  assert.throws(() => createPointsXrProfile(scene({ positions: new Float32Array([100, 0, 0]) }), style()), unsupported);
  assert.throws(() => createPointsXrProfile(scene({ positions: new Float32Array([2 ** -126, 0, 0, 2 ** -126 + 2 ** -149, 0, 0]) }), style()), unsupported);
  assert.doesNotThrow(() => createPointsXrProfile(scene({ positions: new Float32Array([-(2 ** -100), 0, 0, 2 ** -100, 0, 0]) }), style()));
});

test('points XR placement independently places centre two metres forward and reflects semantic y exactly once', () => {
  const profile = createPointsXrProfile(scene({ positions: new Float32Array([0, 2, 3, 2, 2, 3]) }), style());
  const viewer = identity(); viewer[12] = 10; viewer[13] = 1.6; viewer[14] = 20;
  const matrix = createPointsXrPlacement(profile, viewer, 0), s = profile.scale;
  assert.equal(Object.isFrozen(matrix), true); assert.equal(matrix.length, 16);
  for (const [point, expected] of [
    [[1, 2, 3], [10, 1.6, 18]], [[2, 2, 3], [10 + s, 1.6, 18]],
    [[1, 3, 3], [10, 1.6 - s, 18]], [[1, 2, 4], [10, 1.6, 18 + s]],
  ]) transform(matrix, point).forEach((value, index) => near(value, expected[index]));
  const frozen = [...matrix]; viewer[12] = -5; viewer[13] = 3; viewer[14] = 4;
  assert.deepEqual(matrix, frozen, 'caller-held first placement is immutable after later pose changes');
});

test('points XR heading uses horizontal viewer forward without pitch roll and vertical look uses inline orbit heading', () => {
  const profile = createPointsXrProfile(scene(), style()), s = profile.scale;
  // Proper rigid orientation whose forward is +X, up +Y and right +Z.
  const side = [0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 2, 0, 1];
  const facing = createPointsXrPlacement(profile, side, 0);
  assert.deepEqual(transform(facing, [0, 0, 0]), [2, 2, 0]);
  transform(facing, [1, 1, 1]).forEach((value, index) => near(value, [2 - s, 2 - s, s][index]));
  const vertical = [1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 2, 0, 1];
  const fallback = createPointsXrPlacement(profile, vertical, Math.PI / 2);
  transform(fallback, [0, 0, 0]).forEach((value, index) => near(value, [-2, 2, 0][index]));
  const tilted = [1, 0, 0, 0, 0, Math.SQRT1_2, Math.SQRT1_2, 0, 0, -Math.SQRT1_2, Math.SQRT1_2, 0, 0, 2, 0, 1];
  const level = createPointsXrPlacement(profile, tilted, 0);
  transform(level, [0, 1, 0]).forEach((value, index) => near(value, [0, 2 - s, -2][index]));
});

test('points XR present pose validation refuses nonfinite nonrigid out-of-range and Float32-overflow model views', () => {
  const eye = identity(); eye[12] = .032;
  assert.doesNotThrow(() => validatePointsXrPose(identity(), [eye]));
  const boundary = identity(); boundary[12] = 64; boundary[13] = -64;
  assert.doesNotThrow(() => validatePointsXrPose(boundary, [boundary]));
  for (const [index, value] of [[0, NaN], [5, Infinity], [0, 1.01], [15, 0], [12, 64.0001], [14, -64.0001]]) {
    const invalid = identity(); invalid[index] = value;
    assert.throws(() => validatePointsXrPose(invalid, [eye]), failed);
    assert.throws(() => validatePointsXrPose(identity(), [invalid]), failed);
  }
  const reflected = identity(); reflected[0] = -1;
  assert.throws(() => validatePointsXrPose(reflected, [eye]), failed);
  const root = identity(); root[0] = Number.MAX_VALUE;
  assert.throws(() => validatePointsXrPose(identity(), [eye], root), failed);
  const nanRoot = identity(); nanRoot[12] = NaN;
  assert.throws(() => validatePointsXrPose(identity(), [eye], nanRoot), failed);
});
