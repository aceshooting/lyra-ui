import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { createGraphDecorationsWork } from '../dist/graph/decorations.js';
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
function finish(data, presentation, canvas, budget) {
  const work = createGraphDecorationsWork(data, presentation, () => canvas);
  const totals = Object.fromEntries(['operations', 'allocatedBytes', 'visitedLabelPresenceRows', 'visitedDirectedRows',
    'initializedArrows', 'initializedParticles', 'boundedInstances', 'consideredLabels', 'paintedLabels', 'canvasOperations'].map(field => [field, 0]));
  try {
    for (let calls = 0; calls < 100000; calls++) {
      const step = work.step(budget);
      for (const field of Object.keys(totals)) {
        assert.ok(Number.isSafeInteger(step[field]) && step[field] >= 0, field); totals[field] += step[field];
      }
      assert.ok(step.operations <= budget);
      if (step.done) { assert.ok(step.value); return { value: step.value, ...totals }; }
      assert.ok(step.operations > 0); assert.equal(step.value, undefined);
    }
    assert.fail('generated decorations did not finish');
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
function pathPoint(data, edge, t, view) {
  const source = data.source[edge], target = data.target[edge], a = at(data, source), b = at(data, target), appearance = data.spatialAppearance;
  if (!appearance) return a.map((value, axis) => value + (b[axis] - value) * t);
  if (appearance.dangling?.[edge]) return [a[0] + 28 * t, a[1] - 28 * t, a[2]];
  if (source === target) {
    const projected = project(a, view), diameter = data.sizes?.[source] ?? view.style.pointSize;
    const radius = (appearance.sizeUnits === 'world' ? diameter / 2 : projected ? diameter / (2 * projected.scale) : 0) * 1.6;
    return [a[0] + Math.sin(t * Math.PI * 2) * radius, a[1] - (1 - Math.cos(t * Math.PI * 2)) * radius, a[2]];
  }
  if (t <= 0) return a; if (t >= 1) return b;
  const delta = b.map((value, axis) => value - a[axis]), curvature = appearance.edgeCurvatures?.[edge] ?? 0;
  if (!curvature || delta.every(value => value === 0)) return a.map((value, axis) => value + delta[axis] * t);
  const axis = delta.map(Math.abs).indexOf(Math.min(...delta.map(Math.abs))), basis = [0, 0, 0]; basis[axis] = 1;
  const normal = [delta[1] * basis[2] - delta[2] * basis[1], delta[2] * basis[0] - delta[0] * basis[2], delta[0] * basis[1] - delta[1] * basis[0]];
  const amount = 4 * curvature * Math.hypot(...delta) * t * (1 - t) / Math.hypot(...normal);
  return a.map((value, component) => value + delta[component] * t + normal[component] * amount);
}
function compose(position, quaternion, scale) {
  const [x, y, z, w] = quaternion, x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  return Float32Array.from([(1 - (yy + zz)) * scale[0], (xy + wz) * scale[0], (xz - wy) * scale[0], 0,
    (xy - wz) * scale[1], (1 - (xx + zz)) * scale[1], (yz + wx) * scale[1], 0,
    (xz + wy) * scale[2], (yz - wx) * scale[2], (1 - (xx + yy)) * scale[2], 0, ...position, 1]);
}
function arrowMatrix(data, edge, view) {
  const a = at(data, data.source[edge]), b = at(data, data.target[edge]), delta = b.map((value, axis) => value - a[axis]);
  const length = Math.sqrt(sumSquares(delta)), direction = length ? delta.map(value => value * (1 / length)) : [0, 1, 0];
  const projected = project(b, view), radius = projected ? (data.sizes?.[data.target[edge]] ?? view.style.pointSize) / (2 * projected.scale) : 0;
  const height = projected && view.style.lineWidth > 0 ? Math.min(Math.max(6, view.style.lineWidth * 3) / projected.scale, Math.max(0, length - radius)) : 0;
  let quaternion = direction[1] + 1 < 1e-8 ? [0, -0, 1, 0] : [direction[2], 0, -direction[0], direction[1] + 1];
  const inverse = 1 / Math.sqrt(quaternion.reduce((sum, value) => sum + value * value, 0)); quaternion = quaternion.map(value => value * inverse);
  const position = b.map((value, axis) => value + (length ? direction[axis] : 0) * (-radius - height / 2));
  return compose(position, quaternion, [height * Math.tan(0.45), height, height * Math.tan(0.45)]);
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
function recordingCanvas(contextAvailable = true, width = 0, height = 0) {
  const texts = [], context = { globalAlpha: 1, setTransform() {}, clearRect() { texts.length = 0; },
    fillText(text, x, y, width) { texts.push({ text, x, y, width, alpha: this.globalAlpha }); } };
  const canvas = { width: contextAvailable ? width : 7, height: contextAvailable ? height : 9, getContext: () => contextAvailable ? context : null };
  return { canvas, context, texts };
}
function labels(data, view, contextAvailable) {
  const J = Number(Boolean(data.labels?.some(Boolean) || data.edgeLabels?.some(Boolean))), B = J * Number(contextAvailable);
  const result = { J, B, R: B, Q: 0, W: 0, texts: [] };
  if (!B) return result;
  const zoom = view.fittedDistance / view.orbit.distance, appearance = data.spatialAppearance, limit = appearance?.labelLimit ?? 256;
  const paint = item => {
    if (result.W >= limit || item < 0 || item >= data.nodeCount + data.source.length) return;
    const node = item < data.nodeCount, edge = item - data.nodeCount;
    if (node ? data.nodeLabels === 'none' || (data.nodeLabels !== 'always' && zoom < 0.5) : !data.withEdgeLabels || zoom < (data.edgeLabelMinZoom ?? 0.6)) return;
    if (!node && appearance && ((appearance.edgeWidths?.[edge] ?? view.style.lineWidth) <= 0 || (appearance.edgeColors?.[edge * 4 + 3] ?? view.style.muted.a) <= 0)) return;
    const text = node ? data.labels?.[item] : data.edgeLabels?.[edge]; if (!text) return;
    const a = at(data, node ? item : data.source[edge]), b = node ? a : at(data, data.target[edge]);
    const anchor = node ? a : pathPoint(data, edge, 0.5, view), projected = project(anchor, view); if (!projected) return;
    let radius = (data.sizes?.[item] ?? view.style.pointSize) / 2;
    if (node && appearance) {
      const sourceProjection = project(a, view), diameter = data.sizes?.[item] ?? view.style.pointSize;
      radius = (appearance.sizeUnits === 'world' ? diameter / 2 : sourceProjection ? diameter / (2 * sourceProjection.scale) : 0) * projected.scale;
    }
    const x = projected.x + (node ? radius + 4 : 0), y = projected.y - (node ? 0 : view.style.fontSize);
    if (x < 0 || y < 0 || x >= view.width || y >= view.height) return;
    result.texts.push({ text, x, y, width: Math.max(1, Math.min(512, view.width - x)), alpha: !view.style.forcedColors && view.state.dimmed.has(item) ? appearance?.dimmedOpacity ?? 0.3 : 1 }); result.W++;
  };
  const nodesPaint = Boolean(data.labels && data.nodeLabels !== 'none' && (data.nodeLabels === 'always' || zoom >= 0.5));
  const edgesPaint = Boolean(data.edgeLabels && data.withEdgeLabels && zoom >= (data.edgeLabelMinZoom ?? 0.6));
  if (nodesPaint || edgesPaint) {
    result.Q++; paint(view.state.focus);
    if (view.state.hover !== view.state.focus) { result.Q++; paint(view.state.hover); }
    for (let item = 0; item < data.nodeCount + data.source.length && result.W < limit; item++) {
      result.Q++; if (item !== view.state.focus && item !== view.state.hover) paint(item);
    }
  }
  return result;
}

function check(raw, presentation, contextAvailable = true, sameSize = false) {
  const data = owned(raw), before = structuredClone(data), rawBefore = structuredClone(raw), labelModel = labels(data, presentation, contextAvailable);
  if (sameSize) labelModel.R = 0;
  const spatial = Boolean(data.spatialAppearance), I = Number(!spatial && data.directed !== undefined), E = data.source.length;
  const indices = Array.from({ length: E }, (_, edge) => edge).filter(edge => !spatial && data.directed?.[edge]);
  const D = indices.length, N = Math.min(16384, E * (data.particlesPerEdge ?? 0)), d = Number(D > 0), n = Number(N > 0);
  const Z = Number(!presentation.style.reducedMotion && !presentation.style.forcedColors && presentation.style.lineWidth > 0);
  const L = (data.labels ? data.nodeCount : 0) + (data.edgeLabels ? E : 0), { J, B, R, Q, W } = labelModel;
  let invariant;
  for (const budget of [1, 7, 4096]) {
    const initialRatio = Math.min(presentation.style.devicePixelRatio, 2048 / Math.max(1, presentation.width, presentation.height));
    const recording = recordingCanvas(contextAvailable, sameSize ? Math.max(1, Math.floor(presentation.width * initialRatio)) : 0,
      sameSize ? Math.max(1, Math.floor(presentation.height * initialRatio)) : 0);
    const result = finish(data, presentation, recording.canvas, budget), { batch, resources, ownedBuffers, borrowedBuffers, storage } = result.value;
    try {
      assert.equal(result.operations, 16 + 2 * d + Z * n + 2 * J + 12 * B + 2 * R + L + 2 * I * E + 2 * D + 2 * N + Q + 2 * W);
      assert.equal(result.allocatedBytes, 2272 + 140 * B + 156 * D + (64 + 12 * Z) * N);
      assert.equal(result.visitedLabelPresenceRows, L); assert.equal(result.visitedDirectedRows, 2 * I * E);
      assert.equal(result.initializedArrows, D); assert.equal(result.initializedParticles, N); assert.equal(result.boundedInstances, D + N);
      assert.equal(result.consideredLabels, Q); assert.equal(result.paintedLabels, W);
      assert.equal(result.canvasOperations, 2 * J + 2 * R + 7 * B + 2 * W);
      const totals = Object.fromEntries(Object.entries(result).filter(([key]) => key !== 'value'));
      if (invariant) assert.deepEqual(totals, invariant); else invariant = totals;
      const { arrows, arrowPick, particles } = resources;
      assert.equal(arrows.count, D); assert.equal(arrowPick.count, D); assert.equal(particles.count, N);
      assert.equal(arrows.geometry, arrowPick.geometry); assert.notEqual(arrows.instanceMatrix, arrowPick.instanceMatrix);
      assert.equal(arrows.instanceMatrix.version, 1); assert.equal(arrowPick.instanceMatrix.version, 1); assert.equal(particles.instanceMatrix.version, Z);
      for (const mesh of [arrows, arrowPick, particles]) { assert.equal(mesh.parent, null); assert.equal(mesh.frustumCulled, false); assert.deepEqual(mesh.instanceMatrix.updateRanges, []); assertBounds(mesh); }
      assert.notEqual(arrows.boundingSphere, arrowPick.boundingSphere);
      assert.equal(particles.visible, Boolean(Z));
      for (const [row, edge] of indices.entries()) {
        const matrix = arrowMatrix(data, edge, presentation);
        closeArray(arrows.instanceMatrix.array.subarray(row * 16, row * 16 + 16), matrix, 1e-6);
        assert.deepEqual(arrowPick.instanceMatrix.array.subarray(row * 16, row * 16 + 16), arrows.instanceMatrix.array.subarray(row * 16, row * 16 + 16));
        const id = data.nodeCount + edge + 1;
        assert.deepEqual(arrowPick.instanceColor.array.subarray(row * 3, row * 3 + 3), Float32Array.from([id & 255, (id >> 8) & 255, (id >> 16) & 255].map(value => value / 255)));
        closeArray(arrows.instanceColor.array.subarray(row * 3, row * 3 + 3), colorFor(presentation, data.nodeCount + edge, presentation.style.muted), 1e-6);
      }
      for (let row = 0; row < N; row++) {
        let matrix;
        if (!Z) matrix = compose([0, 0, 0], [0, 0, 0, 1], [1, 1, 1]);
        else {
          const perEdge = data.particlesPerEdge, edge = Math.floor(row / perEdge), t = (row % perEdge) / perEdge;
          const a = at(data, data.source[edge]), b = at(data, data.target[edge]), position = pathPoint(data, edge, t, presentation), projected = project(position, presentation), appearance = data.spatialAppearance;
          const eligible = projected && (appearance || a.some((value, axis) => value !== b[axis])) && (appearance?.edgeWidths?.[edge] ?? presentation.style.lineWidth) > 0 && (appearance?.edgeColors?.[edge * 4 + 3] ?? 1) > 0;
          const radius = eligible ? Math.max(2, presentation.style.lineWidth) / projected.scale : 0;
          matrix = compose(position, [0, 0, 0, 1], [radius, radius, radius]);
          closeArray(particles.instanceColor.array.subarray(row * 3, row * 3 + 3), colorFor(presentation, data.nodeCount + edge, presentation.style.accent), 1e-6);
        }
        closeArray(particles.instanceMatrix.array.subarray(row * 16, row * 16 + 16), matrix, 1e-6);
      }
      for (const [mesh, exists, version] of [[arrows, d, 1], [arrowPick, d, 0], [particles, Z * n, 1]]) {
        assert.equal(mesh.instanceColor !== null, Boolean(exists));
        if (exists) { assert.equal(mesh.instanceColor.version, version); assert.deepEqual(mesh.instanceColor.updateRanges, version ? [{ start: 0, count: mesh.count * 3 }] : []); }
      }
      assert.equal(ownedBuffers.length, 12 + 4 * B + 2 * d + Z * n); assert.equal(new Set(ownedBuffers).size, ownedBuffers.length);
      assert.equal(ownedBuffers.reduce((sum, buffer) => sum + buffer.byteLength, 0), result.allocatedBytes);
      const inventory = batch.allocationBuffers(); assert.equal(inventory.length, ownedBuffers.length);
      for (const buffer of inventory) assert.equal(ownedBuffers.includes(buffer), true);
      for (const mesh of [arrows, arrowPick, particles, ...(resources.labelMesh ? [resources.labelMesh] : [])]) {
        for (const attribute of Object.values(mesh.geometry.attributes)) assert.equal(ownedBuffers.includes(attribute.array.buffer), true);
        assert.equal(ownedBuffers.includes(mesh.geometry.index.array.buffer), true);
        if (mesh.instanceMatrix) assert.equal(ownedBuffers.includes(mesh.instanceMatrix.array.buffer), true);
        if (mesh.instanceColor) assert.equal(ownedBuffers.includes(mesh.instanceColor.array.buffer), true);
      }
      const appearance = data.spatialAppearance;
      const borrowed = [data.positions, data.source, data.target, data.sizes, ...(!spatial ? [data.directed] : []),
        appearance?.edgeWidths, appearance?.edgeColors, appearance?.edgeCurvatures, appearance?.dangling].filter(Boolean).map(value => value.buffer);
      const expectedBorrowed = [...new Set(borrowed)];
      assert.equal(borrowedBuffers.length, expectedBorrowed.length);
      assert.equal(new Set(borrowedBuffers).size, borrowedBuffers.length);
      for (const buffer of expectedBorrowed) assert.equal(borrowedBuffers.includes(buffer), true);
      for (const buffer of borrowedBuffers) assert.equal(ownedBuffers.includes(buffer), false);
      assert.equal(storage.cpuBytes, result.allocatedBytes);
      assert.equal(storage.gpuAttributeBytes, 936 * d + 1336 * n + 140 * B + 152 * D + (64 + 12 * Z) * N);
      assert.equal(storage.semanticMapEntries, D);
      const ratio = Math.min(presentation.style.devicePixelRatio, 2048 / Math.max(1, presentation.width, presentation.height));
      const width = B ? Math.max(1, Math.floor(presentation.width * ratio)) : J ? 7 : 0;
      const height = B ? Math.max(1, Math.floor(presentation.height * ratio)) : J ? 9 : 0;
      assert.equal(storage.canvasBackingEstimateBytes, 4 * width * height); assert.equal(storage.gpuTextureBytes, B ? 4 * width * height : 0);
      assert.equal(Boolean(resources.canvas), Boolean(J)); assert.equal(Boolean(resources.labelMesh), Boolean(B));
      assert.deepEqual(recording.texts.map(value => value.text), labelModel.texts.map(value => value.text));
      for (let row = 0; row < W; row++) {
        closeArray(['x', 'y', 'width', 'alpha'].map(key => recording.texts[row][key]), ['x', 'y', 'width', 'alpha'].map(key => labelModel.texts[row][key]), 1e-9);
      }
      if (B) { assert.equal(resources.canvas.width, width); assert.equal(resources.canvas.height, height); assert.equal(resources.labelTexture.version, 2); assert.equal(resources.labelMesh.parent, null); assert.equal(recording.context.globalAlpha, 1); }
      const arrowVersion = arrows.instanceMatrix.version, colors = arrows.instanceColor?.version, labelVersion = resources.labelTexture?.version;
      const moving = batch.update(presentation, { positionOf(row) { const point = at(data, row); return { x: point[0], y: point[1], z: point[2] }; },
        state: presentation.state, fittedDistance: presentation.fittedDistance, revision: presentation.revision, time: 0 });
      assert.equal(moving, Boolean(Z && N && (data.particleSpeed ?? 0.25) > 0));
      assert.equal(arrows.instanceMatrix.version, arrowVersion); assert.equal(arrows.instanceColor?.version, colors); assert.equal(resources.labelTexture?.version, labelVersion);
      assert.deepEqual(data, before); assert.deepEqual(raw, rawBefore);
    } finally { batch.dispose(); }
  }
}

const row = fc.record({ source: fc.nat(7), target: fc.nat(7), directed: fc.boolean(), dangling: fc.boolean(), curvature: fc.constantFrom(-1, -0.123456789, 0, 0.5, 1),
  coordinate: fc.integer({ min: -100, max: 700 }), size: fc.constantFrom(-0, 0, 2, 30), width: fc.constantFrom(0, 2, 7), alpha: fc.constantFrom(0, 0.5, 1),
  selected: fc.boolean(), dimmed: fc.boolean() });
test('prepared decoration rows, Float32 bounds and physical ledgers obey independent rules across budgets', () => {
  fc.assert(fc.property(fc.record({ nodes: fc.integer({ min: 0, max: 8 }), edges: fc.integer({ min: 0, max: 8 }), rows: fc.array(row, { minLength: 8, maxLength: 8 }),
    spatial: fc.boolean(), mask: fc.boolean(), sizes: fc.boolean(), world: fc.boolean(), reduced: fc.boolean(), forced: fc.boolean(),
    perEdge: fc.constantFrom(0, 1, 2, 8), speed: fc.constantFrom(0, 0.25, 1), lineWidth: fc.constantFrom(0, 0.25, 2, 9),
    yaw: fc.constantFrom(0, 0.4, Math.PI), pitch: fc.constantFrom(0, -0.5, 0.5), distance: fc.constantFrom(10, 500, 2000), focus: fc.integer({ min: -1, max: 15 }) }), value => {
    const rows = value.rows.slice(0, value.nodes), edgeRows = value.rows.slice(0, value.nodes ? value.edges : 0);
    const raw = { nodeCount: value.nodes, positions: Float32Array.from(rows.flatMap((entry, index) => [index * 13, entry.coordinate / 4, entry.coordinate])),
      source: Uint32Array.from(edgeRows, entry => entry.source % value.nodes), target: Uint32Array.from(edgeRows, entry => (value.spatial && entry.dangling ? entry.source : entry.target) % value.nodes),
      ...(value.mask ? { directed: Uint8Array.from(edgeRows, entry => Number(entry.directed)) } : {}),
      ...(value.sizes ? { sizes: Float32Array.from(rows, entry => entry.size) } : {}), particlesPerEdge: value.perEdge, particleSpeed: value.speed,
      ...(value.spatial ? { spatialAppearance: { sizeUnits: value.world ? 'world' : 'css', edgeWidths: Float32Array.from(edgeRows, entry => entry.width),
        edgeColors: Float32Array.from(edgeRows.flatMap(entry => [0.25, 0.5, 0.75, entry.alpha])), edgeCurvatures: Float32Array.from(edgeRows, entry => entry.curvature),
        dangling: Uint8Array.from(edgeRows, entry => Number(entry.dangling)) } } : {}) };
    check(raw, { width: 640, height: 480, orbit: { ...DEFAULT_ORBIT_CAMERA, yaw: value.yaw, pitch: value.pitch, distance: value.distance },
      style: resolveLyra3dStyle({ lineWidth: value.lineWidth, reducedMotion: value.reduced, forcedColors: value.forced, focus: '#2060a0', accent: '#c08040' }),
      state: { selected: new Set(value.rows.flatMap((entry, index) => entry.selected ? [value.nodes + index] : [])),
        dimmed: new Set(value.rows.flatMap((entry, index) => entry.dimmed ? [value.nodes + index] : [])), hover: value.nodes, focus: value.focus }, fittedDistance: value.distance, revision: 3 });
  }), { seed: 20261029, numRuns: 200 });
});

test('label consideration counts priorities, rejected rows, zoom gates and context-null storage independently', () => {
  for (const context of [false, true]) for (const mode of ['always', 'zoom', 'none']) for (const zoom of [0.25, 1]) {
    check({ nodeCount: 4, positions: new Float32Array([-50, 0, 0, 0, 0, 0, 50, 0, 0, 100000, 0, 0]), source: new Uint32Array([0, 1]), target: new Uint32Array([1, 2]),
      labels: ['first', '', '<plain>', 'offscreen'], edgeLabels: ['edge', ''], nodeLabels: mode, withEdgeLabels: true, particlesPerEdge: 0 },
    { width: 640, height: 480, orbit: DEFAULT_ORBIT_CAMERA, style: resolveLyra3dStyle(),
      state: { selected: new Set(), dimmed: new Set([2]), focus: 2, hover: 0 }, fittedDistance: 500 * zoom, revision: 1 }, context);
  }
});

test('independent matrices cover axial arrows and all spatial curve normal choices', () => {
  for (const spatial of [false, true]) for (const endpoint of [[0, 80, 0], [0, -80, 0], [80, 90, 0], [0, 80, 90], [80, 0, 90]]) {
    check({ nodeCount: 2, positions: Float32Array.from([0, 0, 0, ...endpoint]), source: new Uint32Array([0]), target: new Uint32Array([1]),
      directed: new Uint8Array([1]), particlesPerEdge: 8,
      ...(spatial ? { spatialAppearance: { edgeCurvatures: new Float32Array([0.4]) } } : {}) },
    { width: 640, height: 480, orbit: DEFAULT_ORBIT_CAMERA, style: resolveLyra3dStyle(),
      state: { selected: new Set(), dimmed: new Set(), focus: -1, hover: -1 }, fittedDistance: 500, revision: 1 });
  }
});

test('independent spatial labels cover curved and loop anchors, world sizes, filtering and caps', () => {
  for (const sizeUnits of ['world', 'css']) for (const labelLimit of [1, 3, 8]) for (const forcedColors of [false, true]) for (const visible of [false, true]) {
    check({ nodeCount: 3, positions: new Float32Array([-50, 0, 0, 0, 30, 0, 50, 0, 0]), sizes: new Float32Array([12, 20, 4]),
      source: new Uint32Array([0, 1, 2]), target: new Uint32Array([1, 1, 2]), labels: ['left', 'loop', 'right'], edgeLabels: ['curve', 'self', 'stub'],
      nodeLabels: 'always', withEdgeLabels: true, particlesPerEdge: 2,
      spatialAppearance: { sizeUnits, labelLimit, dimmedOpacity: 0.4, edgeCurvatures: new Float32Array([0.3, 0, 0]),
        dangling: new Uint8Array([0, 0, 1]), edgeWidths: new Float32Array([2, visible ? 2 : 0, 2]),
        edgeColors: new Float32Array([0.2, 0.4, 0.6, 1, 0.2, 0.4, 0.6, 1, 0.2, 0.4, 0.6, visible ? 1 : 0]) } },
    { width: 640, height: 480, orbit: DEFAULT_ORBIT_CAMERA, style: resolveLyra3dStyle({ forcedColors }),
      state: { selected: new Set(), dimmed: new Set([0, 3]), focus: 3, hover: 1 }, fittedDistance: 500, revision: 1 });
  }
});

test('an already sized canvas has no charged resize setters', () => {
  check({ nodeCount: 1, positions: new Float32Array(3), source: new Uint32Array(), target: new Uint32Array(), labels: ['one'], nodeLabels: 'always' },
  { width: 640, height: 480, orbit: DEFAULT_ORBIT_CAMERA, style: resolveLyra3dStyle({ devicePixelRatio: 1.5 }),
    state: { selected: new Set(), dimmed: new Set(), focus: -1, hover: -1 }, fittedDistance: 500, revision: 1 }, true, true);
});
