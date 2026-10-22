import assert from 'node:assert/strict';
import test from 'node:test';
import { DoubleSide } from 'three';
import { createGraphSpatialComposite } from '../dist/graph/spatial-composite.js';
import { createGraphSpatialNodes } from '../dist/graph/spatial-nodes.js';
import { createGraphSpatialEdges } from '../dist/graph/spatial-edges.js';
import { DEFAULT_ORBIT_CAMERA, projectOrbitPoint } from '../dist/core/orbit.js';
import { decodePickId } from '../dist/core/picking.js';
import { resolveLyra3dStyle } from '../dist/core/style.js';

function fixture(alpha = 0.5) {
  const data = { nodeCount: 3, source: new Uint32Array([1]), target: new Uint32Array([2]), sizes: new Float32Array([40, 0, 0]),
    spatialAppearance: { nodeShapes: new Uint8Array([2, 0, 0]), nodeColors: new Float32Array([1, 0, 0, alpha, 0, 0, 0, 0, 0, 0, 0, 0]), edgeColors: new Float32Array([0, 0, 1, alpha]), edgeWidths: new Float32Array([8]), edgeDashes: [[4, 2]] } };
  const positions = new Float32Array([0, 0, 0, -50, 0, 80, 50, 0, 80]);
  const view = { width: 640, height: 480, orbit: { ...DEFAULT_ORBIT_CAMERA }, style: resolveLyra3dStyle(), project(p) { return projectOrbitPoint(p, this.orbit, this); } };
  const state = { selected: new Set(), dimmed: new Set(), hover: -1, focus: -1 };
  const nodes = createGraphSpatialNodes(data), edges = createGraphSpatialEdges(data), composite = createGraphSpatialComposite(nodes, edges);
  const update = () => { nodes.update(view, positions, state); edges.update(view, (i) => ({ x: positions[i * 3], y: positions[i * 3 + 1], z: positions[i * 3 + 2] }), state); composite.update(view); };
  const payload = (i) => composite.mesh.geometry.getAttribute(`payload${i}`);
  const kinds = () => Array.from({ length: composite.mesh.geometry.instanceCount }, (_, i) => payload(4).getW(i) < 0 ? 'edge' : 'node');
  return { nodes, edges, composite, view, positions, update, payload, kinds, dispose() { composite.dispose(); nodes.dispose(); edges.dispose(); } };
}

test('mixed primitives reorder across types on camera change while preserving shape, width, alpha and pick IDs', () => {
  const f = fixture(); f.update();
  assert.deepEqual(f.kinds(), ['node', 'edge']);
  assert.equal(f.payload(1).getX(0), 2); assert.equal(f.payload(0).getW(1), 8);
  assert.equal(f.payload(2).getW(0), 0.5); assert.equal(f.payload(2).getW(1), 0.5);
  assert.equal(f.payload(3).getX(1), 1);
  const nodeIds = () => { const ids = f.nodes.pick.geometry.getAttribute('pickColor').array; return [0, 1, 2].map((row) => decodePickId(...Array.from(ids.slice(row * 3, row * 3 + 3), (v) => Math.round(v * 255)))).sort(); };
  assert.deepEqual(nodeIds(), [0, 1, 2]);
  const edgeIds = [...f.edges.pick.geometry.getAttribute('pickColor').array];
  f.view.orbit = { ...f.view.orbit, yaw: Math.PI }; f.update();
  assert.deepEqual(f.kinds(), ['edge', 'node']); assert.equal(f.payload(1).getX(1), 2);
  assert.deepEqual(nodeIds(), [0, 1, 2]);
  assert.deepEqual([...f.edges.pick.geometry.getAttribute('pickColor').array], edgeIds);
  assert.equal(f.composite.mesh.material.side, DoubleSide); assert.equal(f.composite.mesh.material.forceSinglePass, true); assert.equal(f.nodes.pick.material.side, DoubleSide); assert.equal(f.edges.pick.material.side, DoubleSide);
  assert.equal(f.composite.mesh.material.depthWrite, false); assert.equal(f.composite.mesh.material.depthTest, true);
  f.dispose();
});

test('opaque primitives participate in the same ordering and equal depth paints edges before nodes', () => {
  const f = fixture(1); f.update(); assert.deepEqual(f.kinds(), ['node', 'edge']);
  f.positions[5] = f.positions[8] = 0; f.update(); assert.deepEqual(f.kinds(), ['edge', 'node']);
  f.view.orbit = { ...f.view.orbit, yaw: Math.PI }; f.update(); assert.deepEqual(f.kinds(), ['edge', 'node']);
  f.dispose();
});

test('composite borrows the dash atlas and disposes only its own resources once', () => {
  const f = fixture(); f.update(); let geometry = 0, material = 0, texture = 0;
  f.composite.mesh.geometry.addEventListener('dispose', () => geometry++);
  f.composite.mesh.material.addEventListener('dispose', () => material++);
  f.edges.mesh.material.uniforms.dashAtlas.value.addEventListener('dispose', () => texture++);
  f.composite.dispose(); f.composite.dispose(); f.composite.update(f.view);
  assert.deepEqual([geometry, material, texture], [1, 1, 0]);
  f.nodes.dispose(); f.edges.dispose(); assert.equal(texture, 1);
});
