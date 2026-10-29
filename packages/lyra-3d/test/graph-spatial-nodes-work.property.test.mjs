import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { createGraphSpatialNodes, createGraphSpatialNodesWork } from '../dist/graph/spatial-nodes.js';
import { createGraphDataPreparationWork } from '../dist/graph/data-preparation.js';
import { graphSpatialNodeMeshData } from '../dist/graph/spatial-appearance.js';
import { DEFAULT_ORBIT_CAMERA } from '../dist/core/orbit.js';
import { resolveLyra3dStyle } from '../dist/core/style.js';
import { triangleMesh } from './graph-node-mesh-fixtures.mjs';

function owned(input) {
  const work = createGraphDataPreparationWork(input);
  for (let calls = 0; calls < 10000; calls++) { const step = work.step(4096); if (step.done) return step.value.data; }
  assert.fail('generated data preparation did not finish');
}
function finish(data, presentation, budget) {
  const work = createGraphSpatialNodesWork(data, presentation);
  let operations = 0, bytes = 0, rows = 0;
  for (let calls = 0; calls < 10000; calls++) {
    const step = work.step(budget);
    for (const field of ['operations', 'allocatedBytes', 'initializedRows']) assert.ok(Number.isSafeInteger(step[field]) && step[field] >= 0);
    assert.ok(step.operations <= budget); operations += step.operations; bytes += step.allocatedBytes; rows += step.initializedRows;
    if (step.done) { work.dispose(); return { value: step.value, operations, bytes, rows }; }
    assert.ok(step.operations > 0); assert.equal(step.value, undefined);
  }
  assert.fail('generated spatial nodes did not finish');
}
function capture(batch) {
  return { attributes: Object.fromEntries(Object.entries(batch.mesh.geometry.attributes).map(([name, attribute]) => [name,
    { array: attribute.array.slice(), version: attribute.version, ranges: attribute.updateRanges.map(range => ({ ...range })) }])),
    transparent: batch.mesh.material.transparent, depthWrite: batch.mesh.material.depthWrite, materialVersion: batch.mesh.material.version,
    forcedColors: batch.forcedColors, translucent: batch.translucent, revision: batch.revision,
    markerArm: batch.mesh.material.uniforms.markerArm.value, worldSizes: batch.mesh.material.uniforms.worldSizes.value,
    viewport: batch.mesh.material.uniforms.viewportSize.value.toArray(), view: batch.mesh.material.uniforms.lyraView.value.toArray(),
    changes: batch.takeChanges() };
}
const linear = value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
const partial = value => value > 0 && value < 1;
function assertIndependentRows(batch, data, presentation) {
  const attributes = batch.mesh.geometry.attributes, { style, state } = presentation, appearance = data.spatialAppearance;
  let blends = false;
  for (let row = 0; row < data.nodeCount; row++) {
    const custom = appearance.nodeMeshes?.[row], customColor = custom?.color, explicit = appearance.nodeColors;
    const source = style.forcedColors ? style.foreground : customColor ? { r: customColor[0], g: customColor[1], b: customColor[2], a: customColor[3] }
      : explicit ? { r: explicit[row * 4], g: explicit[row * 4 + 1], b: explicit[row * 4 + 2], a: explicit[row * 4 + 3] }
        : style.palette[(data.categories?.[row] ?? 0) % style.palette.length];
    const selected = state.selected.has(row) || state.focus === row || state.hover === row, expanded = appearance.expandable?.[row] === 1;
    const alpha = style.forcedColors || !state.dimmed.has(row) ? 1 : appearance.dimmedOpacity;
    assert.equal(attributes.nodeFlags.array[row * 2], Number(selected)); assert.equal(attributes.nodeFlags.array[row * 2 + 1], Number(expanded));
    const shape = custom ? source.a > 0 ? -1 : -2 : appearance.nodeShapes?.[row] ?? 0;
    assert.equal(attributes.nodeShape.array[row], shape); assert.equal(batch.bodyPickable(row), shape === -1);
    assert.ok(Object.is(attributes.nodeSize.array[row], Math.fround((data.sizes?.[row] ?? style.pointSize) / 2)));
    for (const [name, color] of [['nodeFill', source], ['nodeRing', style.accent], ['nodeMarker', style.foreground]]) {
      for (const [channel, component] of ['r', 'g', 'b'].entries()) {
        assert.ok(Math.abs(attributes[name].array[row * 4 + channel] - linear(color[component])) < 0.000001, `${name} row ${row} channel ${component}`);
      }
      assert.equal(attributes[name].array[row * 4 + 3], Math.fround(color.a * alpha));
    }
    for (let axis = 0; axis < 3; axis++) assert.ok(Object.is(attributes.nodePosition.array[row * 3 + axis], data.positions[row * 3 + axis]));
    const id = row + 1;
    assert.equal(attributes.pickColor.array[row * 3], Math.fround((id & 255) / 255));
    assert.equal(attributes.pickColor.array[row * 3 + 1], Math.fround(((id >> 8) & 255) / 255));
    assert.equal(attributes.pickColor.array[row * 3 + 2], Math.fround(((id >> 16) & 255) / 255));
    blends ||= partial(source.a * alpha) || (selected && partial(style.accent.a * alpha)) || (expanded && partial(style.foreground.a * alpha));
  }
  assert.equal(batch.translucent, blends); assert.equal(batch.mesh.material.transparent, blends); assert.equal(batch.mesh.material.depthWrite, !blends);
}

