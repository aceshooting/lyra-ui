import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_ORBIT_CAMERA, orbitNearPlane, projectOrbitPoint } from '../dist/core/orbit.js';
import {
  GRAPH_EDGE_DEPTH_BIAS, graphArrowScreen, graphClipSegment, graphEye, graphNdcDepth, graphNodeExtents, graphPathPoint, graphScale, graphScreen,
  graphSegmentScreen, graphSpatialEdgeVertexChunk, graphSpatialNodeVertexChunk, graphSpatialProjectionChunk, graphSpatialView, graphViewForward,
} from '../dist/graph/spatial-paths.js';

// The shader-side camera math has a TypeScript twin; these tests pin that twin to the CPU projection
// used by picking, labels and the public `project()`, so the GPU path cannot drift from it.
const cameras = [DEFAULT_ORBIT_CAMERA, { yaw: 0.4, pitch: 0.3, distance: 1900, target: { x: 12, y: -40, z: 7 } }, { yaw: Math.PI, pitch: -1.2, distance: 80, target: { x: 0, y: 0, z: 0 } }];
const points = [{ x: 0, y: 0, z: 0 }, { x: 120, y: -45, z: 300 }, { x: -600, y: 600, z: -250 }, { x: 3, y: 5, z: 7 }];
const close = (actual, expected, tolerance = 1e-9) => Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected));

test('screen projection, scale and depth match the orbit projection and the renderer depth range', () => {
  for (const camera of cameras) {
    const view = graphSpatialView(640, 480, camera);
    assert.equal(view.near, orbitNearPlane(camera)); assert.equal(view.far, Math.max(view.near * 10, camera.distance * 4 + 1e4));
    for (const point of points) {
      const expected = projectOrbitPoint(point, camera, view), eye = graphEye(point, camera);
      if (!expected) { assert.ok(eye.z < view.near); continue; }
      const screen = graphScreen(eye, view);
      assert.ok(close(screen.x, expected.x) && close(screen.y, expected.y), JSON.stringify({ camera, point }));
      assert.ok(close(eye.z, expected.depth) && close(graphScale(eye.z, view), expected.scale));
      const window = graphNdcDepth(eye.z, view) * 0.5 + 0.5;
      assert.ok(window > 0 && window < 1);
    }
  }
  const unit = graphSpatialView(1, 1, DEFAULT_ORBIT_CAMERA);
  assert.ok(close(graphNdcDepth(unit.near, unit), -1) && close(graphNdcDepth(unit.far, unit), 1));
});

test('painter order from the view direction alone equals eye-depth order for any target and distance', () => {
  for (const camera of cameras) {
    const forward = graphViewForward(camera), dot = (p) => p.x * forward[0] + p.y * forward[1] + p.z * forward[2];
    for (const a of points) for (const b of points) {
      const depthA = graphEye(a, camera).z, depthB = graphEye(b, camera).z;
      if (Math.abs(depthA - depthB) < 1e-6) continue;
      assert.equal(depthA > depthB, dot(a) < dot(b));
    }
  }
});

test('segments clip at the near plane and vanish wholly behind it', () => {
  assert.equal(graphClipSegment({ x: 0, y: 0, z: -5 }, { x: 4, y: 0, z: 0.1 }, 1), null);
  for (const [a, b] of [[{ x: -40, y: 0, z: -100 }, { x: 40, y: 10, z: 100 }], [{ x: 40, y: 10, z: 100 }, { x: -40, y: 0, z: -100 }]]) {
    const clip = graphClipSegment(a, b, 1);
    const near = a.z < b.z ? clip[0] : clip[1];
    assert.equal(near.z, 1); assert.ok(Number.isFinite(near.x) && Number.isFinite(near.y));
  }
  const view = graphSpatialView(640, 480, DEFAULT_ORBIT_CAMERA);
  const behind = (x) => graphEye({ x, y: 0, z: 600 }, DEFAULT_ORBIT_CAMERA), front = (x) => graphEye({ x, y: 0, z: 0 }, DEFAULT_ORBIT_CAMERA);
  assert.equal(graphSegmentScreen(behind(0), behind(50), view), null, 'an edge wholly behind the camera is neither drawn nor pickable');
  for (const [a, b] of [[front(-40), behind(40)], [behind(-40), front(40)]]) {
    const screen = graphSegmentScreen(a, b, view);
    assert.ok(screen && screen.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z)), 'a half-hidden edge is clipped, not dropped');
  }
});

test('node glyph extents keep shapes, twelve-pixel pick reach, rings, markers and near-plane hiding', () => {
  const view = graphSpatialView(640, 480, DEFAULT_ORBIT_CAMERA), eye = graphEye({ x: 0, y: 0, z: 0 }, DEFAULT_ORBIT_CAMERA);
  const small = [0, 1, 2].map((shape) => graphNodeExtents(eye, 1, shape, false, false, false, 3, view).pick);
  assert.deepEqual(small.slice(0, 2), [12, 12]); assert.ok(close(small[2], 12 * Math.sqrt(Math.PI / 2)));
  const world = graphNodeExtents(eye, 10, 0, false, false, true, 3, view), css = graphNodeExtents(eye, 10, 0, false, false, false, 3, view);
  assert.ok(close(world.radius, 10 * projectOrbitPoint({ x: 0, y: 0, z: 0 }, DEFAULT_ORBIT_CAMERA, view).scale)); assert.equal(css.radius, 10);
  const nearer = graphNodeExtents(graphEye({ x: 0, y: 0, z: 250 }, DEFAULT_ORBIT_CAMERA), 10, 0, false, false, true, 3, view);
  assert.ok(nearer.radius > world.radius * 1.99, 'world diameters grow with proximity');
  assert.equal(graphNodeExtents(eye, 10, 0, true, false, false, 3, view).paint, 15);
  assert.equal(graphNodeExtents(eye, 10, 0, false, true, false, 6, view).paint, 16);
  assert.deepEqual(graphNodeExtents(graphEye({ x: 0, y: 0, z: 501 }, DEFAULT_ORBIT_CAMERA), 10, 0, true, true, false, 3, view), { radius: 0, paint: 0, pick: 0 });
  assert.equal(graphNodeExtents(eye, 1e9, 0, false, false, false, 3, view).radius, 1280, 'radii are clamped to twice the viewport');
});

