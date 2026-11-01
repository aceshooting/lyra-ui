import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GraphDagLayoutError, layoutGraphDag } from '../dist/graph-layout/index.js';

const graph = (nodeCount, edges = []) => ({ nodeCount,
  source: Uint32Array.from(edges, edge => edge[0]), target: Uint32Array.from(edges, edge => edge[1]) });
const error = code => value => value instanceof GraphDagLayoutError && value.code === code;

test('longest paths and stable row slots survive parallel edges and permutations', () => {
  const edges = [[0, 1], [0, 2], [1, 3], [2, 3], [0, 3], [0, 1]];
  const first = layoutGraphDag(graph(5, edges));
  assert.deepEqual([...first.ranks], [0, 1, 1, 2, 0]);
  assert.equal(first.layerCount, 3);
  assert.deepEqual([...first.positions], [-25, -100, 0, -25, 0, 0, 25, 0, 0, 0, 100, 0, 25, -100, 0]);
  assert.deepEqual(layoutGraphDag(graph(5, [...edges].reverse())), first);
});

test('all six directions map only the principal axis and preserve grid rows', () => {
  const input = graph(6, [[0, 5], [1, 5], [2, 5], [3, 5], [4, 5]]);
  for (const direction of ['x', '-x', 'y', '-y', 'z', '-z']) {
    const result = layoutGraphDag(input, { direction, layerGap: 20, nodeGap: 10 });
    const principal = direction.endsWith('x') ? 0 : direction.endsWith('y') ? 1 : 2;
    const sign = direction.startsWith('-') ? -1 : 1;
    const uv = [[-10, -5], [0, -5], [10, -5], [-10, 5], [0, 5], [0, 0]];
    for (let row = 0; row < 6; row++) {
      const expected = principal === 0 ? [sign * (row === 5 ? 10 : -10), ...uv[row]] : principal === 1 ? [uv[row][0], sign * (row === 5 ? 10 : -10), uv[row][1]] : [...uv[row], sign * (row === 5 ? 10 : -10)];
      assert.deepEqual([...result.positions.subarray(row * 3, row * 3 + 3)], expected);
    }
  }
});

test('empty and isolated results own all buffers independently', () => {
  const empty = layoutGraphDag(graph(0));
  assert.equal(empty.layerCount, 0);
  assert.notEqual(empty.positions.buffer, empty.ranks.buffer);
  const input = graph(2, [[0, 1]]);
  const before = [...input.source, ...input.target];
  const a = layoutGraphDag(input); const b = layoutGraphDag(input);
  a.positions[0] = 999; a.ranks[0] = 99;
  assert.equal(b.ranks[0], 0);
  assert.deepEqual([...input.source, ...input.target], before);
  assert.notEqual(a.positions.buffer, b.positions.buffer);
  assert.equal(layoutGraphDag(graph(4)).layerCount, 1);
});

test('cycles, self loops and coordinate overflow fail without partial results', () => {
  for (const input of [graph(2, [[0, 1], [1, 0]]), graph(1, [[0, 0]])]) assert.throws(() => layoutGraphDag(input), error('cyclic-graph'));
  const input = graph(22, Array.from({ length: 21 }, (_, i) => [i, i + 1]));
  assert.throws(() => layoutGraphDag(input, { layerGap: 1000000 }), error('coordinate-range'));
});

test('descriptor-safe headers reject malformed input without invoking accessors', () => {
  let calls = 0;
  const accessor = Object.defineProperty(graph(0), 'nodeCount', { get() { calls++; return 0; } });
  for (const value of [null, [], {}, accessor, graph(-1), graph(1.5), graph(0, [[0, 0]]), { ...graph(1), source: [0] }, { ...graph(1), source: new Proxy(new Uint32Array(), {}) }, Object.create(graph(0))]) assert.throws(() => layoutGraphDag(value), error('invalid-input'));
  assert.equal(calls, 0);
  const shadowed = graph(2, [[0, 1]]);
  Object.defineProperties(shadowed.source, { length: { value: 0 }, buffer: { value: null }, slice: { value() { throw Error('unexpected'); } } });
  assert.deepEqual([...layoutGraphDag(shadowed).ranks], [0, 1]);
});

test('shared, detached and resizable buffers are refused', () => {
  if (typeof SharedArrayBuffer !== 'undefined') assert.throws(() => layoutGraphDag({ nodeCount: 1, source: new Uint32Array(new SharedArrayBuffer(4)), target: new Uint32Array(1) }), error('invalid-input'));
  const source = new Uint32Array(1); structuredClone(source.buffer, { transfer: [source.buffer] });
  assert.throws(() => layoutGraphDag({ nodeCount: 1, source, target: new Uint32Array() }), error('invalid-input'));
  const buffer = new ArrayBuffer(4, { maxByteLength: 8 });
  if (buffer.resizable) assert.throws(() => layoutGraphDag({ nodeCount: 1, source: new Uint32Array(buffer), target: new Uint32Array(1) }), error('invalid-input'));
});

test('options, limits and error constructor have stable domain failures', () => {
  for (const options of [null, [], { direction: 'north' }, { direction: null }, { nodeGap: 0 }, { layerGap: Infinity }, { layerGap: '100' }, Object.defineProperty({}, 'direction', { get() { throw Error('accessor invoked'); } })]) assert.throws(() => layoutGraphDag(graph(0), options), error('invalid-options'));
  assert.deepEqual(layoutGraphDag(graph(0), { nodeGap: undefined }), layoutGraphDag(graph(0)));
  assert.throws(() => layoutGraphDag(graph(10001)), error('limit-exceeded'));
  assert.throws(() => layoutGraphDag({ nodeCount: 2, source: new Uint32Array(100001), target: new Uint32Array(100001) }), error('limit-exceeded'));
  assert.equal(layoutGraphDag(graph(10000)).ranks.length, 10000);
  assert.throws(() => new GraphDagLayoutError('private caller data'), TypeError);
});


test('throwing and revoked DTO proxies retain fixed domain failures', () => {
  const sentinel = new Error('caller sentinel');
  const throwing = value => new Proxy(value, { getOwnPropertyDescriptor() { throw sentinel; } });
  const revoked = value => { const proxy = Proxy.revocable(value, {}); proxy.revoke(); return proxy.proxy; };
  for (const input of [throwing(graph(0)), revoked(graph(0))]) assert.throws(() => layoutGraphDag(input), error('invalid-input'));
  for (const options of [throwing({}), revoked({})]) assert.throws(() => layoutGraphDag(graph(0), options), error('invalid-options'));
});
