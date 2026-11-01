import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { createGraphSpatialEdges, createGraphSpatialEdgesWork } from '../dist/graph/spatial-edges.js';
import { createGraphDataPreparationWork } from '../dist/graph/data-preparation.js';
import { createGraphSceneFactsWork } from '../dist/graph/scene-facts-work.js';
import { DEFAULT_ORBIT_CAMERA } from '../dist/core/orbit.js';
import { resolveLyra3dStyle } from '../dist/core/style.js';

function drain(work) {
  try {
    for (let calls = 0; calls < 10000; calls++) {
      const step = work.step(4096);
      if (step.done) return step.value;
    }
    assert.fail('generated graph preparation did not finish');
  } finally { work.dispose(); }
}
function finish(data, facts, presentation, budget) {
  const work = createGraphSpatialEdgesWork(data, facts, presentation);
  const totals = { operations: 0, allocatedBytes: 0, visitedEdges: 0, initializedPrimitives: 0, copiedDashValues: 0 };
  try {
    for (let calls = 0; calls < 10000; calls++) {
      const step = work.step(budget);
      for (const field of Object.keys(totals)) {
        assert.ok(Number.isSafeInteger(step[field]) && step[field] >= 0, field);
        totals[field] += step[field];
      }
      assert.ok(step.operations <= budget);
      if (step.done) { assert.ok(step.value); return { value: step.value, ...totals }; }
      assert.ok(step.operations > 0); assert.equal(step.value, undefined);
    }
    assert.fail('generated spatial edges did not finish');
  } finally { work.dispose(); }
}
function capture(batch) {
  const geometry = batch.mesh.geometry, material = batch.mesh.material;
  return {
    attributes: Object.fromEntries(Object.entries(geometry.attributes).map(([name, attribute]) => [name,
      { array: attribute.array.slice(), version: attribute.version, ranges: attribute.updateRanges.map(range => ({ ...range })) }])),
    index: geometry.index.array.slice(), anchors: batch.anchors.slice(),
    atlas: material.uniforms.dashAtlas.value.image.data.slice(),
    transparent: material.transparent, depthWrite: material.depthWrite, materialVersion: material.version,
    translucent: batch.translucent, revision: batch.revision,
    worldSizes: material.uniforms.worldSizes.value, atlasHeight: material.uniforms.atlasHeight.value,
    window: material.uniforms.viewWindow.value.toArray(), view: material.uniforms.lyraView.value.toArray(),
    changes: batch.takeChanges(),
  };
}
const linear = value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
const point = (data, row) => Array.from(data.positions.subarray(row * 3, row * 3 + 3));

function expectedMetadata(data) {
  const appearance = data.spatialAppearance, patterns = [[]], keys = new Map([['', 0]]), edges = [];
  let primitives = 0;
  for (let edge = 0; edge < data.source.length; edge++) {
    const dangling = appearance.dangling?.[edge] === 1;
    const loop = !dangling && data.source[edge] === data.target[edge];
    const bend = !dangling && !loop ? appearance.edgeCurvatures?.[edge] ?? 0 : 0;
    const segments = loop || bend !== 0 ? 16 : 1;
    const pattern = dangling ? [4, 4] : appearance.edgeDashes?.[edge] ?? [];
    const key = pattern.join(',');
    if (!keys.has(key)) { keys.set(key, patterns.length); patterns.push(pattern); }
    const count = segments + Number(Boolean(data.directed?.[edge]));
    edges.push({ dangling, loop, bend, segments, count, offset: primitives, pattern: keys.get(key) });
    primitives += count;
  }
  return { edges, primitives, patterns, dashValues: patterns.reduce((sum, pattern) => sum + pattern.length, 0),
    height: Math.max(1, Math.ceil(patterns.length / 32)) };
}

