import assert from 'node:assert/strict';
import test from 'node:test';
import { Scene } from 'three';
import { DEFAULT_ORBIT_CAMERA, projectOrbitPoint } from '../dist/core/orbit.js';
import { resolveLyra3dStyle } from '../dist/core/style.js';
import { createPointsLabels, pointsAxes } from '../dist/points/axes.js';
import { admitPointsData } from '../dist/points/data.js';
import { createPointsEngine } from '../dist/points/engine.js';

const state = (extra = {}) => ({ selected: new Set(), dimmed: new Set(), hover: -1, focus: -1, ...extra });
const positions = (...rows) => new Float32Array(rows.flat());

test('point label and axis admission refuses non-text labels, wrong row counts, oversized text and too many axes', () => {
  const rows = positions([0, 0, 0], [1, 1, 1]);
  assert.throws(() => admitPointsData({ positions: rows, labels: ['a', 7] }), (error) => error instanceof TypeError && /plain strings/u.test(error.message));
  assert.throws(() => admitPointsData({ positions: rows, labels: ['a'] }), /label rows/u);
  assert.throws(() => admitPointsData({ positions: rows, labels: 'ab' }), /label rows/u);
  assert.throws(() => admitPointsData({ positions: rows, labels: new Array(2).fill('x'.repeat(2_200_000)) }), /label text/u);
  const axis = (name) => ({ axis: name, min: 0, max: 1, ticks: [] });
  assert.throws(() => admitPointsData({ positions: rows, axes: 'xyz' }), /axes/u);
  assert.throws(() => admitPointsData({ positions: rows, axes: [axis('x'), axis('y'), axis('z'), axis('x')] }), /axes/u);
  assert.equal(admitPointsData({ positions: rows, axes: [axis('x'), axis('y'), axis('z')] }).axes.length, 3);
  assert.equal(admitPointsData({ positions: rows, labels: ['a'.repeat(300), 'b'] }).labels[0].length, 256, 'long labels are cut, not refused');
});

test('three-dimensional axes include z and its grid planes', () => {
  const data = admitPointsData({ positions: new Float32Array(), axes: [
    { axis: 'x', min: 0, max: 2, grid: true, ticks: [{ value: 1, label: 'one' }] },
    { axis: 'z', min: -3, max: 3, label: 'depth', ticks: [{ value: 0, label: '' }] },
  ] });
  const axes = pointsAxes(data);
  assert.deepEqual([...axes.lines], [0, 0, 0, 2, 0, 0, 0, 0, -3, 0, 0, 3]);
  assert.deepEqual([...axes.grid], [1, 0, -3, 1, 0, 3], 'the x grid line runs along z');
  assert.deepEqual(axes.labels.map(({ text, position }) => [text, position.z]), [['one', 0], ['depth', 3]], 'empty tick labels are not drawn');
});

/** Labels over a stub viewport and a recording 2D context. */
function labelled(extra = {}, dataExtra = {}, axisLabels = []) {
  const texts = [];
  const context = { setTransform() {}, clearRect() { texts.length = 0; }, fillText(text, x, y) { texts.push({ text, x, y, alpha: context.globalAlpha }); }, globalAlpha: 1 };
  const canvas = { width: 0, height: 0, getContext: () => context };
  const viewport = {
    scene: new Scene(), orbit: DEFAULT_ORBIT_CAMERA, width: 400, height: 300, style: resolveLyra3dStyle(),
    project(point) { return projectOrbitPoint(point, this.orbit, this); }, ...extra,
  };
  const data = admitPointsData({ positions: positions([0, 0, 0], [60, 0, 0], [0, 40, 0]), labels: ['first', 'second', 'third'], ...dataExtra });
  return { texts, viewport, labels: createPointsLabels(viewport, data, axisLabels, () => canvas) };
}

