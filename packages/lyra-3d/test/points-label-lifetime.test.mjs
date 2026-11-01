import assert from 'node:assert/strict';
import test from 'node:test';
import { Scene } from 'three';
import { createPointsLabels, pointsAxes } from '../dist/points/axes.js';
import { admitPointsData } from '../dist/points/data.js';
import { createPointsEngine } from '../dist/points/engine.js';
import { createLyra3dViewport } from '../dist/core/viewport.js';
import { DEFAULT_ORBIT_CAMERA } from '../dist/core/orbit.js';
import { DEFAULT_LYRA_3D_STYLE, resolveLyra3dStyle } from '../dist/core/style.js';
import { FakeCanvas, installFakeBrowser, pointerEvent } from './fake-browser.mjs';

const emptyState = () => ({ selected: new Set(), dimmed: new Set(), hover: -1, focus: -1 });
const viewportFixture = () => ({ scene: new Scene(), orbit: DEFAULT_ORBIT_CAMERA, width: 640, height: 480,
  style: resolveLyra3dStyle(), project: () => ({ x: 100, y: 120 }) });

test('empty labels create no canvas while a missing 2D context retains only independently retired canvas ownership', () => {
  const viewport = viewportFixture(), empty = admitPointsData({ positions: new Float32Array([0, 0, 0]) });
  let created = 0;
  const labels = createPointsLabels(viewport, empty, [], () => { created++; throw new Error('Empty labels allocated a canvas'); });
  assert.equal(labels.resources, undefined); labels.update(emptyState()); labels.dispose(); labels.dispose(); assert.equal(created, 0);
  const canvas = { width: 37, height: 53, getContext(kind) { assert.equal(kind, '2d'); created++; return null; } };
  const populated = admitPointsData({ positions: new Float32Array([0, 0, 0]), labels: ['text'] });
  const missing = createPointsLabels(viewport, populated, [], () => canvas), resources = missing.resources;
  try {
    assert.deepEqual(Object.keys(resources).sort(), ['canvas', 'disposed', 'geometry', 'material', 'mesh', 'texture']);
    assert.equal(resources.canvas, canvas); assert.equal(resources.disposed, false);
    for (const key of ['geometry', 'material', 'mesh', 'texture']) assert.equal(resources[key], undefined);
    missing.update(emptyState()); assert.equal(viewport.scene.children.length, 0); assert.equal(created, 1);
    missing.dispose(); missing.dispose(); missing.update(emptyState());
    assert.equal(resources.disposed, true); assert.equal(resources.canvas, undefined); assert.deepEqual([canvas.width, canvas.height], [1, 1]);
  } finally { missing.dispose(); }
});

test('ordinary label updates preserve text ordering appearance caching and bounds and become inert after disposal', () => {
  const draws = [], clears = [], viewport = viewportFixture();
  const context = { globalAlpha: 1, fillStyle: '', font: '', setTransform() {}, clearRect(...args) { clears.push(args); draws.length = 0; },
    fillText(text, x, y, width) { draws.push({ text, x, y, width, alpha: this.globalAlpha, color: this.fillStyle, font: this.font }); } };
  const canvas = { width: 0, height: 0, getContext: () => context };
  const texts = Array.from({ length: 300 }, (_, row) => row === 0 ? '<b>row-0</b>' : `row-${row}`);
  const data = admitPointsData({ positions: new Float32Array(300 * 3), labels: texts,
    axes: [{ axis: 'x', min: -2, max: 2, label: 'axis', ticks: [{ value: 0, label: 'tick' }] }] });
  viewport.style = resolveLyra3dStyle({ ...DEFAULT_LYRA_3D_STYLE, foreground: '#ff0000', fontFamily: 'Example Font', fontSize: 18 });
  const labels = createPointsLabels(viewport, data, pointsAxes(data).labels, () => canvas);
  try {
    const state = { ...emptyState(), focus: 299, hover: 298, dimmed: new Set([299, 0]) };
    labels.update(state);
    assert.equal(draws.length, 256); assert.deepEqual(draws.slice(0, 5).map(row => row.text), ['axis', 'tick', 'row-299', 'row-298', '<b>row-0</b>']);
    assert.deepEqual(draws.slice(0, 5).map(row => row.alpha), [1, 1, .3, 1, .3]);
    assert.deepEqual(draws.slice(0, 5).map(row => row.x), [104, 104, 107, 107, 107]);
    assert.ok(draws.every(row => row.y === 120 && row.width === 512 && row.color === 'rgb(255 0 0)' && row.font === '18px Example Font'));
    assert.equal(context.globalAlpha, 1); assert.deepEqual([canvas.width, canvas.height], [640, 480]);
    const texture = viewport.scene.children[0].material.uniforms.labels.value, version = texture.version, count = clears.length;
    labels.update(state); assert.equal(clears.length, count); assert.equal(texture.version, version);
    viewport.style = resolveLyra3dStyle({ ...DEFAULT_LYRA_3D_STYLE, foreground: '#00ff00', forcedColors: true, devicePixelRatio: 4 });
    viewport.width = 5000; viewport.height = 3000; labels.update(state);
    assert.equal(clears.length, count + 1); assert.ok(texture.version > version); assert.equal(draws.length, 256);
    assert.ok(draws.every(row => row.alpha === 1 && row.color === 'rgb(0 255 0)'));
    assert.deepEqual([canvas.width, canvas.height], [2048, 1228]);
    labels.dispose(); assert.equal(viewport.scene.children.length, 0); assert.deepEqual([canvas.width, canvas.height], [1, 1]);
    const retiredClears = clears.length, retiredVersion = texture.version;
    viewport.width = 20; labels.update({ ...state, focus: 1 }); labels.dispose();
    assert.equal(clears.length, retiredClears); assert.equal(texture.version, retiredVersion); assert.deepEqual([canvas.width, canvas.height], [1, 1]);
  } finally { labels.dispose(); }
});