// Quadratic displacement is four times the midpoint displacement times t(1-t).
function curveAnchor(a, b, curvature, t) {
  const delta = b.map((value, axis) => value - a[axis]), magnitude = delta.map(Math.abs);
  const axis = magnitude.indexOf(Math.min(...magnitude));
  const basis = [0, 0, 0]; basis[axis] = 1;
  const normal = [delta[1] * basis[2] - delta[2] * basis[1], delta[2] * basis[0] - delta[0] * basis[2], delta[0] * basis[1] - delta[1] * basis[0]];
  const normalLength = Math.hypot(...normal);
  const displacement = normalLength ? 4 * curvature * Math.hypot(...delta) * t * (1 - t) / normalLength : 0;
  return a.map((value, component) => value + delta[component] * t + normal[component] * displacement);
}
function assertIndependent(batch, data, presentation, metadata) {
  const geometry = batch.mesh.geometry, attributes = geometry.attributes;
  const appearance = data.spatialAppearance, { style, state } = presentation;
  const expectedAtlas = new Float32Array(2048 * metadata.height);
  for (const [row, pattern] of metadata.patterns.entries()) {
    expectedAtlas[row * 64] = pattern.length;
    expectedAtlas[row * 64 + 1] = pattern.reduce((sum, value) => sum + value, 0);
    for (let scalar = 0; scalar < pattern.length; scalar++) expectedAtlas[row * 64 + scalar + 2] = pattern[scalar];
  }
  const texture = batch.mesh.material.uniforms.dashAtlas.value;
  assert.deepEqual(texture.image.data, expectedAtlas);
  assert.equal(texture.image.width, 2048); assert.equal(texture.image.height, metadata.height);
  assert.equal(batch.mesh.material.uniforms.atlasHeight.value, metadata.height);
  assert.equal(geometry.instanceCount, metadata.primitives);
  assert.equal(batch.pick.geometry === geometry, true);
  let translucent = false;
  for (const [edge, row] of metadata.edges.entries()) {
    const item = data.nodeCount + edge, source = data.source[edge], target = data.target[edge];
    const a = point(data, source), b = row.dangling ? [a[0] + 28, a[1] - 28, a[2]] : point(data, target);
    const radius = row.loop ? (data.sizes?.[source] ?? style.pointSize) / 2 * 1.6 : 0;
    const selected = state.selected.has(item) || state.hover === item;
    const raw = appearance.edgeColors;
    const rgba = selected ? style.accent : style.forcedColors ? style.foreground : raw
      ? { r: raw[edge * 4], g: raw[edge * 4 + 1], b: raw[edge * 4 + 2], a: raw[edge * 4 + 3] } : style.muted;
    const alpha = rgba.a * (!style.forcedColors && state.dimmed.has(item) ? appearance.dimmedOpacity ?? 0.35 : 1);
    const width = appearance.edgeWidths?.[edge] ?? style.lineWidth;
    const eligible = width > 0 && (raw?.[edge * 4 + 3] ?? style.muted.a) > 0;
    const visible = eligible && alpha > 0;
    translucent ||= visible && alpha < 1;
    for (let primitive = 0; primitive < row.count; primitive++) {
      const index = row.offset + primitive, arrow = primitive === row.segments;
      const t0 = arrow ? 1 - 1 / row.segments : primitive / row.segments;
      const t1 = arrow ? 1 : (primitive + 1) / row.segments;
      const read = (name, size) => Array.from(attributes[name].array.subarray(index * size, (index + 1) * size));
      assert.deepEqual(read('edgeStart', 3), a); assert.deepEqual(read('edgeEnd', 3), b.map(Math.fround));
      assert.deepEqual(read('edgePath', 4), [t0, t1, Math.fround(radius), Math.fround(arrow && !row.dangling ? (data.sizes?.[target] ?? style.pointSize) / 2 : 0)]);
      assert.ok(Object.is(attributes.edgeCurvature.array[index], Math.fround(row.bend)));
      assert.equal(attributes.dash.array[index], arrow ? 0 : row.pattern);
      const id = item + 1;
      assert.deepEqual(read('pickColor', 3), [id & 255, (id >> 8) & 255, (id >> 16) & 255].map(value => Math.fround(value / 255)));
      const head = Math.max(6, (width + (selected ? 2 : 0)) * 3);
      assert.deepEqual(read('stroke', 3), [Math.fround(visible ? arrow ? head * Math.tan(0.45) * 2 : width + (selected ? 2 : 0) : 0),
        !arrow && eligible && !row.dangling ? Math.fround(Math.max(12, width)) : 0, Number(arrow)]);
      const color = read('edgeColor', 4);
      for (const [channel, name] of ['r', 'g', 'b'].entries()) assert.ok(Math.abs(color[channel] - linear(rgba[name])) < 0.000001);
      assert.equal(color[3], Math.fround(alpha));
      const middle = (Math.fround(t0) + Math.fround(t1)) / 2;
      let anchor;
      if (arrow) anchor = b;
      else if (row.loop) anchor = appearance.sizeUnits === 'world'
        ? [a[0] + Math.sin(middle * 2 * Math.PI) * radius, a[1] - (1 - Math.cos(middle * 2 * Math.PI)) * radius, a[2]] : a;
      else anchor = curveAnchor(a, b, Math.fround(row.bend), middle);
      for (let axis = 0; axis < 3; axis++) {
        const actual = batch.anchors[index * 3 + axis], expected = Math.fround(anchor[axis]);
        const tolerance = Math.max(1, Math.abs(a[axis]), Math.abs(b[axis]), Math.abs(expected)) * 2 ** -22;
        assert.ok(Math.abs(actual - expected) <= tolerance, `anchor edge ${edge}, primitive ${primitive}, axis ${axis}`);
      }
    }
  }
  assert.equal(batch.translucent, translucent); assert.equal(batch.mesh.material.transparent, translucent);
  assert.equal(batch.mesh.material.depthWrite, !translucent); assert.equal(batch.mesh.material.version, Number(!translucent));
  assert.equal(batch.revision, 1);
  for (const name of ['edgeStart', 'edgeEnd', 'edgePath', 'edgeColor', 'stroke']) {
    const attribute = attributes[name];
    assert.equal(attribute.version, Number(metadata.primitives > 0));
    assert.deepEqual(attribute.updateRanges, metadata.primitives ? [{ start: 0, count: attribute.array.length }] : []);
  }
  for (const name of ['pickColor', 'dash', 'edgeCurvature']) assert.equal(attributes[name].version, 0);
}

