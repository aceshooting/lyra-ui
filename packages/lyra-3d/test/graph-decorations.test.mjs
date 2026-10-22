import assert from 'node:assert/strict';
import test from 'node:test';
import { Color, Group, Matrix4, Scene, Vector3 } from 'three';
import { admitGraphDecorations, createGraphDecorations, graphItemColor } from '../dist/graph/decorations.js';
import { DEFAULT_ORBIT_CAMERA, projectOrbitPoint } from '../dist/core/orbit.js';
import { DEFAULT_LYRA_3D_STYLE, resolveLyra3dStyle } from '../dist/core/style.js';
import { decodePickId } from '../dist/core/picking.js';

const emptyState = () => ({ selected: new Set(), dimmed: new Set(), hover: -1, focus: -1 });
function fixture(extra = {}, nodes = 2, edgeCount = 1) {
  const calls = [];
  const context = { setTransform() {}, clearRect() { calls.length = 0; }, fillText(...args) { calls.push(args); } };
  const canvas = { width: 0, height: 0, getContext: () => context };
  const viewport = { world: new Group(), pickWorld: new Group(), scene: new Scene(), width: 640, height: 480,
    orbit: DEFAULT_ORBIT_CAMERA, style: resolveLyra3dStyle(), project(point) { return projectOrbitPoint(point, this.orbit, this); } };
  const data = { nodeCount: nodes, source: new Uint32Array(edgeCount), target: new Uint32Array(edgeCount).fill(1), ...admitGraphDecorations(extra, nodes, edgeCount) };
  const decorations = createGraphDecorations(viewport, data, () => canvas);
  const frame = { positionOf: (item) => ({ x: item === 0 ? -100 : 100, y: 0, z: 0 }), state: emptyState(), fittedDistance: 500, revision: 0, time: 0 };
  return { viewport, data, decorations, frame, canvas, context, calls };
}

test('decoration admission bounds text and particle options atomically and copies directed masks', () => {
  const mask = new Uint8Array([1]);
  const labels = ['a'.repeat(300), '<b>plain</b>'];
  const admitted = admitGraphDecorations({ labels, directed: mask }, 2, 1);
  mask[0] = 0; labels[1] = 'changed';
  assert.equal(admitted.directed[0], 1); assert.equal(admitted.labels[0].length, 256);
  assert.equal(admitted.labels[1], '<b>plain</b>');
  for (const value of [-1, 9, 1.5, NaN, Infinity]) assert.throws(() => admitGraphDecorations({ particlesPerEdge: value }, 0, 0));
  assert.throws(() => admitGraphDecorations({ labels: new Array(2) }, 2, 0));
  assert.throws(() => admitGraphDecorations({ directed: new Uint8Array([2]) }, 2, 1));
  assert.throws(() => admitGraphDecorations({ labels: ['x'.repeat(4 * 1024 * 1024 + 1)] }, 1, 0));
});

test('arrows terminate at target radius and reuse edge picking indices without particle pick IDs', () => {
  const { decorations, viewport, frame } = fixture({ directed: new Uint8Array([1]), particlesPerEdge: 2 });
  decorations.update(frame);
  assert.equal(viewport.world.children.length, 2); assert.equal(viewport.pickWorld.children.length, 1);
  const arrow = viewport.world.children[0]; const pick = viewport.pickWorld.children[0];
  const color = new Color(); pick.getColorAt(0, color);
  assert.equal(decodePickId(Math.round(color.r * 255), Math.round(color.g * 255), Math.round(color.b * 255)), 2);
  const matrix = new Matrix4(); arrow.getMatrixAt(0, matrix);
  const tip = new Vector3(0, 0.5, 0).applyMatrix4(matrix);
  const expected = 100 - viewport.style.pointSize / (2 * viewport.project({ x: 100, y: 0, z: 0 }).scale);
  assert.ok(Math.abs(tip.x - expected) < 0.001); assert.ok(Math.abs(tip.y) < 0.001);
  assert.deepEqual(pick.instanceMatrix.array, arrow.instanceMatrix.array);
  const version = arrow.instanceMatrix.version;
  decorations.update({ ...frame, time: 100 });
  assert.equal(arrow.instanceMatrix.version, version);
  decorations.update({ ...frame, revision: 1, time: 200 });
  assert.ok(arrow.instanceMatrix.version > version);
  viewport.style = resolveLyra3dStyle({ ...DEFAULT_LYRA_3D_STYLE, lineWidth: 0 });
  decorations.update(frame); arrow.getMatrixAt(0, matrix);
  assert.equal(new Vector3().setFromMatrixScale(matrix).length(), 0);
  decorations.dispose();
  assert.equal(viewport.world.children.length, 0); assert.equal(viewport.pickWorld.children.length, 0);
});

test('labels are plain text on one bounded texture, cached between particle frames and honor zoom gates', () => {
  const { decorations, viewport, frame, canvas, calls } = fixture({ labels: ['<img onerror=alert(1)>', 'second'], edgeLabels: ['edge'], withEdgeLabels: true });
  decorations.update(frame);
  assert.equal(viewport.scene.children.length, 1); assert.equal(calls.length, 3);
  assert.equal(calls[0][0], '<img onerror=alert(1)>');
  const texture = viewport.scene.children[0].material.uniforms.labels.value;
  const version = texture.version;
  decorations.update({ ...frame, time: 100 }); assert.equal(texture.version, version);
  viewport.orbit = { ...DEFAULT_ORBIT_CAMERA, distance: 2000 };
  decorations.update(frame); assert.equal(calls.length, 0);
  viewport.width = 10_000; viewport.height = 5000;
  decorations.update(frame); assert.ok(canvas.width <= 2048 && canvas.height <= 2048);
  let disposed = 0; texture.addEventListener('dispose', () => disposed++);
  decorations.dispose(); assert.equal(disposed, 1); assert.equal(canvas.width, 1); assert.equal(viewport.scene.children.length, 0);
});

test('label budget prioritizes focus while particles remain globally bounded', () => {
  const { decorations, viewport, frame, calls } = fixture({ labels: Array.from({ length: 300 }, (_, i) => `Node ${i}`), nodeLabels: 'always', particlesPerEdge: 8 }, 300, 3000);
  frame.state.focus = 299;
  decorations.update(frame);
  assert.equal(calls.length, 256); assert.equal(calls[0][0], 'Node 299');
  assert.equal(viewport.world.children[0].count, 16_384);
  decorations.dispose();
});

test('particles advance source to target and motion preferences suppress both geometry and scheduling', () => {
  const { decorations, viewport, frame } = fixture({ particlesPerEdge: 2, particleSpeed: 1 });
  assert.equal(decorations.update(frame), true);
  const particles = viewport.world.children[0]; const matrix = new Matrix4();
  particles.getMatrixAt(0, matrix); const before = new Vector3().setFromMatrixPosition(matrix).x;
  decorations.update({ ...frame, time: 100 });
  particles.getMatrixAt(0, matrix); assert.ok(new Vector3().setFromMatrixPosition(matrix).x > before);
  for (const preference of ['reducedMotion', 'forcedColors']) {
    viewport.style = resolveLyra3dStyle({ ...DEFAULT_LYRA_3D_STYLE, [preference]: true });
    assert.equal(decorations.update({ ...frame, time: 200 }), false); assert.equal(particles.visible, false);
  }
  const style = viewport.style;
  const state = { ...emptyState(), dimmed: new Set([0]) };
  assert.deepEqual(graphItemColor(style, state, 0, style.palette[0]), graphItemColor(style, emptyState(), 0, style.foreground));
  decorations.dispose();
});
