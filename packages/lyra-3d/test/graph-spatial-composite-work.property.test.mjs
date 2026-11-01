import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { createGraphSpatialComposite, createGraphSpatialCompositeWork } from '../dist/graph/spatial-composite.js';
import { createGraphSpatialNodesWork } from '../dist/graph/spatial-nodes.js';
import { createGraphSpatialEdgesWork } from '../dist/graph/spatial-edges.js';
import { createGraphDataPreparationWork } from '../dist/graph/data-preparation.js';
import { createGraphSceneFactsWork } from '../dist/graph/scene-facts-work.js';
import { graphSpatialNodeMeshData } from '../dist/graph/spatial-appearance.js';
import { DEFAULT_ORBIT_CAMERA } from '../dist/core/orbit.js';
import { resolveLyra3dStyle } from '../dist/core/style.js';

function drain(work) {
  try {
    for (let calls = 0; calls < 100000; calls++) {
      const step = work.step(4096);
      if (step.done) return step.value;
    }
    assert.fail('generated child preparation did not finish');
  } finally { work.dispose(); }
}
function children(raw, presentation) {
  const data = drain(createGraphDataPreparationWork(raw)).data;
  const facts = drain(createGraphSceneFactsWork(data, presentation.style.pointSize));
  const nodes = drain(createGraphSpatialNodesWork(data, presentation));
  try {
    const edges = drain(createGraphSpatialEdgesWork(data, facts, presentation));
    return { data, nodes, edges, custom: graphSpatialNodeMeshData(data.spatialAppearance),
      dispose() { edges.batch.dispose(); nodes.batch.dispose(); } };
  } catch (error) { nodes.batch.dispose(); throw error; }
}
function finish(input, presentation, budget) {
  const work = createGraphSpatialCompositeWork(input.nodes, input.edges, presentation, input.custom);
  const totals = Object.fromEntries(['operations', 'allocatedBytes', 'visitedNodes', 'visitedEdgePrimitives', 'packedFaces', 'paintedFaces',
    'initializedSlots', 'orderedRows', 'sortOperations', 'publishedRanges'].map(field => [field, 0]));
  try {
    for (let calls = 0; calls < 100000; calls++) {
      const step = work.step(budget);
      for (const field of Object.keys(totals)) {
        assert.ok(Number.isSafeInteger(step[field]) && step[field] >= 0, field); totals[field] += step[field];
      }
      assert.ok(step.operations <= budget);
      assert.ok(step.sortOperations <= step.operations);
      if (step.done) { assert.ok(step.value); return { value: step.value, ...totals }; }
      assert.ok(step.operations > 0); assert.equal(step.value, undefined);
    }
    assert.fail('generated composite preparation did not finish');
  } finally { work.dispose(); }
}
const values = (batch, name) => batch.mesh.geometry.getAttribute(name).array;
function dirtyRanges(rows, faces) {
  const ranges = [];
  for (const row of rows) {
    const previous = ranges.at(-1);
    if (previous && previous.start + previous.count === row * 4) previous.count += 4;
    else ranges.push({ start: row * 4, count: 4 });
  }
  if (ranges.length > 64 && rows.length * 4 >= faces) return [{ start: ranges[0].start, count: ranges.at(-1).start + ranges.at(-1).count - ranges[0].start }];
  return ranges;
}

