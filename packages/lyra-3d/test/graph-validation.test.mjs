import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_ORBIT_CAMERA, projectOrbitPoint } from '../dist/core/orbit.js';
import { DEFAULT_LYRA_3D_STYLE, resolveLyra3dStyle } from '../dist/core/style.js';
import { admitGraphDecorations, graphItemColor } from '../dist/graph/decorations.js';
import { createGraphTaskKernel } from '../dist/graph/layout-task.js';
import { buildGraphOctree, graphChargeForces } from '../dist/graph/octree.js';
import { admitGraphSpatialAppearance } from '../dist/graph/spatial-appearance.js';
import { createGraphSpatialNodes } from '../dist/graph/spatial-nodes.js';
import { graphSpatialView, spatialEdgePoint, spatialNodeWorldRadius } from '../dist/graph/spatial-paths.js';
import { graphEye, graphNodeExtents } from './graph-spatial-reference.mjs';

const state = (extra = {}) => ({ selected: new Set(), dimmed: new Set(), hover: -1, focus: -1, ...extra });

test('spatial appearance admission refuses non-objects and out-of-range label, dash and pattern counts', () => {
  for (const value of [null, undefined, 'appearance', 7]) assert.throws(() => admitGraphSpatialAppearance(value, 1, 1), TypeError, String(value));
  for (const labelLimit of [-1, 1.5, 20001, Number.NaN]) assert.throws(() => admitGraphSpatialAppearance({ labelLimit }, 1, 1), /label limit/u, String(labelLimit));
  assert.equal(admitGraphSpatialAppearance({ labelLimit: 20000 }, 1, 1).labelLimit, 20000);
  assert.throws(() => admitGraphSpatialAppearance({ edgeDashes: 'solid' }, 1, 1), /dash rows/u);
  assert.throws(() => admitGraphSpatialAppearance({ edgeDashes: [[1], [2]] }, 1, 1), /dash rows/u);
  assert.throws(() => admitGraphSpatialAppearance({ edgeDashes: [new Array(33).fill(1)] }, 1, 1), /dash pattern/u);
  assert.throws(() => admitGraphSpatialAppearance({ edgeDashes: [[-1]] }, 1, 1), /dash pattern/u);
});

test('at most 65,534 distinct authored dash patterns are accepted', () => {
  const rows = (distinct) => Array.from({ length: distinct }, (_, index) => [index + 10]);
  assert.equal(admitGraphSpatialAppearance({ edgeDashes: rows(65_534) }, 1, 65_534).edgeDashes.length, 65_534);
  assert.throws(() => admitGraphSpatialAppearance({ edgeDashes: rows(65_535) }, 1, 65_535), /Too many graph dash patterns/u);
  // The solid and default dashed patterns are built in and never count against the budget twice.
  const repeated = Array.from({ length: 70_000 }, () => [4, 4]);
  assert.equal(admitGraphSpatialAppearance({ edgeDashes: repeated }, 1, 70_000).edgeDashes.length, 70_000);
});

function spatialNodes(extra = {}, count = 3) {
  return createGraphSpatialNodes({ nodeCount: count, spatialAppearance: {}, ...extra });
}

test('spatial node batches refuse malformed counts, appearances, masks, columns and categories', () => {
  for (const nodeCount of [-1, 1.5, Number.NaN, 200_001]) assert.throws(() => createGraphSpatialNodes({ nodeCount, spatialAppearance: {} }), /node count/u, String(nodeCount));
  assert.throws(() => createGraphSpatialNodes({ nodeCount: 1 }), /appearance/u);
  assert.throws(() => spatialNodes({ spatialAppearance: { sizeUnits: 'inches' } }), /appearance/u);
  for (const dimmedOpacity of [-0.1, 1.1, Number.NaN]) assert.throws(() => spatialNodes({ spatialAppearance: { dimmedOpacity } }), /opacity/u, String(dimmedOpacity));
  assert.throws(() => spatialNodes({ spatialAppearance: { nodeShapes: new Uint8Array([0, 1, 3]) } }), /mask/u);
  assert.throws(() => spatialNodes({ spatialAppearance: { expandable: new Uint8Array(2) } }), /mask/u);
  assert.throws(() => spatialNodes({ spatialAppearance: { nodeColors: new Float32Array(11) } }), /values/u);
  assert.throws(() => spatialNodes({ spatialAppearance: { nodeColors: new Float32Array(12).fill(2) } }), /values/u);
  assert.throws(() => spatialNodes({ categories: new Uint8Array(3) }), /categories/u);
  assert.throws(() => spatialNodes({ categories: new Uint16Array(2) }), /categories/u);
});

