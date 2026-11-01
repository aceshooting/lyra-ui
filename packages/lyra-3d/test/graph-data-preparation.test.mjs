import assert from 'node:assert/strict';
import test from 'node:test';
import { createGraphDataPreparationWork } from '../dist/graph/data-preparation.js';
import { createGraphDataColumnWork } from '../dist/graph/data-columns-work.js';
import { createGraphEngine } from '../dist/graph/engine.js';
import { graphSpatialNodeMeshData } from '../dist/graph/spatial-appearance.js';
import { triangleMesh } from './graph-node-mesh-fixtures.mjs';
import { installFakeBrowser } from './fake-browser.mjs';

const aborted = { name: 'AbortError', message: 'Graph data preparation was superseded' };
const empty = () => ({ nodeCount: 0, source: new Uint32Array(), target: new Uint32Array() });
const ordinary = () => ({ nodeCount: 2, source: new Uint32Array([0]), target: new Uint32Array([1]), positions: new Float32Array([1, 2, 3, 4, 5, 6]),
  labels: ['a', 'bc'], edgeLabels: ['edge'], directed: new Uint8Array([1]) });
function finish(work, budget = 7) {
  const totals = { operations: 0, allocatedBytes: 0, copiedTextUnits: 0, reflectedKeys: 0, copiedDashValues: 0 };
  for (let calls = 0; calls < 2000000; calls++) {
    const step = work.step(budget);
    for (const key of Object.keys(totals)) { assert.ok(Number.isSafeInteger(step[key]) && step[key] >= 0, key); totals[key] += step[key]; }
    assert.ok(step.operations <= budget);
    if (step.done) return { value: step.value, ...totals };
    assert.ok(step.operations > 0); assert.equal(step.value, undefined);
  }
  assert.fail('graph data preparation did not finish');
}
function assertStart(data, start) {
  assert.equal(start.type, 'start'); assert.equal(start.data.nodeCount, data.nodeCount);
  assert.equal(start.data.source, data.source); assert.equal(start.data.target, data.target); assert.equal(start.data.options, data.options);
  assert.deepEqual(start.data.positions, data.positions); assert.deepEqual(start.data.pinned, data.pinned);
  assert.notEqual(start.data.positions.buffer, data.positions.buffer); assert.notEqual(start.data.pinned.buffer, data.pinned.buffer);
  assert.deepEqual(Object.keys(start.data).sort(), ['nodeCount', 'source', 'target', 'positions', 'pinned', ...(Object.hasOwn(data, 'options') ? ['options'] : [])].sort());
}
async function legacyStart(input, container) {
  let snapshot;
  const engine = createGraphEngine({ task(options) {
    snapshot = structuredClone(options.input.data);
    return { mode: 'main-thread', stop() {}, update() {} };
  } });
  try {
    engine.setData(input, 1);
    const positions = Float32Array.from(Array.from({ length: input.nodeCount }, (_, row) => {
      const point = engine.positionOf(row); return [point.x, point.y, point.z];
    }).flat());
    await engine.mount(container, { hover() {}, pick() {}, camera() {}, lost() {} });
    return { positions, pinned: snapshot.pinned, startPositions: snapshot.positions };
  } finally { engine.dispose(); }
}

test('data preparation defers capture and owns empty DTOs without inventing optional columns', () => {
  let reads = 0;
  const input = new Proxy(empty(), { getOwnPropertyDescriptor(target, key) { reads++; return Reflect.getOwnPropertyDescriptor(target, key); } });
  const pending = createGraphDataPreparationWork(input); assert.equal(reads, 0); pending.dispose(); assert.equal(reads, 0);
  const result = finish(createGraphDataPreparationWork(empty()), 1), { data, start } = result.value;
  assert.equal(data.nodeCount, 0); assert.deepEqual(data.positions, new Float32Array()); assert.deepEqual(data.pinned, new Uint8Array());
  for (const name of ['sizes', 'categories', 'options', 'spatialAppearance']) assert.equal(Object.hasOwn(data, name), false, name);
  assert.equal(data.nodeLabels, 'zoom'); assert.equal(data.withEdgeLabels, false); assertStart(data, start);
  assert.equal(result.allocatedBytes, 0); assert.equal(result.copiedTextUnits, 0); assert.equal(result.reflectedKeys, 0); assert.equal(result.copiedDashValues, 0);
});

