import assert from 'node:assert/strict';
import test from 'node:test';
import { encodePickId } from '../dist/core/picking.js';
import { createGraphEngine } from '../dist/graph/engine.js';
import { createModelEngine } from '../dist/model/engine.js';
import { createPanoramaEngine } from '../dist/panorama/engine.js';
import { createEngine as createPointsEngine } from '../dist/points/index.js';
import { waitUntil } from './wait-until.mjs';
import { installFakeBrowser, pointerEvent } from './fake-browser.mjs';

/** A host that records everything an engine tells it. */
function hostRecorder() {
  const calls = { hover: [], pick: [], camera: [], lost: [], rendering: [], restored: 0, progress: [] };
  const host = {
    hover: (item) => calls.hover.push(item),
    pick: (item, modifiers) => calls.pick.push({ item, ...modifiers }),
    camera: (camera) => calls.camera.push(camera),
    lost: (reason, detail) => calls.lost.push({ reason, detail }),
    rendering: (info) => calls.rendering.push(info),
    restored: () => { calls.restored += 1; },
    progress: (done, total) => calls.progress.push([done, total]),
  };
  return { calls, host };
}

/** The pixel the fake GPU reports for the item with this index. */
const idPixel = (item) => [...encodePickId(item), 255];
const press = (canvas, x, y, extra = {}) => canvas.dispatchEvent(pointerEvent('pointerdown', { clientX: x, clientY: y, ...extra }));
const move = (canvas, x, y) => canvas.dispatchEvent(pointerEvent('pointermove', { clientX: x, clientY: y }));
const release = (canvas, x, y) => canvas.dispatchEvent(pointerEvent('pointerup', { clientX: x, clientY: y }));
const close = (actual, expected, epsilon = 1e-9) => assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} is not within ${epsilon} of ${expected}`);

function recordingGraphEngine() {
  const tasks = [];
  const engine = createGraphEngine({
    task(options) {
      const task = { options, stopped: false, mode: 'main-thread', stop() { this.stopped = true; }, update() {} };
      tasks.push(task);
      return task;
    },
  });
  return { engine, tasks };
}

test('the graph engine relays viewport events, lets edges pick through the viewport and restarts layout on a restored context', async (t) => {
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'warn', () => {});
  const browser = installFakeBrowser();
  t.after(() => browser.restore());
  const { engine, tasks } = recordingGraphEngine();
  const { calls, host } = hostRecorder();
  engine.setData({ nodeCount: 2, positions: new Float32Array([-60, 0, 0, 60, 0, 0]), source: new Uint32Array([0]), target: new Uint32Array([1]) }, 1);
  await engine.mount(browser.container, host);
  engine.resize(400, 300);
  const { canvas, gl } = browser;
  gl.pixel = idPixel(0);
  move(canvas, 120, 150);
  browser.flushFrames();
  assert.deepEqual(calls.hover, [0], 'hover reaches the host');
  // Item 2 is the edge: the graph does not claim it, so the viewport activates it.
  gl.pixel = idPixel(2);
  press(canvas, 200, 150);
  release(canvas, 200, 150);
  assert.deepEqual(calls.pick.map(({ item }) => item), [2]);
  gl.pixel = [0, 0, 0, 0];
  press(canvas, 10, 10);
  move(canvas, 60, 10);
  release(canvas, 60, 10);
  browser.flushFrames();
  assert.equal(calls.camera.length, 1, 'a background drag orbits and reports once per frame');
  gl.pixel = idPixel(1);
  assert.equal(engine.pick(5, 5), 1);
  engine.setStyle({ background: 'rgb(255, 0, 0)' });
  browser.flushFrames();
  const [, red, green] = gl.callsOf('clearColor').at(-1);
  close(red, 1);
  close(green, 0);
  const first = tasks.at(-1);
  gl.lose();
  canvas.dispatchEvent(new Event('webglcontextlost'));
  assert.equal(first.stopped, true, 'layout stops with the context');
  assert.deepEqual(calls.lost, [{ reason: 'context-lost', detail: undefined }]);
  gl.lost = false;
  canvas.dispatchEvent(new Event('webglcontextrestored'));
  assert.equal(tasks.length, 2, 'a new layout task starts on the restored context');
  assert.equal(calls.restored, 1);
  engine.dispose();
  assert.equal(tasks.at(-1).stopped, true);
});

test('the graph engine lays out in a module worker next to its own module and reports a failing worker', async (t) => {
  const browser = installFakeBrowser();
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  const workers = [];
  class FakeWorker {
    posted = []; listeners = new Map(); terminated = 0;
    constructor(url, options) { this.url = url; this.options = options; workers.push(this); }
    addEventListener(type, listener) { this.listeners.set(type, listener); }
    postMessage(message) { this.posted.push(message); }
    terminate() { this.terminated += 1; }
    emit(type, event) { this.listeners.get(type)(event); }
  }
  Object.defineProperty(globalThis, 'Worker', { configurable: true, writable: true, value: FakeWorker });
  t.after(() => {
    browser.restore();
    if (previous) Object.defineProperty(globalThis, 'Worker', previous);
    else delete globalThis.Worker;
  });
  const engine = createGraphEngine();
  const { calls, host } = hostRecorder();
  engine.setData({ nodeCount: 2, source: new Uint32Array([0]), target: new Uint32Array([1]) }, 1);
  await engine.mount(browser.container, host);
  const [worker] = workers;
  assert.ok(worker.url.pathname.endsWith('/graph/layout.worker.js'), worker.url.href);
  assert.deepEqual(worker.options, { type: 'module' });
  assert.equal(worker.posted[0].type, 'start');
  assert.equal(worker.posted[0].input.type, 'start');
  worker.emit('message', { data: { type: 'output', output: { positions: new Float32Array([1, 2, 3, 4, 5, 6]), epoch: 0, iteration: 1, alpha: 1, maxSpeed: 1 }, done: false } });
  assert.deepEqual(engine.positionOf(1), { x: 4, y: 5, z: 6 });
  assert.equal(worker.posted.at(-1).type, 'ack');
  worker.emit('message', { data: { type: 'error', message: 'layout diverged' } });
  assert.deepEqual(calls.lost, [{ reason: 'error', detail: 'Graph layout failed' }]);
  assert.equal(worker.terminated, 1, 'a failed layout is terminated');
  engine.dispose();
});

test('the points engine relays hover, picks, camera moves and projections and labels with its own canvas', async (t) => {
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'warn', () => {});
  const browser = installFakeBrowser({ context2d: true });
  t.after(() => browser.restore());
  const engine = createPointsEngine();
  const { calls, host } = hostRecorder();
  const axis = { axis: 'x', min: -100, max: 100, label: 'distance', ticks: [{ value: 0, label: 'zero' }] };
  engine.setData({ positions: new Float32Array([-50, 0, 0, 0, 0, 0, 50, 0, 0]), labels: ['left', 'middle', 'right'], axes: [axis] }, 1);
  await engine.mount(browser.container, host);
  engine.resize(400, 300);
  const { canvas, gl } = browser;
  gl.pixel = idPixel(1);
  move(canvas, 200, 150);
  browser.flushFrames();
  assert.deepEqual(calls.hover, [1]);
  press(canvas, 200, 150);
  release(canvas, 200, 150);
  assert.deepEqual(calls.pick.map(({ item }) => item), [1]);
  gl.pixel = [0, 0, 0, 0];
  press(canvas, 10, 10);
  move(canvas, 80, 10);
  release(canvas, 80, 10);
  browser.flushFrames();
  assert.equal(calls.camera.length, 1);
  const projected = engine.project(1);
  assert.ok(projected && Number.isFinite(projected.x) && Number.isFinite(projected.y), 'a row projects to screen coordinates');
  assert.equal(engine.project(99), null);
  assert.equal(engine.project(-1), null);
  const labels = browser.canvases.at(-1).drawing.calls.filter(([name]) => name === 'fillText').map(([, text]) => text);
  for (const text of ['left', 'middle', 'right', 'distance', 'zero']) assert.ok(labels.includes(text), `${text} is drawn`);
  gl.lose();
  canvas.dispatchEvent(new Event('webglcontextlost'));
  gl.lost = false;
  canvas.dispatchEvent(new Event('webglcontextrestored'));
  assert.equal(calls.restored, 1);
  engine.dispose();
});

test('point labels are dropped quietly when a 2D canvas is not available and the spare canvas is released', async (t) => {
  const browser = installFakeBrowser();
  t.after(() => browser.restore());
  const engine = createPointsEngine();
  const { host } = hostRecorder();
  engine.setData({ positions: new Float32Array([0, 0, 0]), labels: ['only'], axes: [{ axis: 'y', min: 0, max: 1, label: 'height', ticks: [] }] }, 1);
  await engine.mount(browser.container, host);
  engine.resize(200, 100);
  assert.doesNotThrow(() => browser.flushFrames());
  const spare = browser.canvases.at(-1);
  spare.width = spare.height = 64;
  engine.dispose();
  assert.deepEqual([spare.width, spare.height], [1, 1]);
});

test('the panorama engine relays pointer events as hotspot picks and camera moves and repaints on style and state changes', async (t) => {
  const browser = installFakeBrowser();
  t.after(() => browser.restore());
  const image = { width: 4, height: 2 };
  const engine = createPanoramaEngine({
    inspectMedia: (source) => ({ kind: 'image', element: source.image, width: 4, height: 2 }),
    probe() {},
  });
  const { calls, host } = hostRecorder();
  engine.setData({ source: { kind: 'image', image }, hotspotAngles: new Float32Array([0, 0, 0.5, 0.2]) }, 1);
  await engine.mount(browser.container, host);
  engine.resize(400, 300);
  const { canvas, gl } = browser;
  gl.pixel = idPixel(1);
  move(canvas, 200, 150);
  browser.flushFrames();
  assert.deepEqual(calls.hover, [1]);
  press(canvas, 200, 150);
  release(canvas, 200, 150);
  assert.deepEqual(calls.pick.map(({ item }) => item), [1]);
  gl.pixel = [0, 0, 0, 0];
  press(canvas, 10, 10);
  move(canvas, 90, 40);
  release(canvas, 90, 40);
  browser.flushFrames();
  assert.equal(calls.camera.length, 1);
  assert.deepEqual(Object.keys(calls.camera[0]).sort(), ['fieldOfView', 'pitch', 'yaw'], 'the panorama camera is reported in its own terms');
  engine.setStyle({ background: 'rgb(0, 0, 255)' });
  assert.equal(browser.pendingFrames(), 1, 'a style change schedules a repaint');
  browser.flushFrames();
  const [, red, green, blue] = gl.callsOf('clearColor').at(-1);
  [red, green, blue].forEach((value, channel) => close(value, [0, 0, 1][channel]));
  engine.setState({ selected: new Set([0]), dimmed: new Set([1]), hover: -1, focus: -1 });
  assert.equal(browser.pendingFrames(), 1, 'a state change schedules a repaint');
  engine.dispose();
});

const OBJ_TRIANGLE = 'v -10 -10 0\nv 10 -10 0\nv 0 10 0\nf 1 2 3\n';

test('the model engine picks drawables by ray, relays hover and camera moves and reports parse progress', async (t) => {
  const browser = installFakeBrowser();
  t.after(() => browser.restore());
  const engine = createModelEngine();
  const { calls, host } = hostRecorder();
  await engine.mount(browser.container, host);
  engine.resize(400, 300);
  engine.setData({ bytes: new TextEncoder().encode(OBJ_TRIANGLE), format: 'obj' }, 1);
  await waitUntil(() => engine.positionOf(0) !== null, 'the model to install');
  assert.deepEqual(calls.progress.at(-1), [OBJ_TRIANGLE.length, OBJ_TRIANGLE.length]);
  const { canvas } = browser;
  const center = engine.project(0);
  assert.ok(center, 'the model projects');
  assert.equal(engine.pick(center.x, center.y), 0, 'the ray hits the triangle');
  assert.equal(engine.pick(5, 5), null, 'the corner of the view is empty');
  move(canvas, center.x, center.y);
  browser.flushFrames();
  assert.deepEqual(calls.hover, [0]);
  press(canvas, center.x, center.y);
  release(canvas, center.x, center.y);
  assert.deepEqual(calls.pick.map(({ item }) => item), [0]);
  press(canvas, 5, 5);
  move(canvas, 60, 5);
  release(canvas, 60, 5);
  browser.flushFrames();
  assert.equal(calls.camera.length, 1);
  engine.dispose();
});
