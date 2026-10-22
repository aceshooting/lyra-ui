import assert from 'node:assert/strict';
import test from 'node:test';
import { OrthographicCamera, PerspectiveCamera } from 'three';
import { createGraphSpatialEdges } from '../dist/graph/spatial-edges.js';
import { DEFAULT_ORBIT_CAMERA } from '../dist/core/orbit.js';
import { resolveLyra3dStyle } from '../dist/core/style.js';

const state = { selected: new Set(), dimmed: new Set(), hover: -1, focus: -1 };
const viewport = { width: 640, height: 480, orbit: DEFAULT_ORBIT_CAMERA, style: resolveLyra3dStyle() };
const position = (row) => ({ x: row * 80, y: 0, z: 0 });

test('the edge pick pass windows its shader to the one-pixel view the picker asks for', () => {
  const batch = createGraphSpatialEdges({ nodeCount: 2, source: new Uint32Array([0]), target: new Uint32Array([1]), spatialAppearance: {} });
  batch.update(viewport, position, state);
  const window = batch.pick.material.uniforms.viewWindow.value;
  const pass = (camera) => batch.pick.onBeforeRender(undefined, undefined, camera);
  pass(new PerspectiveCamera());
  assert.deepEqual(window.toArray(), [0, 0, 640, 480], 'without a view offset the pick pass spans the whole view');
  const camera = new PerspectiveCamera();
  camera.setViewOffset(640, 480, 100, 50, 1, 1);
  batch.pick.material.uniformsNeedUpdate = false;
  pass(camera);
  assert.deepEqual(window.toArray(), [100, 50, 1, 1], 'a view offset narrows the window to the picked pixel');
  assert.equal(batch.pick.material.uniformsNeedUpdate, true, 'the renderer is told to upload it');
  camera.clearViewOffset();
  pass(camera);
  assert.deepEqual(window.toArray(), [0, 0, 640, 480]);
  pass(new OrthographicCamera());
  assert.deepEqual(window.toArray(), [0, 0, 640, 480], 'only perspective views carry an offset');
  batch.dispose();
});
