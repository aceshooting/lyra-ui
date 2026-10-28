import assert from 'node:assert/strict';
import test from 'node:test';
import { createGraphSpatialEdges } from '../dist/graph/spatial-edges.js';
import { createGraphSpatialNodes } from '../dist/graph/spatial-nodes.js';
import { createGraphSpatialComposite } from '../dist/graph/spatial-composite.js';
import { DEFAULT_ORBIT_CAMERA } from '../dist/core/orbit.js';
import { resolveLyra3dStyle } from '../dist/core/style.js';

const state = (hover = -1) => ({ selected: new Set(), dimmed: new Set(), hover, focus: -1 });
const view = () => ({ width: 640, height: 480, orbit: { ...DEFAULT_ORBIT_CAMERA }, style: resolveLyra3dStyle(), invalidate() {} });
const data = (extra = {}) => ({ nodeCount: 2, source: new Uint32Array([0]), target: new Uint32Array([1]),
  directed: new Uint8Array([1]), spatialAppearance: { edgeCurvatures: new Float32Array([0.5]) }, ...extra });
const separated = row => ({ x: row * 80, y: 0, z: 0 });

test('straight, loop and dangling reservations keep their existing shapes with curvature present', () => {
  const input = data({ source: new Uint32Array([0, 0, 0, 0]), target: new Uint32Array([1, 0, 1, 1]),
    directed: new Uint8Array([0, 1, 1, 0]), spatialAppearance: {
      edgeCurvatures: new Float32Array([0, 0.5, 0.5, 0.5]), dangling: new Uint8Array([0, 0, 1, 0]), sizeUnits: 'world',
    } });
  const batch = createGraphSpatialEdges(input);
  try {
    batch.update(view(), separated, state());
    assert.equal(batch.mesh.geometry.instanceCount, 1 + 17 + 2 + 16);
    const path = batch.mesh.geometry.getAttribute('edgePath');
    assert.ok(path.getZ(1) > 0, 'self loop keeps its radius');
    assert.equal(path.getZ(18), 0, 'dangling stub keeps its straight shape');
    const end = batch.mesh.geometry.getAttribute('edgeEnd');
    assert.deepEqual([end.getX(18), end.getY(18), end.getZ(18)], [28, -28, 0]);
  } finally { batch.dispose(); }
});

test('curved ordinary edges reserve sixteen strokes and their arrow even while endpoints coincide', () => {
  const batch = createGraphSpatialEdges(data());
  try {
    const viewport = view();
    batch.update(viewport, () => ({ x: 0, y: 0, z: 0 }), state());
    assert.equal(batch.mesh.geometry.instanceCount, 17);
    const path = batch.mesh.geometry.getAttribute('edgePath');
    assert.deepEqual(Array.from({ length: 16 }, (_, i) => [path.getX(i), path.getY(i)]),
      Array.from({ length: 16 }, (_, i) => [i / 16, (i + 1) / 16]));
    const initialPath = [...path.array];
    batch.updatePositions(viewport, separated);
    assert.equal(batch.mesh.geometry.instanceCount, 17);
    assert.deepEqual([...path.array], initialPath, 'separating positions preserves primitive offsets');
    const pick = batch.mesh.geometry.getAttribute('pickColor');
    for (let i = 1; i < 17; i++) assert.deepEqual([pick.getX(i), pick.getY(i), pick.getZ(i)], [pick.getX(0), pick.getY(0), pick.getZ(0)]);
  } finally { batch.dispose(); }
});

test('curve stroke painter anchors sample the curve midpoint while arrows remain at the endpoint', () => {
  const batch = createGraphSpatialEdges(data());
  try {
    batch.update(view(), separated, state());
    assert.equal(batch.mesh.geometry.instanceCount, 17);
    for (let i = 0; i < 16; i++) {
      const t = (i + 0.5) / 16;
      const actual = [...batch.anchors.subarray(i * 3, i * 3 + 3)];
      const expected = [80 * t, 0, 160 * t * (1 - t)];
      actual.forEach((value, axis) => assert.ok(Math.abs(value - expected[axis]) < 1e-5, `segment ${i}, axis ${axis}`));
    }
    assert.deepEqual([...batch.anchors.subarray(48, 51)], [80, 0, 0]);
  } finally { batch.dispose(); }
});