test('pick depth: a shared endpoint always resolves to the node, while a genuinely nearer edge wins', () => {
  for (const camera of cameras) for (const distance of [100, 500, 10000]) {
    const orbit = { ...camera, distance }, view = graphSpatialView(640, 480, orbit);
    for (const point of points) {
      const depth = graphEye(point, orbit).z; if (depth < view.near) continue;
      const node = graphNdcDepth(depth, view) * 0.5 + 0.5, edge = graphNdcDepth(depth + 0.001, view) * 0.5 + 0.5 + GRAPH_EDGE_DEPTH_BIAS;
      assert.ok(node < edge);
      const nearer = graphNdcDepth(depth * 0.99, view) * 0.5 + 0.5 + GRAPH_EDGE_DEPTH_BIAS;
      if (depth * 0.99 > view.near) assert.ok(nearer < node, 'one percent nearer outweighs the tie bias');
    }
  }
});

test('self-loop and dangling paths keep their world conventions; CSS loop radii resolve at the node depth', () => {
  const view = graphSpatialView(640, 480, DEFAULT_ORBIT_CAMERA), centre = { x: 0, y: 0, z: 0 }, depth = graphEye(centre, DEFAULT_ORBIT_CAMERA).z;
  const world = graphPathPoint(centre, centre, 24, 0.5, depth, true, view);
  assert.ok(Math.abs(world.x) < 1e-12); assert.equal(world.y, -48);
  assert.equal(graphPathPoint(centre, centre, 24, 1, depth, true, view), centre, 'loops close exactly on their node');
  const css = graphPathPoint(centre, centre, 24, 0.5, depth, false, view);
  assert.ok(close(-css.y * graphScale(depth, view), 48), 'a CSS loop spans its pixel diameter on screen');
  assert.equal(Math.abs(graphPathPoint(centre, centre, 24, 0.5, view.near / 2, false, view).y), 0, 'a CSS loop behind the camera collapses');
  const end = { x: 28, y: -28, z: 0 };
  assert.equal(graphPathPoint(centre, end, 0, 1, 0, false, view), end, 'straight ends are exact, so pick depth ties stay exact');
  assert.deepEqual(graphPathPoint(centre, end, 0, 0.5, 0, false, view), { x: 14, y: -14, z: 0 });
});

test('arrow heads sit inset at the target, survive near clipping and vanish when degenerate or behind', () => {
  const view = graphSpatialView(640, 480, DEFAULT_ORBIT_CAMERA), eye = (point) => graphEye(point, DEFAULT_ORBIT_CAMERA);
  const head = graphArrowScreen(eye({ x: -60, y: 0, z: 0 }), eye({ x: 60, y: 0, z: 0 }), 10, 20, false, view);
  const target = projectOrbitPoint({ x: 60, y: 0, z: 0 }, DEFAULT_ORBIT_CAMERA, view);
  assert.ok(close(head[1].x, target.x - 10) && close(head[0].x, head[1].x - 10 / Math.tan(0.45)));
  const world = graphArrowScreen(eye({ x: -60, y: 0, z: 0 }), eye({ x: 60, y: 0, z: 0 }), 10, 20, true, view);
  assert.ok(close(world[1].x, target.x - 10 * target.scale), 'world insets scale with depth');
  assert.ok(graphArrowScreen(eye({ x: -10, y: 0, z: DEFAULT_ORBIT_CAMERA.distance + 10 }), eye({ x: 10, y: 0, z: 0 }), 0, 20, false, view), 'a crossing edge keeps its terminal arrow');
  assert.equal(graphArrowScreen(eye({ x: -60, y: 0, z: 0 }), eye({ x: 60, y: 0, z: 600 }), 0, 20, false, view), null, 'no arrow once the tip is behind the camera');
  assert.equal(graphArrowScreen(eye({ x: 10, y: 0, z: 0 }), eye({ x: 10, y: 0, z: 0 }), 0, 20, false, view), null, 'coincident ends have no direction');
});

test('the GLSL twin carries the same constants and the shared helper names', () => {
  const tan = String(Math.tan(Math.PI / 8));
  assert.ok(graphSpatialProjectionChunk.includes(tan), 'the field of view comes from the core constant');
  for (const name of ['lyraGraphEye', 'lyraGraphScale', 'lyraGraphNdcDepth', 'lyraGraphScreen', 'lyraGraphClip', 'lyraGraphPathPoint']) assert.ok(graphSpatialProjectionChunk.includes(`${name}(`), name);
  assert.ok(graphSpatialEdgeVertexChunk.includes(String(GRAPH_EDGE_DEPTH_BIAS)) && graphSpatialEdgeVertexChunk.includes('a.z+0.001'));
  assert.ok(graphSpatialNodeVertexChunk.includes('pickDepth=lyraGraphNdcDepth(eye.z)*0.5+0.5'));
  assert.ok(graphSpatialNodeVertexChunk.includes(String(Math.sqrt(Math.PI / 2))) && graphSpatialNodeVertexChunk.includes(String(Math.sqrt(Math.PI) / 2)));
});