function check(raw, presentation) {
  const before = structuredClone(raw), data = drain(createGraphDataPreparationWork(raw)).data;
  const saved = structuredClone(data), facts = drain(createGraphSceneFactsWork(data, presentation.style.pointSize));
  const metadata = expectedMetadata(data);
  assert.equal(facts.spatialEdgePrimitiveCount, metadata.primitives);
  const legacy = createGraphSpatialEdges(data);
  try {
    legacy.update(presentation, row => ({ x: data.positions[row * 3], y: data.positions[row * 3 + 1], z: data.positions[row * 3 + 2] }), presentation.state);
    const differential = capture(legacy);
    for (const budget of [1, 7, 4096]) {
      const result = finish(data, facts, presentation, budget), { batch, ownedBuffers, borrowedBuffers } = result.value;
      try {
        assert.equal(result.operations, 26 + 2 * data.source.length + metadata.patterns.length + metadata.dashValues + metadata.primitives);
        assert.equal(result.allocatedBytes, 100 * metadata.primitives + 10 * data.source.length + 8192 * metadata.height + 144);
        assert.equal(result.visitedEdges, 2 * data.source.length); assert.equal(result.initializedPrimitives, metadata.primitives);
        assert.equal(result.copiedDashValues, metadata.dashValues);
        assertIndependent(batch, data, presentation, metadata); assert.deepEqual(capture(batch), differential);
        assert.deepEqual(batch.takeChanges(), { full: false, rows: [] });
        assert.equal(ownedBuffers.length, 18); assert.equal(new Set(ownedBuffers).size, 18);
        assert.equal(ownedBuffers.reduce((sum, buffer) => sum + buffer.byteLength, 0), result.allocatedBytes);
        for (const attribute of Object.values(batch.mesh.geometry.attributes)) assert.equal(ownedBuffers.includes(attribute.array.buffer), true);
        assert.equal(ownedBuffers.includes(batch.mesh.geometry.index.array.buffer), true);
        for (const buffer of batch.allocationBuffers()) assert.equal(ownedBuffers.includes(buffer), true);
        const appearance = data.spatialAppearance;
        const borrowed = [data.source, data.target, data.positions, data.sizes, data.directed,
          appearance.edgeWidths, appearance.edgeColors, appearance.edgeCurvatures, appearance.dangling].filter(Boolean).map(value => value.buffer);
        assert.equal(borrowedBuffers.length, new Set(borrowed).size);
        assert.equal(new Set(borrowedBuffers).size, borrowedBuffers.length);
        for (const buffer of new Set(borrowed)) assert.equal(borrowedBuffers.includes(buffer), true);
        for (const buffer of borrowedBuffers) assert.equal(ownedBuffers.includes(buffer), false);
        assert.equal(batch.mesh.parent, null); assert.equal(batch.pick.parent, null);
        assert.deepEqual(data, saved); assert.deepEqual(raw, before);
      } finally { batch.dispose(); }
    }
  } finally { legacy.dispose(); }
}

const dash = fc.oneof(fc.constantFrom([], [0], [-0], [0, 0], [4, 4], [2, 0, 3], [1 / 3, 1 / 7, 1 / 11]),
  fc.array(fc.integer({ min: 0, max: 20 }), { maxLength: 8 }));
const row = fc.record({ source: fc.nat(7), target: fc.nat(7), directed: fc.boolean(), dangling: fc.boolean(),
  curvature: fc.constantFrom(-1, -0.123456789, -0, 0, 0.1, 1), width: fc.constantFrom(0, 0.25, 2, 17),
  red: fc.integer({ min: 0, max: 255 }), green: fc.integer({ min: 0, max: 255 }), blue: fc.integer({ min: 0, max: 255 }),
  alpha: fc.constantFrom(0, 0.25, 0.8, 1), selected: fc.boolean(), dimmed: fc.boolean(), dash });