test('curve attributes and composite payload survive sparse hover and camera-only updates', () => {
  const input = data(), viewport = view(), edges = createGraphSpatialEdges(input), nodes = createGraphSpatialNodes(input);
  const composite = createGraphSpatialComposite(nodes, edges);
  try {
    nodes.update(viewport, new Float32Array([0, 0, 0, 80, 0, 0]), state());
    edges.update(viewport, separated, state()); composite.update(viewport);
    const curvature = edges.mesh.geometry.getAttribute('edgeCurvature');
    assert.ok(curvature, 'each primitive carries its world curve');
    assert.deepEqual([...curvature.array], Array(17).fill(0.5));
    const payload4 = composite.mesh.geometry.getAttribute('payload4');
    const retained = () => {
      let strokes = 0;
      for (let i = 0; i < composite.mesh.geometry.instanceCount; i++) if (payload4.getW(i) < 0) {
        assert.equal(payload4.getY(i), 0.5); strokes++;
      }
      assert.equal(strokes, 17);
    };
    retained();
    const stable = ['edgeStart', 'edgeEnd', 'edgePath', 'edgeCurvature', 'pickColor'].map(name => edges.mesh.geometry.getAttribute(name));
    const versions = stable.map(attribute => attribute.version), anchors = [...edges.anchors];
    const payload0 = composite.mesh.geometry.getAttribute('payload0'), initialPayloadVersion = payload0.version;
    edges.updateState(viewport, state(2), [2]); composite.update(viewport);
    assert.deepEqual(stable.map(attribute => attribute.version), versions);
    assert.deepEqual([...edges.anchors], anchors); retained();
    assert.equal(payload0.version, initialPayloadVersion);
    const stroke = edges.mesh.geometry.getAttribute('stroke');
    assert.ok(stroke.updateRanges.every(range => range.start >= 0 && range.start + range.count <= 17 * 3));
    viewport.orbit = { ...viewport.orbit, yaw: 0.7 }; edges.setView(viewport); composite.update(viewport);
    assert.deepEqual(stable.map(attribute => attribute.version), versions);
    assert.equal(payload0.version, initialPayloadVersion, 'opaque camera changes upload uniforms only');
    retained();
  } finally { composite.dispose(); nodes.dispose(); edges.dispose(); }
});

test('hovering one curve bounds dirty paint ranges to its expanded primitive rows', () => {
  const input = data({ nodeCount: 3, source: new Uint32Array([0, 0]), target: new Uint32Array([1, 2]), directed: new Uint8Array([1, 1]),
    spatialAppearance: { edgeCurvatures: new Float32Array([0.5, -0.25]) } });
  const viewport = view(), nodes = createGraphSpatialNodes(input), edges = createGraphSpatialEdges(input), composite = createGraphSpatialComposite(nodes, edges);
  try {
    nodes.update(viewport, new Float32Array([0, 0, 0, 80, 0, 0, 160, 0, 0]), state());
    edges.update(viewport, separated, state()); composite.update(viewport);
    assert.equal(edges.mesh.geometry.instanceCount, 34);
    for (const batch of [edges, composite]) for (const attribute of Object.values(batch.mesh.geometry.attributes)) attribute.clearUpdateRanges();
    const stroke = edges.mesh.geometry.getAttribute('stroke'), paint = composite.mesh.geometry.getAttribute('payload3');
    const untouched = [...paint.array.subarray(17 * 4, 34 * 4)];
    edges.updateState(viewport, state(3), [3]); composite.update(viewport);
    assert.ok(stroke.updateRanges.length > 0); assert.ok(paint.updateRanges.length > 0);
    for (const range of stroke.updateRanges) assert.ok(range.start >= 0 && range.start + range.count <= 17 * 3);
    for (const range of paint.updateRanges) assert.ok(range.start >= 0 && range.start + range.count <= 17 * 4);
    assert.deepEqual([...paint.array.subarray(17 * 4, 34 * 4)], untouched);
  } finally { composite.dispose(); nodes.dispose(); edges.dispose(); }
});
