import assert from 'node:assert/strict';
import test from 'node:test';
import { DoubleSide, Group, Scene } from 'three';
import { createPointsEngine } from '../dist/points/engine.js';
import { admitPointsData } from '../dist/points/data.js';
import { DEFAULT_ORBIT_CAMERA, projectOrbitPoint } from '../dist/core/orbit.js';
import { resolveLyra3dStyle, DEFAULT_LYRA_3D_STYLE } from '../dist/core/style.js';
import { decodePickId } from '../dist/core/picking.js';

const input = (extra = {}) => ({ positions: new Float32Array([-10, 2, 3, 10, 4, 5]), ...extra });
function harness() {
  const events = []; let options; let callbacks;
  const viewport = { canvas: {}, world: new Group(), pickWorld: new Group(), scene: new Scene(), width: 640, height: 480,
    orbit: DEFAULT_ORBIT_CAMERA, style: resolveLyra3dStyle(), lost: false, disposed: false,
    setOrbit(value) { this.orbit = value; }, setStyle(value) { this.style = resolveLyra3dStyle(value); return this.style; },
    invalidate() {}, onFrame(callback) { this.tick = callback; return () => { this.tick = undefined; }; },
    resize(width, height) { this.width = width; this.height = height; },
    project(point) { return projectOrbitPoint(point, this.orbit, this); }, pickAt() { return 1; },
    dispose() { this.disposed = true; },
  };
  const host = { hover() {}, pick() {}, lost() { events.push('lost'); }, restored() { events.push('restored'); }, camera(value) { events.push(value); } };
  const engine = createPointsEngine({ viewport(_container, nextHost, nextOptions) { callbacks = nextHost; options = nextOptions; return viewport; } });
  return { engine, viewport, events, host, options: () => options, callbacks: () => callbacks };
}

test('point admission copies finite bounded buffers and validates indices without decimating rows', () => {
  const source = input({ sizes: new Float32Array([4, 8]), categories: new Uint16Array([2, 1]), segments: new Uint32Array([0, 1]) });
  const admitted = admitPointsData(source); source.positions.fill(0); source.sizes.fill(99);
  assert.equal(admitted.positions[0], -10); assert.equal(admitted.sizes[0], 4);
  assert.throws(() => admitPointsData(input({ positions: new Float32Array([1, 2]) })));
  for (const value of [NaN, Infinity, 10_000_001, -10_000_001]) assert.throws(() => admitPointsData(input({ positions: new Float32Array([value, 0, 0]) })));
  assert.equal(admitPointsData(input({ positions: new Float32Array([10_000_000, -10_000_000, 0]) })).positions.length, 3);
  assert.throws(() => admitPointsData(input({ segments: new Uint32Array([0, 2]) })));
  assert.throws(() => admitPointsData(input({ sizes: new Float32Array([1, NaN]) })));
  assert.throws(() => admitPointsData(input({ mode: 'bad' })));
});

test('point RGB admission copies exactly three finite linear channels per row', () => {
  const colors = new Float32Array([0, 0.5, 1, 1, 0.25, 0]);
  const admitted = admitPointsData(input({ colors }));
  colors.fill(0.75);
  assert.deepEqual([...admitted.colors], [0, 0.5, 1, 1, 0.25, 0]);
  assert.notEqual(admitted.colors.buffer, colors.buffer);
  assert.equal(admitPointsData(input()).colors, undefined);
  assert.equal(admitPointsData({ positions: new Float32Array(), colors: new Float32Array() }).colors.length, 0);
  for (const invalid of [new Uint8Array(6), new Float32Array(5), new Float32Array(7)]) {
    assert.throws(() => admitPointsData(input({ colors: invalid })), /point colors/);
  }
  for (const value of [NaN, Infinity, -Infinity, -0.01, 1.01]) {
    const invalid = new Float32Array([0, 0, 0, 0, 0, value]);
    assert.throws(() => admitPointsData(input({ colors: invalid })), /point colors/);
  }
});

