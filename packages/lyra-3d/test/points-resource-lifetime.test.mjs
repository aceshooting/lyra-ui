import assert from 'node:assert/strict';
import test from 'node:test';
import { createPointsEngine } from '../dist/points/engine.js';
import { createLyra3dViewport } from '../dist/core/viewport.js';
import { DEFAULT_LYRA_3D_STYLE } from '../dist/core/style.js';
import { encodePickId } from '../dist/core/picking.js';
import { FakeCanvas, installFakeBrowser, pointerEvent } from './fake-browser.mjs';

const data = (extra = {}) => ({ positions: new Float32Array([-10, 0, 0, 10, 4, 2]),
  segments: new Uint32Array([0, 1]), axes: [
    { axis: 'x', min: -12, max: 12, ticks: [{ value: 0, label: '' }], grid: true },
    { axis: 'y', min: -6, max: 6, ticks: [{ value: 0, label: '' }], grid: true },
  ], ...extra });
const draws = gl => gl.callsOf('drawElements').length + gl.callsOf('drawArrays').length
  + gl.callsOf('drawElementsInstanced').length + gl.callsOf('drawArraysInstanced').length;

async function fixture(options = {}) {
  const browser = installFakeBrowser(), callbacks = [], order = [], restores = [];
  const labelCanvas = new FakeCanvas({ context2d: true }); let viewport, engine;
  const close = () => {
    for (const restore of restores.reverse()) restore();
    try { engine?.dispose(); } finally {
      try {
        for (const scene of [viewport?.scene, viewport?.pickScene]) scene?.traverse(object => {
          object.geometry?.dispose();
          for (const material of Array.isArray(object.material) ? object.material : object.material ? [object.material] : []) {
            material.uniforms?.labels?.value?.dispose(); material.dispose();
          }
        });
        viewport?.dispose();
      } finally { browser.restore(); }
    }
  };
  try {
    engine = createPointsEngine({ labelCanvas: () => labelCanvas,
      viewport(container, host, services) {
        viewport = createLyra3dViewport(container, host, services);
        const onFrame = viewport.onFrame.bind(viewport);
        viewport.onFrame = callback => { const remove = onFrame(callback); return () => { order.push('unframe'); remove(); }; };
        return viewport;
      },
    });
    engine.setData(data(options), 0);
    const host = Object.fromEntries(['hover', 'pick', 'camera', 'lost', 'restored', 'rendering'].map(name => [name, (...args) => callbacks.push([name, ...args])]));
    await engine.mount(browser.container, host); engine.resize(640, 480); browser.flushFrames();
    return { browser, engine, viewport, labelCanvas, callbacks, order, restores, close, gl: browser.gl };
  } catch (error) { close(); throw error; }
}
function watch(f, resource, name, failure) {
  const dispose = resource.dispose;
  resource.dispose = function (...args) { f.order.push(name); const result = dispose.apply(this, args); if (failure) throw failure; return result; };
  f.restores.push(() => { resource.dispose = dispose; });
}
function owned(viewport) {
  const point = viewport.world.children.find(mesh => mesh.geometry?.getAttribute('pointPosition'));
  const lines = viewport.world.children.filter(mesh => mesh.geometry?.getAttribute('lineStart'));
  const label = viewport.scene.children.find(mesh => mesh.material?.uniforms?.labels);
  return { point, lines, label };
}

test('real points replacement retires previous resources once and invalid data preserves revision and current resources', async () => {
  const f = await fixture();
  try {
    const old = owned(f.viewport), oldResources = [old.point.geometry, old.point.material, f.viewport.pickWorld.children[0].material,
      ...old.lines.flatMap(line => [line.geometry, line.material])];
    oldResources.forEach((resource, index) => watch(f, resource, `old:${index}`));
    const before = draws(f.gl);
    f.engine.setData(data({ positions: new Float32Array([-3, 2, 1, 4, 5, 6]) }), 1); f.browser.flushFrames();
    oldResources.forEach((_resource, index) => assert.equal(f.order.filter(value => value === `old:${index}`).length, 1));
    const current = owned(f.viewport); assert.notEqual(current.point.geometry, old.point.geometry);
    assert.ok(draws(f.gl) > before); const snapshot = f.order.slice();
    assert.throws(() => f.engine.setData(data({ positions: new Float32Array([NaN, 0, 0]) }), 2), RangeError);
    assert.equal(owned(f.viewport).point.geometry, current.point.geometry); assert.deepEqual(f.order, snapshot);
    assert.deepEqual(f.engine.positionOf(0), { x: -3, y: 2, z: 1 });
    f.engine.setData(data({ positions: new Float32Array([1, 2, 3, 4, 5, 6]) }), 2);
    f.browser.flushFrames(); assert.deepEqual(f.engine.positionOf(0), { x: 1, y: 2, z: 3 });
    f.engine.dispose();
    oldResources.forEach((_resource, index) => assert.equal(f.order.filter(value => value === `old:${index}`).length, 1));
  } finally { f.close(); }
});

