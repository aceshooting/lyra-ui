import assert from 'node:assert/strict';
import test from 'node:test';
import { Color, PerspectiveCamera, SRGBColorSpace } from 'three';
import { createGraphSpatialEdges } from '../dist/graph/spatial-edges.js';
import { createGraphSpatialNodes } from '../dist/graph/spatial-nodes.js';
import { DEFAULT_ORBIT_CAMERA, projectOrbitPoint } from '../dist/core/orbit.js';
import { resolveLyra3dStyle } from '../dist/core/style.js';
import { decodePickId } from '../dist/core/picking.js';
import { graphSpatialView } from '../dist/graph/spatial-paths.js';
import { GRAPH_EDGE_DEPTH_BIAS, graphEye, graphNdcDepth, graphNodeExtents } from './graph-spatial-reference.mjs';

const state = (extra = {}) => ({ selected: new Set(), dimmed: new Set(), hover: -1, focus: -1, ...extra });
const viewport = (style = {}) => ({ width: 640, height: 480, orbit: DEFAULT_ORBIT_CAMERA, style: resolveLyra3dStyle(style) });
const attr = (batch, name) => batch.mesh.geometry.getAttribute(name).array;
const make = (extra = {}) => createGraphSpatialNodes({ nodeCount: 3, spatialAppearance: { nodeShapes: new Uint8Array([0, 1, 2]) }, ...extra });

test('spatial node quads keep row order, shapes and original IDs; translucency only flags blending', () => {
  const batch = make({ spatialAppearance: { nodeShapes: new Uint8Array([0, 1, 2]), nodeColors: new Float32Array([1, 0, 0, 0.5, 0, 1, 0, 0.5, 0, 0, 1, 0.5]) } });
  batch.update(viewport(), new Float32Array([0, 0, 100, 0, 0, -100, 0, 0, 0]), state());
  assert.equal(batch.mesh.geometry.isInstancedBufferGeometry, true);
  assert.equal(batch.mesh.geometry.instanceCount, 3);
  assert.equal(batch.mesh.geometry.hasAttribute('instanceMatrix'), false);
  const ids = attr(batch, 'pickColor');
  const rows = [];
  for (let index = 0; index < 3; index++) rows.push(decodePickId(...[...ids.slice(index * 3, index * 3 + 3)].map((v) => Math.round(v * 255))));
  assert.deepEqual(rows, [0, 1, 2]);
  assert.deepEqual([...attr(batch, 'nodeShape')], [0, 1, 2]);
  assert.equal(batch.mesh.geometry, batch.pick.geometry);
  assert.equal(batch.translucent, true); assert.equal(batch.mesh.material.transparent, true); assert.equal(batch.mesh.material.depthWrite, false);
  batch.update(viewport({ forcedColors: true }), new Float32Array([0, 0, 100, 0, 0, -100, 0, 0, 0]), state());
  assert.equal(batch.translucent, false); assert.equal(batch.mesh.material.transparent, false); assert.equal(batch.mesh.material.depthWrite, true);
  batch.dispose();
});

test('glyph sizes stay in their authored units; the shader resolves world diameters with depth', () => {
  const positions = new Float32Array([0, 0, 0, 0, 0, 250, 0, 0, 0]); const view = viewport();
  const world = make({ sizes: new Float32Array([20, 20, 20]), spatialAppearance: { sizeUnits: 'world' } });
  world.update(view, positions, state());
  assert.deepEqual([...attr(world, 'nodeSize')], [10, 10, 10]); assert.equal(world.mesh.material.uniforms.worldSizes.value, 1);
  const css = make({ sizes: new Float32Array([20, 20, 20]) }); css.update(view, positions, state());
  assert.deepEqual([...attr(css, 'nodeSize')], [10, 10, 10]); assert.equal(css.mesh.material.uniforms.worldSizes.value, 0);
  const spatial = graphSpatialView(640, 480, view.orbit), radius = (z) => graphNodeExtents(graphEye({ x: 0, y: 0, z }, view.orbit), 10, 0, false, false, true, 3, spatial).radius;
  assert.ok(Math.abs(radius(0) - 10 * projectOrbitPoint({ x: 0, y: 0, z: 0 }, view.orbit, view).scale) < 0.00001);
  assert.ok(radius(250) > radius(0) * 1.99);
  world.dispose(); css.dispose();
});

