import assert from 'node:assert/strict';
import test from 'node:test';
import { createGraphDataColumnWork } from '../dist/graph/data-columns-work.js';

const sample = () => ({ nodeCount: 2, source: new Uint32Array([0, 1]), target: new Uint32Array([1, 0]),
  positions: new Float32Array([1, 2, 3, -4, 5, 6]), pinned: new Uint8Array([0, 1]),
  sizes: new Float32Array([0, 3]), categories: new Uint16Array([0, 65535]), options: { seed: 7, damping: 0.5 } });
const columns = ['source', 'target', 'positions', 'pinned', 'sizes', 'categories'];
function finish(work, budget = 7) {
  let bytes = 0;
  for (let count = 0; count < 100000; count++) {
    const step = work.step(budget);
    assert.ok(Number.isInteger(step.operations) && step.operations >= 0 && step.operations <= budget);
    assert.ok(Number.isInteger(step.allocatedBytes) && step.allocatedBytes >= 0);
    bytes += step.allocatedBytes;
    if (step.done) { assert.ok(step.value); return { value: step.value, bytes }; }
    assert.equal(step.value, undefined);
    assert.ok(step.operations > 0, 'unfinished work makes bounded progress');
  }
  assert.fail('work did not finish');
}

test('owned numerical columns retain values without aliasing or changing their caller', () => {
  const input = sample(), before = structuredClone(input), work = createGraphDataColumnWork(input);
  const { value, bytes } = finish(work, 1);
  assert.deepEqual(value, before);
  assert.deepEqual(input, before);
  assert.equal(bytes, columns.reduce((sum, key) => sum + input[key].byteLength, 0));
  for (const key of columns) { assert.notEqual(value[key].buffer, input[key].buffer); input[key].fill(0); }
  input.options.seed = 99;
  assert.deepEqual(value, before);
  work.dispose();
  assert.deepEqual(value, before, 'disposal does not revoke transferred output');
  assert.throws(() => work.step(1), { name: 'InvalidStateError' });
});

test('sample accounting includes every copy, validation visit, allocation and checkpoint', () => {
  for (const budget of [1, 7, 4096]) {
    const work = createGraphDataColumnWork(sample());
    let operations = 0, allocatedBytes = 0, done = false;
    for (let calls = 0; calls < 1000; calls++) {
      const step = work.step(budget);
      operations += step.operations; allocatedBytes += step.allocatedBytes;
      if (step.done) { done = true; break; }
    }
    assert.equal(done, true);
    // 16 source scalars are copied; the layout validator revisits 12 topology/position/pin scalars.
    assert.equal(operations, 1 + 6 + 16 + 12 + 1);
    assert.equal(allocatedBytes, 54);
  }
});

test('empty graphs and omitted position/pin columns retain their semantics', () => {
  const input = { nodeCount: 0, source: new Uint32Array(), target: new Uint32Array() };
  const { value } = finish(createGraphDataColumnWork(input), 1);
  assert.equal(value.positions, undefined);
  assert.equal(value.pinned, undefined);
  assert.equal(value.nodeCount, 0);
  assert.equal(value.source.length, 0);
  const unpositioned = finish(createGraphDataColumnWork({ nodeCount: 2, source: new Uint32Array(), target: new Uint32Array() })).value;
  assert.equal(unpositioned.positions, undefined);
  assert.equal(unpositioned.pinned, undefined);
});

test('creation rejects malformed headers and known accessors without calling getters', () => {
  for (const change of [ { nodeCount: -1 }, { nodeCount: 200001 }, { nodeCount: 0.5 },
    { source: new Uint32Array(1000001), target: new Uint32Array(1000001) },
    { target: new Uint32Array(1) }, { positions: new Float32Array(3) },
    { pinned: new Uint8Array(1) }, { sizes: new Float32Array(1) }, { categories: new Uint16Array(1) },
    { source: new Int32Array(2) }, { target: [] }, { positions: new Float64Array(6) },
    { pinned: new Uint16Array(2) }, { sizes: new Float64Array(2) }, { categories: new Uint8Array(2) },
    { options: null } ]) assert.throws(() => createGraphDataColumnWork({ ...sample(), ...change }));
  for (const key of ['nodeCount', ...columns, 'options']) {
    const input = sample(); let calls = 0;
    Object.defineProperty(input, key, { get() { calls++; throw new Error('caller getter'); } });
    assert.throws(() => createGraphDataColumnWork(input), TypeError);
    assert.equal(calls, 0);
  }
  let calls = 0;
  const options = Object.defineProperty({}, 'seed', { get() { calls++; return 1; } });
  assert.throws(() => createGraphDataColumnWork({ ...sample(), options }), TypeError);
  assert.equal(calls, 0);
  const revoked = Proxy.revocable({}, {}); revoked.revoke();
  assert.throws(() => createGraphDataColumnWork(revoked.proxy), { name: 'TypeError', message: 'Invalid graph numerical columns' });
});

test('shared, resizable and detached buffers are rejected including detached empty columns', () => {
  const shared = new Uint32Array(new SharedArrayBuffer(8));
  assert.throws(() => createGraphDataColumnWork({ ...sample(), source: shared }), TypeError);
  const resizable = new Uint32Array(new ArrayBuffer(8, { maxByteLength: 16 }));
  assert.throws(() => createGraphDataColumnWork({ ...sample(), source: resizable }), TypeError);
  const detached = new Uint32Array(); structuredClone(detached.buffer, { transfer: [detached.buffer] });
  assert.throws(() => createGraphDataColumnWork({ nodeCount: 0, source: detached, target: new Uint32Array() }), TypeError);
});

test('numeric validation fails before typed-array writes can coerce invalid values', () => {
  for (const change of [ { source: new Uint32Array([2, 0]) }, { target: new Uint32Array([0, 2]) },
    { positions: new Float32Array([Infinity, 0, 0, 0, 0, 0]) },
    { positions: new Float32Array([10000001, 0, 0, 0, 0, 0]) },
    { pinned: new Uint8Array([2, 0]) }, { sizes: new Float32Array([-1, 0]) },
    { sizes: new Float32Array([NaN, 0]) }, { options: { damping: 1 } } ]) {
    const work = createGraphDataColumnWork({ ...sample(), ...change });
    assert.throws(() => finish(work), RangeError);
    assert.throws(() => work.step(1), { name: 'InvalidStateError' });
  }
  const input = sample(), work = createGraphDataColumnWork(input);
  work.step(1);
  structuredClone(input.source.buffer, { transfer: [input.source.buffer] });
  assert.throws(() => work.step(7), TypeError);
  assert.throws(() => work.step(7), { name: 'InvalidStateError' });
});

test('caller array methods and captured options cannot affect copying', () => {
  const input = sample(), before = structuredClone(input);
  for (const key of columns) for (const method of ['slice', 'set', 'map', 'every', 'values', Symbol.iterator]) {
    Object.defineProperty(input[key], method, { value() { throw new Error('caller method'); } });
  }
  const work = createGraphDataColumnWork(input);
  input.options.seed = 999;
  assert.deepEqual(finish(work).value, before);
});

test('bad budgets preserve work; disposal and consumed output close it permanently', () => {
  const work = createGraphDataColumnWork(sample());
  for (const budget of [0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => work.step(budget), RangeError);
  finish(work);
  assert.throws(() => work.step(1), { name: 'InvalidStateError' });
  for (const advance of [false, true]) {
    const pending = createGraphDataColumnWork(sample());
    if (advance) pending.step(2);
    pending.dispose(); pending.dispose();
    assert.throws(() => pending.step(1), { name: 'InvalidStateError' });
  }
});
