import assert from 'node:assert/strict';
import test from 'node:test';
import { Scene } from 'three';
import { admitPointsData } from '../dist/points/data.js';
import { pointsAxes, createPointsLabels } from '../dist/points/axes.js';
import { DEFAULT_ORBIT_CAMERA, projectOrbitPoint } from '../dist/core/orbit.js';
import { resolveLyra3dStyle } from '../dist/core/style.js';

const state = { selected: new Set(), dimmed: new Set(), hover: -1, focus: -1 };
test('axes use supplied labels and bounded coordinates, and 2d omits z-axis geometry', () => {
  const data = admitPointsData({ positions: new Float32Array(), mode: '2d', axes: [
    { axis: 'x', min: -10, max: 10, label: 'Distance (m)', grid: true, ticks: [{ value: 0, label: 'zero' }] },
    { axis: 'y', min: -5, max: 5, ticks: [] },
    { axis: 'z', min: 1, max: 2, label: 'Hidden', ticks: [] },
  ] });
  const axes = pointsAxes(data);
  assert.equal(axes.lines.length, 12); assert.equal(axes.grid.length, 6);
  assert.deepEqual(axes.labels.map((entry) => entry.text), ['Distance (m)', 'zero']);
  assert.deepEqual([...axes.grid], [0, -5, 0, 0, 5, 0]);
  assert.throws(() => admitPointsData({ positions: new Float32Array(), axes: [{ axis: 'x', min: 0, max: 1, ticks: [{ value: 2, label: 'bad' }] }] }));
  assert.throws(() => admitPointsData({ positions: new Float32Array(), axes: [{ axis: 'x', min: 0, max: 1, ticks: Array.from({ length: 129 }, () => ({ value: 0, label: 'zero' })) }] }));
});

test('plain point/axis text shares one capped texture with caching and resource disposal', () => {
  const calls = [];
  const context = { setTransform() {}, clearRect() { calls.length = 0; }, fillText(...args) { calls.push(args); } };
  const canvas = { width: 0, height: 0, getContext: () => context };
  const viewport = { scene: new Scene(), orbit: DEFAULT_ORBIT_CAMERA, width: 640, height: 480, style: resolveLyra3dStyle(), project(point) { return projectOrbitPoint(point, this.orbit, this); } };
  const data = admitPointsData({ positions: new Float32Array(300 * 3), labels: Array.from({ length: 300 }, () => '<b>Plain</b>'), axes: [{ axis: 'x', min: -10, max: 10, label: 'Length (m)', ticks: [] }] });
  const labels = createPointsLabels(viewport, data, pointsAxes(data).labels, () => canvas);
  labels.update(state);
  assert.equal(viewport.scene.children.length, 1); assert.equal(calls.length, 256);
  assert.equal(calls[0][0], 'Length (m)'); assert.equal(calls[1][0], '<b>Plain</b>');
  const texture = viewport.scene.children[0].material.uniforms.labels.value;
  const version = texture.version; labels.update(state); assert.equal(texture.version, version);
  viewport.width = 5000; viewport.height = 5000; labels.update(state);
  assert.ok(canvas.width <= 2048 && canvas.height <= 2048);
  let disposed = 0; texture.addEventListener('dispose', () => disposed++);
  labels.dispose(); assert.equal(disposed, 1); assert.equal(canvas.width, 1); assert.equal(viewport.scene.children.length, 0);
});