test('focus and hover labels come first, dimmed rows fade and forced colors never fade', () => {
  const { texts, labels, viewport } = labelled();
  labels.update(state({ focus: 2, hover: 1, dimmed: new Set([0, 2]) }));
  assert.deepEqual(texts.map(({ text }) => text), ['third', 'second', 'first']);
  assert.deepEqual(texts.map(({ alpha }) => alpha), [0.3, 1, 0.3], 'only the dimmed rows fade');
  viewport.style = resolveLyra3dStyle({ forcedColors: true });
  labels.update(state({ focus: 2, hover: 1, dimmed: new Set([0, 2]) }));
  assert.deepEqual(texts.map(({ alpha }) => alpha), [1, 1, 1]);
  labels.update(state({ focus: 1, hover: 1 }));
  assert.deepEqual(texts.map(({ text }) => text), ['second', 'first', 'third'], 'a row that is both focused and hovered is drawn once');
  labels.dispose();
});

test('labels are placed beside their point, offset by its size, and skipped when hidden or out of view', () => {
  const { texts, labels, viewport } = labelled({}, { sizes: new Float32Array([10, 20, 0]) });
  labels.update(state());
  const first = viewport.project({ x: 0, y: 0, z: 0 });
  assert.equal(texts[0].x, first.x + 4 + 5, 'a 10px point puts its label 5px further out');
  const second = viewport.project({ x: 60, y: 0, z: 0 });
  assert.equal(texts[1].x, second.x + 4 + 10);
  assert.equal(texts[2].x, viewport.project({ x: 0, y: 40, z: 0 }).x + 4, 'a zero-size point has no offset');
  viewport.orbit = { ...DEFAULT_ORBIT_CAMERA, distance: 40 };
  labels.update(state());
  assert.ok(texts.every(({ x, y }) => x >= 0 && y >= 0 && x < 400 && y < 300), 'labels outside the view are not drawn');
  assert.ok(texts.length < 3);
  viewport.orbit = { ...DEFAULT_ORBIT_CAMERA, distance: 0.5, target: { x: 0, y: 0, z: -400 } };
  labels.update(state());
  assert.equal(texts.length, 0, 'labels behind the camera are not drawn');
  labels.dispose();
});

test('axis labels use the default point size offset and rows without labels are skipped', () => {
  const { texts, labels } = labelled({}, { labels: ['', 'second', ''] }, [{ position: { x: 0, y: 0, z: 0 }, text: '' }, { position: { x: 10, y: 0, z: 0 }, text: 'axis' }]);
  labels.update(state({ hover: 7, focus: -1 }));
  assert.deepEqual(texts.map(({ text }) => text), ['axis', 'second'], 'empty text and unknown rows are ignored');
  labels.dispose();
});

test('axis labels are drawn for data that has no row labels at all', () => {
  const { texts, labels } = labelled({}, { labels: undefined }, [{ position: { x: 10, y: 0, z: 0 }, text: 'axis' }]);
  labels.update(state({ focus: 0, hover: 1 }));
  assert.deepEqual(texts.map(({ text }) => text), ['axis']);
  labels.dispose();
});

test('an engine with nothing to label creates no overlay', () => {
  const unlabelled = labelled({}, { labels: undefined });
  assert.equal(unlabelled.viewport.scene.children.length, 0);
  assert.doesNotThrow(() => { unlabelled.labels.update(state()); unlabelled.labels.dispose(); });
});

test('a disposed points engine ignores every later call', async () => {
  const viewport = {
    canvas: {}, world: new Scene(), pickWorld: new Scene(), scene: new Scene(), width: 100, height: 100, orbit: DEFAULT_ORBIT_CAMERA, style: resolveLyra3dStyle(), lost: false, disposed: false,
    setOrbit() {}, setStyle() {}, invalidate() {}, onFrame() { return () => {}; }, resize() {}, project: () => null, pickAt: () => null, dispose() { this.disposed = true; },
  };
  const engine = createPointsEngine({ viewport: () => viewport });
  engine.setData({ positions: positions([0, 0, 0]) }, 1);
  await engine.mount({}, { hover() {}, pick() {}, camera() {}, lost() {} });
  engine.dispose();
  assert.equal(viewport.disposed, true);
  assert.doesNotThrow(() => {
    engine.resize(10, 10);
    engine.setStyle({});
    engine.setState(state());
    engine.setCamera(DEFAULT_ORBIT_CAMERA);
    engine.setData({ positions: positions([1, 1, 1]) }, 2);
  });
  assert.equal(engine.positionOf(0), null);
  assert.equal(engine.pick(1, 1), null);
  assert.equal(engine.project(0), null);
  assert.equal(engine.focus(0), null);
});