test('real points disposal independently completes labels batches lines and viewport despite first cleanup failure', async () => {
  for (const first of ['label', 'batch']) {
    const f = await fixture({ labels: ['first', 'second'] });
    try {
      const resources = owned(f.viewport), failure = new Error(`Controlled ${first} cleanup failure`);
      assert.ok(resources.label); assert.ok(resources.lines.length >= 2);
      let labelWidth = f.labelCanvas.width;
      Object.defineProperty(f.labelCanvas, 'width', { configurable: true, get: () => labelWidth, set(value) {
        labelWidth = value;
        if (value === 1) { f.order.push('labels'); if (first === 'label') throw failure; }
      } });
      f.restores.push(() => Object.defineProperty(f.labelCanvas, 'width', { configurable: true, writable: true, value: labelWidth }));
      watch(f, resources.point.geometry, 'points', first === 'batch' ? failure : undefined);
      resources.lines.forEach((line, index) => watch(f, line.geometry, `line:${index}`));
      const viewportDispose = f.viewport.dispose;
      f.viewport.dispose = () => { f.order.push('viewport'); return viewportDispose(); };
      f.restores.push(() => { f.viewport.dispose = viewportDispose; });
      const contextRequests = f.gl.loseContextCalls ?? 0;
      assert.throws(() => f.engine.dispose(), error => error === failure);
      assert.deepEqual(f.order, ['unframe', 'labels', 'points', ...resources.lines.map((_line, index) => `line:${index}`), 'viewport']);
      assert.equal(f.gl.loseContextCalls, contextRequests + 1); assert.equal(f.browser.container.children.length, 0);
      assert.equal(f.engine.positionOf(0), null); assert.equal(f.browser.pendingFrames(), 0);
      const beforeDraws = draws(f.gl), beforeCallbacks = f.callbacks.length, beforeOrder = f.order.slice();
      f.viewport.canvas.dispatchEvent(pointerEvent('pointermove'));
      f.viewport.canvas.dispatchEvent(new Event('webglcontextrestored'));
      f.engine.resize(800, 600); f.engine.setStyle(DEFAULT_LYRA_3D_STYLE);
      f.engine.setState({ selected: new Set([0]), dimmed: new Set(), hover: 0, focus: 0 });
      f.engine.dispose(); f.browser.flushFrames();
      assert.equal(draws(f.gl), beforeDraws); assert.equal(f.callbacks.length, beforeCallbacks); assert.deepEqual(f.order, beforeOrder);
    } finally { f.close(); }
  }
});

test('real inline points remain renderable pickable and updateable in 2D and 3D with XR unset', async () => {
  for (const mode of ['2d', '3d']) {
    const f = await fixture({ mode });
    try {
      const before = draws(f.gl); const geometry = owned(f.viewport).point.geometry;
      f.engine.setState({ selected: new Set([1]), dimmed: new Set([0]), hover: -1, focus: 1 });
      f.engine.setStyle({ ...DEFAULT_LYRA_3D_STYLE, pointSize: 12, lineWidth: 3 });
      f.engine.resize(800, 600); f.engine.setCamera({ yaw: .3, pitch: .2, distance: 50, target: { x: 0, y: 0, z: 0 } });
      f.browser.flushFrames(); assert.ok(draws(f.gl) > before); assert.equal(owned(f.viewport).point.geometry, geometry);
      assert.deepEqual([f.viewport.width, f.viewport.height], [800, 600]);
      assert.equal(f.engine.positionOf(1).z, mode === '2d' ? 0 : 2);
      if (mode === '2d') assert.deepEqual([f.viewport.orbit.yaw, f.viewport.orbit.pitch], [0, 0]);
      assert.ok(f.engine.project(0));
      f.gl.pixel = [...encodePickId(1), 255]; assert.equal(f.engine.pick(400, 300), 1);
      assert.equal(f.browser.canvases.filter(canvas => canvas.contexts.some(context => context === f.viewport.renderer.getContext())).length, 1);
      assert.equal(f.gl.lost, false);
      assert.equal(f.viewport.renderer.xr.getSession(), null); assert.equal(f.viewport.renderer.xr.isPresenting, false);
    } finally { f.close(); }
  }
});