test('spatial node updates refuse positions the renderer cannot hold and ignore updates after disposal', () => {
  const batch = spatialNodes();
  const viewport = { width: 640, height: 480, orbit: DEFAULT_ORBIT_CAMERA, style: resolveLyra3dStyle() };
  for (const positions of [new Float32Array(6), new Float32Array([0, 0, 0, 0, 0, 0, 0, 0, Number.NaN]), new Float32Array([0, 0, 0, 0, 0, 0, 0, 2e7, 0]), [0, 0, 0, 0, 0, 0, 0, 0, 0]]) {
    assert.throws(() => batch.update(viewport, positions, state()), /positions/u);
  }
  batch.dispose();
  batch.dispose();
  assert.doesNotThrow(() => batch.update(viewport, new Float32Array(9), state()));
});

test('nodes behind the camera get no extent, and categories choose palette colors', () => {
  const style = resolveLyra3dStyle({ palette: ['#ff0000', '#00ff00'] });
  const viewport = { width: 640, height: 480, orbit: DEFAULT_ORBIT_CAMERA, style };
  const batch = spatialNodes({ categories: new Uint16Array([0, 1, 3]) });
  batch.update(viewport, new Float32Array([0, 0, 0, 0, 0, 0, 0, 0, 2000]), state());
  const view = graphSpatialView(640, 480, DEFAULT_ORBIT_CAMERA), size = batch.mesh.geometry.getAttribute('nodeSize');
  const extent = (row, z) => graphNodeExtents(graphEye({ x: 0, y: 0, z }, DEFAULT_ORBIT_CAMERA), size.getX(row), 0, false, false, false, 3, view);
  assert.ok(extent(0, 0).paint > 0 && extent(0, 0).pick > 0, 'a visible node has a body and a hit area');
  assert.deepEqual([extent(2, 2000).paint, extent(2, 2000).pick], [0, 0], 'a node behind the near plane is neither drawn nor pickable');
  const fill = batch.mesh.geometry.getAttribute('nodeFill');
  assert.ok(fill.getX(0) > 0.9 && fill.getY(0) < 0.01, 'category 0 is the first palette color');
  assert.ok(fill.getY(1) > 0.9 && fill.getX(1) < 0.01, 'category 1 is the second palette color');
  assert.ok(fill.getY(2) > 0.9, 'categories wrap around the palette');
  batch.dispose();
});

test('node and edge paths hide anything whose endpoint has no position and collapse behind the camera', () => {
  const view = { style: resolveLyra3dStyle(), project: (point) => projectOrbitPoint(point, DEFAULT_ORBIT_CAMERA, { width: 640, height: 480 }) };
  const data = { source: new Uint32Array([0, 1]), target: new Uint32Array([1, 1]), sizes: new Float32Array([20, 20]), spatialAppearance: {} };
  const positions = [{ x: 0, y: 0, z: 0 }, { x: 80, y: 0, z: 0 }];
  assert.equal(spatialEdgePoint(data, 0, 0.5, () => null, view), null, 'no source position');
  assert.equal(spatialEdgePoint(data, 0, 0.5, (row) => (row === 0 ? positions[0] : null), view), null, 'no target position');
  assert.deepEqual(spatialEdgePoint(data, 0, 0.5, (row) => positions[row], view), { x: 40, y: 0, z: 0 });
  assert.equal(spatialNodeWorldRadius(data, 0, { x: 0, y: 0, z: 5000 }, view), 0, 'a node behind the camera has no CSS-sized radius');
  assert.equal(spatialNodeWorldRadius({ ...data, spatialAppearance: { sizeUnits: 'world' } }, 0, { x: 0, y: 0, z: 5000 }, view), 10);
  assert.equal(spatialNodeWorldRadius({ ...data, sizes: undefined }, 0, { x: 0, y: 0, z: 0 }, view) > 0, true, 'unsized nodes use the style point size');
});

