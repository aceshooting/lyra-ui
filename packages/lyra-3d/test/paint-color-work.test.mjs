import assert from 'node:assert/strict';
import test from 'node:test';
import * as three from 'three';
import { createPointBatch } from '../dist/points/batches.js';
import { admitPointsData } from '../dist/points/data.js';
import { createGraphEngine } from '../dist/graph/engine.js';
import { createGraphSpatialNodes } from '../dist/graph/spatial-nodes.js';
import { createGraphSpatialEdges } from '../dist/graph/spatial-edges.js';
import * as orbit from '../dist/core/orbit.js';
import * as style from '../dist/core/style.js';
import { graphData, state, viewportHarness } from './performance-fixture.mjs';

const options = { palette: ['#7589a3'], accent: '#a27549', focus: '#4975a2', foreground: '#8975a3', muted: '#a38975' };
const count = 128;
const all = length => new Set(Array.from({ length }, (_, row) => row));
const attr = (batch, name) => batch.mesh.geometry.getAttribute(name).array;
const rgb = (value, source = three.SRGBColorSpace, dim = 1) => {
  const color = new three.Color().setRGB(value.r, value.g, value.b, source).multiplyScalar(dim);
  return [color.r, color.g, color.b].map(Math.fround);
};
const rgba = (value, dim = 1) => [...rgb(value), Math.fround(value.a * dim)];

// Count the real Three conversion entry point without replacing its behavior.
function conversions(action) {
  const descriptor = Object.getOwnPropertyDescriptor(three.Color.prototype, 'setRGB');
  const calls = new Map();
  Object.defineProperty(three.Color.prototype, 'setRGB', { ...descriptor, value: function (...args) {
    calls.set(args[3], (calls.get(args[3]) ?? 0) + 1);
    return Reflect.apply(descriptor.value, this, args);
  } });
  try { action(); return calls; } finally { Object.defineProperty(three.Color.prototype, 'setRGB', descriptor); }
}

test('point paints convert shared style colors once without rounding before dimming', () => {
  const batch = createPointBatch(admitPointsData({ positions: new Float32Array(count * 3) }));
  const resolved = style.resolveLyra3dStyle(options);
  const next = state({ selected: all(count), focus: 3, dimmed: new Set([0, 2, 3, 7]) });
  try {
    const observations = [];
    for (const paint of [() => batch.paint(resolved, next), () => batch.paintState(resolved, next, null)]) {
      observations.push(conversions(paint));
      for (let row = 0; row < count; row++) assert.deepEqual([...attr(batch, 'pointColor').slice(row * 3, row * 3 + 3)],
        rgb(row === next.focus ? resolved.focus : resolved.accent, three.SRGBColorSpace, next.dimmed.has(row) ? 0.3 : 1));
    }
    for (const calls of observations) assert.equal(calls.get(three.SRGBColorSpace), 2, 'only accent and focus require conversion in each paint');
  } finally { batch.dispose(); }
});

test('point authored linear colors and forced-color precedence survive color-management changes between paints', () => {
  const colors = Float32Array.from({ length: count * 3 }, (_, index) => ((index % 17) + 1) / 19);
  const batch = createPointBatch(admitPointsData({ positions: new Float32Array(count * 3), colors }));
  const next = state({ selected: new Set([1, 3]), hover: 2, focus: 3, dimmed: new Set([0, 1, 2, 3, 4]) });
  const saved = { enabled: three.ColorManagement.enabled, workingColorSpace: three.ColorManagement.workingColorSpace };
  const observations = [];
  try {
    for (const forcedColors of [false, true]) {
      const resolved = style.resolveLyra3dStyle({ ...options, forcedColors });
      // Reuse this exact style object: a cache must not survive a paint invocation.
      for (const [enabled, workingColorSpace] of [[true, three.LinearSRGBColorSpace], [false, three.LinearSRGBColorSpace], [true, three.SRGBColorSpace]]) {
        Object.assign(three.ColorManagement, { enabled, workingColorSpace });
        observations.push({ forcedColors, calls: conversions(() => batch.paint(resolved, next)) });
        for (let row = 0; row < count; row++) {
          const override = row === next.focus ? resolved.focus : next.selected.has(row) || row === next.hover ? resolved.accent : forcedColors ? resolved.foreground : undefined;
          const value = override ?? { r: colors[row * 3], g: colors[row * 3 + 1], b: colors[row * 3 + 2] };
          assert.deepEqual([...attr(batch, 'pointColor').slice(row * 3, row * 3 + 3)],
            rgb(value, override ? three.SRGBColorSpace : three.LinearSRGBColorSpace, !forcedColors && next.dimmed.has(row) ? 0.3 : 1));
        }
      }
    }
    for (const { forcedColors, calls } of observations) {
      assert.equal(calls.get(three.SRGBColorSpace), forcedColors ? 3 : 2, 'only used style colors are converted');
      assert.equal(calls.get(three.LinearSRGBColorSpace) ?? 0, forcedColors ? 0 : count - 3, 'authored row colors still use Three on every row');
    }
  } finally { Object.assign(three.ColorManagement, saved); batch.dispose(); }
});

