import assert from 'node:assert/strict';
import test from 'node:test';
import { createGraphNodeMeshWork } from '../dist/graph/node-mesh.js';
import { triangleMesh } from './graph-node-mesh-fixtures.mjs';

function finish(work, budget = 7) {
  let allocatedBytes = 0, reflectedKeys = 0, calls = 0;
  for (; calls < 2000000; calls++) {
    const step = work.step(budget);
    assert.ok(Number.isSafeInteger(step.operations) && step.operations >= 0 && step.operations <= budget);
    assert.ok(Number.isSafeInteger(step.allocatedBytes) && step.allocatedBytes >= 0);
    assert.ok(Number.isSafeInteger(step.reflectedKeys) && step.reflectedKeys >= 0);
    allocatedBytes += step.allocatedBytes; reflectedKeys += step.reflectedKeys;
    if (step.done) return { value: step.value, allocatedBytes, reflectedKeys, calls: calls + 1 };
    assert.equal(step.value, undefined); assert.ok(step.operations > 0);
  }
  assert.fail('bounded mesh work did not finish');
}
const invalid = (reason, nodeIndex) => error => error.code === 'graph-node-mesh' && error.reason === reason && error.nodeIndex === nodeIndex;

test('incremental custom admission owns exact mesh bytes and reports native reflection separately', () => {
  for (const budget of [1, 7, 4096]) {
    const mesh = triangleMesh(1, [1, .25, 0, .5]), before = structuredClone(mesh);
    const work = createGraphNodeMeshWork([mesh, null], 2);
    const result = finish(work, budget), data = result.value;
    assert.equal(data.triangleCount, 1); assert.equal(data.customNodeCount, 1); assert.equal(data.payloadBytes, 64);
    assert.equal(data.nodeMeshes.length, 2); assert.equal(data.nodeMeshes[1], null);
    assert.deepEqual(data.nodeMeshes[0], before); assert.deepEqual(mesh, before);
    assert.notEqual(data.nodeMeshes[0].positions.buffer, mesh.positions.buffer);
    assert.notEqual(data.nodeMeshes[0].normals.buffer, mesh.normals.buffer);
    assert.equal(result.allocatedBytes, 48, 'one face owns nine position and three normal Float32 values');
    assert.equal(result.reflectedKeys, 11, 'three row-array keys, three mesh keys and five color-array keys');
    assert.equal(Object.isFrozen(data), true); assert.equal(Object.isFrozen(data.nodeMeshes), true);
    assert.equal(Object.isFrozen(data.nodeMeshes[0]), true); assert.equal(Object.isFrozen(data.nodeMeshes[0].color), true);
    mesh.positions.fill(0); mesh.normals.fill(0); mesh.color.fill(0);
    assert.deepEqual(data.nodeMeshes[0], before);
    work.dispose(); assert.deepEqual(data.nodeMeshes[0], before);
    assert.throws(() => work.step(1), { name: 'InvalidStateError' });
  }
});

test('omitted and all-null meshes complete without retaining custom row storage', () => {
  for (const [rows, count, keys] of [[undefined, 0, 0], [undefined, 200000, 0], [[], 0, 1], [[null, null], 2, 3]]) {
    const result = finish(createGraphNodeMeshWork(rows, count), 1);
    assert.equal(result.value, undefined); assert.equal(result.allocatedBytes, 0); assert.equal(result.reflectedKeys, keys);
  }
});

test('creation does not scan rows and strict shape failures retain existing error identity', () => {
  let reads = 0;
  const rows = new Proxy([triangleMesh()], { getOwnPropertyDescriptor(target, key) { reads++; return Reflect.getOwnPropertyDescriptor(target, key); } });
  const pending = createGraphNodeMeshWork(rows, 1);
  assert.equal(reads, 0); pending.dispose(); assert.equal(reads, 0);
  const extra = [triangleMesh()]; extra.extra = true;
  const symbol = [triangleMesh()]; symbol[Symbol('extra')] = true;
  const cases = [null, {}, [], [null, null], [undefined], new Array(1), extra, symbol];
  for (const input of cases) assert.throws(() => finish(createGraphNodeMeshWork(input, 1)), error => error.code === 'graph-node-mesh' && error.reason === 'invalid');
  for (const count of [-1, .5, NaN, Infinity, 200001]) assert.throws(() => finish(createGraphNodeMeshWork(undefined, count)), invalid('invalid', undefined));
  let getters = 0;
  const entry = Object.defineProperty({}, 'positions', { get() { getters++; return new Float32Array(9); } });
  assert.throws(() => finish(createGraphNodeMeshWork([entry], 1)), invalid('invalid', 0));
  assert.equal(getters, 0);
});

test('scene and per-node limits preflight before any owned typed backing is allocated', () => {
  for (const [rows, expectedRow] of [[[triangleMesh(65)], 0], [Array.from({ length: 1025 }, () => triangleMesh(64)), 1024]]) {
    const work = createGraphNodeMeshWork(rows, rows.length); let allocated = 0;
    assert.throws(() => {
      for (let calls = 0; calls < 2000000; calls++) {
        const step = work.step(7); allocated += step.allocatedBytes;
        if (step.done) assert.fail('over-budget meshes must fail');
      }
      assert.fail('preflight did not terminate');
    }, invalid('budget', expectedRow));
    assert.equal(allocated, 0); assert.throws(() => work.step(1), { name: 'InvalidStateError' });
  }
});

