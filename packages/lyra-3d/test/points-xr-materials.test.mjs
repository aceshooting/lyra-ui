import assert from 'node:assert/strict';
import test from 'node:test';
import { ArrayCamera, PerspectiveCamera, Scene, Vector4, WebGLRenderer } from 'three';
import { createLineBatch, createPointBatch, configureLineBatchXr, configurePointBatchXr } from '../dist/points/batches.js';
import { admitPointsData } from '../dist/points/data.js';
import { resolveLyra3dStyle } from '../dist/core/style.js';
import { installFakeBrowser } from './fake-browser.mjs';

// Actual renderer/cameras with fake GL: uniform/draw ownership checks, not shader pixels.
// Independent ordinary-GPU stereo coverage must establish rendered disk/stroke extents.
function fixture(t) {
  const browser = installFakeBrowser(), saved = Object.getOwnPropertyDescriptor(globalThis, 'self');
  Object.defineProperty(globalThis, 'self', { configurable: true, value: { requestAnimationFrame, cancelAnimationFrame } });
  const canvas = document.createElement('canvas'), renderer = new WebGLRenderer({ canvas, context: canvas.getContext('webgl2') });
  const batches = [];
  t.after(() => {
    try { for (const batch of batches) batch.dispose(); } finally {
      try { renderer.setAnimationLoop(null); renderer.dispose(); renderer.getContext().state.lose(); } finally {
        browser.restore(); if (saved) Object.defineProperty(globalThis, 'self', saved); else delete globalThis.self;
      }
    }
  });
  renderer.setSize(1440, 600, false);
  const scene = new Scene(), eyes = [new PerspectiveCamera(70, 640 / 480, .01, 100), new PerspectiveCamera(65, 800 / 600, .01, 100)];
  eyes.forEach((eye, index) => {
    eye.position.x = index === 0 ? -.032 : .032; eye.rotation.y = index === 0 ? .04 : -.025;
    eye.projectionMatrix.elements[8] = index === 0 ? -.11 : .09; eye.projectionMatrix.elements[9] = index === 0 ? .06 : -.03;
    eye.projectionMatrixInverse.copy(eye.projectionMatrix).invert();
    eye.viewport = new Vector4(index === 0 ? 0 : 640, 0, index === 0 ? 640 : 800, index === 0 ? 480 : 600);
    eye.updateMatrixWorld(true);
  });
  const camera = new ArrayCamera(eyes), gl = renderer.getContext().state;
  return { renderer, scene, eyes, camera, gl,
    own(batch) { batches.push(batch); scene.add(batch.mesh); return batch; },
    draws: () => gl.callsOf('drawElementsInstanced').length + gl.callsOf('drawArraysInstanced').length,
  };
}
const data = () => admitPointsData({ positions: new Float32Array([-.2, 0, -2, .2, .1, -2.5]), sizes: new Float32Array([6, 12]) });
const style = () => resolveLyra3dStyle({ pointSize: 8, lineWidth: 3 });
const state = () => ({ selected: new Set(), dimmed: new Set(), hover: -1, focus: -1 });

test('native point sizing configures only visible uniforms and preserves inline attributes and pick calibration', t => {
  const f = fixture(t), batch = f.own(createPointBatch(data())); batch.resize(640, 480); batch.paint(style(), state());
  const attributes = { ...batch.mesh.geometry.attributes }, visible = batch.mesh.material, pick = batch.pick.material;
  assert.equal(visible.uniforms.worldUnitsPerSize.value, 0); assert.equal(pick.uniforms.worldUnitsPerSize.value, 0);
  const calls = f.gl.calls.length;
  configurePointBatchXr(batch.resources, .002);
  assert.equal(visible.uniforms.worldUnitsPerSize.value, .002); assert.equal(visible.uniformsNeedUpdate, true);
  assert.equal(pick.uniforms.worldUnitsPerSize.value, 0); assert.equal(f.gl.calls.length, calls);
  for (const [name, attribute] of Object.entries(attributes)) assert.equal(batch.mesh.geometry.getAttribute(name), attribute);
  assert.deepEqual([...batch.mesh.geometry.getAttribute('pointSize').array], [6, 12]);
  batch.dispose(); assert.throws(() => configurePointBatchXr(batch.resources, .002), { name: 'InvalidStateError' });
});

