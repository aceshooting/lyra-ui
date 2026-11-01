import assert from 'node:assert/strict';
import test from 'node:test';
import { createGraphSceneFactsWork } from '../dist/graph/scene-facts-work.js';
import { createGraphDataPreparationWork } from '../dist/graph/data-preparation.js';
import { createGraphEngine } from '../dist/graph/engine.js';
import { fitOrbitCamera } from '../dist/core/orbit.js';
import { triangleMesh } from './graph-node-mesh-fixtures.mjs';
import { installFakeBrowser } from './fake-browser.mjs';

const aborted = { name: 'AbortError', message: 'Graph scene preparation was superseded' };
const empty = () => ({ nodeCount: 0, source: new Uint32Array(), target: new Uint32Array() });
function owned(input) {
  const work = createGraphDataPreparationWork(input);
  for (let calls = 0; calls < 100000; calls++) {
    const step = work.step(4096);
    if (step.done) return step.value.data;
  }
  assert.fail('data preparation did not finish');
}
function finish(work, budget = 7) {
  const totals = { operations: 0, visitedNodes: 0, visitedEdges: 0 };
  for (let calls = 0; calls < 2000000; calls++) {
    const step = work.step(budget);
    for (const key of Object.keys(totals)) {
      assert.ok(Number.isSafeInteger(step[key]) && step[key] >= 0, key);
      totals[key] += step[key];
    }
    assert.ok(step.operations <= budget);
    if (step.done) { assert.ok(step.value); return { value: step.value, ...totals }; }
    assert.ok(step.operations > 0); assert.equal(step.value, undefined);
  }
  assert.fail('scene facts did not finish');
}
function facts(input, pointSize = 6, budget = 7) {
  return finish(createGraphSceneFactsWork(owned(input), pointSize), budget);
}
const twoNodes = () => ({ nodeCount: 2, source: new Uint32Array([0]), target: new Uint32Array([1]), positions: new Float32Array([0, 0, 0, 4, 0, 0]) });

test('scene facts defer input reads and guard invocation until stepping', () => {
  let reads = 0, guards = 0;
  const input = new Proxy(owned(empty()), { get(target, key, receiver) { reads++; return Reflect.get(target, key, receiver); } });
  const pending = createGraphSceneFactsWork(input, 6, () => { guards++; return true; });
  assert.equal(reads, 0); assert.equal(guards, 0);
  pending.dispose(); pending.dispose(); assert.equal(reads, 0); assert.equal(guards, 0);
  assert.throws(() => pending.step(1), { name: 'InvalidStateError' });
});

test('empty and ordinary facts omit spatial fields and count only required work', () => {
  for (const budget of [1, 7, 4096]) {
    const zero = facts(empty(), 6, budget);
    assert.deepEqual(zero, { value: { bounds: null, preserveDerivedBounds: false }, operations: 3, visitedNodes: 0, visitedEdges: 0 });
    const input = { ...twoNodes(), directed: new Uint8Array([1]), sizes: new Float32Array([100, 200]) };
    const result = facts(input, 1024, budget);
    assert.deepEqual(result.value, { bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 4, y: 0, z: 0 } }, preserveDerivedBounds: false });
    assert.equal(result.operations, 5); assert.equal(result.visitedNodes, 2); assert.equal(result.visitedEdges, 0);
    assert.deepEqual(Object.keys(result.value).sort(), ['bounds', 'preserveDerivedBounds']);
  }
});

test('world diameters use supplied sizes or the prospective resolved point size', () => {
  for (const budget of [1, 7, 4096]) {
    for (const pointSize of [0, 6, 1024]) {
      const input = { ...twoNodes(), spatialAppearance: { sizeUnits: 'world' } };
      const radius = pointSize / 2, result = facts(input, pointSize, budget);
      assert.deepEqual(result.value.bounds, { min: { x: radius ? -radius : 0, y: radius ? -radius : 0, z: radius ? -radius : 0 }, max: { x: 4 + radius, y: radius, z: radius } });
      assert.equal(result.value.spatialEdgePrimitiveCount, 1); assert.equal(result.operations, 6);
    }
    const supplied = facts({ ...twoNodes(), sizes: new Float32Array([0, 8]), spatialAppearance: { sizeUnits: 'world' } }, 1024, budget);
    assert.deepEqual(supplied.value.bounds, { min: { x: 0, y: -4, z: -4 }, max: { x: 8, y: 4, z: 4 } });
    const css = facts({ ...twoNodes(), sizes: new Float32Array([0, 8]), spatialAppearance: { sizeUnits: 'css' } }, 1024, budget);
    assert.deepEqual(css.value.bounds, { min: { x: 0, y: 0, z: 0 }, max: { x: 4, y: 0, z: 0 } });
  }
});