test('actual points replacement and disposal retire every label resource before completing batch and viewport cleanup', async () => {
  for (const failAt of ['geometry', 'material', 'texture']) {
    const browser = installFakeBrowser(), canvases = [], callbacks = [], calls = [], restores = [], labelResources = [];
    let viewport, engine;
    const data = text => ({ positions: new Float32Array([-2, 0, 0, 2, 1, 0]), labels: [text, 'second'], segments: new Uint32Array([0, 1]) });
    const labelMesh = () => viewport.scene.children.find(mesh => mesh.material?.uniforms?.labels);
    const watch = (owner, method, name, failure) => {
      const original = owner[method];
      owner[method] = function (...args) { calls.push(name); const result = original.apply(this, args); if (failure) throw failure; return result; };
      restores.push(() => { owner[method] = original; });
    };
    try {
      engine = createPointsEngine({ labelCanvas: () => { const canvas = new FakeCanvas({ context2d: true }); canvases.push(canvas); return canvas; },
        viewport(container, host, options) { viewport = createLyra3dViewport(container, host, options); return viewport; } });
      engine.setData(data('first'), 0);
      await engine.mount(browser.container, { hover() { callbacks.push('hover'); }, pick() { callbacks.push('pick'); }, camera() { callbacks.push('camera'); }, lost() { callbacks.push('lost'); } });
      engine.resize(640, 480); browser.flushFrames();
      const old = labelMesh(), oldCanvas = canvases[0];
      assert.ok(old);
      labelResources.push(old.geometry, old.material, old.material.uniforms.labels.value);
      watch(old.geometry, 'dispose', 'old-geometry'); watch(old.material, 'dispose', 'old-material');
      watch(old.material.uniforms.labels.value, 'dispose', 'old-texture');
      engine.setData(data('replacement'), 1); browser.flushFrames();
      assert.deepEqual(calls, ['old-geometry', 'old-material', 'old-texture']);
      assert.equal(old.parent, null); assert.deepEqual([oldCanvas.width, oldCanvas.height], [1, 1]);
      const current = labelMesh(), canvas = canvases[1], failure = new Error(`Controlled label ${failAt} failure`);
      assert.notEqual(current, old); assert.equal(canvases.length, 2);
      labelResources.push(current.geometry, current.material, current.material.uniforms.labels.value);
      for (const [name, owner] of [['geometry', current.geometry], ['material', current.material], ['texture', current.material.uniforms.labels.value]]) {
        watch(owner, 'dispose', name, name === failAt ? failure : undefined);
      }
      const points = viewport.world.children.find(mesh => mesh.geometry?.getAttribute('pointPosition'));
      const lines = viewport.world.children.filter(mesh => mesh.geometry?.getAttribute('lineStart'));
      watch(points.geometry, 'dispose', 'points'); lines.forEach((line, index) => watch(line.geometry, 'dispose', `line-${index}`));
      watch(viewport, 'dispose', 'viewport');
      const beforeRelease = browser.gl.loseContextCalls ?? 0;
      assert.throws(() => engine.dispose(), error => error === failure);
      assert.deepEqual(calls, ['old-geometry', 'old-material', 'old-texture', 'geometry', 'material', 'texture', 'points', ...lines.map((_, index) => `line-${index}`), 'viewport']);
      assert.deepEqual([canvas.width, canvas.height], [1, 1]); assert.equal(current.parent, null);
      assert.equal(browser.gl.loseContextCalls, beforeRelease + 1); assert.equal(browser.container.children.length, 0); assert.equal(browser.pendingFrames(), 0);
      assert.equal(engine.positionOf(0), null);
      const retiredCalls = calls.slice(), retiredCallbacks = callbacks.length;
      viewport.canvas.dispatchEvent(pointerEvent('pointermove')); viewport.canvas.dispatchEvent(new Event('webglcontextrestored'));
      engine.resize(800, 600); engine.setState(emptyState()); engine.dispose(); browser.flushFrames();
      assert.deepEqual(calls, retiredCalls); assert.equal(callbacks.length, retiredCallbacks);
    } finally {
      for (const restore of restores.reverse()) restore();
      try { engine?.dispose(); } finally {
        try {
          for (const resource of labelResources) resource.dispose();
          viewport?.scene.traverse(mesh => {
            mesh.geometry?.dispose();
            for (const material of Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []) {
              material.uniforms?.labels?.value?.dispose(); material.dispose();
            }
          });
          viewport?.dispose();
        } finally { browser.restore(); }
      }
    }
  }
});