test('a graph task starts from data and refuses to begin with a pin update', () => {
  assert.throws(() => createGraphTaskKernel({ type: 'pins', update: {} }), /initial data/u);
  assert.throws(() => createGraphTaskKernel({ type: 'start', data: { nodeCount: 1, source: new Uint32Array(), target: new Uint32Array() } }).update({ type: 'start' }), /new task/u);
});

test('charge forces refuse unusable options and an empty or uncharged tree exerts nothing', () => {
  const tree = buildGraphOctree(new Float32Array([0, 0, 0, 1, 0, 0]));
  for (const [strength, theta, softening] of [[Number.NaN, 0.5, 1], [-1, 0.5, 1], [2e6, 0.5, 1], [1, -1, 1], [1, Number.NaN, 1], [1, 0.5, 1e-9], [1, 0.5, Number.NaN]]) {
    assert.throws(() => graphChargeForces(tree, strength, theta, softening), RangeError, `${strength} ${theta} ${softening}`);
  }
  assert.deepEqual([...graphChargeForces(buildGraphOctree(new Float32Array(0)), 1, 0.5, 1)], []);
  assert.deepEqual([...graphChargeForces(tree, 0, 0.5, 1)], [0, 0, 0, 0, 0, 0]);
});

test('decoration admission refuses unknown label modes, non-boolean edge labels and wrong label rows', () => {
  assert.throws(() => admitGraphDecorations({ nodeLabels: 'sometimes' }, 1, 0), /label mode/u);
  assert.throws(() => admitGraphDecorations({ withEdgeLabels: 1 }, 1, 0), /edge label visibility/u);
  assert.throws(() => admitGraphDecorations({ labels: ['a'] }, 2, 0), /label rows/u);
  assert.throws(() => admitGraphDecorations({ labels: 'ab' }, 2, 0), /label rows/u);
  assert.throws(() => admitGraphDecorations({ edgeLabels: [] }, 1, 1), /label rows/u);
  assert.throws(() => admitGraphDecorations({ labels: [1, 2] }, 2, 0), TypeError);
  assert.equal(admitGraphDecorations({ nodeLabels: 'none' }, 1, 0).nodeLabels, 'none');
  assert.equal(admitGraphDecorations({}, 0, 0).nodeLabels, 'zoom', 'zoom-dependent labels are the default');
});

test('item colors prefer focus, then selection and hover, and dim only outside forced colors', () => {
  const style = resolveLyra3dStyle(DEFAULT_LYRA_3D_STYLE);
  const base = { r: 0.2, g: 0.4, b: 0.6, a: 1 };
  const rgb = (color) => [color.r, color.g, color.b].map((value) => Number(value.toFixed(4)));
  const focused = graphItemColor(style, state({ focus: 3, selected: new Set([3]) }), 3, base);
  const expected = graphItemColor(resolveLyra3dStyle({ ...DEFAULT_LYRA_3D_STYLE, accent: DEFAULT_LYRA_3D_STYLE.focus }), state({ selected: new Set([3]) }), 3, base);
  assert.deepEqual(rgb(focused), rgb(expected), 'focus uses the focus color');
  const plain = graphItemColor(style, state(), 3, base);
  const dimmed = graphItemColor(style, state({ dimmed: new Set([3]) }), 3, base);
  for (const channel of ['r', 'g', 'b']) assert.ok(Math.abs(dimmed[channel] - plain[channel] * 0.3) < 1e-12, `dimming scales ${channel}`);
  const forced = resolveLyra3dStyle({ forcedColors: true });
  const forcedPlain = graphItemColor(forced, state(), 3, base);
  const forcedDimmed = graphItemColor(forced, state({ dimmed: new Set([3]) }), 3, base);
  assert.deepEqual(rgb(forcedDimmed), rgb(forcedPlain), 'forced colors are never dimmed');
});