test('negative-zero radius is canonicalized while coordinate extrema retain legacy signs', () => {
  for (const sizes of [undefined, new Float32Array([-0])]) for (const budget of [1, 7, 4096]) {
    const input = { nodeCount: 1, source: new Uint32Array(), target: new Uint32Array(), positions: new Float32Array([-0, 0, -0]),
      ...(sizes ? { sizes } : {}), spatialAppearance: { sizeUnits: 'world' } };
    const { bounds } = facts(input, -0, budget).value;
    assert.ok(Object.is(bounds.min.x, -0)); assert.ok(Object.is(bounds.max.x, 0));
    assert.ok(Object.is(bounds.min.y, 0)); assert.ok(Object.is(bounds.max.y, 0));
    assert.ok(Object.is(bounds.min.z, -0)); assert.ok(Object.is(bounds.max.z, 0));
  }
});

test('analytic curve bounds and derived policy preserve both curvature signs', () => {
  for (const curvature of [-0.5, 0.5]) for (const budget of [1, 7, 4096]) {
    const result = facts({ ...twoNodes(), spatialAppearance: { edgeCurvatures: new Float32Array([curvature]) } }, 6, budget);
    assert.deepEqual(result.value.bounds, { min: { x: 0, y: 0, z: curvature < 0 ? -2 : 0 }, max: { x: 4, y: 0, z: curvature > 0 ? 2 : 0 } });
    assert.equal(result.value.preserveDerivedBounds, true); assert.equal(result.value.spatialEdgePrimitiveCount, 16);
    assert.equal(result.operations, 6);
  }
  const samePoint = facts({ ...twoNodes(), positions: new Float32Array(6), spatialAppearance: { edgeCurvatures: new Float32Array([0.5]) } });
  assert.equal(samePoint.value.preserveDerivedBounds, true);
  assert.deepEqual(samePoint.value.bounds, { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } });
});

test('loop dangling straight curved and directed primitives retain allocation policy', () => {
  const input = { nodeCount: 2, positions: new Float32Array([0, 0, 0, 4, 0, 0]),
    source: new Uint32Array([0, 0, 0, 0]), target: new Uint32Array([1, 0, 0, 1]), directed: new Uint8Array([0, 1, 1, 1]),
    spatialAppearance: { dangling: new Uint8Array([0, 0, 1, 0]), edgeCurvatures: new Float32Array([0, 0.5, 0.5, 0.5]), edgeWidths: new Float32Array(4) } };
  for (const budget of [1, 7, 4096]) {
    const result = facts(input, 6, budget);
    assert.equal(result.value.spatialEdgePrimitiveCount, 37);
    assert.equal(result.visitedNodes, 2); assert.equal(result.visitedEdges, 4); assert.equal(result.operations, 9);
    assert.deepEqual(result.value.bounds, { min: { x: 0, y: 0, z: 0 }, max: { x: 4, y: 0, z: 2 } });
  }
  const onlyExcluded = facts({ nodeCount: 1, positions: new Float32Array([2, 3, 4]), source: new Uint32Array([0, 0]), target: new Uint32Array([0, 0]),
    spatialAppearance: { dangling: new Uint8Array([0, 1]), edgeCurvatures: new Float32Array([1, 1]) } });
  assert.equal(onlyExcluded.value.preserveDerivedBounds, false); assert.equal(onlyExcluded.value.spatialEdgePrimitiveCount, 17);
  assert.deepEqual(onlyExcluded.value.bounds, { min: { x: 2, y: 3, z: 4 }, max: { x: 2, y: 3, z: 4 } });
});

