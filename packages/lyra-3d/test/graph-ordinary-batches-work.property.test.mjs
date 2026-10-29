import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { createGraphOrdinaryBatchWork } from '../dist/graph/ordinary-batches.js';
import { createGraphDataPreparationWork } from '../dist/graph/data-preparation.js';
import { DEFAULT_ORBIT_CAMERA } from '../dist/core/orbit.js';
import { resolveLyra3dStyle } from '../dist/core/style.js';

function owned(raw) {
  const work = createGraphDataPreparationWork(raw);
  try {
    for (let calls = 0; calls < 100000; calls++) { const step = work.step(4096); if (step.done) return step.value.data; }
    assert.fail('generated data preparation did not finish');
  } finally { work.dispose(); }
}
const at = (data, row) => Array.from(data.positions.subarray(row * 3, row * 3 + 3));
const sumSquares = vector => vector[0] * vector[0] + vector[1] * vector[1] + vector[2] * vector[2];
const linear = value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
function project(point, view) {
  const camera = view.orbit, dx = point[0] - camera.target.x, dy = point[1] - camera.target.y, dz = point[2] - camera.target.z;
  const x = Math.cos(camera.yaw) * dx - Math.sin(camera.yaw) * dz;
  const z = Math.sin(camera.yaw) * dx + Math.cos(camera.yaw) * dz;
  const y = Math.cos(camera.pitch) * dy - Math.sin(camera.pitch) * z;
  const depth = camera.distance - (Math.sin(camera.pitch) * dy + Math.cos(camera.pitch) * z);
  if (depth < Math.max(0.01, camera.distance * 0.001)) return null;
  const scale = view.height / (2 * Math.tan(Math.PI / 8) * depth);
  return { x: view.width / 2 + x * scale, y: view.height / 2 + y * scale, scale };
}
function compose(position, quaternion, scale) {
  const [x, y, z, w] = quaternion, x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  return Float32Array.from([(1 - (yy + zz)) * scale[0], (xy + wz) * scale[0], (xz - wy) * scale[0], 0,
    (xy - wz) * scale[1], (1 - (xx + zz)) * scale[1], (yz + wx) * scale[1], 0,
    (xz + wy) * scale[2], (yz - wx) * scale[2], (1 - (xx + yy)) * scale[2], 0, ...position, 1]);
}
function colorFor(view, item, base) {
  const { style, state } = view;
  const color = state.focus === item ? style.focus : state.selected.has(item) || state.hover === item ? style.accent : style.forcedColors ? style.foreground : base;
  const multiplier = !style.forcedColors && state.dimmed.has(item) ? 0.3 : 1;
  return ['r', 'g', 'b'].map(channel => linear(color[channel]) * multiplier);
}
function closeArray(actual, expected, tolerance = 0) {
  assert.equal(actual.length, expected.length);
  for (let scalar = 0; scalar < actual.length; scalar++) {
    assert.ok(Math.abs(actual[scalar] - expected[scalar]) <= tolerance * Math.max(1, Math.abs(expected[scalar])), `scalar ${scalar}`);
  }
}