test('ordinary composition transfers exact owned fields, counters and separate start buffers', () => {
  let operations;
  for (const budget of [1, 7, 4096]) {
    const input = ordinary(), before = structuredClone(input), work = createGraphDataPreparationWork(input);
    const result = finish(work, budget), { data, start } = result.value;
    assert.equal(result.allocatedBytes, 61); assert.equal(result.copiedTextUnits, 7); assert.equal(result.reflectedKeys, 0); assert.equal(result.copiedDashValues, 0);
    if (operations === undefined) operations = result.operations; else assert.equal(result.operations, operations, 'phase/completion costs are budget-independent');
    assert.deepEqual(data.positions, before.positions); assert.deepEqual(data.pinned, new Uint8Array([1, 1]));
    assert.deepEqual(data.labels, before.labels); assert.deepEqual(data.edgeLabels, before.edgeLabels); assert.deepEqual(data.directed, before.directed);
    assert.notEqual(data.source.buffer, input.source.buffer); assert.notEqual(data.target.buffer, input.target.buffer); assert.notEqual(data.positions.buffer, input.positions.buffer);
    assertStart(data, start); assert.deepEqual(input, before);
    input.positions.fill(0); input.source.fill(1); input.labels[0] = 'changed'; input.directed[0] = 0;
    work.dispose(); assert.deepEqual(data.positions, before.positions); assert.deepEqual(start.data.positions, before.positions); assert.deepEqual(data.source, before.source);
    assert.throws(() => work.step(1), { name: 'InvalidStateError' });
  }
});

test('initial live and task positions/pins match the untouched synchronous engine oracle', async t => {
  const browser = installFakeBrowser(); t.after(() => browser.restore());
  const cases = [];
  for (const nodes of [0, 1, 7]) for (const seed of [undefined, 0, 1, 0xffffffff]) {
    cases.push({ nodeCount: nodes, source: new Uint32Array(), target: new Uint32Array(), ...(seed === undefined ? {} : { options: { seed } }) });
  }
  cases.push(ordinary(), { ...ordinary(), pinned: new Uint8Array([0, 1]) }, { nodeCount: 2, source: new Uint32Array(), target: new Uint32Array(), pinned: new Uint8Array([1, 0]) });
  for (const input of cases) {
    const oracle = await legacyStart(input, browser.container);
    for (const budget of [1, 7, 4096]) {
      const { data, start } = finish(createGraphDataPreparationWork(input), budget).value;
      assert.deepEqual(data.positions, oracle.positions); assert.deepEqual(data.pinned, oracle.pinned);
      assert.deepEqual(start.data.positions, oracle.startPositions); assert.deepEqual(start.data.pinned, oracle.pinned);
      assertStart(data, start);
    }
  }
});

test('spatial composition preserves child metadata and propagates bytes/text/keys/dashes once', () => {
  let operations;
  for (const budget of [1, 7, 4096]) {
    const input = { ...ordinary(), spatialAppearance: { nodeShapes: new Uint8Array([0, 2]), edgeWidths: new Float32Array([3]), edgeCurvatures: new Float32Array([2]),
      dangling: new Uint8Array([0]), edgeDashes: [[2, 2]], nodeMeshes: [null, triangleMesh(1, [1, 0, 0, 1])] } };
    const before = structuredClone(input), result = finish(createGraphDataPreparationWork(input), budget), { data, start } = result.value;
    assert.equal(result.allocatedBytes, 120); assert.equal(result.copiedTextUnits, 7); assert.equal(result.reflectedKeys, 11); assert.equal(result.copiedDashValues, 2);
    if (operations === undefined) operations = result.operations; else assert.equal(result.operations, operations);
    const metadata = graphSpatialNodeMeshData(data.spatialAppearance);
    assert.equal(metadata.nodeMeshes, data.spatialAppearance.nodeMeshes); assert.equal(metadata.payloadBytes, 64);
    assert.equal(data.spatialAppearance.edgeCurvatures[0], 1); assert.notEqual(data.spatialAppearance, input.spatialAppearance);
    assert.notEqual(metadata.nodeMeshes[1].positions.buffer, input.spatialAppearance.nodeMeshes[1].positions.buffer);
    assert.deepEqual(input, before); assertStart(data, start);
    assert.equal(Object.hasOwn(start.data, 'spatialAppearance'), false);
  }
});

