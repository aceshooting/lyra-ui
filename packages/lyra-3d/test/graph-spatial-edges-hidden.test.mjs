import assert from 'node:assert/strict';
import test from 'node:test';
import { createGraphSpatialEdges } from '../dist/graph/spatial-edges.js';
import { DEFAULT_ORBIT_CAMERA, projectOrbitPoint } from '../dist/core/orbit.js';
import { resolveLyra3dStyle } from '../dist/core/style.js';

const state = (extra = {}) => ({ selected: new Set(), dimmed: new Set(), hover: -1, focus: -1, ...extra });
const viewport = { width: 640, height: 480, orbit: DEFAULT_ORBIT_CAMERA, style: resolveLyra3dStyle(), project(point) { return projectOrbitPoint(point, this.orbit, this); } };
const FRONT = 0;
const BEHIND = 600;
const at = (...rows) => (row) => rows[row] ?? null;
const pair = (extra = {}) => ({ nodeCount: 2, source: new Uint32Array([0]), target: new Uint32Array([1]), spatialAppearance: {}, ...extra });
const attribute = (batch, name) => batch.mesh.geometry.getAttribute(name);

test('an edge wholly behind the camera is neither drawn nor pickable and sorts to the far end', () => {
  const batch = createGraphSpatialEdges(pair());
  batch.update(viewport, at({ x: 0, y: 0, z: BEHIND }, { x: 50, y: 0, z: BEHIND }), state());
  const stroke = attribute(batch, 'stroke');
  assert.deepEqual([stroke.getX(0), stroke.getY(0)], [0, 0], 'no line and no pick strip');
  assert.deepEqual([attribute(batch, 'pickDepth').getX(0), attribute(batch, 'pickDepth').getY(0)], [0, 0]);
  assert.equal(batch.depthAt(0), Infinity);
  batch.dispose();
});

test('an edge with only one end behind the camera is clipped at the near plane on either side', () => {
  for (const [source, target] of [[FRONT, BEHIND], [BEHIND, FRONT]]) {
    const batch = createGraphSpatialEdges(pair());
    batch.update(viewport, at({ x: -40, y: 0, z: source }, { x: 40, y: 0, z: target }), state());
    const stroke = attribute(batch, 'stroke');
    assert.ok(stroke.getX(0) > 0, `the visible part is drawn (${source} -> ${target})`);
    assert.ok(Number.isFinite(attribute(batch, 'screenStart').getX(0)) && Number.isFinite(attribute(batch, 'screenEnd').getX(0)));
    assert.ok(Number.isFinite(batch.depthAt(0)) && batch.depthAt(0) > 0);
    batch.dispose();
  }
});

test('an edge whose endpoint has no position is skipped without disturbing its neighbours', () => {
  const batch = createGraphSpatialEdges({ nodeCount: 3, source: new Uint32Array([0, 0]), target: new Uint32Array([1, 2]), spatialAppearance: {} });
  batch.update(viewport, at({ x: 0, y: 0, z: 0 }, { x: 80, y: 0, z: 0 }), state());
  const stroke = attribute(batch, 'stroke');
  assert.ok(stroke.getX(0) > 0, 'the edge with both endpoints is drawn');
  assert.deepEqual([stroke.getX(1), stroke.getY(1)], [0, 0], 'the edge to a node without a position is not');
  batch.dispose();
});

test('arrows follow their edge: shown at the target, hidden when the edge is hidden', () => {
  const visible = createGraphSpatialEdges(pair({ directed: new Uint8Array([1]) }));
  visible.update(viewport, at({ x: -60, y: 0, z: FRONT }, { x: 60, y: 0, z: FRONT }), state());
  assert.equal(attribute(visible, 'stroke').getX(1) > 0, true, 'the arrow head has width');
  assert.equal(attribute(visible, 'stroke').getZ(1), 1, 'and is marked as an arrow');
  visible.dispose();
  const hidden = createGraphSpatialEdges(pair({ directed: new Uint8Array([1]) }));
  hidden.update(viewport, at({ x: -60, y: 0, z: BEHIND }, { x: 60, y: 0, z: BEHIND }), state());
  assert.equal(attribute(hidden, 'stroke').getX(1), 0, 'an arrow behind the camera has no width');
  hidden.update(viewport, at({ x: -60, y: 0, z: FRONT }, null), state());
  assert.equal(attribute(hidden, 'stroke').getX(1), 0, 'an arrow without a target position has no width');
  assert.equal(hidden.depthAt(1), Infinity);
  hidden.dispose();
});

