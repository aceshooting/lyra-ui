import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_LYRA_3D_STYLE,
  DEFAULT_ORBIT_CAMERA,
  LYRA_3D_CONTRACT,
  LYRA_3D_FIELD_OF_VIEW,
  LYRA_3D_MAX_PICK_ITEMS,
  LYRA_3D_WORLD_LIMIT,
  Lyra3dUnsupportedError,
  boundsOfPositions,
  createPickColors,
  decodePickId,
  encodePickId,
  fitOrbitCamera,
  focusOrbitCamera,
  interpolateOrbit,
  isSoftwareRendererName,
  normalizeOrbitCamera,
  normalizeWorldPoint,
  orbitBy,
  orbitCameraPose,
  panBy,
  parseCssColor,
  projectOrbitPoint,
  resolveLyra3dStyle,
  zoomBy,
} from '../dist/core/index.js';

const close = (actual, expected, epsilon = 1e-9, label = '') =>
  assert.ok(Math.abs(actual - expected) <= epsilon, `${label} expected ${expected}, got ${actual}`);

test('the contract version is 1', () => {
  assert.equal(LYRA_3D_CONTRACT, 1);
});

test('parses the concrete color forms computed styles produce', () => {
  assert.deepEqual(parseCssColor('#0a141e'), { r: 10 / 255, g: 20 / 255, b: 30 / 255, a: 1 });
  assert.deepEqual(parseCssColor('#fff8'), { r: 1, g: 1, b: 1, a: 0x88 / 255 });
  assert.deepEqual(parseCssColor('rgb(10, 20, 30)'), { r: 10 / 255, g: 20 / 255, b: 30 / 255, a: 1 });
  assert.deepEqual(parseCssColor('rgba(255, 0, 0, 0.5)'), { r: 1, g: 0, b: 0, a: 0.5 });
  assert.deepEqual(parseCssColor('rgb(100% 0% 50% / 25%)'), { r: 1, g: 0, b: 0.5, a: 0.25 });
  assert.deepEqual(parseCssColor('color(srgb 0.2 0.4 0.6 / 0.8)'), { r: 0.2, g: 0.4, b: 0.6, a: 0.8 });
  assert.deepEqual(parseCssColor('transparent'), { r: 0, g: 0, b: 0, a: 0 });
  assert.deepEqual(parseCssColor('rgb(300, -5, 0)'), { r: 1, g: 0, b: 0, a: 1 }, 'channels clamp');
  for (const invalid of ['var(--lr-color-brand)', 'oklch(0.5 0.1 200)', '#12345', 'rgb(1, 2)', 'rgb(a, b, c)', '', 7, null]) {
    assert.equal(parseCssColor(invalid), null, String(invalid));
  }
});

test('resolves an untrusted style field by field, reading only own data properties', () => {
  const resolved = resolveLyra3dStyle({
    background: 'rgb(10, 20, 30)',
    foreground: 'not a color',
    palette: ['#ff0000', 'bogus', '#00ff00'],
    fontSize: Number.POSITIVE_INFINITY,
    pointSize: 2000,
    devicePixelRatio: 2,
    reducedMotion: 'yes',
    forcedColors: true,
    get accent() {
      throw new Error('accessors are never read');
    },
  });
  assert.deepEqual(resolved.background, { r: 10 / 255, g: 20 / 255, b: 30 / 255, a: 1 });
  assert.deepEqual(resolved.foreground, parseCssColor(DEFAULT_LYRA_3D_STYLE.foreground));
  assert.deepEqual(resolved.accent, parseCssColor(DEFAULT_LYRA_3D_STYLE.accent));
  assert.equal(resolved.palette.length, 2);
  assert.equal(resolved.fontSize, DEFAULT_LYRA_3D_STYLE.fontSize);
  assert.equal(resolved.pointSize, 1024);
  assert.equal(resolved.devicePixelRatio, 2);
  assert.equal(resolved.reducedMotion, false, 'only a real true enables reduced motion');
  assert.equal(resolved.forcedColors, true);
  assert.ok(Object.isFrozen(resolved));
  const empty = resolveLyra3dStyle({ palette: [] });
  assert.equal(empty.palette.length, DEFAULT_LYRA_3D_STYLE.palette.length, 'an empty palette keeps the defaults');
  assert.equal(resolveLyra3dStyle(null).fontFamily, DEFAULT_LYRA_3D_STYLE.fontFamily);
});