function expected(input, presentation) {
  const nodes = input.nodes.batch, edges = input.edges.batch, custom = input.custom;
  const V = nodes.mesh.geometry.instanceCount, P = edges.mesh.geometry.instanceCount, T = custom?.triangleCount ?? 0;
  const O = V + P, C = O + T, Q = Number(Boolean(custom));
  const staged = Array.from({ length: 5 }, () => new Float32Array(C * 4));
  const anchors = new Float32Array(C * 3), loopOffsets = new Float32Array(C * 2), slots = [];
  const dirty = new Map([0, 3, 4].map(payload => [payload, []]));
  const nodePosition = values(nodes, 'nodePosition'), nodeSize = values(nodes, 'nodeSize'), nodeFlags = values(nodes, 'nodeFlags');
  const nodeFill = values(nodes, 'nodeFill'), nodeShape = values(nodes, 'nodeShape');
  let L = 0, activeEdges = 0;
  const put = (payload, slot, components) => { for (let channel = 0; channel < 4; channel++) staged[payload][slot * 4 + channel] = components[channel]; };
  for (let primitive = 0; primitive < P; primitive++) {
    const stroke = values(edges, 'stroke'), color = values(edges, 'edgeColor');
    if (!(stroke[primitive * 3] > 0 && color[primitive * 4 + 3] > 0)) continue;
    const slot = slots.length, path = values(edges, 'edgePath'), start = values(edges, 'edgeStart'), end = values(edges, 'edgeEnd');
    put(0, slot, [...start.subarray(primitive * 3, primitive * 3 + 3), path[primitive * 4]]);
    put(1, slot, [...end.subarray(primitive * 3, primitive * 3 + 3), path[primitive * 4 + 1]]);
    put(2, slot, color.subarray(primitive * 4, primitive * 4 + 4));
    put(3, slot, [path[primitive * 4 + 2], path[primitive * 4 + 3], stroke[primitive * 3], stroke[primitive * 3 + 2]]);
    put(4, slot, [values(edges, 'dash')[primitive], values(edges, 'edgeCurvature')[primitive], 0, -1]);
    anchors.set(edges.anchors.subarray(primitive * 3, primitive * 3 + 3), slot * 3);
    if (nodes.mesh.material.uniforms.worldSizes.value < 0.5 && path[primitive * 4 + 2] > 0 && stroke[primitive * 3 + 2] < 0.5) {
      const a = path[primitive * 4] * Math.PI * 2, b = path[primitive * 4 + 1] * Math.PI * 2, radius = path[primitive * 4 + 2];
      loopOffsets[slot * 2] = (Math.sin(a) + Math.sin(b)) * radius / 2;
      loopOffsets[slot * 2 + 1] = -(2 - Math.cos(a) - Math.cos(b)) * radius / 2; L = 1;
    }
    slots.push(slot); activeEdges++;
  }
  for (let row = 0; row < V; row++) {
    if (!(nodeSize[row] > 0 || nodeFlags[row * 2] > 0 || nodeFlags[row * 2 + 1] > 0)) continue;
    const slot = slots.length;
    put(0, slot, [...nodePosition.subarray(row * 3, row * 3 + 3), nodeSize[row]]);
    put(1, slot, [nodeShape[row], nodeFlags[row * 2], nodeFlags[row * 2 + 1], 0]);
    for (const [payload, name] of [[2, 'nodeFill'], [3, 'nodeRing'], [4, 'nodeMarker']]) put(payload, slot, values(nodes, name).subarray(row * 4, row * 4 + 4));
    anchors.set(nodePosition.subarray(row * 3, row * 3 + 3), slot * 3); slots.push(slot);
  }
  let face = 0;
  for (let row = 0; row < V; row++) {
    const body = custom?.nodeMeshes[row]; if (!body) continue;
    for (let localFace = 0; localFace < body.positions.length / 9; localFace++, face++) {
      const slot = O + face, normal = Array.from(body.normals.subarray(localFace * 3, localFace * 3 + 3));
      const magnitude = normal.reduce((sum, component) => sum + Math.abs(component), 0);
      const normalized = normal.map(component => component / magnitude);
      const oct = normalized[2] >= 0 ? normalized.slice(0, 2)
        : [(1 - Math.abs(normalized[1])) * (normalized[0] < 0 ? -1 : 1), (1 - Math.abs(normalized[0])) * (normalized[1] < 0 ? -1 : 1)];
      for (let vertex = 0; vertex < 3; vertex++) put(vertex + 1, slot,
        [...body.positions.subarray(localFace * 9 + vertex * 3, localFace * 9 + vertex * 3 + 3), vertex < 2 ? oct[vertex] : 0]);
      put(4, slot, [0, 0, 0, -2 - row]);
      const changes = new Set();
      const write = (payload, channel, value) => {
        const offset = slot * 4 + channel;
        if (staged[payload][offset] === value) return;
        staged[payload][offset] = value; changes.add(payload);
      };
      for (let axis = 0; axis < 3; axis++) {
        write(0, axis, nodePosition[row * 3 + axis]); write(4, axis, nodeFill[row * 4 + axis]);
        anchors[slot * 3 + axis] = nodePosition[row * 3 + axis];
      }
      write(0, 3, nodeSize[row]); write(3, 3, nodeFill[row * 4 + 3]);
      write(4, 3, -2 - row - (nodeShape[row] === -1 ? 0 : 0.25));
      for (const payload of changes) dirty.get(payload).push(face);
      slots.push(slot);
    }
  }
  assert.equal(face, T);
  const A = slots.length, tau = Number(nodes.translucent || edges.translucent), K = Number(Boolean(tau && A));
  const { orbit } = presentation, cp = Math.cos(orbit.pitch);
  const forward = [cp * Math.sin(orbit.yaw), Math.sin(orbit.pitch), cp * Math.cos(orbit.yaw)];
  const origin = orbit.distance + orbit.target.x * forward[0] + orbit.target.y * forward[1] + orbit.target.z * forward[2];
  const near = Math.max(0.01, orbit.distance * 0.001), height = Math.max(1, presentation.height);
  const scaleAt = depth => height / (2 * Math.tan(Math.PI / 8) * depth);
  const depths = slots.map(slot => {
    let key = anchors[slot * 3] * forward[0] + anchors[slot * 3 + 1] * forward[1] + anchors[slot * 3 + 2] * forward[2];
    if (L) {
      const depth = origin - key;
      if (depth >= near) key += (loopOffsets[slot * 2] * forward[0] + loopOffsets[slot * 2 + 1] * forward[1]) / scaleAt(depth);
    }
    if (slot >= O && T) {
      const offset = slot * 4, depth = origin - key;
      const radius = staged[0][offset + 3] * (nodes.mesh.material.uniforms.worldSizes.value > 0.5 ? 1 : depth > near ? 1 / scaleAt(depth) : 0);
      for (let axis = 0; axis < 3; axis++) key += (staged[1][offset + axis] + staged[2][offset + axis] + staged[3][offset + axis]) / 3 * radius * forward[axis];
    }
    return key;
  });
  let order = slots;
  if (tau) {
    const min = Math.min(...depths), max = Math.max(...depths), factor = max > min ? (2 ** 31 - 1) / (max - min) : 0;
    order = slots.map((slot, index) => ({ slot, key: Math.min(2 ** 31 - 1, Math.floor((depths[index] - min) * factor)) * 2 ** 22 + slot }))
      .sort((a, b) => a.key - b.key).map(value => value.slot);
  }
  const output = Array.from({ length: 5 }, () => new Float32Array(C * 4));
  for (const [row, slot] of order.entries()) for (let payload = 0; payload < 5; payload++) output[payload].set(staged[payload].subarray(slot * 4, slot * 4 + 4), row * 4);
  const pickRanges = new Map([...dirty].map(([payload, rows]) => [payload, dirtyRanges(rows, T)]));
  return { V, P, T, O, C, Q, A, L, K, tau, output, staged, activeEdges, pickRanges,
    R: [...pickRanges.values()].reduce((sum, ranges) => sum + ranges.length, 0) };
}

