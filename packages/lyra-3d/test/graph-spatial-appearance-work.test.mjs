import assert from 'node:assert/strict';
import test from 'node:test';
import { createGraphSpatialAppearanceWork, admitGraphSpatialAppearance, graphSpatialNodeMeshData } from '../dist/graph/spatial-appearance.js';
import { triangleMesh } from './graph-node-mesh-fixtures.mjs';

function finish(work, budget = 7) {
  let allocatedBytes = 0, reflectedKeys = 0, copiedDashValues = 0;
  for (let calls = 0; calls < 2000000; calls++) {
    const step = work.step(budget);
    for (const key of ['operations', 'allocatedBytes', 'reflectedKeys', 'copiedDashValues']) assert.ok(Number.isSafeInteger(step[key]) && step[key] >= 0, key);
    assert.ok(step.operations <= budget);
    allocatedBytes += step.allocatedBytes; reflectedKeys += step.reflectedKeys; copiedDashValues += step.copiedDashValues;
    if (step.done) return { value: step.value, allocatedBytes, reflectedKeys, copiedDashValues };
    assert.equal(step.value, undefined); assert.ok(step.operations > 0);
  }
  assert.fail('spatial appearance work did not finish');
}
const defaults = { sizeUnits: 'css', dimmedOpacity: .35, labelLimit: 256, nodeShapes: undefined, nodeColors: undefined,
  expandable: undefined, edgeColors: undefined, edgeWidths: undefined, edgeCurvatures: undefined, dangling: undefined, edgeDashes: undefined };
const failure = (name, message) => ({ name, message });
const aborted = failure('AbortError', 'Graph spatial appearance admission was superseded');
const maskError = failure('RangeError', 'Invalid graph appearance mask');
const floatError = failure('RangeError', 'Invalid graph appearance values');
const curveError = failure('RangeError', 'Invalid graph curvature values');
const dashRows = failure('RangeError', 'Invalid graph dash rows');
const dashPattern = failure('RangeError', 'Invalid graph dash pattern');
const columns = ['nodeShapes', 'nodeColors', 'expandable', 'edgeColors', 'edgeWidths', 'edgeCurvatures', 'dangling'];
function fixture() {
  return { sizeUnits: 'world', dimmedOpacity: .25, labelLimit: 20,
    nodeShapes: new Uint8Array([0, 2]), nodeColors: new Float32Array([1, 0, 0, .5, 0, 1, 0, 1]), expandable: new Uint8Array([1, 0]),
    edgeColors: new Float32Array([0, 0, 1, 1, 1, 1, 0, .5]), edgeWidths: new Float32Array([0, 1000]),
    edgeCurvatures: new Float32Array([-3, .5]), dangling: new Uint8Array([0, 1]), edgeDashes: [[4, 2], []],
    nodeMeshes: [null, triangleMesh(1, [1, .25, 0, .5])] };
}

test('spatial work defaults and absent/all-null custom bodies retain ordinary metadata', () => {
  for (const [input, nodes, edges, reflectedKeys] of [[{}, 0, 0, 0], [{}, 200000, 1000000, 0], [{ nodeMeshes: [null, null] }, 2, 0, 3]]) {
    const result = finish(createGraphSpatialAppearanceWork(input, nodes, edges), 1);
    assert.deepEqual(result, { value: defaults, allocatedBytes: 0, reflectedKeys, copiedDashValues: 0 });
    assert.equal(Object.hasOwn(result.value, 'nodeMeshes'), false); assert.equal(graphSpatialNodeMeshData(result.value), undefined);
  }
  const empty = { nodeMeshes: [], edgeDashes: [] };
  for (const name of columns) empty[name] = name === 'nodeShapes' || name === 'expandable' || name === 'dangling' ? new Uint8Array() : new Float32Array();
  const result = finish(createGraphSpatialAppearanceWork(empty, 0, 0), 1);
  const expected = { ...defaults, ...empty }; delete expected.nodeMeshes;
  assert.deepEqual(result.value, expected); assert.equal(result.reflectedKeys, 1); assert.equal(result.allocatedBytes, 0);
});