/** Projects through the renderer pose: a right-handed look-at camera viewing a y-mirrored world. */
function projectThroughPose(point, camera, viewport) {
  const pose = orbitCameraPose(camera);
  const world = [point.x, -point.y, point.z];
  const sub = (a, b) => a.map((value, index) => value - b[index]);
  const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const unit = (a) => a.map((value) => value / Math.hypot(...a));
  const back = unit(sub(pose.position, pose.target));
  const right = unit(cross(pose.up, back));
  const up = cross(back, right);
  const relative = sub(world, pose.position);
  const depth = -dot(relative, back);
  const scale = viewport.height / (2 * Math.tan(LYRA_3D_FIELD_OF_VIEW / 2) * depth);
  return { x: viewport.width / 2 + dot(relative, right) * scale, y: viewport.height / 2 - dot(relative, up) * scale, depth };
}

test('the renderer pose reproduces the y-down orbit projection from every angle', () => {
  const viewport = { width: 640, height: 480 };
  const points = [{ x: 0, y: 0, z: 0 }, { x: 40, y: -25, z: 10 }, { x: -60, y: 80, z: -35 }];
  for (const yaw of [0, 0.7, -2.4, Math.PI]) {
    for (const pitch of [0, 0.5, -1.2]) {
      const camera = normalizeOrbitCamera({ yaw, pitch, distance: 300, target: { x: 5, y: -10, z: 15 } });
      for (const point of points) {
        const expected = projectOrbitPoint(point, camera, viewport);
        const actual = projectThroughPose(point, camera, viewport);
        close(actual.x, expected.x, 1e-6, `x yaw=${yaw} pitch=${pitch}`);
        close(actual.y, expected.y, 1e-6, `y yaw=${yaw} pitch=${pitch}`);
        close(actual.depth, expected.depth, 1e-6, 'depth');
      }
    }
  }
  const straight = normalizeOrbitCamera({ yaw: 0, pitch: 0, distance: 100, target: { x: 0, y: 0, z: 0 } });
  const below = projectOrbitPoint({ x: 0, y: 10, z: 0 }, straight, viewport);
  assert.ok(below.y > viewport.height / 2, 'positive world y is below the center at zero pitch');
  assert.equal(projectOrbitPoint({ x: 0, y: 0, z: 200 }, straight, viewport), null, 'behind the eye');
});

test('normalizes cameras from untrusted input', () => {
  const camera = normalizeOrbitCamera({ yaw: 7, pitch: 3, distance: -5, target: { x: 1, y: 2, z: Number.NaN } });
  close(camera.yaw, 7 % (Math.PI * 2));
  close(camera.pitch, Math.PI / 2 - 0.01);
  assert.equal(camera.distance, 0.01);
  assert.deepEqual(camera.target, DEFAULT_ORBIT_CAMERA.target, 'a partial target keeps the fallback');
  assert.ok(Object.isFrozen(camera) && Object.isFrozen(camera.target));
  assert.deepEqual(normalizeOrbitCamera('nope'), DEFAULT_ORBIT_CAMERA);
  assert.equal(normalizeWorldPoint({ x: 1, y: 2 }), undefined);
  assert.deepEqual(normalizeWorldPoint({ x: 1e12, y: 0, z: -1e12 }), { x: 1e7, y: 0, z: -1e7 });
});