test('supersession during reflection or after allocation closes work before another step', () => {
  let current = true;
  const rows = new Proxy([null, triangleMesh()], {
    getOwnPropertyDescriptor(target, key) { if (key === '1') current = false; return Reflect.getOwnPropertyDescriptor(target, key); },
  });
  const reflective = createGraphNodeMeshWork(rows, 2, () => current);
  assert.throws(() => finish(reflective, 1), { name: 'AbortError' });
  assert.throws(() => reflective.step(1), { name: 'InvalidStateError' });
  current = true;
  const mesh = triangleMesh(64), before = structuredClone(mesh), work = createGraphNodeMeshWork([mesh], 1, () => current);
  let allocated = false;
  for (let count = 0; count < 10000; count++) {
    const step = work.step(1);
    if (step.allocatedBytes > 0) { allocated = true; break; }
    assert.equal(step.done, false);
  }
  assert.equal(allocated, true); current = false;
  assert.throws(() => work.step(1), { name: 'AbortError' });
  work.dispose(); assert.deepEqual(mesh, before);
  assert.throws(() => work.step(1), { name: 'InvalidStateError' });
});

test('detachment between resumable copy steps fails instead of silently copying zeroes', () => {
  const mesh = triangleMesh(64), work = createGraphNodeMeshWork([mesh], 1);
  let allocated = false;
  for (let count = 0; count < 10000; count++) {
    const step = work.step(1);
    if (step.allocatedBytes > 0) { allocated = true; break; }
    assert.equal(step.done, false);
  }
  assert.equal(allocated, true);
  structuredClone(mesh.normals.buffer, { transfer: [mesh.normals.buffer] });
  assert.throws(() => finish(work, 1), invalid('invalid', 0));
  assert.throws(() => work.step(1), { name: 'InvalidStateError' });
});

test('numeric/geometry failure closes work while native copying ignores caller typed-array methods', () => {
  const bad = triangleMesh(); bad.normals[2] = -1;
  const failing = createGraphNodeMeshWork([null, bad], 2);
  assert.throws(() => finish(failing, 1), invalid('invalid', 1));
  assert.throws(() => failing.step(1), { name: 'InvalidStateError' });
  const mesh = triangleMesh(), before = structuredClone(mesh);
  for (const array of [mesh.positions, mesh.normals]) {
    for (const name of ['slice', 'set', 'every', 'map', 'values', Symbol.iterator]) Object.defineProperty(array, name, { value() { throw new Error('caller method'); } });
  }
  assert.deepEqual(finish(createGraphNodeMeshWork([mesh], 1), 1).value.nodeMeshes[0], before);
});

test('invalid budgets preserve work and explicit disposal prevents further input reads', () => {
  const work = createGraphNodeMeshWork([triangleMesh()], 1);
  for (const budget of [0, -1, .5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => work.step(budget), RangeError);
  assert.equal(finish(work).value.triangleCount, 1);
  let reads = 0;
  const rows = new Proxy([triangleMesh()], { getOwnPropertyDescriptor(target, key) { reads++; return Reflect.getOwnPropertyDescriptor(target, key); } });
  const disposed = createGraphNodeMeshWork(rows, 1); disposed.step(1); disposed.dispose(); const before = reads;
  disposed.dispose(); assert.throws(() => disposed.step(1), { name: 'InvalidStateError' }); assert.equal(reads, before);
});


test('whole-scene preflight errors precede earlier geometry errors and all owned copying', () => {
  const bad = triangleMesh(); bad.normals[2] = -1;
  for (const [later, reason] of [[triangleMesh(65), 'budget'], [{ ...triangleMesh(), extra: true }, 'invalid']]) {
    const work = createGraphNodeMeshWork([bad, later], 2); let allocated = 0;
    assert.throws(() => {
      for (let calls = 0; calls < 10000; calls++) {
        const step = work.step(1); allocated += step.allocatedBytes;
        if (step.done) assert.fail('invalid mesh scene completed');
      }
      assert.fail('preflight did not terminate');
    }, invalid(reason, 1));
    assert.equal(allocated, 0);
  }
});

test('fully copied source attachment and cancellation remain guarded during geometry work', () => {
  for (const mode of ['detach', 'cancel']) {
    let current = true;
    const mesh = triangleMesh(64), work = createGraphNodeMeshWork([mesh], 1, () => current);
    let bytes = 0;
    for (let calls = 0; calls < 10000 && bytes < 64 * 48; calls++) {
      const step = work.step(1); bytes += step.allocatedBytes; assert.equal(step.done, false);
    }
    assert.equal(bytes, 64 * 48);
    assert.equal(work.step(1).done, false, 'geometry validation has a resumable boundary');
    if (mode === 'detach') structuredClone(mesh.positions.buffer, { transfer: [mesh.positions.buffer] });
    else current = false;
    assert.throws(() => work.step(1), mode === 'detach' ? invalid('invalid', 0) : { name: 'AbortError' });
    assert.throws(() => work.step(1), { name: 'InvalidStateError' });
  }
});

test('reflective disposal closes a running generator without resuming it or reading later rows', () => {
  let work, laterReads = 0;
  const rows = new Proxy([triangleMesh(), triangleMesh()], {
    getOwnPropertyDescriptor(target, key) {
      if (key === '0') work.dispose();
      if (key === '1') laterReads++;
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
  work = createGraphNodeMeshWork(rows, 2);
  assert.throws(() => finish(work, 1), { name: 'AbortError' });
  assert.equal(laterReads, 0); work.dispose();
  assert.throws(() => work.step(1), { name: 'InvalidStateError' });
});