test('cross-field spatial size and dangling checks preserve ordinary size behavior', () => {
  for (const [sizeUnits, limit] of [['css', 1024], ['world', 20000000]]) {
    const input = { ...ordinary(), sizes: new Float32Array([limit, 0]), spatialAppearance: { sizeUnits } };
    assert.deepEqual(finish(createGraphDataPreparationWork(input)).value.data.sizes, input.sizes);
    input.sizes[0] = limit + 2;
    assert.throws(() => finish(createGraphDataPreparationWork(input)), { name: 'RangeError', message: 'Graph spatial diameters exceed the supported range' });
  }
  const ordinaryLarge = { ...ordinary(), sizes: new Float32Array([30000000, 0]), categories: new Uint16Array([0, 65535]) };
  const data = finish(createGraphDataPreparationWork(ordinaryLarge)).value.data;
  assert.deepEqual(data.sizes, ordinaryLarge.sizes); assert.deepEqual(data.categories, ordinaryLarge.categories);
  const dangling = { ...ordinary(), spatialAppearance: { dangling: new Uint8Array([1]) } };
  assert.throws(() => finish(createGraphDataPreparationWork(dangling)), { name: 'RangeError', message: 'Dangling layout endpoints must share the source row' });
  dangling.target[0] = 0;
  assert.deepEqual(finish(createGraphDataPreparationWork(dangling)).value.data.target, new Uint32Array([0]));
});

test('only known owned DTO fields survive and caller mutation/detachment after completion is safe', () => {
  let reads = 0;
  const input = { ...ordinary(), options: { seed: 7, damping: .5 }, pinned: new Uint8Array([0, 1]), categories: new Uint16Array([1, 2]) };
  Object.defineProperty(input, 'unrelated', { get() { reads++; throw new Error('ignored'); } });
  const { data, start } = finish(createGraphDataPreparationWork(input), 1).value;
  assert.equal(reads, 0); assert.equal(Object.hasOwn(data, 'unrelated'), false); assert.equal(Object.hasOwn(start.data, 'unrelated'), false);
  assert.notEqual(data.options, input.options); assert.equal(data.options, start.data.options);
  input.options.seed = 99; assert.equal(data.options.seed, 7);
  const snapshot = structuredClone({ data, start });
  for (const name of ['source', 'target', 'positions', 'pinned', 'categories', 'directed']) structuredClone(input[name].buffer, { transfer: [input[name].buffer] });
  assert.deepEqual({ data, start }, snapshot);
});

test('deferred malformed capture and own appearance accessors reject without invoking getters', () => {
  let reads = 0;
  const input = Object.defineProperty(empty(), 'source', { get() { reads++; return new Uint32Array(); } });
  const work = createGraphDataPreparationWork(input); assert.equal(reads, 0);
  assert.throws(() => finish(work), TypeError); assert.equal(reads, 0); assert.throws(() => work.step(1), { name: 'InvalidStateError' });
  const appearance = Object.defineProperty(empty(), 'spatialAppearance', { get() { reads++; return {}; } });
  assert.throws(() => finish(createGraphDataPreparationWork(appearance)), { name: 'TypeError', message: 'Invalid graph spatial appearance' });
  assert.equal(reads, 0);
  const inherited = Object.assign(Object.create({ spatialAppearance: { sizeUnits: 'bad' } }), empty());
  assert.equal(Object.hasOwn(finish(createGraphDataPreparationWork(inherited)).value.data, 'spatialAppearance'), false);
});

test('numerical capture is fenced after reflective supersession and never publishes stale columns', () => {
  let current = true;
  const input = new Proxy(ordinary(), { getOwnPropertyDescriptor(target, key) {
    if (key === 'source') current = false;
    return Reflect.getOwnPropertyDescriptor(target, key);
  } });
  const work = createGraphDataPreparationWork(input, () => current);
  assert.throws(() => finish(work, 1), aborted); assert.throws(() => work.step(1), { name: 'InvalidStateError' });
});

test('a thrown child guard exception retains identity without a second guard call replacing it', () => {
  const first = new Error('first guard exception'), second = new Error('second guard exception');
  let armed = false, throws = 0;
  const input = new Proxy(ordinary(), { getOwnPropertyDescriptor(target, key) {
    if (key === 'labels') armed = true;
    return Reflect.getOwnPropertyDescriptor(target, key);
  } });
  const work = createGraphDataPreparationWork(input, () => { if (armed) throw ++throws === 1 ? first : second; return true; });
  assert.throws(() => finish(work, 1), error => error === first);
  assert.equal(throws, 1); assert.throws(() => work.step(1), { name: 'InvalidStateError' });
});

test('completed numerical output remains private until its charged adoption phase', () => {
  const numerical = createGraphDataColumnWork(empty()), numericalStep = numerical.step(10000);
  assert.equal(numericalStep.done, true);
  for (const mode of ['cancel', 'dispose']) {
    let current = true, labelReads = 0;
    const input = new Proxy(empty(), { getOwnPropertyDescriptor(target, key) { if (key === 'labels') labelReads++; return Reflect.getOwnPropertyDescriptor(target, key); } });
    const work = createGraphDataPreparationWork(input, () => current);
    const setup = work.step(1); assert.equal(setup.done, false); assert.equal(setup.operations, 1);
    const completed = work.step(numericalStep.operations);
    assert.equal(completed.operations, numericalStep.operations); assert.equal(completed.done, false); assert.equal(completed.value, undefined); assert.equal(labelReads, 0);
    if (mode === 'dispose') { work.dispose(); assert.throws(() => work.step(1), { name: 'InvalidStateError' }); }
    else { current = false; assert.throws(() => work.step(1), aborted); }
    assert.equal(labelReads, 0);
  }
});

