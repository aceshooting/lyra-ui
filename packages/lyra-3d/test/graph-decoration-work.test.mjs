import assert from 'node:assert/strict';
import test from 'node:test';
import { createGraphDecorationWork } from '../dist/graph/data-appearance-work.js';
import { admitGraphDecorations } from '../dist/graph/decorations.js';

function finish(work, budget = 7) {
  let allocatedBytes = 0, copiedTextUnits = 0;
  for (let calls = 0; calls < 2000000; calls++) {
    const step = work.step(budget);
    assert.ok(Number.isSafeInteger(step.operations) && step.operations >= 0 && step.operations <= budget);
    assert.ok(Number.isSafeInteger(step.allocatedBytes) && step.allocatedBytes >= 0);
    assert.ok(Number.isSafeInteger(step.copiedTextUnits) && step.copiedTextUnits >= 0);
    allocatedBytes += step.allocatedBytes; copiedTextUnits += step.copiedTextUnits;
    if (step.done) return { value: step.value, allocatedBytes, copiedTextUnits };
    assert.equal(step.value, undefined); assert.ok(step.operations > 0);
  }
  assert.fail('decoration work did not finish');
}
const defaults = { labels: undefined, edgeLabels: undefined, nodeLabels: 'zoom', withEdgeLabels: false,
  edgeLabelMinZoom: .6, directed: undefined, particlesPerEdge: 0, particleSpeed: .25 };
const failure = (name, message) => ({ name, message });
const labelRows = failure('RangeError', 'Invalid graph label rows');
const labelValue = failure('TypeError', 'Graph labels must be plain strings');
const maskValue = failure('RangeError', 'Invalid graph directed mask');

// Expected values are authored independently of the synchronous wrapper.
test('empty decoration work preserves defaults and omitted versus empty columns', () => {
  for (const [nodes, edges] of [[0, 0], [200000, 1000000]]) {
    const result = finish(createGraphDecorationWork({}, nodes, edges), 1);
    assert.deepEqual(result, { value: defaults, allocatedBytes: 0, copiedTextUnits: 0 });
  }
  const empty = finish(createGraphDecorationWork({ labels: [], edgeLabels: [], directed: new Uint8Array() }, 0, 0), 1);
  assert.deepEqual(empty.value, { ...defaults, labels: [], edgeLabels: [], directed: new Uint8Array() });
  assert.equal(empty.allocatedBytes, 0); assert.equal(empty.copiedTextUnits, 0);
});

test('decoration work owns exact rows and directed bytes across operation budgets', () => {
  for (const budget of [1, 7, 4096]) {
    const input = { labels: ['a'.repeat(300), 'plain'], edgeLabels: ['edge'], directed: new Uint8Array([1]),
      nodeLabels: 'always', withEdgeLabels: true, edgeLabelMinZoom: .4, particlesPerEdge: 2, particleSpeed: .5 };
    const before = structuredClone(input), work = createGraphDecorationWork(input, 2, 1);
    const result = finish(work, budget), expected = { ...before, labels: ['a'.repeat(256), 'plain'] };
    assert.deepEqual(result.value, expected); assert.deepEqual(input, before);
    assert.equal(result.allocatedBytes, 1); assert.equal(result.copiedTextUnits, 265);
    assert.notEqual(result.value.labels, input.labels); assert.notEqual(result.value.edgeLabels, input.edgeLabels);
    assert.notEqual(result.value.directed.buffer, input.directed.buffer);
    input.labels[0] = 'changed'; input.edgeLabels[0] = 'changed'; input.directed[0] = 0;
    work.dispose(); assert.deepEqual(result.value, expected);
    assert.throws(() => work.step(1), { name: 'InvalidStateError' });
  }
});

test('creation performs no reflection and strict headers ignore unrelated fields', () => {
  let reads = 0;
  const input = new Proxy({}, { getOwnPropertyDescriptor(target, key) { reads++; return Reflect.getOwnPropertyDescriptor(target, key); } });
  const work = createGraphDecorationWork(input, 0, 0); assert.equal(reads, 0); work.dispose(); assert.equal(reads, 0);
  for (const value of [null, undefined, [], 1, 'data']) {
    assert.throws(() => finish(createGraphDecorationWork(value, 0, 0)), failure('TypeError', 'Invalid graph decoration input'));
  }
  for (const [nodes, edges] of [[-1, 0], [0, -1], [.5, 0], [0, Infinity], [NaN, 0], [200001, 0], [0, 1000001]]) {
    assert.throws(() => finish(createGraphDecorationWork({}, nodes, edges)), failure('RangeError', 'Invalid graph decoration counts'));
  }
  const known = Object.defineProperty({}, 'labels', { get() { reads++; return []; } });
  assert.throws(() => finish(createGraphDecorationWork(known, 0, 0)), failure('TypeError', 'Invalid graph decoration input'));
  const ignored = Object.defineProperty({}, 'unrelated', { get() { reads++; throw new Error('unrelated'); } });
  assert.deepEqual(finish(createGraphDecorationWork(ignored, 0, 0)).value, defaults);
  class OwnFields { labels = ['owned']; }
  assert.deepEqual(finish(createGraphDecorationWork(new OwnFields(), 1, 0)).value.labels, ['owned']);
  assert.equal(reads, 0);
});