test('explicit RGB stays linear and yields to focus, selection, hover and forced colors', async () => {
  const { engine, viewport, host } = harness();
  const colors = new Float32Array([0.25, 0.5, 0.75, 0.125, 0.25, 0.5]);
  const style = { ...DEFAULT_LYRA_3D_STYLE, palette: ['#00ff00', '#0000ff'], accent: '#ff0000', focus: '#00ffff', foreground: '#ffff00' };
  engine.setData(input({ colors, categories: new Uint16Array([0, 1]) }), 0);
  colors.fill(1);
  engine.setStyle(style);
  await engine.mount({}, host);
  const rgb = () => [...viewport.world.children[0].geometry.getAttribute('pointColor').array];
  const expected = [0.25, 0.5, 0.75, 0.125, 0.25, 0.5];
  assert.deepEqual(rgb(), expected, 'linear loader values must not undergo a second sRGB transfer');
  const base = { selected: new Set(), dimmed: new Set(), hover: -1, focus: -1 };
  engine.setState({ ...base, selected: new Set([0]) });
  assert.deepEqual(rgb().slice(0, 3), [1, 0, 0]);
  engine.setState({ ...base, selected: new Set([0]), hover: 0, focus: 0 });
  assert.deepEqual(rgb().slice(0, 3), [0, 1, 1]);
  engine.setState({ ...base, hover: 0 });
  assert.deepEqual(rgb().slice(0, 3), [1, 0, 0]);
  engine.setState({ ...base, dimmed: new Set([0]) });
  rgb().slice(0, 3).forEach((value, index) => assert.ok(Math.abs(value - expected[index] * 0.3) < 1e-7));
  engine.setStyle({ ...style, forcedColors: true });
  assert.deepEqual(rgb(), [1, 1, 0, 1, 1, 0], 'forced colors ignore explicit RGB and dimming');
  engine.setState({ ...base, selected: new Set([0]) });
  assert.deepEqual(rgb().slice(0, 3), [1, 0, 0], 'selection keeps its established precedence');
  engine.setStyle(style);
  engine.setState(base);
  assert.deepEqual(rgb(), expected);
  engine.dispose();
});

test('RGB replacement is atomic and unsetting colors restores the existing category palette', async () => {
  const { engine, viewport, host } = harness();
  const categories = new Uint16Array([0, 1]);
  engine.setStyle({ ...DEFAULT_LYRA_3D_STYLE, palette: ['#00ff00', '#0000ff'] });
  engine.setData(input({ categories }), 0);
  await engine.mount({}, host);
  const rgb = () => [...viewport.world.children[0].geometry.getAttribute('pointColor').array];
  const palette = [0, 1, 0, 0, 0, 1];
  assert.deepEqual(rgb(), palette, 'unset colors keep prior category behavior');
  const geometry = viewport.world.children[0].geometry;
  let disposed = 0;
  geometry.addEventListener('dispose', () => { disposed += 1; });
  assert.throws(() => engine.setData(input({ colors: new Float32Array([2, 0, 0, 0, 0, 0]) }), 1));
  assert.equal(viewport.world.children[0].geometry, geometry);
  assert.equal(disposed, 0);
  assert.deepEqual(rgb(), palette);
  engine.setData(input({ categories, colors: new Float32Array([0.25, 0.5, 0.75, 0.125, 0.25, 0.5]) }), 1);
  assert.equal(disposed, 1, 'rejected revision did not consume its revision number');
  assert.deepEqual(rgb(), [0.25, 0.5, 0.75, 0.125, 0.25, 0.5]);
  engine.setData(input({ categories }), 2);
  assert.deepEqual(rgb(), palette, 'removing the RGB column restores category colors');
  engine.dispose();
});

test('point buffers preserve row pick IDs, variable sizes, and owned state colors', async () => {
  const { engine, viewport, host } = harness();
  engine.setData(input({ sizes: new Float32Array([4, 16]), categories: new Uint16Array([0, 1]) }), 0);
  await engine.mount({}, host); viewport.tick(0);
  const mesh = viewport.world.children[0];
  assert.equal(mesh.geometry.instanceCount, 2);
  assert.deepEqual([...mesh.geometry.getAttribute('pointSize').array], [4, 16]);
  const pick = mesh.geometry.getAttribute('pickColor').array;
  assert.equal(decodePickId(...[...pick.slice(3, 6)].map((channel) => Math.round(channel * 255))), 1);
  const old = mesh.geometry.getAttribute('pointColor').array.slice();
  const selected = new Set([0]); engine.setState({ selected, dimmed: new Set(), hover: -1, focus: -1 });
  const painted = mesh.geometry.getAttribute('pointColor').array.slice(); selected.clear();
  engine.setStyle(DEFAULT_LYRA_3D_STYLE);
  assert.deepEqual(mesh.geometry.getAttribute('pointColor').array, painted);
  assert.notDeepEqual(mesh.geometry.getAttribute('pointColor').array, old);
  engine.setState({ selected: new Set(), dimmed: new Set([1]), hover: -1, focus: -1 });
  engine.setStyle({ ...DEFAULT_LYRA_3D_STYLE, forcedColors: true });
  const forced = mesh.geometry.getAttribute('pointColor').array;
  assert.deepEqual(forced.slice(0, 3), forced.slice(3, 6));
  assert.equal(engine.pick(1, 1), 1); engine.dispose();
});