test('prepared spatial edges obey independent primitive, atlas, paint and ownership rules across work budgets', () => {
  fc.assert(fc.property(fc.record({ nodes: fc.integer({ min: 0, max: 8 }), edges: fc.integer({ min: 0, max: 12 }),
    rows: fc.array(row, { minLength: 12, maxLength: 12 }), positions: fc.boolean(), sizes: fc.boolean(), colors: fc.boolean(), widths: fc.boolean(),
    directed: fc.boolean(), curves: fc.boolean(), dangling: fc.boolean(), world: fc.boolean(), forced: fc.boolean(), reduced: fc.boolean(),
    coincident: fc.boolean(), coordinate: fc.constantFrom(-10000000, -0, 0, 1 / 3, 97.25, 10000000),
    size: fc.constantFrom(-0, 0, 2, 17, 1024), opacity: fc.constantFrom(0, 0.35, 1), hover: fc.integer({ min: -1, max: 11 }) }), value => {
    const count = value.nodes ? value.edges : 0, rows = value.rows.slice(0, count);
    const raw = { nodeCount: value.nodes, source: Uint32Array.from(rows, entry => entry.source % value.nodes),
      target: Uint32Array.from(rows, entry => (value.dangling && entry.dangling ? entry.source : entry.target) % value.nodes), options: { seed: 17 },
      ...(value.positions ? { positions: Float32Array.from({ length: value.nodes * 3 }, (_, scalar) => value.coordinate
        + (value.coordinate > 0 ? -1 : 1) * (value.coincident ? scalar % 3 : scalar) / 8) } : {}),
      ...(value.sizes ? { sizes: new Float32Array(value.nodes).fill(value.size) } : {}),
      ...(value.directed ? { directed: Uint8Array.from(rows, entry => Number(entry.directed)) } : {}),
      spatialAppearance: { sizeUnits: value.world ? 'world' : 'css', dimmedOpacity: value.opacity, edgeDashes: rows.map(entry => [...entry.dash]),
        ...(value.curves ? { edgeCurvatures: Float32Array.from(rows, entry => entry.curvature) } : {}),
        ...(value.dangling ? { dangling: Uint8Array.from(rows, entry => Number(entry.dangling)) } : {}),
        ...(value.widths ? { edgeWidths: Float32Array.from(rows, entry => entry.width) } : {}),
        ...(value.colors ? { edgeColors: Float32Array.from(rows.flatMap(entry => [entry.red / 255, entry.green / 255, entry.blue / 255, entry.alpha])) } : {}) } };
    check(raw, { width: 320, height: 200, orbit: { ...DEFAULT_ORBIT_CAMERA, distance: 2000, pitch: 0.25 },
      style: resolveLyra3dStyle({ pointSize: value.size, lineWidth: 2.75, forcedColors: value.forced, reducedMotion: value.reduced,
        muted: 'rgba(64, 128, 192, 0.8)', accent: 'rgba(255, 0, 128, 0.5)', foreground: '#80ff40' }),
      state: { selected: new Set(rows.flatMap((entry, edge) => entry.selected ? [value.nodes + edge] : [])),
        dimmed: new Set(rows.flatMap((entry, edge) => entry.dimmed ? [value.nodes + edge] : [])), hover: value.hover < count && value.hover >= 0 ? value.nodes + value.hover : -1,
        focus: count ? value.nodes : -1 } });
  }), { seed: 20261029, numRuns: 200 });
});

test('atlas boundaries and first-seen signed-zero patterns preserve exact independent ledgers', () => {
  for (const patterns of [[], Array.from({ length: 31 }, (_, index) => [index + 1]), Array.from({ length: 32 }, (_, index) => [index + 1]),
    [[-0], [0], [], [0, 0], [4, 4], [99], [1 / 3, 1 / 7, 1 / 11], [1 / 3, 1 / 7, 1 / 11]]]) {
    const edges = patterns.length;
    check({ nodeCount: 2, positions: new Float32Array([0, 0, 0, 10000000, 0, 0]), source: new Uint32Array(edges), target: Uint32Array.from({ length: edges }, (_, edge) => Number(edge !== 5)),
      directed: new Uint8Array(edges).fill(1), spatialAppearance: { edgeDashes: patterns, edgeCurvatures: new Float32Array(edges).fill(0.123456789),
        dangling: Uint8Array.from({ length: edges }, (_, edge) => Number(edge === 5)) } },
    { width: 640, height: 480, orbit: DEFAULT_ORBIT_CAMERA, style: resolveLyra3dStyle(),
      state: { selected: new Set(), dimmed: new Set(), hover: -1, focus: -1 } });
  }
});
