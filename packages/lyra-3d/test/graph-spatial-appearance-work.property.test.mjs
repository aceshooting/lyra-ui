import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { createGraphSpatialAppearanceWork, graphSpatialNodeMeshData } from '../dist/graph/spatial-appearance.js';
import { triangleMesh } from './graph-node-mesh-fixtures.mjs';

function drain(input, nodes, edges, budget) {
  const work = createGraphSpatialAppearanceWork(input, nodes, edges); let bytes = 0, keys = 0, dashValues = 0;
  for (let calls = 0; calls < 100000; calls++) {
    const step = work.step(budget);
    assert.ok(Number.isSafeInteger(step.operations) && step.operations >= 0 && step.operations <= budget);
    bytes += step.allocatedBytes; keys += step.reflectedKeys; dashValues += step.copiedDashValues;
    if (step.done) return { value: step.value, bytes, keys, dashValues };
    assert.ok(step.operations > 0);
  }
  assert.fail('generated spatial work did not finish');
}

test('spatial ownership, curvature clamp and mesh association do not depend on operation chunking', () => {
  fc.assert(fc.property(fc.record({ nodes: fc.integer({ min: 1, max: 4 }), edges: fc.integer({ min: 0, max: 6 }),
    shape: fc.integer({ min: 0, max: 2 }), color: fc.integer({ min: 0, max: 100 }), width: fc.integer({ min: 0, max: 1000 }),
    curvature: fc.integer({ min: -400, max: 400 }), dash: fc.array(fc.integer({ min: 0, max: 100 }), { maxLength: 8 }),
    custom: fc.boolean(), world: fc.boolean() }),
  ({ nodes, edges, shape, color, width, curvature, dash, custom, world }) => {
    const input = { sizeUnits: world ? 'world' : 'css', dimmedOpacity: .35, labelLimit: 256,
      nodeShapes: new Uint8Array(nodes).fill(shape), nodeColors: new Float32Array(nodes * 4).fill(color / 100), expandable: new Uint8Array(nodes).fill(1),
      edgeColors: new Float32Array(edges * 4).fill(color / 100), edgeWidths: new Float32Array(edges).fill(width),
      edgeCurvatures: new Float32Array(edges).fill(curvature / 100), dangling: new Uint8Array(edges), edgeDashes: Array.from({ length: edges }, () => [...dash]),
      ...(custom ? { nodeMeshes: Array.from({ length: nodes }, (_, row) => row === nodes - 1 ? triangleMesh() : null) } : {}) };
    const before = structuredClone(input), expected = { ...before, edgeCurvatures: Float32Array.from(before.edgeCurvatures, value => Math.max(-1, Math.min(1, value))) };
    const expectedBytes = nodes * 18 + edges * 25 + (custom ? 48 : 0);
    for (const budget of [1, 7, 4096]) {
      const result = drain(input, nodes, edges, budget);
      assert.deepEqual(result.value, expected); assert.deepEqual(input, before);
      assert.equal(result.bytes, expectedBytes); assert.equal(result.keys, custom ? nodes + 3 : 0); assert.equal(result.dashValues, edges * dash.length);
      for (const name of ['nodeShapes', 'nodeColors', 'expandable', 'edgeColors', 'edgeWidths', 'edgeCurvatures', 'dangling']) assert.notEqual(result.value[name].buffer, input[name].buffer);
      for (let edge = 0; edge < edges; edge++) { assert.notEqual(result.value.edgeDashes[edge], input.edgeDashes[edge]); assert.equal(Object.isFrozen(result.value.edgeDashes[edge]), true); }
      const metadata = graphSpatialNodeMeshData(result.value);
      if (custom) { assert.equal(metadata.nodeMeshes, result.value.nodeMeshes); assert.equal(metadata.triangleCount, 1); assert.equal(metadata.payloadBytes, 64); }
      else assert.equal(metadata, undefined);
    }
  }), { seed: 20261028, numRuns: 200 });
});