test('fits bounds inside the padding and focuses, orbits, zooms and pans', () => {
  const viewport = { width: 400, height: 300 };
  const positions = new Float32Array([-50, -20, 0, 50, 20, 10, Number.NaN, 0, 0]);
  const bounds = boundsOfPositions(positions, new Float32Array([5, 5, 5]));
  assert.deepEqual(bounds, { min: { x: -55, y: -25, z: -5 }, max: { x: 55, y: 25, z: 15 } });
  assert.equal(boundsOfPositions(new Float32Array(0)), null);
  const fitted = fitOrbitCamera(bounds, viewport, 24);
  assert.deepEqual(fitted.target, { x: 0, y: 0, z: 5 });
  for (const corner of [bounds.min, bounds.max]) {
    const projected = projectOrbitPoint(corner, fitted, viewport);
    assert.ok(projected.x >= 0 && projected.x <= viewport.width && projected.y >= 0 && projected.y <= viewport.height);
  }
  assert.deepEqual(fitOrbitCamera(null, viewport), DEFAULT_ORBIT_CAMERA);

  const focused = focusOrbitCamera(fitted, { x: 10, y: 20, z: 30 }, 50);
  assert.deepEqual(focused.target, { x: 10, y: 20, z: 30 });
  assert.equal(focused.distance, 50);
  assert.equal(focusOrbitCamera(fitted, { x: 0, y: 0, z: 0 }).distance, fitted.distance);
  close(orbitBy(fitted, 0.5, 0.25).yaw, 0.5);
  close(zoomBy(fitted, 0.5).distance, fitted.distance / 2);
  const panned = panBy(DEFAULT_ORBIT_CAMERA, 10, 0, viewport);
  assert.ok(panned.target.x < 0, 'dragging right moves the target left');
  const halfway = interpolateOrbit({ ...DEFAULT_ORBIT_CAMERA, yaw: 3 }, { ...DEFAULT_ORBIT_CAMERA, yaw: -3 }, 0.5);
  assert.ok(Math.abs(halfway.yaw) > 3, 'turns the short way across the seam');
  assert.deepEqual(interpolateOrbit(DEFAULT_ORBIT_CAMERA, focused, 1), focused);
});

test('fits every supported world-bound corner inside padded ordinary and one-pixel-wide viewports', () => {
  const limit = LYRA_3D_WORLD_LIMIT;
  const bounds = { min: { x: -limit, y: -limit, z: -limit }, max: { x: limit, y: limit, z: limit } };
  for (const viewport of [{ width: 640, height: 480 }, { width: 1, height: 65536 }]) {
    const padding = Math.min(24, viewport.width / 4);
    for (const orientation of [{ yaw: 0, pitch: 0 }, { yaw: 0.7, pitch: -0.4 }]) {
      const fitted = fitOrbitCamera(bounds, viewport, padding, orientation);
      assert.ok(fitted.distance > limit, 'framing distance is independent of the coordinate ceiling');
      for (const x of [-limit, limit]) for (const y of [-limit, limit]) for (const z of [-limit, limit]) {
        const projected = projectOrbitPoint({ x, y, z }, fitted, viewport);
        assert.ok(projected, 'all corners remain in front of the near plane');
        assert.ok(projected.depth >= orbitCameraPose(fitted).near && projected.depth <= fitted.distance * 4 + 1e4, 'all corners stay inside renderer clipping planes');
        assert.ok(projected.x >= padding - 1e-8 && projected.x <= viewport.width - padding + 1e-8, `x=${projected.x}`);
        assert.ok(projected.y >= padding - 1e-8 && projected.y <= viewport.height - padding + 1e-8, `y=${projected.y}`);
      }
      assert.deepEqual(normalizeOrbitCamera(fitted), fitted, 'subsequent camera writes preserve the fitted distance');
    }
  }
});

test('fits small bounds to the actual narrow aspect ratio without a minimum aspect floor', () => {
  const bounds = { min: { x: -50, y: -20, z: -10 }, max: { x: 50, y: 20, z: 10 } };
  const viewport = { width: 1, height: 4096 };
  const fitted = fitOrbitCamera(bounds, viewport, 0);
  for (const x of [-50, 50]) for (const y of [-20, 20]) for (const z of [-10, 10]) {
    const projected = projectOrbitPoint({ x, y, z }, fitted, viewport);
    assert.ok(projected && projected.x >= 0 && projected.x <= 1 && projected.y >= 0 && projected.y <= 4096);
  }
});