test('strict label rows reject sparse/accessor shapes and bypass custom iterators', () => {
  for (const labels of [null, 'a', {}, [], ['a', 'b']]) assert.throws(() => finish(createGraphDecorationWork({ labels }, 1, 0)), labelRows);
  for (const labels of [[undefined], [1], new Array(1)]) assert.throws(() => finish(createGraphDecorationWork({ labels }, 1, 0)), labelValue);
  assert.throws(() => finish(createGraphDecorationWork({ edgeLabels: [] }, 0, 1)), labelRows);
  let reads = 0;
  const accessor = Object.defineProperty(['a'], '0', { get() { reads++; return 'a'; } });
  assert.throws(() => finish(createGraphDecorationWork({ labels: accessor }, 1, 0)), labelValue);
  const labels = ['first', 'second']; labels[Symbol.iterator] = () => { reads++; throw new Error('iterator'); };
  assert.deepEqual(finish(createGraphDecorationWork({ labels }, 2, 0)).value.labels, ['first', 'second']);
  assert.equal(reads, 0);
});

test('native directed admission rejects unsupported backing and bypasses shadowed properties', () => {
  const detached = new Uint8Array(1); structuredClone(detached.buffer, { transfer: [detached.buffer] });
  const invalid = [[1], new Uint16Array([1]), new Uint8Array(0), new Uint8Array([2]), detached, new Proxy(new Uint8Array([1]), {})];
  if (typeof SharedArrayBuffer === 'function') invalid.push(new Uint8Array(new SharedArrayBuffer(1)));
  const resizable = new ArrayBuffer(1, { maxByteLength: 2 });
  if (resizable.resizable) invalid.push(new Uint8Array(resizable));
  for (const directed of invalid) assert.throws(() => finish(createGraphDecorationWork({ directed }, 0, 1)), maskValue);
  const directed = new Uint8Array([1, 0]); let reads = 0;
  for (const key of ['length', 'buffer', 'slice', 'every', 'set', Symbol.iterator]) {
    Object.defineProperty(directed, key, { get() { reads++; throw new Error('shadow'); } });
  }
  assert.deepEqual(finish(createGraphDecorationWork({ directed }, 0, 2), 1).value.directed, new Uint8Array([1, 0]));
  assert.equal(reads, 0);
});

test('shared decoration rules retain scalar bounds and a combined raw text budget', () => {
  const scalarError = failure('RangeError', 'Invalid graph decoration option');
  for (const [name, values] of [['edgeLabelMinZoom', [0, 1001, NaN, Infinity, '1']],
    ['particlesPerEdge', [-1, 9, .5, NaN]], ['particleSpeed', [-1, 10.1, Infinity]]]) {
    for (const value of values) assert.throws(() => finish(createGraphDecorationWork({ [name]: value }, 0, 0)), scalarError);
  }
  for (const value of ['invalid', 1]) assert.throws(() => finish(createGraphDecorationWork({ nodeLabels: value }, 0, 0)), failure('RangeError', 'Invalid graph label mode'));
  for (const value of [null, 0, 'true']) assert.throws(() => finish(createGraphDecorationWork({ withEdgeLabels: value }, 0, 0)), failure('TypeError', 'Invalid graph edge label visibility'));
  assert.deepEqual(finish(createGraphDecorationWork({ nodeLabels: null, edgeLabelMinZoom: null, particlesPerEdge: null, particleSpeed: null }, 0, 0)).value, defaults);
  const half = 'x'.repeat(2 * 1024 * 1024);
  const accepted = finish(createGraphDecorationWork({ labels: [half], edgeLabels: [half] }, 1, 1), 1);
  assert.equal(accepted.copiedTextUnits, 512);
  assert.throws(() => finish(createGraphDecorationWork({ labels: [half], edgeLabels: [half + 'x'] }, 1, 1)), failure('RangeError', 'Graph label text exceeds its limit'));
  assert.throws(() => finish(createGraphDecorationWork({ labels: [half + half + 'x'], directed: new Uint8Array([2]) }, 1, 1)), maskValue);
});