test('admitted custom metadata supplies exact preflight without expanding fit to triangle extents', () => {
  const input = { nodeCount: 1, source: new Uint32Array(), target: new Uint32Array(), positions: new Float32Array([1, 2, 3]),
    spatialAppearance: { nodeMeshes: [triangleMesh()] } };
  for (const budget of [1, 7, 4096]) {
    const result = facts(input, 6, budget);
    assert.deepEqual(result.value.customStorage, { payloadBytes: 64, cpuBytes: 361, gpuBytes: 160, accountedBytes: 521, primitiveCount: 2 });
    assert.ok(Object.isFrozen(result.value.customStorage));
    assert.deepEqual(result.value.bounds, { min: { x: 1, y: 2, z: 3 }, max: { x: 1, y: 2, z: 3 } });
    assert.equal(result.operations, 4);
  }
  const without = facts({ ...input, spatialAppearance: { nodeMeshes: [null] } });
  assert.equal(Object.hasOwn(without.value, 'customStorage'), false);
});

test('edge primitive ceiling is inclusive and rejects the first excess before scene construction', () => {
  const input = count => ({ nodeCount: 1, source: new Uint32Array(count), target: new Uint32Array(count), positions: new Float32Array(3), spatialAppearance: {} });
  const exact = owned(input(125000));
  const result = finish(createGraphSceneFactsWork(exact, 6), 4096);
  assert.equal(result.value.spatialEdgePrimitiveCount, 2000000); assert.equal(result.visitedEdges, 125000); assert.equal(result.operations, 125004);
  const directed = new Uint8Array(125000); directed[124999] = 1;
  const excess = createGraphSceneFactsWork(owned({ ...input(125000), directed }), 6);
  assert.throws(() => finish(excess, 4096), { name: 'RangeError', message: 'Graph spatial geometry exceeds its primitive limit' });
  assert.throws(() => excess.step(1), { name: 'InvalidStateError' });
});

test('custom mixed primitive preflight rejects even when edge-only ceiling passes', () => {
  const count = 124999 + 14, curvatures = new Float32Array(count); curvatures.fill(1, 0, 124999);
  const data = owned({ nodeCount: 2, source: new Uint32Array(count), target: new Uint32Array(count).fill(1), positions: new Float32Array(6),
    spatialAppearance: { edgeCurvatures: curvatures, nodeMeshes: [triangleMesh(), null] } });
  const work = createGraphSceneFactsWork(data, 6);
  let operations = 0, visits = 0;
  while (operations < 1 + 2 + count) {
    const step = work.step(Math.min(4096, 1 + 2 + count - operations));
    assert.equal(step.done, false); assert.equal(step.value, undefined); operations += step.operations; visits += step.visitedEdges;
  }
  assert.equal(visits, count);
  assert.throws(() => work.step(1), { name: 'RangeError', message: 'Graph node mesh storage budget exceeded', reason: 'budget' });
  assert.throws(() => work.step(1), { name: 'InvalidStateError' });
});

test('point size validation is deferred and closes only after an accepted step budget', () => {
  for (const invalid of [-1, 1025, Infinity, NaN, '6', undefined]) {
    const work = createGraphSceneFactsWork(owned(empty()), invalid);
    assert.throws(() => work.step(0), { name: 'RangeError' });
    assert.throws(() => work.step(1), { name: 'RangeError', message: 'Invalid graph scene point size' });
    assert.throws(() => work.step(1), { name: 'InvalidStateError' });
  }
});

test('bad budgets preserve pending progress and successful transfer occurs only once', () => {
  const data = owned(twoNodes()), before = structuredClone(data), work = createGraphSceneFactsWork(data, 6);
  assert.equal(work.step(1).done, false);
  for (const budget of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => work.step(budget), { name: 'RangeError' });
  const result = finish(work, 1); assert.equal(result.operations, 4); assert.deepEqual(data, before);
  const saved = structuredClone(result.value);
  assert.throws(() => work.step(1), { name: 'InvalidStateError' });
  work.dispose(); work.dispose(); data.positions.fill(100);
  assert.deepEqual(result.value, saved);
  assert.deepEqual(Object.keys(result.value).sort(), ['bounds', 'preserveDerivedBounds']);
});