function geometrySphere(geometry) {
  const positions = geometry.attributes.position.array, min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let row = 0; row < positions.length / 3; row++) for (let axis = 0; axis < 3; axis++) {
    min[axis] = Math.min(min[axis], positions[row * 3 + axis]); max[axis] = Math.max(max[axis], positions[row * 3 + axis]);
  }
  const center = min.map((value, axis) => (value + max[axis]) * 0.5);
  let squared = 0;
  for (let row = 0; row < positions.length / 3; row++) squared = Math.max(squared, sumSquares(center.map((value, axis) => value - positions[row * 3 + axis])));
  return { center, radius: Math.sqrt(squared) };
}
function bounds(mesh) {
  const base = geometrySphere(mesh.geometry), matrices = mesh.instanceMatrix.array;
  let sphere = { center: [0, 0, 0], radius: -1 };
  const expand = point => {
    const delta = point.map((value, axis) => value - sphere.center[axis]), squared = sumSquares(delta);
    if (squared > sphere.radius * sphere.radius) {
      const length = Math.sqrt(squared), amount = (length - sphere.radius) * 0.5;
      sphere.center = sphere.center.map((value, axis) => value + delta[axis] * (amount / length)); sphere.radius += amount;
    }
  };
  for (let row = 0; row < mesh.count; row++) {
    const m = matrices.subarray(row * 16, row * 16 + 16), [x, y, z] = base.center;
    const center = [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
    const radius = base.radius * Math.sqrt(Math.max(sumSquares(m.subarray(0, 3)), sumSquares(m.subarray(4, 7)), sumSquares(m.subarray(8, 11))));
    if (sphere.radius < 0) { sphere = { center, radius }; continue; }
    if (center.every((value, axis) => value === sphere.center[axis])) sphere.radius = Math.max(sphere.radius, radius);
    else {
      const delta = center.map((value, axis) => value - sphere.center[axis]), inverse = 1 / (Math.sqrt(sumSquares(delta)) || 1);
      const reach = delta.map(value => value * inverse * radius);
      expand(center.map((value, axis) => value + reach[axis])); expand(center.map((value, axis) => value - reach[axis]));
    }
  }
  return sphere;
}
function assertBounds(mesh) {
  const expected = bounds(mesh);
  assert.ok(mesh.boundingSphere); closeArray(mesh.boundingSphere.center.toArray(), expected.center, 1e-12);
  assert.ok(Math.abs(mesh.boundingSphere.radius - expected.radius) <= Math.max(1, Math.abs(expected.radius)) * 1e-12);
  const base = geometrySphere(mesh.geometry);
  closeArray(mesh.geometry.boundingSphere.center.toArray(), base.center, 1e-12);
  assert.equal(mesh.geometry.boundingSphere.radius, base.radius);
}

function matrixFor(kind, row, data, view) {
  const a = at(data, kind === 0 ? row : data.source[row]);
  if (kind === 0) {
    const projection = project(a, view), radius = projection ? (data.sizes?.[row] ?? view.style.pointSize) / (2 * projection.scale) : 0;
    return compose(a, [0, 0, 0, 1], [radius, radius, radius]);
  }
  const b = at(data, data.target[row]), position = a.map((value, axis) => (value + b[axis]) / 2), delta = b.map((value, axis) => value - a[axis]);
  const length = Math.sqrt(sumSquares(delta)), direction = length ? delta.map(value => value * (1 / length)) : [0, 1, 0];
  const projection = project(position, view), radius = projection ? view.style.lineWidth / (2 * projection.scale) : 0;
  let quaternion = direction[1] + 1 < 1e-8 ? [0, -0, 1, 0] : [direction[2], 0, -direction[0], direction[1] + 1];
  const inverse = 1 / Math.sqrt(quaternion.reduce((sum, value) => sum + value * value, 0)); quaternion = quaternion.map(value => value * inverse);
  return compose(position, quaternion, [radius, length, radius]);
}
function finish(data, presentation, budget) {
  const work = createGraphOrdinaryBatchWork(data, presentation);
  const totals = { operations: 0, allocatedBytes: 0, initializedNodes: 0, initializedEdges: 0, boundedInstances: 0 };
  try {
    for (let calls = 0; calls < 100000; calls++) {
      const step = work.step(budget);
      for (const field of Object.keys(totals)) { assert.ok(Number.isSafeInteger(step[field]) && step[field] >= 0, field); totals[field] += step[field]; }
      assert.ok(step.operations <= budget);
      if (step.done) { assert.ok(step.value); return { value: step.value, totals }; }
      assert.ok(step.operations > 0); assert.equal(step.value, undefined);
    }
    assert.fail('Ordinary batch preparation did not finish');
  } finally { work.dispose(); }
}
function check(raw, presentation) {
  const data = owned(raw), before = structuredClone(data), rawBefore = structuredClone(raw), V = data.nodeCount, E = data.source.length;
  let invariant;
  for (const budget of [1, 7, 4096]) {
    const { value, totals } = finish(data, presentation, budget), { batch, resources, ownedBuffers, borrowedBuffers, storage } = value;
    try {
      assert.equal(totals.operations, 18 + 2 * Number(V > 0) + 2 * Number(E > 0) + 2 * V + 2 * E);
      assert.equal(totals.allocatedBytes, 3920 + 152 * (V + E));
      assert.equal(totals.initializedNodes, V); assert.equal(totals.initializedEdges, E); assert.equal(totals.boundedInstances, V + E);
      if (invariant) assert.deepEqual(totals, invariant); else invariant = totals;
      const meshes = [resources.nodes, resources.nodePick, resources.edges, resources.edgePick];
      assert.equal(resources.nodes.geometry, resources.nodePick.geometry); assert.equal(resources.edges.geometry, resources.edgePick.geometry);
      assert.equal(new Set(meshes.map(mesh => mesh.instanceMatrix.array.buffer)).size, 4);
      assert.equal(new Set(meshes.map(mesh => mesh.boundingSphere)).size, 4);
      const nativeBuffers = new Set();
      for (const [index, mesh] of meshes.entries()) {
        const count = index < 2 ? V : E, pick = index % 2 === 1;
        assert.equal(mesh.count, count); assert.equal(mesh.parent, null); assert.equal(mesh.frustumCulled, false);
        assert.equal(mesh.instanceMatrix.version, 1); assert.deepEqual(mesh.instanceMatrix.updateRanges, []); assertBounds(mesh);
        assert.equal(mesh.instanceColor !== null, count > 0);
        if (count) {
          assert.equal(mesh.instanceColor.version, pick ? 0 : 1);
          assert.deepEqual(mesh.instanceColor.updateRanges, pick ? [] : [{ start: 0, count: count * 3 }]);
        }
        for (const attribute of [...Object.values(mesh.geometry.attributes), mesh.geometry.index, mesh.instanceMatrix, mesh.instanceColor].filter(Boolean)) nativeBuffers.add(attribute.array.buffer);
        for (let row = 0; row < count; row++) {
          const kind = index < 2 ? 0 : 1, item = kind === 0 ? row : V + row;
          closeArray(mesh.instanceMatrix.array.subarray(row * 16, row * 16 + 16), matrixFor(kind, row, data, presentation), 1e-6);
          const expected = pick ? [(item + 1) & 255, ((item + 1) >> 8) & 255, ((item + 1) >> 16) & 255].map(value => value / 255)
            : colorFor(presentation, item, kind === 0 ? presentation.style.palette[(data.categories?.[row] ?? 0) % presentation.style.palette.length] : presentation.style.muted);
          closeArray(mesh.instanceColor.array.subarray(row * 3, row * 3 + 3), expected, 1e-6);
        }
      }
      for (const [visual, pick] of [[resources.nodes, resources.nodePick], [resources.edges, resources.edgePick]]) {
        assert.deepEqual(visual.instanceMatrix.array, pick.instanceMatrix.array);
        assert.notEqual(visual.instanceMatrix, pick.instanceMatrix);
      }
      assert.equal(ownedBuffers.length, 12 + 2 * Number(V > 0) + 2 * Number(E > 0));
      assert.equal(new Set(ownedBuffers).size, ownedBuffers.length); assert.equal(ownedBuffers.length, nativeBuffers.size);
      for (const buffer of nativeBuffers) assert.equal(ownedBuffers.includes(buffer), true);
      assert.equal(ownedBuffers.reduce((sum, buffer) => sum + buffer.byteLength, 0), totals.allocatedBytes);
      const inventory = batch.allocationBuffers(); assert.equal(inventory.length, ownedBuffers.length);
      for (const buffer of inventory) assert.equal(ownedBuffers.includes(buffer), true);
      const expectedBorrowed = [...new Set([data.positions, data.source, data.target, data.sizes, data.categories].filter(Boolean).map(value => value.buffer))];
      assert.equal(borrowedBuffers.length, expectedBorrowed.length); assert.equal(new Set(borrowedBuffers).size, borrowedBuffers.length);
      for (const buffer of expectedBorrowed) assert.equal(borrowedBuffers.includes(buffer), true);
      for (const buffer of borrowedBuffers) assert.equal(ownedBuffers.includes(buffer), false);
      assert.equal(storage.cpuBytes, totals.allocatedBytes); assert.equal(storage.gpuAttributeBytes, totals.allocatedBytes);
      const versions = meshes.map(mesh => [mesh.instanceMatrix.version, mesh.instanceColor?.version]);
      batch.updateTransforms(presentation, data.positions, presentation.revision);
      assert.deepEqual(meshes.map(mesh => [mesh.instanceMatrix.version, mesh.instanceColor?.version]), versions);
      assert.deepEqual(data, before); assert.deepEqual(raw, rawBefore);
    } finally { batch.dispose(); }
  }
}
const row = fc.record({ source: fc.nat(7), target: fc.nat(7), x: fc.integer({ min: -100, max: 100 }), y: fc.integer({ min: -100, max: 100 }),
  z: fc.integer({ min: -100, max: 700 }), size: fc.constantFrom(-0, 0, 2, 30), category: fc.integer({ min: 0, max: 65535 }), selected: fc.boolean(), dimmed: fc.boolean() });
test('ordinary rows, colors, pick identities, Float32 bounds and ledgers follow independent generated rules', () => {
  fc.assert(fc.property(fc.record({ nodes: fc.integer({ min: 0, max: 8 }), edges: fc.integer({ min: 0, max: 8 }), rows: fc.array(row, { minLength: 8, maxLength: 8 }),
    sizes: fc.boolean(), categories: fc.boolean(), forced: fc.boolean(), width: fc.constantFrom(320, 640), height: fc.constantFrom(240, 480),
    lineWidth: fc.constantFrom(0, 0.25, 2, 9), pointSize: fc.constantFrom(0, 6, 30), yaw: fc.constantFrom(0, 0.4, Math.PI),
    pitch: fc.constantFrom(0, -0.5, 0.5), distance: fc.constantFrom(10, 500, 2000),
    target: fc.record({ x: fc.integer({ min: -30, max: 30 }), y: fc.integer({ min: -30, max: 30 }), z: fc.integer({ min: -30, max: 30 }) }),
    focus: fc.integer({ min: -1, max: 15 }) }), value => {
    const rows = value.rows.slice(0, value.nodes), edges = value.rows.slice(0, value.nodes ? value.edges : 0);
    const raw = { nodeCount: value.nodes, positions: Float32Array.from(rows.flatMap(entry => [entry.x, entry.y, entry.z])),
      source: Uint32Array.from(edges, entry => entry.source % value.nodes), target: Uint32Array.from(edges, entry => entry.target % value.nodes),
      ...(value.sizes ? { sizes: Float32Array.from(rows, entry => entry.size) } : {}),
      ...(value.categories ? { categories: Uint16Array.from(rows, entry => entry.category) } : {}) };
    check(raw, { width: value.width, height: value.height, orbit: { ...DEFAULT_ORBIT_CAMERA, target: value.target, yaw: value.yaw, pitch: value.pitch, distance: value.distance },
      style: resolveLyra3dStyle({ lineWidth: value.lineWidth, pointSize: value.pointSize, forcedColors: value.forced,
        palette: ['#204060', '#e0a080', 'rgba(32, 160, 80, 0.2)'], focus: '#2060a0', accent: '#c08040' }),
      state: { selected: new Set(value.rows.flatMap((entry, index) => entry.selected ? [index, value.nodes + index] : [])),
        dimmed: new Set(value.rows.flatMap((entry, index) => entry.dimmed ? [index, value.nodes + index] : [])), hover: value.nodes, focus: value.focus }, revision: 3 });
  }), { seed: 20261029, numRuns: 200 });
});

test('independent ordinary matrices cover axial and coincident edges with zero widths and diameters', () => {
  for (const target of [[0, 80, 0], [0, -80, 0], [80, 0, 0], [0, 0, 80], [0, 0, 0]]) for (const size of [0, 12]) for (const lineWidth of [0, 2]) {
    check({ nodeCount: 2, positions: Float32Array.from([0, 0, 0, ...target]), source: new Uint32Array([0]), target: new Uint32Array([1]), sizes: new Float32Array([size, size]) },
    { width: 640, height: 480, orbit: DEFAULT_ORBIT_CAMERA, style: resolveLyra3dStyle({ lineWidth }),
      state: { selected: new Set(), dimmed: new Set(), focus: -1, hover: -1 }, revision: 1 });
  }
});

test('node and edge pick colors carry the original index across a channel boundary', () => {
  check({ nodeCount: 257, positions: new Float32Array(771), source: new Uint32Array([0, 255, 256]), target: new Uint32Array([256, 256, 0]) },
  { width: 640, height: 480, orbit: DEFAULT_ORBIT_CAMERA, style: resolveLyra3dStyle(),
    state: { selected: new Set([255, 257]), dimmed: new Set([256, 259]), focus: 258, hover: -1 }, revision: 1 });
});

test('near-plane equality remains visible with neighboring Float32 positions on both sides', () => {
  check({ nodeCount: 3, positions: Float32Array.from([0, 0, 499.5, 0, 0, 499.5 + 2 ** -15, 0, 0, 499.5 - 2 ** -15]),
    source: new Uint32Array([0, 1, 0]), target: new Uint32Array([0, 1, 2]) },
  { width: 640, height: 480, orbit: { ...DEFAULT_ORBIT_CAMERA, yaw: 0, pitch: 0, distance: 500 }, style: resolveLyra3dStyle(),
    state: { selected: new Set(), dimmed: new Set(), focus: -1, hover: -1 }, revision: 1 });
});