test('prepared spatial node rows obey independent color identity and size rules across work budgets', () => {
  fc.assert(fc.property(fc.record({ count: fc.integer({ min: 0, max: 8 }), seed: fc.integer({ min: 0, max: 0xffffffff }),
    suppliedPositions: fc.boolean(), suppliedSizes: fc.boolean(), world: fc.boolean(), explicitColors: fc.boolean(), custom: fc.boolean(), forced: fc.boolean(), reduced: fc.boolean(),
    size: fc.constantFrom(-0, 0, 2, 17, 1024), opacity: fc.constantFrom(0, 0.35, 1), coordinate: fc.integer({ min: -100, max: 100 }),
    red: fc.integer({ min: 0, max: 255 }), green: fc.integer({ min: 0, max: 255 }), blue: fc.integer({ min: 0, max: 255 }), alpha: fc.constantFrom(0, 0.25, 0.8, 1) }),
  ({ count, seed, suppliedPositions, suppliedSizes, world, explicitColors, custom, forced, reduced, size, opacity, coordinate, red, green, blue, alpha }) => {
    const color = [red / 255, green / 255, blue / 255, alpha];
    const raw = { nodeCount: count, source: new Uint32Array(), target: new Uint32Array(), options: { seed },
      categories: Uint16Array.from({ length: count }, (_, row) => row * 7),
      ...(suppliedPositions ? { positions: Float32Array.from({ length: count * 3 }, (_, scalar) => coordinate + scalar / 8) } : {}),
      ...(suppliedSizes ? { sizes: new Float32Array(count).fill(size) } : {}),
      spatialAppearance: { sizeUnits: world ? 'world' : 'css', dimmedOpacity: opacity,
        nodeShapes: Uint8Array.from({ length: count }, (_, row) => row % 3), expandable: Uint8Array.from({ length: count }, (_, row) => row % 2),
        ...(explicitColors ? { nodeColors: Float32Array.from({ length: count * 4 }, (_, scalar) => color[scalar % 4]) } : {}),
        ...(custom ? { nodeMeshes: Array.from({ length: count }, (_, row) => row % 2 ? null : triangleMesh(1, color)) } : {}) } };
    const data = owned(raw), before = structuredClone(data);
    const presentation = { width: 320, height: 200, orbit: { ...DEFAULT_ORBIT_CAMERA, distance: 2000, pitch: 0.25 },
      style: resolveLyra3dStyle({ pointSize: size, fontSize: 24, forcedColors: forced, reducedMotion: reduced,
        palette: ['rgba(128, 64, 192, 0.8)', '#204060', '#ffffff'], accent: 'rgba(255, 0, 128, 0.5)', foreground: '#80ff40' }),
      state: { selected: new Set([0, 3, 6]), dimmed: new Set([0, 2, 4, 6]), hover: 1, focus: 2 } };
    const legacy = createGraphSpatialNodes(data, graphSpatialNodeMeshData(data.spatialAppearance));
    try {
      legacy.update(presentation, data.positions, presentation.state); const expected = capture(legacy);
      for (const budget of [1, 7, 4096]) {
        const result = finish(data, presentation, budget), { batch, ownedBuffers, borrowedBuffers } = result.value;
        try {
          assert.equal(result.operations, 19 + count); assert.equal(result.bytes, 140 + 89 * count); assert.equal(result.rows, count);
          assertIndependentRows(batch, data, presentation); assert.deepEqual(capture(batch), expected); assert.deepEqual(data, before);
          assert.equal(ownedBuffers.reduce((sum, buffer) => sum + buffer.byteLength, 0), result.bytes);
          assert.equal(new Set(ownedBuffers).size, ownedBuffers.length);
          for (const buffer of borrowedBuffers) assert.equal(ownedBuffers.includes(buffer), false);
          assert.notEqual(batch.mesh.geometry.attributes.nodePosition.array.buffer, data.positions.buffer);
        } finally { batch.dispose(); }
      }
    } finally { legacy.dispose(); }
  }), { seed: 20261029, numRuns: 200 });
});
