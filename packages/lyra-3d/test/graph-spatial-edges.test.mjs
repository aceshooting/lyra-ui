import assert from 'node:assert/strict';
import test from 'node:test';
import { spatialEdgePoint, spatialEdgeSegments } from '../dist/graph/spatial-paths.js';
import { createGraphSpatialEdges } from '../dist/graph/spatial-edges.js';
import { DEFAULT_ORBIT_CAMERA, projectOrbitPoint } from '../dist/core/orbit.js';
import { resolveLyra3dStyle } from '../dist/core/style.js';
const state = (extra = {}) => ({ selected: new Set(), dimmed: new Set(), hover: -1, focus: -1, ...extra });
const viewport = { width: 640, height: 480, orbit: DEFAULT_ORBIT_CAMERA, style: resolveLyra3dStyle(), project(point) { return projectOrbitPoint(point, this.orbit, this); } };
const positions = new Float32Array([0, 0, 0, 80, 0, 0]);
const point = (row) => ({ x: positions[row * 3], y: positions[row * 3 + 1], z: positions[row * 3 + 2] });

test('self loops and dangling paths preserve existing spatial world conventions', () => {
  const data = { nodeCount: 2, source: new Uint32Array([0, 0]), target: new Uint32Array([0, 0]), sizes: new Float32Array([30, 30]), spatialAppearance: { sizeUnits: 'world', dangling: new Uint8Array([0, 1]) } };
  assert.equal(spatialEdgeSegments(data, 0), 16); assert.equal(spatialEdgeSegments(data, 1), 1);
  const loop = spatialEdgePoint(data, 0, 0.5, point, viewport); assert.ok(Math.abs(loop.x) < 1e-12); assert.equal(loop.y, -48);
  assert.deepEqual(spatialEdgePoint(data, 1, 1, point, viewport), { x: 28, y: -28, z: 0 });
});

test('edge batches keep stable IDs, expanded picks, zero width and dangling suppression', () => {
  const data = { nodeCount: 2, source: new Uint32Array([0, 0, 0]), target: new Uint32Array([1, 1, 0]), spatialAppearance: { edgeWidths: new Float32Array([2, 0, 2]), dangling: new Uint8Array([0, 0, 1]), edgeDashes: [[4, 2], [], []] } };
  const batch = createGraphSpatialEdges(data); batch.update(viewport, point, state({ selected: new Set([2]) }));
  const geometry = batch.mesh.geometry;
  assert.equal(geometry.instanceCount, 3); assert.equal(geometry.getAttribute('stroke').getX(0), 4);
  assert.equal(geometry.getAttribute('stroke').getY(0), 12); assert.equal(geometry.getAttribute('stroke').getX(1), 0); assert.equal(geometry.getAttribute('stroke').getY(2), 0);
  assert.ok(geometry.getAttribute('dash').getX(0) > 0); assert.equal(geometry.getAttribute('pickColor').getX(0), Math.fround(3 / 255));
  let disposed = 0; batch.mesh.material.addEventListener('dispose', () => disposed++); batch.dispose(); assert.equal(disposed, 1);
});

test('spatial directed loops have a visible arrow without introducing another pick identity', () => {
  const data = { nodeCount: 2, source: new Uint32Array([0]), target: new Uint32Array([0]), sizes: new Float32Array([30, 30]), directed: new Uint8Array([1]), spatialAppearance: { sizeUnits: 'world' } };
  const batch = createGraphSpatialEdges(data); batch.update(viewport, point, state());
  assert.equal(batch.mesh.geometry.instanceCount, 17);
  const strokes = batch.mesh.geometry.getAttribute('stroke'); assert.ok(strokes.getX(16) > 0); assert.equal(strokes.getY(16), 0); assert.equal(strokes.getZ(16), 1);
  const dash = batch.mesh.geometry.getAttribute('dash'); assert.ok(dash.getY(15) > dash.getY(1)); batch.dispose();
});

test('alpha-only dimming preserves edge pick reach while transparent source paint stays excluded', () => {
  const data = { nodeCount: 2, source: new Uint32Array([0, 0]), target: new Uint32Array([1, 1]), spatialAppearance: { edgeColors: new Float32Array([1, 0, 0, 1, 1, 0, 0, 0]), dimmedOpacity: 0 } };
  const batch = createGraphSpatialEdges(data); batch.update(viewport, point, state({ selected: new Set([3]), dimmed: new Set([2]) }));
  const stroke = batch.mesh.geometry.getAttribute('stroke'); assert.equal(stroke.getX(0), 0); assert.equal(stroke.getY(0), 12); assert.equal(stroke.getX(1), 0); assert.equal(stroke.getY(1), 0); batch.dispose();
});

test('expanded loop geometry is bounded before allocating GPU attribute buffers', () => {
  const count = 117648;
  assert.throws(() => createGraphSpatialEdges({ nodeCount: 1, source: new Uint32Array(count), target: new Uint32Array(count), directed: new Uint8Array(count).fill(1), spatialAppearance: {} }), /primitive limit/);
});

test('directed crossing edges retain the visible terminal arrow after near clipping', () => {
  const data = { nodeCount: 2, source: new Uint32Array([0]), target: new Uint32Array([1]), directed: new Uint8Array([1]), spatialAppearance: {} };
  const position = (row) => row === 0 ? { x: -10, y: 0, z: viewport.orbit.distance + 10 } : { x: 10, y: 0, z: 0 };
  const batch = createGraphSpatialEdges(data); batch.update(viewport, position, state());
  const stroke = batch.mesh.geometry.getAttribute('stroke'); assert.ok(stroke.getX(0) > 0); assert.ok(stroke.getX(1) > 0); batch.dispose();
});

test('unsafe derived world loop sizes reject before attribute allocation', () => {
  assert.throws(() => createGraphSpatialEdges({ nodeCount: 1, source: new Uint32Array([0]), target: new Uint32Array([0]), sizes: new Float32Array([3e38]), spatialAppearance: { sizeUnits: 'world' } }), /diameters/);
});

test('translucent stroke sorting carries original pick IDs and restores opaque writes', () => {
  const data = { nodeCount: 4, source: new Uint32Array([0, 2]), target: new Uint32Array([1, 3]), spatialAppearance: { edgeColors: new Float32Array([1, 0, 0, 0.5, 0, 1, 0, 0.5]) } };
  const position = (row) => ({ x: row % 2 ? 80 : 0, y: 0, z: row < 2 ? 30 : -30 });
  const batch = createGraphSpatialEdges(data); batch.update(viewport, position, state());
  assert.equal(batch.mesh.material.transparent, true); assert.equal(batch.mesh.material.depthWrite, false);
  assert.equal(batch.mesh.geometry.getAttribute('pickColor').getX(0), Math.fround(6 / 255));
  batch.update({ ...viewport, style: resolveLyra3dStyle({ forcedColors: true }) }, position, state());
  assert.equal(batch.mesh.material.depthWrite, true); assert.equal(batch.mesh.geometry.getAttribute('pickColor').getX(0), Math.fround(5 / 255)); batch.dispose();
});