test('real renderer submits native point material separately through asymmetric canted eye cameras', t => {
  const f = fixture(t), batch = f.own(createPointBatch(data())); batch.resize(1, 1); batch.paint(style(), state());
  configurePointBatchXr(batch.resources, .002);
  const projections = f.eyes.map(eye => eye.projectionMatrix.toArray()), draws = f.draws(), observed = [];
  batch.mesh.onAfterRender = (_renderer, _scene, eye) => observed.push({ eye, modelView: batch.mesh.modelViewMatrix.toArray(), units: batch.mesh.material.uniforms.worldUnitsPerSize.value });
  f.renderer.render(f.scene, f.camera);
  assert.equal(f.draws() - draws, 2); assert.equal(observed.length, 2);
  assert.equal(observed[0].eye, f.eyes[0]); assert.equal(observed[1].eye, f.eyes[1]);
  assert.notDeepEqual(observed[0].modelView, observed[1].modelView); assert.deepEqual(observed.map(value => value.units), [.002, .002]);
  assert.deepEqual(f.eyes.map(eye => eye.projectionMatrix.toArray()), projections);
  assert.deepEqual(f.eyes.map(eye => eye.viewport.toArray()), [[0, 0, 640, 480], [640, 0, 800, 600]]);
});

test('native line configuration preserves endpoints and configured width while real renderer owns each eye transform', t => {
  const f = fixture(t), batch = f.own(createLineBatch(new Float32Array([-.3, -.1, -2, .25, .2, -2.6])));
  batch.update(style(), 640, 480);
  const starts = batch.mesh.geometry.getAttribute('lineStart'), ends = batch.mesh.geometry.getAttribute('lineEnd'), material = batch.mesh.material;
  assert.equal(material.uniforms.worldUnitsPerSize.value, 0); configureLineBatchXr(batch.resources, .002);
  assert.equal(material.uniforms.lineWidth.value, 3); assert.equal(material.uniforms.worldUnitsPerSize.value, .002);
  assert.equal(batch.mesh.geometry.getAttribute('lineStart'), starts); assert.equal(batch.mesh.geometry.getAttribute('lineEnd'), ends);
  const seen = [], before = f.draws(); batch.mesh.onAfterRender = (_renderer, _scene, eye) => seen.push(eye);
  f.renderer.render(f.scene, f.camera); assert.equal(f.draws() - before, 2); assert.deepEqual(seen, f.eyes);
  batch.dispose(); assert.throws(() => configureLineBatchXr(batch.resources, .002), { name: 'InvalidStateError' });
});

test('ordinary point and line resize plus cropped picking keep their CSS mode until explicit native configuration', t => {
  const f = fixture(t), point = f.own(createPointBatch(data())), line = f.own(createLineBatch(new Float32Array([0, 0, -1, 1, 1, -2])));
  point.resize(800, 600); point.paint(style(), state()); line.update(style(), 800, 600);
  assert.deepEqual(point.mesh.material.uniforms.viewportSize.value.toArray(), [800, 600]);
  assert.deepEqual(line.mesh.material.uniforms.viewportSize.value.toArray(), [800, 600]);
  assert.equal(point.mesh.material.uniforms.worldUnitsPerSize.value, 0); assert.equal(line.mesh.material.uniforms.worldUnitsPerSize.value, 0);
  const camera = new PerspectiveCamera(); camera.setViewOffset(800, 600, 400, 300, 1, 1);
  point.pick.onBeforeRender(null, null, camera); assert.deepEqual(point.pick.material.uniforms.viewportSize.value.toArray(), [1, 1]);
  configurePointBatchXr(point.resources, .002); point.pick.onBeforeRender(null, null, camera);
  assert.equal(point.pick.material.uniforms.worldUnitsPerSize.value, 0);
  assert.deepEqual(point.pick.material.uniforms.viewportSize.value.toArray(), [1, 1]);
  camera.clearViewOffset(); point.pick.onBeforeRender(null, null, camera);
  assert.deepEqual(point.pick.material.uniforms.viewportSize.value.toArray(), [800, 600]);
});