test('dimming falls back to the default opacity and invisible source colors stay excluded', () => {
  const style = resolveLyra3dStyle({ muted: 'rgb(0, 0, 0)' });
  const batch = createGraphSpatialEdges(pair());
  batch.update({ ...viewport, style }, at({ x: -60, y: 0, z: FRONT }, { x: 60, y: 0, z: FRONT }), state({ dimmed: new Set([2]) }));
  assert.ok(Math.abs(attribute(batch, 'edgeColor').getW(0) - 0.35) < 1e-6, 'a dimmed edge keeps 35% of its opacity by default');
  assert.equal(batch.mesh.material.transparent, true, 'a partly transparent stroke needs blending');
  const transparentSource = createGraphSpatialEdges(pair({ spatialAppearance: { edgeColors: new Float32Array([1, 0, 0, 0]) } }));
  transparentSource.update(viewport, at({ x: -60, y: 0, z: FRONT }, { x: 60, y: 0, z: FRONT }), state());
  assert.equal(attribute(transparentSource, 'stroke').getX(0), 0, 'a fully transparent authored color draws nothing');
  assert.equal(attribute(transparentSource, 'stroke').getY(0), 0, 'and cannot be picked');
  batch.dispose();
  transparentSource.dispose();
});

test('a disposed edge batch ignores further updates and repeated disposal', () => {
  const batch = createGraphSpatialEdges(pair());
  batch.dispose();
  assert.doesNotThrow(() => batch.update(viewport, at({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }), state()));
  assert.doesNotThrow(() => batch.dispose());
});

test('arrows on dangling stubs, translucent edges and coincident endpoints stay finite and well ordered', () => {
  const finite = (batch) => ['screenStart', 'screenEnd', 'stroke', 'edgeColor', 'dash'].every((name) => Array.from(attribute(batch, name).array).every(Number.isFinite));
  // A directed self loop drawn as a dangling stub keeps its arrow at the stub tip.
  const stub = createGraphSpatialEdges({ nodeCount: 1, source: new Uint32Array([0]), target: new Uint32Array([0]), directed: new Uint8Array([1]), spatialAppearance: { dangling: new Uint8Array([1]) } });
  stub.update(viewport, at({ x: 0, y: 0, z: 0 }), state());
  assert.ok(attribute(stub, 'stroke').getX(1) > 0 && finite(stub));
  stub.dispose();
  // Coincident endpoints have no direction: the arrow collapses instead of dividing by zero.
  const coincident = createGraphSpatialEdges(pair({ directed: new Uint8Array([1]) }));
  coincident.update(viewport, at({ x: 10, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }), state());
  assert.equal(attribute(coincident, 'stroke').getX(1), 0);
  assert.ok(finite(coincident));
  coincident.dispose();
  // A translucent authored color makes both the line and its arrow blend, so edges are depth sorted.
  const translucent = createGraphSpatialEdges(pair({ directed: new Uint8Array([1]), spatialAppearance: { edgeColors: new Float32Array([1, 0, 0, 0.5]) } }));
  translucent.update(viewport, at({ x: -60, y: 0, z: 0 }, { x: 60, y: 0, z: 0 }), state());
  assert.equal(translucent.mesh.material.transparent, true);
  assert.equal(translucent.mesh.material.depthWrite, false);
  assert.ok(attribute(translucent, 'stroke').getX(1) > 0 && finite(translucent));
  translucent.dispose();
  // A fully transparent authored color hides the arrow along with the line.
  const hidden = createGraphSpatialEdges(pair({ directed: new Uint8Array([1]), spatialAppearance: { edgeColors: new Float32Array([1, 0, 0, 0]) } }));
  hidden.update(viewport, at({ x: -60, y: 0, z: 0 }, { x: 60, y: 0, z: 0 }), state());
  assert.equal(attribute(hidden, 'stroke').getX(1), 0);
  hidden.dispose();
});