test('2d mode flattens rendered coordinates and locks cameras while retaining silent pan and fit', async () => {
  const { engine, viewport, host, events, options } = harness();
  engine.setData(input({ mode: '2d' }), 0); await engine.mount({}, host);
  engine.setCamera({ ...DEFAULT_ORBIT_CAMERA, yaw: 1, pitch: 0.5, target: { x: 2, y: 3, z: 5 } });
  assert.equal(viewport.orbit.yaw, 0); assert.equal(viewport.orbit.pitch, 0); assert.equal(viewport.orbit.target.z, 0);
  assert.equal(engine.positionOf(0).z, 0);
  const constrained = options().constrain({ ...viewport.orbit, yaw: 0.8, target: { x: 8, y: 9, z: 10 } });
  assert.deepEqual(constrained.target, { x: 8, y: 9, z: 0 }); assert.equal(constrained.yaw, 0);
  engine.fit(); engine.focus(1, 200); assert.equal(events.length, 0);
  engine.setData(input(), 1); engine.setCamera({ ...DEFAULT_ORBIT_CAMERA, yaw: 1 });
  assert.equal(viewport.orbit.yaw, 1); assert.equal(engine.positionOf(0).z, 3); engine.dispose();
});

test('primary pan opts in only for current 2d data while unset and explicit 3d retain orbit', async () => {
  const { engine, host, options } = harness();
  await engine.mount({}, host);
  const primaryPan = options().primaryPan;
  assert.equal(typeof primaryPan, 'function');
  assert.equal(primaryPan(), false, 'no data keeps the core default orbit');
  engine.setData(input(), 0);
  assert.equal(primaryPan(), false, 'unset mode keeps 3d orbit');
  engine.setData(input({ mode: '3d' }), 1);
  assert.equal(primaryPan(), false, 'explicit 3d keeps orbit');
  engine.setData(input({ mode: '2d' }), 2);
  assert.equal(primaryPan(), true, 'live 2d replacement enables primary pan');
  assert.throws(() => engine.setData(input({ mode: 'bad' }), 3));
  assert.equal(primaryPan(), true, 'rejected replacement preserves current gesture mode');
  engine.setData(input({ mode: '3d' }), 3);
  assert.equal(primaryPan(), false, 'same callback observes a return to 3d');
  engine.setData(input({ mode: '2d' }), 4);
  assert.equal(primaryPan(), true);
  assert.equal(options().primaryPan, primaryPan, 'data replacement does not remount the viewport');
  engine.dispose();
});

test('failed replacements preserve revision/resources and successful replacements dispose old resources', async () => {
  const { engine, viewport, host } = harness();
  engine.setData(input(), 0); await engine.mount({}, host);
  const geometry = viewport.world.children[0].geometry; let disposed = 0;
  geometry.addEventListener('dispose', () => disposed++);
  assert.throws(() => engine.setData(input({ positions: new Float32Array([20_000_000, 0, 0]) }), 1));
  assert.equal(disposed, 0); assert.equal(engine.positionOf(0).x, -10);
  engine.setData(input({ positions: new Float32Array([7, 8, 9]) }), 1); assert.equal(disposed, 1);
  engine.dispose(); engine.dispose(); assert.equal(viewport.disposed, true);
  assert.equal(viewport.world.children.length, 0); assert.equal(engine.positionOf(0), null);
});

test('segments and axes are bounded, visual-only and update their CSS-pixel width', async () => {
  const { engine, viewport, host } = harness();
  engine.setData(input({ segments: new Uint32Array([0, 1]), axes: [{ axis: 'x', min: -10, max: 10, ticks: [] }] }), 0);
  await engine.mount({}, host); viewport.tick(0);
  assert.equal(viewport.world.children.length, 3); assert.equal(viewport.pickWorld.children.length, 1);
  engine.setStyle({ ...DEFAULT_LYRA_3D_STYLE, lineWidth: 4 }); viewport.tick(1);
  assert.equal(viewport.world.children[1].material.uniforms.lineWidth.value, 4);
  assert.throws(() => engine.setData(input({ axes: [{ axis: 'x', min: 1, max: -1, ticks: [] }] }), 1));
  engine.dispose();
});

