import assert from 'node:assert/strict';
import test from 'node:test';
import { Group, Scene } from 'three';
import { DEFAULT_ORBIT_CAMERA, projectOrbitPoint } from '../dist/core/orbit.js';
import { resolveLyra3dStyle } from '../dist/core/style.js';
import { createGraphDecorations } from '../dist/graph/decorations.js';
import { createGraphEngine } from '../dist/graph/engine.js';
import { installFakeBrowser } from './fake-browser.mjs';

const inertTask = () => ({ mode: 'main-thread', stop() {}, update() {} });
const host = () => ({ hover() {}, pick() {}, camera() {}, lost() {} });
const texts = (canvas) => canvas.drawing.calls.filter(([name]) => name === 'fillText').map(([, text, x, y]) => ({ text, x, y }));

test('spatial labels and parameter-speed particles share the curved world path', (t) => {
  const browser = installFakeBrowser({ context2d: true }); t.after(() => browser.restore());
  const viewport = {
    canvas: browser.canvases[0], world: new Group(), pickWorld: new Group(), scene: new Scene(), width: 640, height: 480,
    orbit: { ...DEFAULT_ORBIT_CAMERA, yaw: 0.6, pitch: 0.3 }, style: resolveLyra3dStyle(),
    project(point) { return projectOrbitPoint(point, this.orbit, this); },
  };
  const canvas = globalThis.document.createElement('canvas');
  const data = { nodeCount: 2, source: new Uint32Array([0]), target: new Uint32Array([1]), spatialAppearance: { edgeCurvatures: new Float32Array([0.5]) }, edgeLabels: ['curve'], withEdgeLabels: true, edgeLabelMinZoom: 0.001, particlesPerEdge: 2, particleSpeed: 0 };
  const decorations = createGraphDecorations(viewport, data, () => canvas);
  decorations.update({ positionOf: row => ({ x: row * 100, y: 0, z: 0 }), state: { selected: new Set(), dimmed: new Set(), hover: -1, focus: -1 }, fittedDistance: 500, revision: 0, time: 0 });
  const label = texts(canvas).find(value => value.text === 'curve');
  const expected = viewport.project({ x: 50, y: 0, z: 50 });
  assert.ok(label); assert.ok(Math.abs(label.x - expected.x) < 1e-6); assert.ok(Math.abs(label.y - (expected.y - viewport.style.fontSize)) < 1e-6);
  const particles = viewport.world.children.find(mesh => mesh.count === 2);
  assert.ok(particles); assert.equal(particles.instanceMatrix.array[16 + 12], 50); assert.equal(particles.instanceMatrix.array[16 + 14], 50);
  decorations.dispose();
});

test('graph labels are drawn on an overlay canvas made by the viewport\'s own document', async (t) => {
  const browser = installFakeBrowser({ context2d: true });
  t.after(() => browser.restore());
  const engine = createGraphEngine({ task: inertTask });
  engine.setData({
    nodeCount: 2, positions: new Float32Array([-80, 0, 0, 80, 0, 0]), source: new Uint32Array([0]), target: new Uint32Array([1]),
    labels: ['left', 'right'], edgeLabels: ['link'], nodeLabels: 'always', withEdgeLabels: true, edgeLabelMinZoom: 0.001,
  }, 1);
  await engine.mount(browser.container, host());
  engine.resize(400, 300);
  engine.fit();
  browser.flushFrames();
  const drawn = texts(browser.canvases.at(-1));
  assert.deepEqual(drawn.map(({ text }) => text).sort(), ['left', 'link', 'right']);
  const left = engine.project(0);
  const label = drawn.find(({ text }) => text === 'left');
  assert.ok(label.x > left.x && Math.abs(label.y - left.y) < 1e-9, 'a node label sits to the right of its node');
  const link = drawn.find(({ text }) => text === 'link');
  const middle = (engine.project(0).x + engine.project(1).x) / 2;
  assert.ok(Math.abs(link.x - middle) < 1e-6, 'an edge label sits above the middle of its edge');
  engine.dispose();
});

test('only edge labels still create an overlay, and hidden edge labels are not drawn', async (t) => {
  const browser = installFakeBrowser({ context2d: true });
  t.after(() => browser.restore());
  const engine = createGraphEngine({ task: inertTask });
  engine.setData({
    nodeCount: 2, positions: new Float32Array([-80, 0, 0, 80, 0, 0]), source: new Uint32Array([0]), target: new Uint32Array([1]),
    edgeLabels: ['link'], withEdgeLabels: false,
  }, 1);
  await engine.mount(browser.container, host());
  engine.resize(400, 300);
  browser.flushFrames();
  assert.deepEqual(texts(browser.canvases.at(-1)), [], 'edge labels need withEdgeLabels');
  engine.dispose();
});

test('a layout task created while the engine is being disposed is stopped immediately', async (t) => {
  const browser = installFakeBrowser();
  t.after(() => browser.restore());
  const stops = [];
  let engine;
  engine = createGraphEngine({
    task() {
      engine.dispose();
      return { mode: 'main-thread', stop: () => stops.push('stopped'), update() {} };
    },
  });
  engine.setData({ nodeCount: 2, source: new Uint32Array([0]), target: new Uint32Array([1]) }, 1);
  await engine.mount(browser.container, host());
  assert.deepEqual(stops, ['stopped']);
});

test('decorations without particle settings add no particle mesh and report no animation', () => {
  const viewport = {
    world: new Group(), pickWorld: new Group(), scene: new Scene(), width: 400, height: 300, orbit: DEFAULT_ORBIT_CAMERA, style: resolveLyra3dStyle(),
    project(point) { return projectOrbitPoint(point, this.orbit, this); },
  };
  const data = { nodeCount: 2, source: new Uint32Array([0]), target: new Uint32Array([1]) };
  const decorations = createGraphDecorations(viewport, data);
  assert.equal(viewport.world.children.length, 0);
  const animating = decorations.update({ positionOf: (item) => ({ x: item * 50, y: 0, z: 0 }), state: { selected: new Set(), dimmed: new Set(), hover: -1, focus: -1 }, fittedDistance: 500, revision: 0, time: 0 });
  assert.equal(animating, false);
  decorations.dispose();
});