test('budget-one completion never recaptures a child and invalid budgets preserve pending work', () => {
  let sourceReads = 0;
  const input = new Proxy(ordinary(), { getOwnPropertyDescriptor(target, key) { if (key === 'source') sourceReads++; return Reflect.getOwnPropertyDescriptor(target, key); } });
  const work = createGraphDataPreparationWork(input);
  for (const budget of [0, -1, .5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => work.step(budget), RangeError);
  const result = finish(work, 1); assert.equal(sourceReads, 1); assert.deepEqual(result.value.data.pinned, new Uint8Array([1, 1]));
  assert.throws(() => work.step(1), { name: 'InvalidStateError' }); work.dispose(); work.dispose();
});

test('cancellation during decoration and spatial mesh work preserves the parent abort contract', () => {
  for (const phase of ['labels', 'mesh']) {
    let current = true;
    const labels = new Proxy(['a', 'b'], { getOwnPropertyDescriptor(target, key) { if (phase === 'labels' && key === '0') current = false; return Reflect.getOwnPropertyDescriptor(target, key); } });
    const nodeMeshes = new Proxy([triangleMesh(), null], { getOwnPropertyDescriptor(target, key) { if (phase === 'mesh' && key === '0') current = false; return Reflect.getOwnPropertyDescriptor(target, key); } });
    const work = createGraphDataPreparationWork({ ...ordinary(), labels, spatialAppearance: { nodeMeshes } }, () => current);
    assert.throws(() => finish(work, 7), aborted); assert.throws(() => work.step(1), { name: 'InvalidStateError' });
  }
});

test('disposal during child reflection closes the composition without reading later rows', () => {
  let work, laterReads = 0;
  const labels = new Proxy(['a', 'b'], { getOwnPropertyDescriptor(target, key) {
    if (key === '0') work.dispose();
    if (key === '1') laterReads++;
    return Reflect.getOwnPropertyDescriptor(target, key);
  } });
  work = createGraphDataPreparationWork({ ...ordinary(), labels });
  assert.throws(() => finish(work, 1), aborted); assert.equal(laterReads, 0);
  work.dispose(); assert.throws(() => work.step(1), { name: 'InvalidStateError' });
});

test('parent supersession takes precedence over a numerical capture validation failure', () => {
  for (const mode of ['throw', 'invalid']) {
    let current = true;
    const input = new Proxy(ordinary(), { getOwnPropertyDescriptor(target, key) {
      if (key === 'source') {
        current = false;
        if (mode === 'throw') throw new Error('stale capture failure');
        return { configurable: true, enumerable: true, writable: true, value: new Float64Array([0]) };
      }
      return Reflect.getOwnPropertyDescriptor(target, key);
    } });
    const work = createGraphDataPreparationWork(input, () => current);
    assert.throws(() => finish(work, 1), aborted); assert.throws(() => work.step(1), { name: 'InvalidStateError' });
  }
});

test('numerical capture disposal also closes a child created after parent revocation', () => {
  let work;
  const input = new Proxy(ordinary(), { getOwnPropertyDescriptor(target, key) {
    if (key === 'source') work.dispose();
    return Reflect.getOwnPropertyDescriptor(target, key);
  } });
  work = createGraphDataPreparationWork(input);
  assert.throws(() => finish(work, 1), aborted); work.dispose();
  assert.throws(() => work.step(1), { name: 'InvalidStateError' });
});

test('cross-field failure after custom mesh adoption never publishes its owned candidate', () => {
  const mesh = triangleMesh(), before = structuredClone(mesh);
  const work = createGraphDataPreparationWork({ ...ordinary(), spatialAppearance: { nodeMeshes: [mesh, null], dangling: new Uint8Array([1]) } });
  let bytes = 0, keys = 0;
  assert.throws(() => {
    for (let calls = 0; calls < 10000; calls++) {
      const step = work.step(1); bytes += step.allocatedBytes; keys += step.reflectedKeys;
      assert.equal(step.done, false); assert.equal(step.value, undefined);
    }
    assert.fail('invalid cross-field relation did not reject');
  }, { name: 'RangeError', message: 'Dangling layout endpoints must share the source row' });
  assert.ok(bytes >= 48); assert.equal(keys, 5); assert.deepEqual(mesh, before);
  assert.throws(() => work.step(1), { name: 'InvalidStateError' });
});