test('a camera change only moves uniforms: no glyph attribute is rewritten', () => {
  const batch = make(); batch.update(viewport(), new Float32Array(9), state());
  const versions = () => ['nodePosition', 'nodeSize', 'nodeShape', 'nodeFlags', 'nodeFill', 'nodeRing', 'nodeMarker', 'pickColor'].map((name) => batch.mesh.geometry.getAttribute(name).version);
  const before = versions(), revision = batch.revision;
  batch.setView({ width: 320, height: 200, orbit: { ...DEFAULT_ORBIT_CAMERA, pitch: 0.5, distance: 2000 } });
  assert.deepEqual(versions(), before); assert.equal(batch.revision, revision);
  assert.deepEqual(batch.mesh.material.uniforms.lyraView.value.toArray(), [320, 200, 2, 18000]);
  assert.deepEqual(batch.mesh.material.uniforms.viewportSize.value.toArray(), [320, 200]);
  batch.dispose();
});

test('selected hover and focus retain linearized RGBA fill and paint independent rings', () => {
  const colors = new Float32Array([0.5, 0.25, 0.75, 0.8, 0.5, 0.25, 0.75, 0.8, 0.5, 0.25, 0.75, 0.8]);
  const batch = make({ spatialAppearance: { nodeColors: colors, dimmedOpacity: 0.4, expandable: new Uint8Array([1, 0, 0]) } });
  colors.fill(0);
  const view = viewport(); batch.update(view, new Float32Array(9), state({ selected: new Set([0]), hover: 1, focus: 2, dimmed: new Set([0]) }));
  const expected = new Color().setRGB(0.5, 0.25, 0.75, SRGBColorSpace);
  assert.ok(Math.abs(attr(batch, 'nodeFill')[0] - expected.r) < 0.000001);
  assert.ok(Math.abs(attr(batch, 'nodeFill')[3] - 0.32) < 0.000001);
  assert.ok(Math.abs(attr(batch, 'nodeFill')[7] - 0.8) < 0.000001);
  assert.deepEqual([...attr(batch, 'nodeFlags')], [1, 1, 1, 0, 1, 0]);
  assert.ok(Math.abs(attr(batch, 'nodeRing')[3] - view.style.accent.a * 0.4) < 0.000001);
  batch.dispose();
});

test('forced colors bypass supplied color and dim alpha while preserving ring and marker', () => {
  const batch = make({ spatialAppearance: { nodeColors: new Float32Array(12), expandable: new Uint8Array([1, 0, 0]) } });
  const view = viewport({ forcedColors: true, foreground: '#00ff00' });
  batch.update(view, new Float32Array(9), state({ selected: new Set([0]), dimmed: new Set([0]) }));
  assert.deepEqual([...attr(batch, 'nodeFill').slice(0, 4)], [0, 1, 0, 1]);
  assert.deepEqual([...attr(batch, 'nodeFlags').slice(0, 2)], [1, 1]); batch.dispose();
});

test('the one-pixel picker compensates the glyph viewport so hit extents keep their CSS reach', () => {
  const batch = make({ sizes: new Float32Array([2, 2, 2]) }); batch.update(viewport(), new Float32Array(9), state());
  const camera = new PerspectiveCamera(); camera.setViewOffset(640, 480, 320, 240, 1, 1);
  batch.pick.onBeforeRender(null, null, camera);
  assert.deepEqual(batch.pick.material.uniforms.viewportSize.value.toArray(), [1, 1]);
  camera.clearViewOffset(); batch.pick.onBeforeRender(null, null, camera);
  assert.deepEqual(batch.pick.material.uniforms.viewportSize.value.toArray(), [640, 480]); batch.dispose();
});

