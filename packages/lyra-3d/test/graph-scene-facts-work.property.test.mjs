import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { createGraphSceneFactsWork } from '../dist/graph/scene-facts-work.js';
import { createGraphDataPreparationWork } from '../dist/graph/data-preparation.js';
import { createGraphEngine } from '../dist/graph/engine.js';
import { fitOrbitCamera } from '../dist/core/orbit.js';

function owned(input) {
  const work = createGraphDataPreparationWork(input);
  for (let calls = 0; calls < 10000; calls++) {
    const step = work.step(4096); if (step.done) return step.value.data;
  }
  assert.fail('generated data preparation did not finish');
}
function finish(data, budget) {
  const work = createGraphSceneFactsWork(data, 6);
  let operations = 0, nodes = 0, edges = 0;
  for (let calls = 0; calls < 10000; calls++) {
    const step = work.step(budget);
    for (const field of ['operations', 'visitedNodes', 'visitedEdges']) assert.ok(Number.isSafeInteger(step[field]) && step[field] >= 0);
    assert.ok(step.operations <= budget); operations += step.operations; nodes += step.visitedNodes; edges += step.visitedEdges;
    if (step.done) { work.dispose(); return { value: step.value, operations, nodes, edges }; }
    assert.ok(step.operations > 0); assert.equal(step.value, undefined);
  }
  assert.fail('generated scene facts did not finish');
}
function legacyFit(input, padding) {
  const engine = createGraphEngine();
  try { engine.setData(input, 1); return engine.fit(padding); }
  finally { engine.dispose(); }
}

test('scene facts and legacy fit agree across budgets for generated ordinary and spatial owned inputs', () => {
  fc.assert(fc.property(fc.record({ nodes: fc.integer({ min: 0, max: 8 }), edges: fc.integer({ min: 0, max: 12 }),
    seed: fc.integer({ min: 0, max: 0xffffffff }), explicit: fc.boolean(), spatial: fc.boolean(), world: fc.boolean(), suppliedSizes: fc.boolean(),
    coordinate: fc.integer({ min: -1000, max: 1000 }), size: fc.integer({ min: 0, max: 1024 }), padding: fc.integer({ min: 0, max: 50 }),
    rows: fc.array(fc.record({ source: fc.nat(7), target: fc.nat(7), dangling: fc.boolean(), directed: fc.boolean(), curvature: fc.constantFrom(-1, -0.5, 0, 0.5, 1) }), { minLength: 12, maxLength: 12 }) }),
  ({ nodes, edges: requestedEdges, seed, explicit, spatial, world, suppliedSizes, coordinate, size, padding, rows }) => {
    const edges = nodes ? requestedEdges : 0;
    const source = new Uint32Array(edges), target = new Uint32Array(edges), directed = new Uint8Array(edges), dangling = new Uint8Array(edges), curvatures = new Float32Array(edges);
    let expectedCount = 0, expectedDerived = false;
    for (let edge = 0; edge < edges; edge++) {
      const row = rows[edge]; source[edge] = row.source % nodes;
      dangling[edge] = Number(row.dangling); target[edge] = row.dangling ? source[edge] : row.target % nodes;
      directed[edge] = Number(row.directed); curvatures[edge] = row.curvature;
      expectedCount += !row.dangling && (source[edge] === target[edge] || row.curvature !== 0) ? 16 : 1;
      expectedCount += Number(row.directed);
      expectedDerived ||= !row.dangling && source[edge] !== target[edge] && row.curvature !== 0;
    }
    const input = { nodeCount: nodes, source, target, directed, options: { seed },
      ...(explicit ? { positions: Float32Array.from({ length: nodes * 3 }, (_, scalar) => coordinate + scalar / 4) } : {}),
      ...(suppliedSizes ? { sizes: new Float32Array(nodes).fill(size) } : {}),
      ...(spatial ? { spatialAppearance: { sizeUnits: world ? 'world' : 'css', dangling, edgeCurvatures: curvatures } } : {}) };
    const before = structuredClone(input), data = owned(input), ownedBefore = structuredClone(data), expectedCamera = legacyFit(input, padding);
    let expectedFacts;
    for (const budget of [1, 7, 4096]) {
      const result = finish(data, budget);
      assert.equal(result.operations, 3 + nodes + (spatial ? edges : 0)); assert.equal(result.nodes, nodes); assert.equal(result.edges, spatial ? edges : 0);
      assert.equal(result.value.preserveDerivedBounds, spatial && expectedDerived);
      assert.equal(Object.hasOwn(result.value, 'spatialEdgePrimitiveCount'), spatial);
      if (spatial) assert.equal(result.value.spatialEdgePrimitiveCount, expectedCount);
      assert.equal(Object.hasOwn(result.value, 'customStorage'), false);
      if (nodes === 0) assert.equal(result.value.bounds, null);
      const camera = fitOrbitCamera(result.value.bounds, { width: 1, height: 1 }, padding, undefined, { preserveDerivedBounds: result.value.preserveDerivedBounds });
      assert.deepEqual(camera, expectedCamera);
      if (expectedFacts === undefined) expectedFacts = result.value; else assert.deepEqual(result.value, expectedFacts);
      assert.deepEqual(data, ownedBefore); assert.deepEqual(input, before);
    }
    const saved = structuredClone(expectedFacts); data.positions.fill(0); data.source.fill(0); data.target.fill(0);
    assert.deepEqual(expectedFacts, saved, 'transferred scalar facts do not alias graph columns');
  }), { seed: 20261029, numRuns: 200 });
});