function snapshot(batch) {
  const attributes = geometry => Object.fromEntries(Object.entries(geometry.attributes).map(([name, attribute]) => [name,
    { array: attribute.array.slice(), version: attribute.version, ranges: attribute.updateRanges.map(range => ({ ...range })) }]));
  const material = value => ({ transparent: value.transparent, depthWrite: value.depthWrite, depthTest: value.depthTest, version: value.version,
    side: value.side, forceSinglePass: value.forceSinglePass, toneMapped: value.toneMapped,
    uniforms: Object.fromEntries(Object.entries(value.uniforms).map(([name, entry]) => [name, name === 'dashAtlas' ? 'atlas' : entry.value?.toArray?.() ?? entry.value])) });
  const allocation = batch.allocations();
  return { attributes: attributes(batch.mesh.geometry), count: batch.mesh.geometry.instanceCount, material: material(batch.mesh.material),
    pick: batch.customPick ? { attributes: attributes(batch.customPick.geometry), count: batch.customPick.geometry.instanceCount, material: material(batch.customPick.material) } : undefined,
    allocation: { cpuBytes: allocation.cpuBytes, baseGeometryBytes: allocation.baseGeometryBytes, gpuAttributeBytes: allocation.gpuAttributeBytes,
      sortKeyBytes: allocation.sortKeyBytes, customStorage: allocation.customStorage, transientCustomScratchBytes: allocation.transientCustomScratchBytes } };
}
function check(raw, presentation) {
  const rawBefore = structuredClone(raw), control = children(raw, presentation);
  let legacy;
  try {
    legacy = createGraphSpatialComposite(control.nodes.batch, control.edges.batch, control.custom);
    legacy.update({ width: presentation.width, height: presentation.height, orbit: presentation.orbit, invalidate() { assert.fail('initial composite invalidated'); } });
    const differential = snapshot(legacy);
    let invariantTotals;
    for (const budget of [1, 7, 4096]) {
      const input = children(raw, presentation), before = structuredClone(input.data), model = expected(input, presentation);
      let batch;
      try {
        const result = finish(input, { width: presentation.width, height: presentation.height, orbit: presentation.orbit }, budget);
        ({ batch } = result.value);
        const { V, P, T, O, C, Q, A, L, K, tau, R } = model, H = result.sortOperations;
        assert.equal(result.operations, 22 + 5 * Q + L + K + C + P + V + Q * V + 2 * T + A + 2 * tau * A + H + R);
        assert.equal(result.allocatedBytes, 180 * C + 8 * C * K + 8 * C * L + 4 * (V + 1) * Q + 140);
        assert.equal(result.visitedNodes, (1 + Q) * V); assert.equal(result.visitedEdgePrimitives, P);
        assert.equal(result.packedFaces, T); assert.equal(result.paintedFaces, T); assert.equal(result.initializedSlots, C);
        assert.equal(result.orderedRows, A); assert.equal(result.publishedRanges, R);
        assert.ok(H <= 8 * A * (Math.ceil(Math.log2(Math.max(2, A))) + 1));
        if (!tau || A < 2) assert.equal(H, 0); else assert.ok(H > 0);
        const totals = Object.fromEntries(Object.entries(result).filter(([name]) => name !== 'value'));
        if (invariantTotals) assert.deepEqual(totals, invariantTotals); else invariantTotals = totals;
        assert.equal(batch.mesh.geometry.instanceCount, A);
        for (let payload = 0; payload < 5; payload++) assert.deepEqual(values(batch, `payload${payload}`), model.output[payload]);
        assert.equal(batch.mesh.material.transparent, Boolean(tau)); assert.equal(batch.mesh.material.depthWrite, !tau);
        assert.equal(batch.mesh.material.version, Number(!tau));
        assert.equal(batch.mesh.material.uniforms.meshForcedColors.value, Number(input.nodes.batch.forcedColors));
        const owned = result.value.ownedBuffers, borrowed = result.value.borrowedBuffers;
        assert.equal(owned.length, 18 + Q + L); assert.equal(new Set(owned).size, owned.length);
        assert.equal(owned.reduce((sum, buffer) => sum + buffer.byteLength, 0), result.allocatedBytes);
        const allocation = batch.allocations();
        assert.equal(allocation.cpuBytes, result.allocatedBytes); assert.equal(allocation.baseGeometryBytes, 140);
        assert.equal(allocation.gpuAttributeBytes, 80 * C + 80 * T); assert.equal(allocation.sortKeyBytes, 8 * C * K);
        assert.equal(allocation.transientCustomScratchBytes, 0);
        assert.equal(allocation.buffers.length, owned.length);
        for (const buffer of allocation.buffers) assert.equal(owned.includes(buffer), true);
        const expectedBorrowed = new Set([...input.nodes.ownedBuffers, ...input.nodes.borrowedBuffers, ...input.edges.ownedBuffers, ...input.edges.borrowedBuffers]);
        for (const body of input.custom?.nodeMeshes ?? []) if (body) { expectedBorrowed.add(body.positions.buffer); expectedBorrowed.add(body.normals.buffer); }
        assert.equal(borrowed.length, expectedBorrowed.size); assert.equal(new Set(borrowed).size, borrowed.length);
        for (const buffer of expectedBorrowed) assert.equal(borrowed.includes(buffer), true);
        for (const buffer of borrowed) assert.equal(owned.includes(buffer), false);
        assert.equal(batch.mesh.material.uniforms.worldSizes, input.nodes.batch.mesh.material.uniforms.worldSizes);
        assert.equal(batch.mesh.material.uniforms.markerArm, input.nodes.batch.mesh.material.uniforms.markerArm);
        assert.equal(batch.mesh.material.uniforms.dashAtlas, input.edges.batch.mesh.material.uniforms.dashAtlas);
        assert.equal(batch.mesh.material.uniforms.atlasHeight, input.edges.batch.mesh.material.uniforms.atlasHeight);
        if (Q) {
          const pick = batch.customPick;
          assert.ok(pick); assert.equal(pick.geometry.instanceCount, T);
          assert.equal(pick.geometry.index, batch.mesh.geometry.index); assert.equal(pick.material.uniforms, batch.mesh.material.uniforms);
          for (const name of ['position', 'normal', 'uv']) assert.equal(pick.geometry.getAttribute(name), batch.mesh.geometry.getAttribute(name));
          for (let payload = 0; payload < 5; payload++) {
            const attribute = pick.geometry.getAttribute(`payload${payload}`), ranges = model.pickRanges.get(payload) ?? [];
            assert.equal(owned.includes(attribute.array.buffer), true);
            assert.notEqual(attribute.array.buffer, values(batch, `payload${payload}`).buffer);
            assert.equal(attribute.array.byteOffset, O * 16); assert.equal(attribute.array.length, T * 4);
            assert.deepEqual(attribute.array, model.staged[payload].subarray(O * 4));
            assert.equal(attribute.version, Number(ranges.length > 0)); assert.deepEqual(attribute.updateRanges, ranges);
          }
          assert.equal(allocation.customStorage.cpuBytes, 2 * input.custom.payloadBytes + 180 * T + 8 * C * K + 8 * T * L + 21 * V + 4);
          assert.equal(allocation.customStorage.gpuBytes, 160 * T);
        } else { assert.equal(batch.customPick, undefined); assert.equal(allocation.customStorage, undefined); }
        assert.deepEqual(snapshot(batch), differential);
        const initial = snapshot(batch);
        batch.update({ width: presentation.width, height: presentation.height, orbit: presentation.orbit, invalidate() { assert.fail('unchanged composite invalidated'); } });
        assert.deepEqual(snapshot(batch), initial, 'the initial caches already match the first unchanged update');
        assert.deepEqual(input.nodes.batch.takeChanges(), { full: false, rows: [] });
        assert.deepEqual(input.edges.batch.takeChanges(), { full: false, rows: [] });
        assert.equal(batch.mesh.parent, null); if (batch.customPick) assert.equal(batch.customPick.parent, null);
        assert.deepEqual(input.data, before); assert.deepEqual(raw, rawBefore);
      } finally { try { batch?.dispose(); } finally { input.dispose(); } }
    }
  } finally { try { legacy?.dispose(); } finally { control.dispose(); } }
}