test('all spatial columns, dashes and child mesh metadata transfer exact owned values and costs', () => {
  for (const budget of [1, 7, 4096]) {
    const input = fixture(), before = structuredClone(input), work = createGraphSpatialAppearanceWork(input, 2, 2);
    const result = finish(work, budget), expected = { ...before, edgeCurvatures: new Float32Array([-1, .5]) };
    assert.deepEqual(result.value, expected); assert.deepEqual(input, before);
    assert.equal(result.allocatedBytes, 134, '86 spatial typed bytes plus 48 child mesh bytes');
    assert.equal(result.reflectedKeys, 11); assert.equal(result.copiedDashValues, 2);
    const metadata = graphSpatialNodeMeshData(result.value);
    assert.equal(metadata.nodeMeshes, result.value.nodeMeshes); assert.equal(metadata.triangleCount, 1);
    assert.equal(metadata.customNodeCount, 1); assert.equal(metadata.payloadBytes, 64);
    for (const name of columns) { assert.notEqual(result.value[name].buffer, input[name].buffer); input[name].fill(0); }
    assert.notEqual(result.value.edgeDashes, input.edgeDashes); assert.notEqual(result.value.edgeDashes[0], input.edgeDashes[0]);
    assert.equal(Object.isFrozen(result.value.edgeDashes[0]), true); assert.equal(Object.isFrozen(result.value.edgeDashes[1]), true);
    input.edgeDashes[0][0] = 99; input.nodeMeshes[1].positions.fill(0); input.nodeMeshes[1].color.fill(0);
    work.dispose(); assert.deepEqual(result.value, expected); assert.equal(graphSpatialNodeMeshData(result.value), metadata);
    assert.throws(() => work.step(1), { name: 'InvalidStateError' });
  }
});

test('creation does not reflect and strict known descriptors reject getters without invoking them', () => {
  let reads = 0;
  const proxy = new Proxy({}, { getOwnPropertyDescriptor(target, key) { reads++; return Reflect.getOwnPropertyDescriptor(target, key); } });
  const pending = createGraphSpatialAppearanceWork(proxy, 0, 0); assert.equal(reads, 0); pending.dispose(); assert.equal(reads, 0);
  for (const input of [null, undefined, [], 1, 'appearance']) assert.throws(() => finish(createGraphSpatialAppearanceWork(input, 0, 0)), failure('TypeError', 'Invalid graph spatial appearance'));
  for (const [nodes, edges] of [[-1, 0], [0, -1], [.5, 0], [0, Infinity], [NaN, 0], [200001, 0], [0, 1000001]]) {
    assert.throws(() => finish(createGraphSpatialAppearanceWork({}, nodes, edges)), failure('RangeError', 'Invalid graph spatial appearance counts'));
  }
  for (const [name, message] of [['edgeCurvatures', 'Invalid graph curvature column'], ['nodeMeshes', 'Invalid graph node meshes'], ['nodeColors', 'Invalid graph spatial appearance']]) {
    const input = Object.defineProperty({}, name, { get() { reads++; throw new Error('getter'); } });
    assert.throws(() => finish(createGraphSpatialAppearanceWork(input, 0, 0)), failure('TypeError', message));
  }
  const unrelated = Object.defineProperty({}, 'unrelated', { get() { reads++; throw new Error('ignored'); } });
  assert.deepEqual(finish(createGraphSpatialAppearanceWork(unrelated, 0, 0)).value, defaults);
  assert.equal(reads, 0);
});

test('typed spatial work uses native brands and rejects unsupported or detached backing', () => {
  for (const name of columns) {
    const source = fixture()[name], Constructor = source.constructor;
    const detached = new Constructor(source.length); structuredClone(detached.buffer, { transfer: [detached.buffer] });
    const invalid = [Array.from(source), new Constructor(source.length + 1), detached, new Proxy(source, {})];
    if (typeof SharedArrayBuffer === 'function') invalid.push(new Constructor(new SharedArrayBuffer(source.byteLength)));
    const resizable = new ArrayBuffer(source.byteLength, { maxByteLength: source.byteLength * 2 });
    if (resizable.resizable) invalid.push(new Constructor(resizable));
    const error = name === 'edgeCurvatures' ? curveError : Constructor === Uint8Array ? maskError : floatError;
    for (const value of invalid) assert.throws(() => finish(createGraphSpatialAppearanceWork({ [name]: value }, 2, 2)), error);
  }
  assert.throws(() => finish(createGraphSpatialAppearanceWork({ nodeShapes: new Float32Array(2) }, 2, 0)), maskError);
  assert.throws(() => finish(createGraphSpatialAppearanceWork({ edgeCurvatures: new Float64Array(2) }, 0, 2)), curveError);
  const input = fixture(), before = structuredClone(input); let reads = 0;
  for (const name of columns) for (const key of ['length', 'buffer', 'slice', 'map', 'every', 'set', Symbol.iterator]) {
    Object.defineProperty(input[name], key, { get() { reads++; throw new Error('shadow'); } });
  }
  assert.deepEqual(finish(createGraphSpatialAppearanceWork(input, 2, 2), 1).value, { ...before, edgeCurvatures: new Float32Array([-1, .5]) });
  assert.equal(reads, 0);
});

