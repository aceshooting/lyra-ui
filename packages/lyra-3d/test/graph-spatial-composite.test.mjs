import assert from 'node:assert/strict';
import test from 'node:test';
import { DoubleSide } from 'three';
import { GRAPH_RESORT_ANGLE, createGraphSpatialComposite } from '../dist/graph/spatial-composite.js';
import { createGraphSpatialNodes } from '../dist/graph/spatial-nodes.js';
import { createGraphSpatialEdges } from '../dist/graph/spatial-edges.js';
import { DEFAULT_ORBIT_CAMERA, projectOrbitPoint } from '../dist/core/orbit.js';
import { graphEye, graphPathPoint, graphSpatialView } from '../dist/graph/spatial-paths.js';
import { decodePickId } from '../dist/core/picking.js';
import { resolveLyra3dStyle } from '../dist/core/style.js';

function fixture(alpha = 0.5) {
  const data = { nodeCount: 3, source: new Uint32Array([1]), target: new Uint32Array([2]), sizes: new Float32Array([40, 0, 0]),
    spatialAppearance: { nodeShapes: new Uint8Array([2, 0, 0]), nodeColors: new Float32Array([1, 0, 0, alpha, 0, 0, 0, 0, 0, 0, 0, 0]), edgeColors: new Float32Array([0, 0, 1, alpha]), edgeWidths: new Float32Array([8]), edgeDashes: [[4, 2]] } };
  const positions = new Float32Array([0, 0, 0, -50, 0, 80, 50, 0, 80]);
  const view = { width: 640, height: 480, orbit: { ...DEFAULT_ORBIT_CAMERA }, style: resolveLyra3dStyle(), invalidate() {}, project(p) { return projectOrbitPoint(p, this.orbit, this); } };
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
  assert.equal(f.payload(1).getX(0), 2); assert.equal(f.payload(3).getZ(1), 8);
  assert.equal(f.payload(2).getW(0), 0.5); assert.equal(f.payload(2).getW(1), 0.5);
  assert.equal(f.payload(4).getX(1), 1);
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

test('opaque primitives draw in a fixed edges-then-nodes order with depth writes and never re-sort', () => {
  const f = fixture(1); f.update(); assert.deepEqual(f.kinds(), ['edge', 'node']);
  assert.equal(f.composite.mesh.material.transparent, false); assert.equal(f.composite.mesh.material.depthWrite, true);
  const version = f.payload(0).version;
  f.view.orbit = { ...f.view.orbit, yaw: Math.PI }; f.composite.update(f.view);
  assert.deepEqual(f.kinds(), ['edge', 'node']); assert.equal(f.payload(0).version, version, 'turning the camera uploads nothing');
  f.positions[5] = f.positions[8] = 0; f.update(); assert.deepEqual(f.kinds(), ['edge', 'node']); assert.ok(f.payload(0).version > version);
  f.dispose();
});

test('translucent painter order re-sorts only after the view direction turns materially', () => {
  const f = fixture(); f.update(); assert.deepEqual(f.kinds(), ['node', 'edge']);
  const version = () => f.payload(0).version, start = version();
  const move = (orbit) => { f.view.orbit = { ...f.view.orbit, ...orbit }; f.composite.update(f.view); };
  move({ distance: 900, target: { x: 40, y: -30, z: 10 } }); assert.equal(version(), start, 'pan and zoom never change depth order');
  move({ yaw: GRAPH_RESORT_ANGLE / 2 }); assert.equal(version(), start, 'a small turn keeps the current order');
  move({ yaw: GRAPH_RESORT_ANGLE * 2 }); assert.ok(version() > start, 'a material turn re-sorts');
  const resorted = version(); move({ yaw: GRAPH_RESORT_ANGLE * 2.5 }); assert.equal(version(), resorted, 'measured from the last sort');
  move({ yaw: Math.PI }); assert.deepEqual(f.kinds(), ['edge', 'node']);
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


test('a sub-threshold rotation settles to exact translucent order and requests its final paint', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(); t.after(() => f.dispose());
  f.positions[3] = -60; f.positions[6] = 40;
  f.positions[5] = f.positions[8] = 0.01;
  let paints = 0; f.view.invalidate = () => { paints++; };
  f.update(); assert.deepEqual(f.kinds(), ['node', 'edge']);
  const version = f.payload(0).version;
  f.view.orbit = { ...f.view.orbit, yaw: GRAPH_RESORT_ANGLE / 2 };
  f.composite.update(f.view);
  assert.equal(f.payload(0).version, version, 'motion does not upload below the angular threshold');
  t.mock.timers.tick(1000);
  assert.deepEqual(f.kinds(), ['edge', 'node'], 'the tiny turn crosses the primitives depths');
  assert.equal(paints, 1, 'the corrected order must be rendered even without further host updates');
  f.composite.update(f.view); t.mock.timers.tick(1000);
  assert.equal(paints, 1, 'a settled frame does not keep scheduling work');
});

test('continued rotation defers the final exact sort, and disposal cancels it', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(); t.after(() => f.dispose());
  let paints = 0; f.view.invalidate = () => { paints++; };
  f.update();
  for (let step = 1; step <= 4; step++) {
    f.view.orbit = { ...f.view.orbit, yaw: GRAPH_RESORT_ANGLE * step / 10 };
    f.composite.update(f.view); t.mock.timers.tick(50);
    assert.equal(paints, 0, 'continuous movement postpones the settling sort');
  }
  f.composite.dispose(); t.mock.timers.tick(1000);
  assert.equal(paints, 0, 'disposed composites cannot upload or request another paint');
});


test('translucent CSS loop segments follow their rendered depth after tilt, zoom, pan and resize', () => {
  const data = { nodeCount: 2, source: new Uint32Array([0]), target: new Uint32Array([0]), sizes: new Float32Array([20, 10]),
    spatialAppearance: { nodeColors: new Float32Array([0, 0, 0, 0, 1, 0, 0, 0.5]), edgeColors: new Float32Array([0, 0, 1, 0.5]), edgeWidths: new Float32Array([8]) } };
  const positions = [{ x: 0, y: 0, z: 0 }, { x: 0, y: -3.5, z: -7 * Math.cos(Math.PI / 6) }];
  const view = { width: 640, height: 480, orbit: { ...DEFAULT_ORBIT_CAMERA, pitch: Math.PI / 6 }, style: resolveLyra3dStyle(), invalidate() {} };
  const state = { selected: new Set(), dimmed: new Set(), hover: -1, focus: -1 };
  const nodes = createGraphSpatialNodes(data), edges = createGraphSpatialEdges(data), composite = createGraphSpatialComposite(nodes, edges);
  try {
    nodes.update(view, new Float32Array(positions.flatMap(p => [p.x, p.y, p.z])), state);
    edges.update(view, i => positions[i], state);
    const versions = [...Object.values(edges.mesh.geometry.attributes), ...Object.values(nodes.mesh.geometry.attributes)].map(a => a.version);
    const check = (farther) => {
      composite.update(view);
      const p0 = composite.mesh.geometry.getAttribute('payload0'), p1 = composite.mesh.geometry.getAttribute('payload1'), p4 = composite.mesh.geometry.getAttribute('payload4');
      let segment = -1, glyph = -1;
      for (let i = 0; i < composite.mesh.geometry.instanceCount; i++) {
        if (p4.getW(i) < 0 && p0.getW(i) === 7 / 16) segment = i;
        if (p4.getW(i) >= 0 && p0.getW(i) === 5) glyph = i;
      }
      assert.ok(segment >= 0 && glyph >= 0);
      const projectedView = graphSpatialView(view.width, view.height, view.orbit), centreDepth = graphEye(positions[0], view.orbit).z;
      const ends = [p0.getW(segment), p1.getW(segment)].map(t => graphEye(graphPathPoint(positions[0], positions[0], 16, t, centreDepth, false, projectedView), view.orbit).z);
      const glyphDepth = graphEye(positions[1], view.orbit).z;
      assert.equal(ends.every(depth => depth > glyphDepth), farther, 'both actual segment endpoints establish the expected painter order');
      assert.equal(segment < glyph, farther, 'the loop segment and comparison glyph must paint back to front');
      assert.deepEqual([...Object.values(edges.mesh.geometry.attributes), ...Object.values(nodes.mesh.geometry.attributes)].map(a => a.version), versions, 'camera changes never rewrite source GPU geometry');
    };
    check(true);
    view.orbit = { ...view.orbit, distance: 200 }; check(false);
    view.orbit = { ...view.orbit, target: { x: 0, y: 0, z: 500 } }; check(true);
    view.height = 1600; check(false);
  } finally { composite.dispose(); nodes.dispose(); edges.dispose(); }
});