const row = fc.record({ source: fc.nat(7), target: fc.nat(7), directed: fc.boolean(), dangling: fc.boolean(), curvature: fc.constantFrom(-1, -0.123456789, 0, 0.5, 1),
  size: fc.constantFrom(-0, 0, 6, 20), width: fc.constantFrom(0, 2, 17), alpha: fc.constantFrom(0, 0.5, 1),
  custom: fc.boolean(), faces: fc.integer({ min: 1, max: 3 }), normal: fc.constantFrom([0, 0, 1], [0, 0, -1], [1, -2, 3], [-1, 2, -3]),
  selected: fc.boolean(), dimmed: fc.boolean(), expanded: fc.boolean(), coordinate: fc.integer({ min: -200, max: 600 }) });
test('prepared composite payloads, oct normals, quantized order and ledgers agree independently across budgets', () => {
  fc.assert(fc.property(fc.record({ nodes: fc.integer({ min: 0, max: 8 }), edges: fc.integer({ min: 0, max: 8 }),
    rows: fc.array(row, { minLength: 8, maxLength: 8 }), custom: fc.boolean(), world: fc.boolean(), forced: fc.boolean(), reduced: fc.boolean(),
    sizes: fc.boolean(), opacity: fc.constantFrom(0, 0.35, 1), yaw: fc.constantFrom(0, 0.3, Math.PI), pitch: fc.constantFrom(0, -0.5, 0.5),
    distance: fc.constantFrom(10, 500, 2000), target: fc.integer({ min: -100, max: 100 }), height: fc.constantFrom(1, 200, 800), shifted: fc.boolean() }), value => {
    const rows = value.rows.slice(0, value.nodes), edgeRows = value.rows.slice(0, value.nodes ? value.edges : 0);
    const meshes = rows.map(entry => {
      if (!value.custom || !entry.custom) return null;
      const length = Math.hypot(...entry.normal), unit = entry.normal.map(component => component / length);
      const triangle = entry.normal[2] < 0 ? [-0.5, -0.5, 0, 0, 0.5, 0, 0.5, -0.5, 0] : [-0.5, -0.5, 0, 0.5, -0.5, 0, 0, 0.5, 0];
      return { positions: Float32Array.from({ length: entry.faces * 9 }, (_, scalar) => {
        const local = triangle[scalar % 9];
        return scalar % 3 === 2 && value.shifted ? 0.5 : local;
      }), normals: Float32Array.from({ length: entry.faces * 3 }, (_, scalar) => unit[scalar % 3]), color: [0.25, 0.5, 0.75, entry.alpha] };
    });
    const raw = { nodeCount: value.nodes, positions: Float32Array.from(rows.flatMap((entry, index) => [index * 17, entry.coordinate / 4, entry.coordinate])),
      source: Uint32Array.from(edgeRows, entry => entry.source % value.nodes),
      target: Uint32Array.from(edgeRows, entry => (entry.dangling ? entry.source : entry.target) % value.nodes),
      directed: Uint8Array.from(edgeRows, entry => Number(entry.directed)),
      ...(value.sizes ? { sizes: Float32Array.from(rows, entry => entry.size) } : {}),
      spatialAppearance: { sizeUnits: value.world ? 'world' : 'css', dimmedOpacity: value.opacity, nodeMeshes: meshes,
        nodeColors: Float32Array.from(rows.flatMap(entry => [0.75, 0.25, 0.5, entry.alpha])), expandable: Uint8Array.from(rows, entry => Number(entry.expanded)),
        edgeColors: Float32Array.from(edgeRows.flatMap(entry => [0.25, 0.5, 0.75, entry.alpha])), edgeWidths: Float32Array.from(edgeRows, entry => entry.width),
        edgeCurvatures: Float32Array.from(edgeRows, entry => entry.curvature), dangling: Uint8Array.from(edgeRows, entry => Number(entry.dangling)),
        edgeDashes: edgeRows.map((_, index) => index % 2 ? [4, 4] : []) } };
    check(raw, { width: 320, height: value.height,
      orbit: { ...DEFAULT_ORBIT_CAMERA, yaw: value.yaw, pitch: value.pitch, distance: value.distance, target: { x: value.target, y: 0, z: value.target } },
      style: resolveLyra3dStyle({ pointSize: 12, forcedColors: value.forced, reducedMotion: value.reduced, accent: 'rgba(255, 0, 128, 0.5)' }),
      state: { selected: new Set(value.rows.flatMap((entry, index) => entry.selected ? [index, value.nodes + index] : [])),
        dimmed: new Set(value.rows.flatMap((entry, index) => entry.dimmed ? [index, value.nodes + index] : [])), hover: -1, focus: -1 } });
  }), { seed: 20261029, numRuns: 200 });
});