for (const authored of [false, true]) for (const forcedColors of [false, true]) {
  test(`spatial colors reuse only resolved style values (authored=${authored}, forced=${forcedColors})`, () => {
    const data = graphData(count, true);
    const raw = Float32Array.from({ length: count * 4 }, (_, index) => index % 4 === 3 ? 0.8 : ((index % 13) + 1) / 17);
    data.spatialAppearance = { dimmedOpacity: 0.4, ...(authored ? { nodeColors: raw, edgeColors: raw } : {}) };
    const nodes = createGraphSpatialNodes(data), edges = createGraphSpatialEdges(data);
    const view = { width: 640, height: 480, orbit: orbit.DEFAULT_ORBIT_CAMERA, style: style.resolveLyra3dStyle({ ...options, forcedColors }) };
    const next = state({ selected: new Set([0, count]), hover: count + 1, focus: count + 2, dimmed: new Set([0, 1, count, count + 2]) });
    const position = row => ({ x: data.positions[row * 3], y: data.positions[row * 3 + 1], z: data.positions[row * 3 + 2] });
    const observations = [];
    try {
      nodes.update(view, data.positions, state()); edges.update(view, position, state());
      for (const paint of [() => { nodes.updateStyle(view, next); edges.updateStyle(view, next); },
        () => { nodes.updateState(view, next, null); edges.updateState(view, next, null); }]) {
        observations.push(conversions(paint));
        for (let row = 0; row < count; row++) {
          const authoredColor = { r: raw[row * 4], g: raw[row * 4 + 1], b: raw[row * 4 + 2], a: raw[row * 4 + 3] };
          const nodeBase = forcedColors ? view.style.foreground : authored ? authoredColor : view.style.palette[0];
          const nodeDim = !forcedColors && next.dimmed.has(row) ? 0.4 : 1;
          for (const [name, value] of [['nodeFill', nodeBase], ['nodeRing', view.style.accent], ['nodeMarker', view.style.foreground]]) {
            assert.deepEqual([...attr(nodes, name).slice(row * 4, row * 4 + 4)], rgba(value, nodeDim));
          }
          const item = count + row;
          const edgeBase = next.selected.has(item) || next.hover === item ? view.style.accent : forcedColors ? view.style.foreground : authored ? authoredColor : view.style.muted;
          assert.deepEqual([...attr(edges, 'edgeColor').slice(row * 4, row * 4 + 4)], rgba(edgeBase, !forcedColors && next.dimmed.has(item) ? 0.4 : 1), 'focus alone does not change spatial edge paint');
        }
      }
      const expected = forcedColors ? 4 : authored ? count * 2 + 1 : 5;
      for (const calls of observations) assert.equal(calls.get(three.SRGBColorSpace), expected, 'authored RGB stays per row; each used style color is converted once per batch paint');
    } finally { nodes.dispose(); edges.dispose(); }
  });
}

test('classic nodes, edges, arrows and particles share style conversions within their paint', async () => {
  const h = viewportHarness(three, orbit, style);
  const engine = createGraphEngine({ viewport: () => h.viewport, task: () => ({ mode: 'main-thread', stop() {}, update() {} }) });
  engine.setData({ ...graphData(count), directed: new Uint8Array(count).fill(1), particlesPerEdge: 1, particleSpeed: 0 }, 0);
  engine.setStyle(options);
  const next = state({ selected: all(count * 2), focus: 3, dimmed: new Set([0, 3, count, count + 2]) });
  try {
    await engine.mount({}, h.host); h.viewport.tick(0);
    const calls = conversions(() => { engine.setState(next); h.viewport.tick(1); });
    const meshes = h.viewport.world.children.filter(mesh => mesh.isInstancedMesh);
    assert.equal(meshes.length, 4, 'nodes, edges, arrows and particles are all present');
    for (let kind = 0; kind < meshes.length; kind++) for (let row = 0; row < count; row++) {
      const item = (kind === 0 ? 0 : count) + row;
      const value = item === next.focus ? h.viewport.style.focus : h.viewport.style.accent;
      assert.deepEqual([...meshes[kind].instanceColor.array.slice(row * 3, row * 3 + 3)], rgb(value, three.SRGBColorSpace, next.dimmed.has(item) ? 0.3 : 1));
    }
    assert.equal(calls.get(three.SRGBColorSpace), 3, 'the engine uses focus/accent and the decoration paint shares one accent conversion');
  } finally { engine.dispose(); }
});