test('shared spatial value rules retain defaults, finite ranges and semantic failure precedence', () => {
  assert.deepEqual(finish(createGraphSpatialAppearanceWork({ sizeUnits: null, dimmedOpacity: null, labelLimit: null }, 0, 0)).value, defaults);
  const cases = [
    [{ nodeShapes: new Uint8Array([3]) }, maskError], [{ expandable: new Uint8Array([2]) }, maskError], [{ dangling: new Uint8Array([2]) }, maskError],
    [{ nodeColors: new Float32Array([0, 0, 0, 2]) }, floatError], [{ edgeColors: new Float32Array([0, 0, NaN, 1]) }, floatError],
    [{ edgeWidths: new Float32Array([-1]) }, floatError], [{ edgeWidths: new Float32Array([1001]) }, floatError],
    [{ edgeCurvatures: new Float32Array([NaN]), sizeUnits: 'bad' }, curveError],
    [{ sizeUnits: 'bad', labelLimit: -1 }, failure('TypeError', 'Invalid graph size units')],
    [{ labelLimit: -1, dimmedOpacity: Infinity }, failure('RangeError', 'Invalid graph label limit')],
    [{ dimmedOpacity: 1.01 }, failure('RangeError', 'Invalid graph dimmed opacity')],
    [{ edgeDashes: [[-1]], nodeMeshes: [triangleMesh(65)] }, dashPattern],
  ];
  for (const [input, error] of cases) assert.throws(() => finish(createGraphSpatialAppearanceWork(input, 1, 1)), error);
  for (const labelLimit of [.5, 20001, NaN]) assert.throws(() => finish(createGraphSpatialAppearanceWork({ labelLimit }, 0, 0)), failure('RangeError', 'Invalid graph label limit'));
  const meshFirst = createGraphSpatialAppearanceWork({ nodeMeshes: [triangleMesh(65)], nodeShapes: new Uint8Array([3]) }, 1, 0);
  assert.throws(() => finish(meshFirst), error => error.code === 'graph-node-mesh' && error.reason === 'budget' && error.nodeIndex === 0);
});

test('strict dash rows own bounded values, ignore custom methods and refuse holes or accessors', () => {
  for (const edgeDashes of [null, 'dash', [], new Array(1)]) assert.throws(() => finish(createGraphSpatialAppearanceWork({ edgeDashes }, 0, 1)), dashRows);
  for (const dash of [null, new Uint8Array([1]), new Array(1), Array(33).fill(1), [-1], [NaN], [Infinity], ['1'], [10000001]]) {
    assert.throws(() => finish(createGraphSpatialAppearanceWork({ edgeDashes: [dash] }, 0, 1)), dashPattern);
  }
  let reads = 0;
  const outer = Object.defineProperty([[1]], '0', { get() { reads++; return [1]; } });
  assert.throws(() => finish(createGraphSpatialAppearanceWork({ edgeDashes: outer }, 0, 1)), dashRows);
  const row = Object.defineProperty([1], '0', { get() { reads++; return 1; } });
  assert.throws(() => finish(createGraphSpatialAppearanceWork({ edgeDashes: [row] }, 0, 1)), dashPattern);
  const ownedRow = Array(32).fill(10000000), rows = [ownedRow];
  rows[Symbol.iterator] = () => { reads++; throw new Error('outer iterator'); };
  for (const key of [Symbol.iterator, 'join']) ownedRow[key] = () => { reads++; throw new Error('row method'); };
  const result = finish(createGraphSpatialAppearanceWork({ edgeDashes: rows }, 0, 1), 1);
  assert.deepEqual(result.value.edgeDashes, [Array(32).fill(10000000)]); assert.equal(result.copiedDashValues, 32); assert.equal(reads, 0);
});

test('strict dash distinct-pattern accounting preserves the exact seeded boundary', () => {
  const rows = count => Array.from({ length: count }, (_, index) => [index + 10]);
  const accepted = finish(createGraphSpatialAppearanceWork({ edgeDashes: rows(65534) }, 0, 65534), 4096);
  assert.equal(accepted.value.edgeDashes.length, 65534); assert.equal(accepted.copiedDashValues, 65534);
  assert.throws(() => finish(createGraphSpatialAppearanceWork({ edgeDashes: rows(65535) }, 0, 65535), 4096), failure('RangeError', 'Too many graph dash patterns'));
  const repeated = Array.from({ length: 70000 }, (_, index) => index % 2 ? [4, 4] : []);
  const result = finish(createGraphSpatialAppearanceWork({ edgeDashes: repeated }, 0, repeated.length), 4096);
  assert.equal(result.value.edgeDashes.length, 70000); assert.equal(result.copiedDashValues, 70000);
  assert.notEqual(result.value.edgeDashes[1], result.value.edgeDashes[3]);
});

