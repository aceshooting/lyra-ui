import assert from 'node:assert/strict';
import test from 'node:test';
import { Color, PerspectiveCamera, SRGBColorSpace } from 'three';
import { createGraphSpatialEdges } from '../dist/graph/spatial-edges.js';
import { createGraphSpatialNodes } from '../dist/graph/spatial-nodes.js';
import { DEFAULT_ORBIT_CAMERA, projectOrbitPoint } from '../dist/core/orbit.js';
import { resolveLyra3dStyle } from '../dist/core/style.js';
import { decodePickId } from '../dist/core/picking.js';

const state = (extra = {}) => ({ selected: new Set(), dimmed: new Set(), hover: -1, focus: -1, ...extra });
const viewport = (style = {}) => ({ width: 640, height: 480, orbit: DEFAULT_ORBIT_CAMERA, style: resolveLyra3dStyle(style) });
const attr = (batch, name) => batch.mesh.geometry.getAttribute(name).array;
const make = (extra = {}) => createGraphSpatialNodes({ nodeCount: 3, spatialAppearance: { nodeShapes: new Uint8Array([0, 1, 2]) }, ...extra });

test('spatial node quads retain all shapes and original IDs through depth ordering', () => {
  const batch = make({ spatialAppearance: { nodeShapes: new Uint8Array([0, 1, 2]), nodeColors: new Float32Array([1, 0, 0, 0.5, 0, 1, 0, 0.5, 0, 0, 1, 0.5]) } });
  batch.update(viewport(), new Float32Array([0, 0, 100, 0, 0, -100, 0, 0, 0]), state());
  assert.equal(batch.mesh.geometry.isInstancedBufferGeometry, true);
  assert.equal(batch.mesh.geometry.instanceCount, 3);
  assert.equal(batch.mesh.geometry.hasAttribute('instanceMatrix'), false);
  const ids = attr(batch, 'pickColor');
  const rows = [];
  for (let index = 0; index < 3; index++) rows.push(decodePickId(...[...ids.slice(index * 3, index * 3 + 3)].map((v) => Math.round(v * 255))));
  assert.deepEqual(rows, [1, 2, 0]);
  assert.deepEqual([...attr(batch, 'nodeShape')], [1, 2, 0]);
  assert.equal(batch.mesh.geometry, batch.pick.geometry);
  assert.equal(batch.mesh.material.transparent, true); assert.equal(batch.mesh.material.depthWrite, false);
  batch.update(viewport({ forcedColors: true }), new Float32Array([0, 0, 100, 0, 0, -100, 0, 0, 0]), state());
  assert.equal(batch.mesh.material.transparent, false); assert.equal(batch.mesh.material.depthWrite, true);
  assert.deepEqual([...attr(batch, 'nodeShape')], [0, 1, 2]);
  batch.dispose();
});

test('world diameters project with depth while CSS diameters remain fixed', () => {
  const positions = new Float32Array([0, 0, 0, 0, 0, 250, 0, 0, 0]); const view = viewport();
  const world = make({ sizes: new Float32Array([20, 20, 20]), spatialAppearance: { sizeUnits: 'world' } });
  world.update(view, positions, state());
  assert.ok(Math.abs(attr(world, 'nodeRadius')[0] - 10 * projectOrbitPoint({ x: 0, y: 0, z: 0 }, view.orbit, view).scale) < 0.00001);
  assert.ok(attr(world, 'nodeRadius')[1] > attr(world, 'nodeRadius')[0] * 1.99);
  const css = make({ sizes: new Float32Array([20, 20, 20]) }); css.update(view, positions, state());
  assert.deepEqual([...attr(css, 'nodeRadius')], [10, 10, 10]); world.dispose(); css.dispose();
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

test('shape-specific hit extents preserve twelve CSS-pixel reach and compensate one-pixel picker', () => {
  const batch = make({ sizes: new Float32Array([2, 2, 2]) }); batch.update(viewport(), new Float32Array(9), state());
  const extents = attr(batch, 'nodeExtent');
  assert.equal(extents[1], 12); assert.equal(extents[3], 12);
  assert.ok(Math.abs(extents[5] - 12 * Math.sqrt(Math.PI / 2)) < 0.00001);
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
  const batch = make(); batch.update(viewport(), new Float32Array([0, 0, 501, 0, 0, 500, 0, 0, 0]), state({ selected: new Set([0]) }));
  assert.deepEqual([...attr(batch, 'nodeExtent').slice(0, 4)], [0, 0, 0, 0]);
  assert.ok(attr(batch, 'nodeExtent')[4] > 0 && attr(batch, 'nodeExtent')[5] >= 12); batch.dispose();
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
  const windowDepth = (value) => value;
  for (const yaw of [0, 0.4, Math.PI]) for (const distance of [100, 500, 10000]) {
    const view = { ...viewport(), orbit: { ...DEFAULT_ORBIT_CAMERA, yaw, distance } };
    view.project = (point) => projectOrbitPoint(point, view.orbit, view);
    nodes.update(view, positions, state()); edges.update(view, position, state());
    const nodeDepth = attr(nodes, 'nodePickDepth'), edgeDepth = attr(edges, 'pickDepth');
    for (let row = 0; row < 2; row++) assert.ok(windowDepth(nodeDepth[row]) <= windowDepth(edgeDepth[row]), `endpoint ${row}, yaw ${yaw}, distance ${distance}`);
  }
  assert.ok(nodes.pick.material.fragmentShader.includes('gl_FragDepth = pickDepth'));
  assert.ok(nodes.pick.material.vertexShader.includes('flat varying float pickDepth'));
  assert.ok(edges.pick.material.fragmentShader.includes('flat varying vec2 depthEnds'));
  assert.ok(edges.pick.material.fragmentShader.includes('depthEnds.x+(depthEnds.y-depthEnds.x)*'));
  nodes.dispose(); edges.dispose();
});