test('keeps extreme framing inputs and renderer camera arithmetic finite', () => {
  const bounds = { min: { x: -Number.MAX_VALUE, y: -Number.MAX_VALUE, z: -Number.MAX_VALUE }, max: { x: Number.MAX_VALUE, y: Number.MAX_VALUE, z: Number.MAX_VALUE } };
  for (const viewport of [{ width: 0, height: Number.NaN }, { width: Infinity, height: -1 }, { width: 1, height: Number.MAX_VALUE }]) {
    for (const padding of [Number.MAX_VALUE, Infinity, Number.NaN, -10]) {
      const camera = fitOrbitCamera(bounds, viewport, padding);
      assert.ok(Number.isFinite(camera.distance) && camera.distance > 0);
      const pose = orbitCameraPose(camera);
      assert.ok([...pose.position, ...pose.target, ...pose.up, pose.near].every(Number.isFinite));
      assert.ok([...pose.position, pose.near, camera.distance * 4 + 1e4].every((value) => Number.isFinite(Math.fround(value))));
    }
  }
  const ordinary = { width: 640, height: 480 };
  const supported = { min: { x: -LYRA_3D_WORLD_LIMIT, y: -LYRA_3D_WORLD_LIMIT, z: -LYRA_3D_WORLD_LIMIT }, max: { x: LYRA_3D_WORLD_LIMIT, y: LYRA_3D_WORLD_LIMIT, z: LYRA_3D_WORLD_LIMIT } };
  assert.deepEqual(fitOrbitCamera(bounds, ordinary), fitOrbitCamera(supported, ordinary), 'finite excess bounds use the supported world range before extent arithmetic');
  assert.deepEqual(fitOrbitCamera({ min: { x: NaN, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }, ordinary), DEFAULT_ORBIT_CAMERA);
  assert.ok(normalizeOrbitCamera({ distance: Number.MAX_VALUE }).distance > LYRA_3D_WORLD_LIMIT);
});

test('encodes and decodes 24-bit pick ids with 0 reserved for the background', () => {
  for (const index of [0, 1, 254, 255, 256, 65535, 70000, LYRA_3D_MAX_PICK_ITEMS]) {
    const color = encodePickId(index);
    assert.equal(decodePickId(...color), index);
  }
  assert.equal(decodePickId(0, 0, 0), null);
  assert.equal(encodePickId(-1), null);
  assert.equal(encodePickId(1.5), null);
  assert.equal(encodePickId(LYRA_3D_MAX_PICK_ITEMS + 1), null);
  const colors = createPickColors(300);
  assert.equal(colors.length, 900);
  const at = (index) => [0, 1, 2].map((offset) => Math.round(colors[index * 3 + offset] * 255));
  assert.equal(decodePickId(...at(0)), 0);
  assert.equal(decodePickId(...at(299)), 299);
  assert.throws(() => createPickColors(LYRA_3D_MAX_PICK_ITEMS + 1), RangeError);
});

test('reports an unsupported browser with a stable code', () => {
  const error = new Lyra3dUnsupportedError();
  assert.equal(error.name, 'Lyra3dUnsupportedError');
  assert.equal(error.code, 'webgl-unavailable');
  assert.ok(error instanceof Error);
});

test('recognizes software rasterizers by their renderer string', () => {
  for (const name of [
    'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)',
    'llvmpipe, or similar',
    'llvmpipe (LLVM 19.1.1, 256 bits)',
    'Microsoft Basic Render Driver',
  ]) {
    assert.equal(isSoftwareRendererName(name), true, name);
  }
  for (const name of ['ANGLE (NVIDIA, Vulkan 1.4.312 (NVIDIA Tesla V100S-PCIE-32GB), NVIDIA)', 'Apple M2', 'WebKit WebGL', '', undefined]) {
    assert.equal(isSoftwareRendererName(name), false, String(name));
  }
});