test('cancellation before every fixed phase prevents output and permanently closes work', () => {
  const data = owned({ ...twoNodes(), spatialAppearance: { edgeCurvatures: new Float32Array([0.5]) } });
  for (const completedOperations of [0, 1, 2, 3, 4, 5]) {
    let current = true;
    const work = createGraphSceneFactsWork(data, 6, () => current);
    for (let index = 0; index < completedOperations; index++) {
      const step = work.step(1); assert.equal(step.done, false); assert.equal(step.value, undefined);
    }
    current = false;
    assert.throws(() => work.step(1), aborted); assert.throws(() => work.step(1), { name: 'InvalidStateError' }); work.dispose();
  }
});

test('guard exceptions keep identity and reentrant disposal cannot publish', () => {
  const first = new Error('first guard failure'), second = new Error('second guard failure'); let calls = 0;
  const throwing = createGraphSceneFactsWork(owned(empty()), 6, () => { throw ++calls === 1 ? first : second; });
  assert.throws(() => throwing.step(1), error => error === first); assert.equal(calls, 1);
  assert.throws(() => throwing.step(1), { name: 'InvalidStateError' });
  let work;
  work = createGraphSceneFactsWork(owned(empty()), 6, () => { work.dispose(); return true; });
  assert.throws(() => work.step(1), aborted); assert.throws(() => work.step(1), { name: 'InvalidStateError' });
});

test('caught nested stepping preserves outer progress and uncaught nesting closes it', () => {
  let work, nested = 0;
  work = createGraphSceneFactsWork(owned(empty()), 6, () => {
    assert.throws(() => work.step(0), { name: 'InvalidStateError' }); nested++; return true;
  });
  assert.equal(finish(work, 1).operations, 3); assert.ok(nested > 0);
  let escaping, caught;
  escaping = createGraphSceneFactsWork(owned(empty()), 6, () => {
    try { escaping.step(1); } catch (error) { caught = error; throw error; }
    return true;
  });
  assert.throws(() => escaping.step(1), error => error === caught && error.name === 'InvalidStateError');
  assert.throws(() => escaping.step(1), { name: 'InvalidStateError' });
});

test('prepared bounds reproduce untouched engine fit with prospective style and derived world extents', async t => {
  const browser = installFakeBrowser(); t.after(() => browser.restore());
  const cases = [
    { input: { ...twoNodes(), spatialAppearance: { sizeUnits: 'world' } }, pointSize: 1024 },
    { input: { ...twoNodes(), positions: new Float32Array([10000000, 0, 0, 9999998, 0, 0]), sizes: new Float32Array([20000000, 20000000]),
      spatialAppearance: { sizeUnits: 'world', edgeCurvatures: new Float32Array([0.5]) } }, pointSize: 6 },
    { input: { ...twoNodes(), positions: new Float32Array([-10000000, 0, 0, 10000000, 0, 0]), spatialAppearance: { edgeCurvatures: new Float32Array([1]) } }, pointSize: 6 },
  ];
  for (const { input, pointSize } of cases) {
    const engine = createGraphEngine({ task() { return { mode: 'main-thread', stop() {}, update() {} }; } });
    try {
      engine.setData(input, 1); await engine.mount(browser.container, { hover() {}, pick() {}, camera() {}, lost() {} });
      engine.setStyle({ pointSize }); engine.resize(320, 240);
      const result = facts(input, pointSize).value;
      const expected = fitOrbitCamera(result.bounds, { width: 320, height: 240 }, 24, undefined, { preserveDerivedBounds: result.preserveDerivedBounds });
      assert.deepEqual(engine.fit(), expected);
      if (result.preserveDerivedBounds && input.sizes) {
        assert.notDeepEqual(expected, fitOrbitCamera(result.bounds, { width: 320, height: 240 }), 'curve flag retains the derived world-radius bounds');
      }
    } finally { engine.dispose(); }
  }
});
