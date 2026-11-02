import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GRAPH_FIXTURE_SEED, graphFixture, graphFixtureDigest } from './graph-fixture.mjs';
import { PROFILES } from './run.mjs';

const source = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const integer = (text) => Number(text.replaceAll('_', ''));

/** The admission ceilings, read from the sources that enforce them so a change cannot drift past the profile. */
function admissionLimits() {
  const columns = source('packages/lyra-ui/src/internal/typed-columns.ts')
    .match(/GRAPH_COLUMN_LIMITS[^=]*=\s*Object\.freeze\(\{\s*nodes:\s*([\d_]+),\s*edges:\s*([\d_]+)\s*\}\)/);
  const layout = source('packages/lyra-3d/src/graph/layout-admission.ts');
  const layoutNodes = layout.match(/count > ([\d_]+)\) throw new RangeError\('Invalid graph node count'\)/);
  const layoutEdges = layout.match(/input\.source\.length > ([\d_]+)\)/);
  assert.ok(columns && layoutNodes && layoutEdges, 'admission limits are no longer where this test reads them');
  return { columns: { nodes: integer(columns[1]), edges: integer(columns[2]) }, layout: { nodes: integer(layoutNodes[1]), edges: integer(layoutEdges[1]) } };
}

test('the same seed reproduces the same bytes; recorded profiles keep their fingerprints', () => {
  // These digests identify the scenes earlier results measured; a change makes them incomparable.
  assert.equal(graphFixtureDigest(graphFixture({ nodes: 10_000, edges: 30_000 })), '06764174');
  assert.equal(graphFixtureDigest(graphFixture({ nodes: 100_000, edges: 300_000 })), 'a1c0d380');
  assert.equal(GRAPH_FIXTURE_SEED, 7);
  const a = graphFixture({ nodes: 500, edges: 1500, seed: 3 }), b = graphFixture({ nodes: 500, edges: 1500, seed: 3 });
  assert.equal(graphFixtureDigest(a), graphFixtureDigest(b));
  assert.notEqual(graphFixtureDigest(a), graphFixtureDigest(graphFixture({ nodes: 500, edges: 1500, seed: 4 })));
});

test('the 100k profile keeps the 10k ratio of three edges per node, valid and loop-free', () => {
  const graph = PROFILES.scale.find((scenario) => scenario.kind === 'graph');
  assert.deepEqual([graph.nodes, graph.edges], [100_000, 300_000]);
  const quick = PROFILES.quick.find((scenario) => scenario.kind === 'graph');
  assert.equal(graph.edges / graph.nodes, quick.edges / quick.nodes);
  const fixture = graphFixture(graph);
  for (const column of [fixture.x, fixture.y, fixture.z]) {
    assert.ok(column instanceof Float32Array && column.length === graph.nodes);
    assert.ok(column.every((value) => Number.isFinite(value) && Math.abs(value) <= 600));
  }
  assert.ok(fixture.source instanceof Uint32Array && fixture.target instanceof Uint32Array);
  assert.equal(fixture.source.length, graph.edges);
  assert.equal(fixture.target.length, graph.edges);
  const degree = new Uint32Array(graph.nodes);
  for (let edge = 0; edge < graph.edges; edge += 1) {
    const from = fixture.source[edge], to = fixture.target[edge];
    assert.ok(from < graph.nodes && to < graph.nodes && from !== to, `edge ${edge}`);
    degree[from] += 1; degree[to] += 1;
  }
  assert.ok(degree.every((value) => value > 0), 'every node has an edge');
});

test('every graph profile is admitted by typed columns and by the worker layout', () => {
  const limits = admissionLimits();
  const graphs = [...PROFILES.quick, ...PROFILES.stress, ...PROFILES.scale].filter((scenario) => scenario.kind === 'graph');
  for (const graph of graphs) {
    for (const ceiling of [limits.columns, limits.layout]) {
      assert.ok(graph.nodes <= ceiling.nodes && graph.edges <= ceiling.edges, `${graph.id} within ${JSON.stringify(ceiling)}`);
    }
  }
});

test('graph sizes are validated before allocation', () => {
  for (const options of [{ nodes: 1, edges: 0 }, { nodes: 1.5, edges: 0 }, { nodes: 10, edges: -1 }, { nodes: 10, edges: Number.NaN }]) {
    assert.throws(() => graphFixture(options), RangeError);
  }
});
