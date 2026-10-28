import assert from 'node:assert/strict';
import { test } from 'node:test';
import fc from 'fast-check';
import { layoutGraphDag, layoutGraphDagAsync } from '../dist/graph-layout/index.js';

const runs = { seed: 0x5eed_1e57, numRuns: 200, includeErrorInReport: true };
const dag = fc.integer({ min: 0, max: 12 }).chain(nodeCount => fc.tuple(
  fc.array(fc.integer(), { minLength: nodeCount, maxLength: nodeCount }),
  fc.array(fc.tuple(fc.integer({ min: 0, max: 11 }), fc.integer({ min: 0, max: 11 })), { maxLength: 36 }),
).map(([keys, candidates]) => {
  const order = Array.from({ length: nodeCount }, (_, row) => row).sort((a, b) => keys[a] - keys[b] || a - b);
  const edges = candidates.filter(([a, b]) => a < nodeCount && b < nodeCount && a !== b)
    .map(([a, b]) => a < b ? [order[a], order[b]] : [order[b], order[a]]);
  return { nodeCount, edges };
}));
const inputFor = ({ nodeCount, edges }) => ({ nodeCount,
  source: Uint32Array.from(edges, edge => edge[0]), target: Uint32Array.from(edges, edge => edge[1]) });

// Independently search incoming paths rather than reproducing the CSR/FIFO traversal.
function referenceRanks(nodeCount, edges) {
  const memo = new Map();
  function depth(node) {
    if (memo.has(node)) return memo.get(node);
    let rank = 0;
    for (const [from, to] of edges) if (to === node) rank = Math.max(rank, depth(from) + 1);
    memo.set(node, rank);
    return rank;
  }
  return Array.from({ length: nodeCount }, (_, row) => depth(row));
}
const plain = result => ({ positions: [...result.positions], ranks: [...result.ranks], layerCount: result.layerCount });

test('generated DAGs agree with independent incoming-path ranks and edge constraints', () => {
  fc.assert(fc.property(dag, value => {
    const result = layoutGraphDag(inputFor(value));
    const expected = referenceRanks(value.nodeCount, value.edges);
    assert.deepEqual([...result.ranks], expected);
    assert.equal(result.layerCount, expected.length ? Math.max(...expected) + 1 : 0);
    for (const [from, to] of value.edges) assert.ok(result.ranks[to] > result.ranks[from]);
  }), runs);
});

test('edge permutations and parallel edges preserve original-row geometry', () => {
  fc.assert(fc.property(dag, fc.nat(), (value, rotation) => {
    const expected = plain(layoutGraphDag(inputFor(value)));
    const count = value.edges.length;
    const shift = count ? rotation % count : 0;
    const edges = [...value.edges.slice(shift), ...value.edges.slice(0, shift)].reverse();
    assert.deepEqual(plain(layoutGraphDag(inputFor({ ...value, edges }))), expected);
    assert.deepEqual(plain(layoutGraphDag(inputFor({ ...value, edges: [...edges, ...edges] }))), expected);
  }), runs);
});

test('all axes preserve peer coordinates and negative axes negate only depth', () => {
  fc.assert(fc.property(dag, value => {
    const input = inputFor(value);
    const baseline = layoutGraphDag(input, { direction: 'y' }).positions;
    for (const direction of ['x', '-x', 'y', '-y', 'z', '-z']) {
      const actual = layoutGraphDag(input, { direction }).positions;
      for (let row = 0; row < value.nodeCount; row++) {
        const [u, w, v] = baseline.subarray(row * 3, row * 3 + 3);
        const principal = direction.startsWith('-') ? -w : w;
        const expected = direction.endsWith('x') ? [principal, u, v] : direction.endsWith('y') ? [u, principal, v] : [u, v, principal];
        for (let axis = 0; axis < 3; axis++) assert.ok(actual[row * 3 + axis] === expected[axis]);
      }
    }
  }), runs);
});

test('small async DAG results match sync bitwise and own independent output buffers', async () => {
  await fc.assert(fc.asyncProperty(dag, async value => {
    const input = inputFor(value);
    const source = [...input.source]; const target = [...input.target];
    const sync = layoutGraphDag(input);
    const asyncResult = await layoutGraphDagAsync(input);
    assert.deepEqual(new Uint8Array(asyncResult.positions.buffer), new Uint8Array(sync.positions.buffer));
    assert.deepEqual(asyncResult.ranks, sync.ranks);
    assert.equal(asyncResult.layerCount, sync.layerCount);
    const buffers = [input.source.buffer, input.target.buffer, sync.positions.buffer, sync.ranks.buffer, asyncResult.positions.buffer, asyncResult.ranks.buffer];
    assert.equal(new Set(buffers).size, buffers.length);
    const saved = plain(sync);
    asyncResult.positions.fill(123); asyncResult.ranks.fill(123);
    assert.deepEqual(plain(sync), saved);
    assert.deepEqual([...input.source], source);
    assert.deepEqual([...input.target], target);
  }), runs);
});