test('invalid batch data and position updates fail atomically before buffer writes', () => {
  assert.throws(() => make({ nodeCount: 200001 }));
  assert.throws(() => make({ spatialAppearance: { nodeShapes: new Uint8Array([0, 1, 3]) } }));
  assert.throws(() => make({ spatialAppearance: { nodeColors: new Float32Array([0, 0, 0, 1]) } }));
  assert.throws(() => make({ spatialAppearance: { dimmedOpacity: NaN } }));
  const batch = make(); batch.update(viewport(), new Float32Array(9), state());
  const previous = attr(batch, 'nodePosition').slice();
  assert.throws(() => batch.update(viewport(), new Float32Array([NaN, 0, 0, 0, 0, 0, 0, 0, 0]), state()));
  assert.deepEqual(attr(batch, 'nodePosition'), previous); batch.dispose();
});

test('nodes behind the near plane have no visual or pick quad extent', () => {
  const view = graphSpatialView(640, 480, DEFAULT_ORBIT_CAMERA), extents = (z) => graphNodeExtents(graphEye({ x: 0, y: 0, z }, DEFAULT_ORBIT_CAMERA), 3, 0, true, false, false, 3, view);
  assert.deepEqual([extents(501), extents(500)].map(({ paint, pick }) => [paint, pick]), [[0, 0], [0, 0]]);
  assert.ok(extents(0).paint > 0 && extents(0).pick >= 12);
});

test('disposal releases shared geometry once and both materials, without caller mutations', () => {
  const sizes = new Float32Array([2, 4, 6]); const batch = make({ sizes }); let geometries = 0, materials = 0;
  batch.mesh.geometry.addEventListener('dispose', () => geometries++);
  batch.mesh.material.addEventListener('dispose', () => materials++); batch.pick.material.addEventListener('dispose', () => materials++);
  batch.dispose(); batch.dispose(); assert.equal(geometries, 1); assert.equal(materials, 2); assert.deepEqual([...sizes], [2, 4, 6]);
});


test('spatial node and edge picks use matching quantized depth at shared endpoints', () => {
  const input = { nodeCount: 2, source: new Uint32Array([0]), target: new Uint32Array([1]), spatialAppearance: {} };
  const nodes = createGraphSpatialNodes(input), edges = createGraphSpatialEdges(input);
  const positions = new Float32Array([-80, 0, 0, 80, 0, 0]);
  const position = (row) => ({ x: positions[row * 3], y: positions[row * 3 + 1], z: positions[row * 3 + 2] });
  for (const yaw of [0, 0.4, Math.PI]) for (const distance of [100, 500, 10000]) {
    const view = { ...viewport(), orbit: { ...DEFAULT_ORBIT_CAMERA, yaw, distance } };
    nodes.update(view, positions, state()); edges.update(view, position, state());
    // Edge endpoints are the node positions bit for bit, so both shaders evaluate the same depth.
    assert.deepEqual([...attr(edges, 'edgeStart'), ...attr(edges, 'edgeEnd')], [...attr(nodes, 'nodePosition')]);
    const spatial = graphSpatialView(640, 480, view.orbit);
    for (let row = 0; row < 2; row++) {
      const depth = graphEye(position(row), view.orbit).z;
      assert.ok(graphNdcDepth(depth, spatial) * 0.5 + 0.5 < graphNdcDepth(depth + 0.001, spatial) * 0.5 + 0.5 + GRAPH_EDGE_DEPTH_BIAS, `endpoint ${row}, yaw ${yaw}, distance ${distance}`);
    }
  }
  assert.ok(nodes.pick.material.fragmentShader.includes('gl_FragDepth = pickDepth'));
  assert.ok(nodes.pick.material.vertexShader.includes('flat varying float pickDepth'));
  assert.ok(edges.pick.material.fragmentShader.includes('flat varying vec2 depthEnds'));
  assert.ok(edges.pick.material.fragmentShader.includes('depthEnds.x+(depthEnds.y-depthEnds.x)*'));
  nodes.dispose(); edges.dispose();
});