test('directed buffers detached between allocation and copy cannot silently supply zero bits', () => {
  const directed = new Uint8Array([1, 0, 1]), work = createGraphDecorationWork({ directed }, 0, 3);
  let allocated = false;
  for (let calls = 0; calls < 10000; calls++) {
    const step = work.step(1); assert.equal(step.done, false);
    if (step.allocatedBytes > 0) { allocated = true; break; }
  }
  assert.equal(allocated, true); structuredClone(directed.buffer, { transfer: [directed.buffer] });
  assert.throws(() => finish(work, 1), maskValue); assert.throws(() => work.step(1), { name: 'InvalidStateError' });
});

test('supersession during reflection, label copying or mask allocation closes ownership', () => {
  let current = true, laterReads = 0;
  const labels = new Proxy(['a', 'b', 'c'], { getOwnPropertyDescriptor(target, key) {
    if (key === '1') current = false;
    if (key === '2') laterReads++;
    return Reflect.getOwnPropertyDescriptor(target, key);
  } });
  const reflective = createGraphDecorationWork({ labels }, 3, 0, () => current);
  assert.throws(() => finish(reflective, 1), { name: 'AbortError' }); assert.equal(laterReads, 0);
  for (const kind of ['labels', 'mask']) {
    current = true;
    const work = createGraphDecorationWork({ labels: ['first', 'second'], directed: new Uint8Array([1, 0]) }, 2, 2, () => current);
    let boundary = false;
    for (let calls = 0; calls < 10000; calls++) {
      const step = work.step(1); assert.equal(step.done, false);
      if (kind === 'labels' ? step.copiedTextUnits > 0 : step.allocatedBytes > 0) { boundary = true; break; }
    }
    assert.equal(boundary, true); current = false;
    assert.throws(() => work.step(1), { name: 'AbortError' }); assert.throws(() => work.step(1), { name: 'InvalidStateError' });
  }
});

test('reentrant disposal avoids running-generator errors and invalid budgets preserve pending work', () => {
  const work = createGraphDecorationWork({}, 0, 0);
  for (const budget of [0, -1, .5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => work.step(budget), RangeError);
  assert.deepEqual(finish(work).value, defaults);
  let reflective, laterReads = 0;
  const labels = new Proxy(['a', 'b'], { getOwnPropertyDescriptor(target, key) {
    if (key === '0') reflective.dispose();
    if (key === '1') laterReads++;
    return Reflect.getOwnPropertyDescriptor(target, key);
  } });
  reflective = createGraphDecorationWork({ labels }, 2, 0);
  assert.throws(() => finish(reflective, 1), { name: 'AbortError' }); assert.equal(laterReads, 0);
  reflective.dispose(); assert.throws(() => reflective.step(1), { name: 'InvalidStateError' });
});

test('reflective errors are fixed while application guard exceptions retain identity', () => {
  const secret = new Error('application detail');
  const root = new Proxy({}, { getOwnPropertyDescriptor() { throw secret; } });
  assert.throws(() => finish(createGraphDecorationWork(root, 0, 0)), failure('TypeError', 'Invalid graph decoration input'));
  const labels = new Proxy(['a'], { getOwnPropertyDescriptor(target, key) { if (key === '0') throw secret; return Reflect.getOwnPropertyDescriptor(target, key); } });
  assert.throws(() => finish(createGraphDecorationWork({ labels }, 1, 0)), labelValue);
  const guarded = createGraphDecorationWork({}, 0, 0, () => { throw secret; });
  assert.throws(() => guarded.step(1), error => error === secret);
  assert.throws(() => guarded.step(1), { name: 'InvalidStateError' });
});

test('synchronous decoration access behavior survives shared-rule extraction', () => {
  let reads = 0;
  const changing = Object.defineProperty({}, 'withEdgeLabels', { get() { return ++reads === 1 ? true : undefined; } });
  assert.throws(() => admitGraphDecorations(changing, 0, 0), failure('TypeError', 'Invalid graph edge label visibility'));
  assert.equal(reads, 2);
  let iterations = 0;
  const labels = ['ordinary']; labels[Symbol.iterator] = function* () { iterations++; yield 'iterator label'; };
  assert.deepEqual(admitGraphDecorations({ labels }, 1, 0).labels, ['iterator label']); assert.equal(iterations, 1);
  let rowReads = 0;
  const getterRows = Object.defineProperty(['a'], '0', { get() { rowReads++; return 'getter label'; } });
  assert.deepEqual(admitGraphDecorations({ labels: getterRows }, 1, 0).labels, ['getter label']); assert.equal(rowReads, 1);
  assert.deepEqual(admitGraphDecorations({}, 0, 0), defaults);
});