test('empty and single active orders, equal-depth ties and CSS near-plane boundaries retain exact initialization', () => {
  const state = { selected: new Set(), dimmed: new Set(), hover: -1, focus: -1 };
  const presentation = { width: 640, height: 480, orbit: DEFAULT_ORBIT_CAMERA, style: resolveLyra3dStyle(), state };
  for (const sizes of [[0], [0, 2]]) {
    check({ nodeCount: sizes.length, positions: new Float32Array(sizes.length * 3), sizes: Float32Array.from(sizes),
      source: new Uint32Array(), target: new Uint32Array(),
      spatialAppearance: { nodeColors: Float32Array.from(sizes.flatMap(() => [0.25, 0.5, 0.75, 0.5])) } }, presentation);
  }
  const body = () => ({ positions: new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0, 0.5, 0]),
    normals: new Float32Array([0, 0, 1]), color: [0.25, 0.5, 0.75, 0.5] });
  check({ nodeCount: 2, positions: new Float32Array([-10, 0, 0, 10, 0, 0]), sizes: new Float32Array([20, 20]),
    source: new Uint32Array([0]), target: new Uint32Array([1]), spatialAppearance: { nodeMeshes: [body(), null],
      nodeColors: new Float32Array([0.25, 0.5, 0.75, 0.5, 0.75, 0.5, 0.25, 0.5]), edgeColors: new Float32Array([0.25, 0.5, 0.75, 0.5]) } }, presentation);
  for (const rotated of [false, true]) for (const coordinate of [999.125, 999, 998.875]) {
    const custom = body();
    custom.positions = new Float32Array([-0.375, -0.5, 0.25, 0.625, -0.5, 0.25, 0.125, 0.5, 0.25]);
    check({ nodeCount: 1, positions: Float32Array.from(rotated ? [coordinate, 0, 0] : [0, 0, coordinate]), sizes: new Float32Array([20]),
      source: new Uint32Array([0]), target: new Uint32Array([0]), spatialAppearance: { sizeUnits: 'css', nodeMeshes: [custom],
        edgeColors: new Float32Array([0.25, 0.5, 0.75, 0.5]), edgeWidths: new Float32Array([2]) } },
    { ...presentation, orbit: { ...DEFAULT_ORBIT_CAMERA, distance: 1000, yaw: rotated ? Math.PI / 2 : 0 } });
  }
});