test('typed detachment and dash cancellation close partially owned spatial work', () => {
  const edgeCurvatures = new Float32Array([1, -1]), work = createGraphSpatialAppearanceWork({ edgeCurvatures }, 0, 2);
  let allocated = false;
  for (let calls = 0; calls < 10000; calls++) {
    const step = work.step(1); assert.equal(step.done, false);
    if (step.allocatedBytes > 0) { allocated = true; break; }
  }
  assert.equal(allocated, true); structuredClone(edgeCurvatures.buffer, { transfer: [edgeCurvatures.buffer] });
  assert.throws(() => finish(work, 1), curveError); assert.throws(() => work.step(1), { name: 'InvalidStateError' });
  let current = true;
  const dashed = createGraphSpatialAppearanceWork({ edgeDashes: [[1, 2, 3]] }, 0, 1, () => current);
  let copied = false;
  for (let calls = 0; calls < 10000; calls++) {
    const step = dashed.step(1); assert.equal(step.done, false);
    if (step.copiedDashValues > 0) { copied = true; break; }
  }
  assert.equal(copied, true); current = false;
  assert.throws(() => dashed.step(1), aborted); assert.throws(() => dashed.step(1), { name: 'InvalidStateError' });
});

test('child reflection cancellation and reentrant disposal preserve parent abort and close both owners', () => {
  for (const mode of ['cancel', 'dispose']) {
    let current = true, work, laterReads = 0;
    const nodeMeshes = new Proxy([triangleMesh(), triangleMesh()], { getOwnPropertyDescriptor(target, key) {
      if (key === '0') { if (mode === 'cancel') current = false; else work.dispose(); }
      if (key === '1') laterReads++;
      return Reflect.getOwnPropertyDescriptor(target, key);
    } });
    work = createGraphSpatialAppearanceWork({ nodeMeshes }, 2, 0, () => current);
    assert.throws(() => finish(work, 1), aborted); assert.equal(laterReads, 0);
    work.dispose(); assert.throws(() => work.step(1), { name: 'InvalidStateError' });
  }
});

test('late paint failure after child completion exposes no result and preserves caller geometry', () => {
  const mesh = triangleMesh(), before = structuredClone(mesh);
  const work = createGraphSpatialAppearanceWork({ nodeMeshes: [mesh], nodeShapes: new Uint8Array([3]) }, 1, 0);
  let bytes = 0, keys = 0;
  assert.throws(() => {
    for (let calls = 0; calls < 10000; calls++) {
      const step = work.step(1); bytes += step.allocatedBytes; keys += step.reflectedKeys;
      assert.equal(step.done, false); assert.equal(step.value, undefined);
    }
    assert.fail('invalid paint did not reject');
  }, maskError);
  assert.ok(bytes >= 48); assert.equal(keys, 4); assert.deepEqual(mesh, before);
  assert.throws(() => work.step(1), { name: 'InvalidStateError' });
});

test('budgets preserve pending work and reflective errors do not expose application text', () => {
  const work = createGraphSpatialAppearanceWork({}, 0, 0);
  for (const budget of [0, -1, .5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => work.step(budget), RangeError);
  assert.deepEqual(finish(work).value, defaults);
  const secret = new Error('application detail');
  const root = new Proxy({}, { getOwnPropertyDescriptor() { throw secret; } });
  assert.throws(() => finish(createGraphSpatialAppearanceWork(root, 0, 0)), failure('TypeError', 'Invalid graph spatial appearance'));
  const guarded = createGraphSpatialAppearanceWork({}, 0, 0, () => { throw secret; });
  assert.throws(() => guarded.step(1), error => error === secret); assert.throws(() => guarded.step(1), { name: 'InvalidStateError' });
});

test('legacy spatial getter order and custom dash iterator/join behavior survive shared policy extraction', () => {
  const secret = new Error('dimmed getter'); let labelReads = 0;
  const input = { sizeUnits: 'bad', get dimmedOpacity() { throw secret; }, get labelLimit() { labelReads++; return -1; } };
  assert.throws(() => admitGraphSpatialAppearance(input, 0, 0), error => error === secret); assert.equal(labelReads, 0);
  let iterations = 0, joins = 0;
  const dash = [4, 2];
  dash[Symbol.iterator] = function* () { iterations++; yield 7; yield 1; };
  dash.join = () => { joins++; return 'custom key'; };
  assert.deepEqual(admitGraphSpatialAppearance({ edgeDashes: [dash] }, 0, 1).edgeDashes, [[7, 1]]);
  assert.equal(iterations, 2); assert.equal(joins, 1);
  assert.deepEqual(finish(createGraphSpatialAppearanceWork({ edgeDashes: [dash] }, 0, 1)).value.edgeDashes, [[4, 2]]);
  assert.equal(iterations, 2); assert.equal(joins, 1);
});
