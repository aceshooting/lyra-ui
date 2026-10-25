import assert from 'node:assert/strict';
import test from 'node:test';
import * as three from 'three';
import { WebGLAttributes } from 'three/src/renderers/webgl/WebGLAttributes.js';
import { createGraphEngine } from '../dist/graph/engine.js';
import { createGraphSpatialEdges } from '../dist/graph/spatial-edges.js';
import * as orbit from '../dist/core/orbit.js';
import * as style from '../dist/core/style.js';
import { attributesOf, state, uploadRecorder, viewportHarness, visualSnapshot } from './performance-fixture.mjs';

const initialStyle = { pointSize: 6, lineWidth: 1, accent: '#a27549' };
const selected = state({ selected: new Set([0, 1, 2]) });
const geometryNames = ['edgeStart', 'edgeEnd', 'edgePath', 'pickColor'];
const input = extra => ({ nodeCount: 2, positions: new Float32Array([-40, 0, 20, 60, 10, -20]),
  source: new Uint32Array([0]), target: new Uint32Array([1]), spatialAppearance: {}, ...extra });

async function fixture(data, nextStyle = initialStyle) {
  const h = viewportHarness(three, orbit, style), jobs = [];
  const engine = createGraphEngine({ viewport: () => h.viewport, task: options => {
    jobs.push(options); return { mode: 'main-thread', stop() {}, update() {} };
  } });
  engine.setData(data, 0); engine.setStyle(nextStyle); engine.setState(selected);
  try { await engine.mount({}, h.host); } catch (error) { engine.dispose(); throw error; }
  const edge = h.viewport.pickWorld.children.find(mesh => mesh.geometry?.hasAttribute('edgeStart'));
  assert.ok(edge, 'the spatial pick mesh owns the source edge attributes');
  return { ...h, engine, jobs, edge, attributes: attributesOf(h.viewport) };
}

for (const [name, extra, radiusDependsOnStyle] of [
  ['ordinary', {}, false],
  ['default arrow', { directed: new Uint8Array([1]) }, true],
  ['default loop', { target: new Uint32Array([0]) }, true],
  ['authored arrow', { directed: new Uint8Array([1]), sizes: new Float32Array([12, 18]) }, false],
  ['authored world loop', { target: new Uint32Array([0]), sizes: new Float32Array([12, 18]), spatialAppearance: { sizeUnits: 'world' } }, false],
  ['directed dangling', { target: new Uint32Array([0]), directed: new Uint8Array([1]), spatialAppearance: { dangling: new Uint8Array([1]) } }, false],
]) {
  test(`style repaints preserve only independent edge geometry (${name})`, async () => {
    const data = input(extra), f = await fixture(data), gpu = uploadRecorder(f.attributes, WebGLAttributes);
    const observations = [];
    try {
      for (const [nextStyle, radiusChanged] of [
        [{ ...initialStyle, pointSize: 17, lineWidth: 4 }, true],
        [{ ...initialStyle, pointSize: 17, lineWidth: 4, accent: '#4975a2' }, false],
        [initialStyle, true],
      ]) {
        const previous = Object.fromEntries(geometryNames.map(key => [key, f.edge.geometry.getAttribute(key).version]));
        f.engine.setStyle(nextStyle);
        const control = await fixture(data, nextStyle);
        try { assert.deepEqual(visualSnapshot(f.viewport), visualSnapshot(control.viewport), 'style output, geometric radii and pick buffers match a fresh full build'); }
        finally { control.engine.dispose(); }
        gpu.flush();
        assert.deepEqual(gpu.mirrors(), visualSnapshot(f.viewport).attributes, 'pending uploads include every changed geometry and paint value');
        observations.push({ previous, current: Object.fromEntries(geometryNames.map(key => [key, f.edge.geometry.getAttribute(key).version])), refresh: radiusDependsOnStyle && radiusChanged });
      }
      for (const { previous, current, refresh } of observations) for (const key of geometryNames) {
        if (refresh && key !== 'pickColor') assert.ok(current[key] > previous[key], `${key} must refresh a changed default loop/arrow radius`);
        else assert.equal(current[key], previous[key], `${key} must not refresh when positions and its radius dependencies are unchanged`);
      }
    } finally { gpu.dispose(); f.engine.dispose(); }
  });
}