test('mount reentrancy cannot resurrect a disposed points engine', async () => {
  let engine; let released = 0;
  engine = createPointsEngine({ viewport(_container, host) { host.rendering({ software: false }); return { dispose() { released++; } }; } });
  await engine.mount({}, { hover() {}, pick() {}, lost() {}, camera() {}, rendering() { engine.dispose(); } });
  assert.equal(released, 1); await assert.rejects(engine.mount({}, {}));
});

test('one million point rows retain the last row pick identity without matrices or decimation', async () => {
  const { createPointBatch } = await import('../dist/points/batches.js');
  const admitted = admitPointsData({ positions: new Float32Array(1_000_000 * 3) });
  const batch = createPointBatch(admitted);
  assert.equal(batch.mesh.geometry.instanceCount, 1_000_000);
  assert.equal(batch.mesh.geometry.hasAttribute('instanceMatrix'), false);
  const colors = batch.mesh.geometry.getAttribute('pickColor').array;
  assert.equal(decodePickId(...[...colors.slice(-3)].map((channel) => Math.round(channel * 255))), 999_999);
  assert.throws(() => admitPointsData({ positions: new Float32Array(1_000_001 * 3) }));
  batch.dispose();
});

test('point ID-pass glyph size compensates for the one-pixel camera view', async () => {
  const { createPointBatch } = await import('../dist/points/batches.js');
  const { PerspectiveCamera } = await import('three');
  const batch = createPointBatch(admitPointsData(input()));
  batch.resize(640, 480);
  const camera = new PerspectiveCamera(); camera.setViewOffset(640, 480, 320, 240, 1, 1);
  batch.pick.onBeforeRender(null, null, camera);
  assert.equal(batch.pick.material.uniforms.viewportSize.value.x, 1);
  assert.equal(batch.pick.material.uniforms.viewportSize.value.y, 1);
  camera.clearViewOffset(); batch.pick.onBeforeRender(null, null, camera);
  assert.equal(batch.pick.material.uniforms.viewportSize.value.x, 640);
  batch.dispose();
});

test('fit includes admitted axes beyond the point cloud', async () => {
  const { engine, viewport, host } = harness();
  engine.setData(input({ axes: [{ axis: 'x', min: -1000, max: 1000, ticks: [] }] }), 0);
  await engine.mount({}, host); engine.fit(24);
  for (const x of [-1000, 1000]) {
    const point = viewport.project({ x, y: 0, z: 0 });
    assert.ok(point && point.x >= 24 && point.x <= viewport.width - 24);
  }
  engine.dispose();
});


test('context notifications preserve resources and disposed callbacks cannot reach the host', async () => {
  const { engine, viewport, host, callbacks, events } = harness();
  engine.setData(input(), 0); await engine.mount({}, host);
  const geometry = viewport.world.children[0].geometry;
  callbacks().lost('context-lost'); callbacks().restored();
  assert.equal(viewport.world.children[0].geometry, geometry);
  assert.deepEqual(events, ['lost', 'restored']);
  engine.dispose(); assert.equal(viewport.tick, undefined);
  callbacks().lost('context-lost'); callbacks().restored(); callbacks().camera(DEFAULT_ORBIT_CAMERA);
  assert.deepEqual(events, ['lost', 'restored']);
});


test('screen-expanded point and line quads survive mirrored world winding without splitting transparency passes', async () => {
  const { engine, viewport, host } = harness();
  engine.setData(input({ segments: new Uint32Array([0, 1]) }), 0); await engine.mount({}, host);
  viewport.world.scale.y = viewport.pickWorld.scale.y = -1;
  const points = viewport.world.children[0], lines = viewport.world.children[1], pick = viewport.pickWorld.children[0];
  for (const mesh of [points, lines, pick]) {
    assert.equal(mesh.material.side, DoubleSide); assert.equal(mesh.material.forceSinglePass, true);
  }
  const ids = pick.geometry.getAttribute('pickColor').array;
  assert.deepEqual([0, 1].map((row) => decodePickId(...Array.from(ids.slice(row * 3, row * 3 + 3), (v) => Math.round(v * 255)))), [0, 1]);
  engine.dispose();
});