test('worker and pin position revisions refresh geometry before a subsequent style-only repaint', async () => {
  const data = input({ directed: new Uint8Array([1]) }), f = await fixture(data);
  const gpu = uploadRecorder(f.attributes, WebGLAttributes), observations = [];
  const moved = new Float32Array([-80, 30, 50, 90, -20, -40]);
  try {
    const beforeWorker = f.edge.geometry.getAttribute('edgeStart').version;
    f.jobs[0].onOutput({ positions: moved.slice(), epoch: 0 }, false);
    assert.ok(f.edge.geometry.getAttribute('edgeStart').version > beforeWorker);
    const beforeStyle = f.edge.geometry.getAttribute('edgeStart').version;
    f.engine.setStyle({ ...initialStyle, lineWidth: 3 });
    observations.push([beforeStyle, f.edge.geometry.getAttribute('edgeStart').version]);
    let control = await fixture({ ...data, positions: moved }, { ...initialStyle, lineWidth: 3 });
    try { assert.deepEqual(visualSnapshot(f.viewport), visualSnapshot(control.viewport)); } finally { control.engine.dispose(); }
    gpu.flush(); assert.deepEqual(gpu.mirrors(), visualSnapshot(f.viewport).attributes);

    f.engine.setPins({ indices: new Uint32Array([1]), positions: new Float32Array([100, 40, -60]), pinned: new Uint8Array([1]) });
    const beforePinnedStyle = f.edge.geometry.getAttribute('edgeEnd').version;
    moved.set([100, 40, -60], 3);
    f.engine.setStyle(initialStyle);
    observations.push([beforePinnedStyle, f.edge.geometry.getAttribute('edgeEnd').version]);
    control = await fixture({ ...data, positions: moved });
    try { assert.deepEqual(visualSnapshot(f.viewport), visualSnapshot(control.viewport)); } finally { control.engine.dispose(); }
    gpu.flush(); assert.deepEqual(gpu.mirrors(), visualSnapshot(f.viewport).attributes);
    for (const [before, after] of observations) assert.equal(after, before, 'a completed position revision cannot be redundantly refreshed by a geometry-independent style');
  } finally { gpu.dispose(); f.engine.dispose(); }
});

test('direct edge style calls still refresh dynamic lookup positions and validity without a stable-position proof', () => {
  const data = input({ directed: new Uint8Array([1]) }), batch = createGraphSpatialEdges(data);
  const view = { width: 640, height: 480, orbit: orbit.DEFAULT_ORBIT_CAMERA, style: style.resolveLyra3dStyle(initialStyle) };
  let endpoint = { x: 60, y: 10, z: -20 };
  const lookup = row => row === 0 ? { x: -40, y: 0, z: 20 } : endpoint;
  const snapshot = value => Object.fromEntries(Object.entries(value.mesh.geometry.attributes).map(([key, attr]) => [key, Array.from(attr.array)]));
  try {
    batch.update(view, lookup, selected);
    for (const next of [null, { x: 110, y: -50, z: 75 }]) {
      endpoint = next;
      const before = batch.mesh.geometry.getAttribute('edgeEnd').version;
      batch.updateStyle(view, selected);
      const control = createGraphSpatialEdges(data);
      try {
        control.update(view, lookup, selected);
        assert.deepEqual(snapshot(batch), snapshot(control));
        assert.deepEqual(batch.anchors, control.anchors);
        assert.equal(batch.translucent, control.translucent);
      } finally { control.dispose(); }
      assert.ok(batch.mesh.geometry.getAttribute('edgeEnd').version > before);
      assert.equal(batch.mesh.geometry.getAttribute('stroke').getX(0) > 0, next !== null, 'validity loss and recovery update visible and pick geometry');
    }
  } finally { batch.dispose(); }
});
