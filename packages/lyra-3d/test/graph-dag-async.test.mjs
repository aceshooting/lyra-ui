import assert from 'node:assert/strict';
import test from 'node:test';
import { getEventListeners } from 'node:events';
import { layoutGraphDagAsync } from '../dist/graph-layout/async.js';
import { layoutGraphDag } from '../dist/graph-layout/index.js';

const empty = () => ({ nodeCount: 0, source: new Uint32Array(), target: new Uint32Array() });
const graph = (nodeCount = 3000) => ({
  nodeCount,
  source: Uint32Array.from({ length: nodeCount - 1 }, (_, i) => i),
  target: Uint32Array.from({ length: nodeCount - 1 }, (_, i) => i + 1),
});
const abortError = (error) => error instanceof DOMException && error.name === 'AbortError';
const code = (expected) => (error) => error.code === expected;

async function withTasks(run) {
  const originalSet = globalThis.setTimeout;
  const originalClear = globalThis.clearTimeout;
  const tasks = new Map();
  let nextId = 0;
  globalThis.setTimeout = (callback) => { const id = ++nextId; tasks.set(id, callback); return id; };
  globalThis.clearTimeout = (id) => { tasks.delete(id); };
  const tick = async () => {
    assert.ok(tasks.size, 'work must use a pending macrotask');
    const [id, callback] = tasks.entries().next().value;
    tasks.delete(id);
    callback();
    await Promise.resolve();
  };
  try { await run({ tasks, tick }); } finally {
    globalThis.setTimeout = originalSet;
    globalThis.clearTimeout = originalClear;
  }
}

test('async entry defers input admission and always rejects through its promise', async () => {
  await withTasks(async ({ tasks, tick }) => {
    let reads = 0;
    const input = Object.defineProperty({}, 'nodeCount', { get() { reads++; throw Error('getter'); } });
    let pending;
    assert.doesNotThrow(() => { pending = layoutGraphDagAsync(input); });
    const rejected = assert.rejects(pending, code('invalid-input'));
    assert.equal(reads, 0);
    assert.equal(tasks.size, 1);
    await tick();
    await rejected;
    assert.equal(reads, 0);
    assert.equal(tasks.size, 0);
  });
});

test('empty input emits immutable header in its own first task and complete in a later task', async () => {
  await withTasks(async ({ tasks, tick }) => {
    const reports = [];
    let settled = false;
    const pending = layoutGraphDagAsync(empty(), undefined, { onProgress: (report) => reports.push(report) });
    void pending.then(() => { settled = true; });
    assert.deepEqual(reports, []);
    await tick();
    assert.equal(settled, false);
    assert.equal(reports.length, 1);
    assert.deepEqual(reports[0], { phase: 'snapshot', operations: 0, nodeCount: 0, edgeCount: 0 });
    assert.equal(Object.isFrozen(reports[0]), true);
    while (tasks.size) await tick();
    const result = await pending;
    assert.equal(result.layerCount, 0);
    assert.equal(reports.at(-1).phase, 'complete');
    assert.equal(reports.filter((report) => report.phase === 'complete').length, 1);
  });
});

test('every slice charges at most 4096 operations, reports once, and matches synchronous results', async () => {
  await withTasks(async ({ tasks, tick }) => {
    const input = graph();
    const reports = [];
    const pending = layoutGraphDagAsync(input, undefined, { onProgress: (report) => reports.push(report) });
    let previous = 0;
    while (tasks.size) {
      const before = reports.length;
      await tick();
      assert.equal(reports.length, before + 1);
      const report = reports.at(-1);
      assert.ok(report.operations >= previous);
      assert.ok(report.operations - previous <= 4096);
      previous = report.operations;
    }
    const actual = await pending;
    const expected = layoutGraphDag(input);
    assert.deepEqual(actual.positions, expected.positions);
    assert.deepEqual(actual.ranks, expected.ranks);
    assert.ok(previous > input.source.length * 3 + input.nodeCount * 3);
    const phases = reports.map((report) => ['snapshot', 'adjacency', 'rank', 'place', 'complete'].indexOf(report.phase));
    assert.deepEqual(phases, [...phases].sort((a, b) => a - b));
  });
});

for (const phase of ['snapshot', 'adjacency', 'rank', 'place', 'complete']) {
  test(`abort from ${phase} progress stops work, callbacks and pending timers`, async () => {
    await withTasks(async ({ tasks, tick }) => {
      const controller = new AbortController();
      let count = 0;
      let reached = false;
      const input = graph(9000);
      const source = input.source.slice();
      const pending = layoutGraphDagAsync(input, undefined, {
        signal: controller.signal,
        onProgress(report) { count++; if (report.phase === phase) { reached = true; controller.abort('private reason'); } },
      });
      const rejected = assert.rejects(pending, abortError);
      while (tasks.size) await tick();
      await rejected;
      assert.equal(reached, true);
      const finalCount = count;
      await Promise.resolve();
      assert.equal(count, finalCount);
      assert.equal(tasks.size, 0);
      assert.deepEqual(input.source, source);
      assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
    });
  });
}

test('execution descriptors and native signal brand are admitted before pre-abort', async () => {
  const controller = new AbortController();
  controller.abort();
  let reads = 0;
  const accessor = Object.defineProperty({ signal: controller.signal }, 'onProgress', { get() { reads++; } });
  for (const execution of [null, [], { signal: null }, { signal: {} }, { signal: new Proxy(controller.signal, {}) }, { onProgress: 42 }, accessor]) {
    await assert.rejects(layoutGraphDagAsync(null, null, execution), code('invalid-options'));
  }
  assert.equal(reads, 0);
  await assert.rejects(layoutGraphDagAsync(null, null, { signal: controller.signal }), abortError);
  const inherited = Object.create({ signal: {}, onProgress: 42 });
  await layoutGraphDagAsync(empty(), undefined, inherited);
});

test('native signal intrinsics ignore own overridden signal members and abort reason', async () => {
  await withTasks(async ({ tasks, tick }) => {
    const controller = new AbortController();
    for (const name of ['aborted', 'addEventListener', 'removeEventListener', 'reason']) {
      Object.defineProperty(controller.signal, name, { get() { throw Error(`must not read ${name}`); } });
    }
    const pending = layoutGraphDagAsync(graph(), undefined, { signal: controller.signal });
    const rejected = assert.rejects(pending, abortError);
    await tick();
    controller.abort();
    await rejected;
    assert.equal(tasks.size, 0);
  });
});

test('progress exceptions reject unchanged and reentrant independent calls remain independent', async () => {
  const sentinel = new Error('callback sentinel');
  let callbacks = 0;
  await assert.rejects(layoutGraphDagAsync(empty(), undefined, { onProgress() { callbacks++; throw sentinel; } }), (error) => error === sentinel);
  assert.equal(callbacks, 1);
  let nested;
  const result = await layoutGraphDagAsync(empty(), undefined, { onProgress(report) {
    if (report.phase === 'snapshot') nested = layoutGraphDagAsync(empty());
  } });
  const second = await nested;
  assert.notEqual(result.positions.buffer, second.positions.buffer);
});


test('cancellation interrupts borrowed snapshot work after copying has started', async () => {
  await withTasks(async ({ tasks, tick }) => {
    const controller = new AbortController();
    let copiedProgress = false;
    const pending = layoutGraphDagAsync(graph(9000), undefined, {
      signal: controller.signal,
      onProgress(report) {
        if (report.phase === 'snapshot' && report.operations > 0) {
          copiedProgress = true;
          controller.abort();
        }
      },
    });
    const rejected = assert.rejects(pending, abortError);
    while (tasks.size) await tick();
    await rejected;
    assert.equal(copiedProgress, true);
    assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  });
});

test('normal completion and callback failure remove abort listeners', async () => {
  for (const throws of [false, true]) {
    const controller = new AbortController();
    const sentinel = new Error('stop');
    const pending = layoutGraphDagAsync(empty(), undefined, {
      signal: controller.signal,
      onProgress() { if (throws) throw sentinel; },
    });
    if (throws) await assert.rejects(pending, (error) => error === sentinel);
    else await pending;
    assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  }
});

test('full async ceilings admit low-depth data and reject header limits before copying', async () => {
  await withTasks(async ({ tasks, tick }) => {
    const source = new Uint32Array(1000000);
    const target = new Uint32Array(1000000);
    target.fill(199999);
    const pending = layoutGraphDagAsync({ nodeCount: 200000, source, target });
    while (tasks.size) await tick();
    const result = await pending;
    assert.equal(result.positions.length, 600000);
    assert.equal(result.ranks.length, 200000);
    assert.equal(result.ranks[0], 0);
    assert.equal(result.ranks[199998], 0);
    assert.equal(result.ranks[199999], 1);
    assert.equal(result.layerCount, 2);
    for (const input of [
      { nodeCount: 200001, source: new Uint32Array(), target: new Uint32Array() },
      { nodeCount: 200000, source: new Uint32Array(1000001), target: new Uint32Array(1000001) },
    ]) {
      const reports = [];
      const invalid = layoutGraphDagAsync(input, undefined, { onProgress: (report) => reports.push(report) });
      const rejected = assert.rejects(invalid, code('limit-exceeded'));
      await tick();
      await rejected;
      assert.equal(tasks.size, 0);
      assert.deepEqual(reports, []);
    }
  });
});

test('soft deadline is checked within each 256 charged operations', async () => {
  const originalPerformance = Object.getOwnPropertyDescriptor(globalThis, 'performance');
  let time = 0;
  Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => { time += 5; return time; } } });
  try {
    await withTasks(async ({ tasks, tick }) => {
      const reports = [];
      const pending = layoutGraphDagAsync(graph(), undefined, { onProgress: (report) => reports.push(report) });
      let previous = 0;
      while (tasks.size) {
        await tick();
        const operations = reports.at(-1).operations;
        assert.ok(operations - previous <= 256, 'expired deadline must yield within 256 operations');
        previous = operations;
      }
      await pending;
      assert.ok(previous > 1000);
    });
  } finally {
    if (originalPerformance) Object.defineProperty(globalThis, 'performance', originalPerformance);
    else delete globalThis.performance;
  }
});

test('endpoint validation happens in budgeted snapshot tasks after the header', async () => {
  await withTasks(async ({ tasks, tick }) => {
    const input = graph(9000);
    const pending = layoutGraphDagAsync(input);
    const rejected = assert.rejects(pending, code('invalid-input'));
    await tick();
    // Deliberately violate the borrowed-array contract to exercise observed-value safety.
    input.target[input.target.length - 1] = input.nodeCount;
    while (tasks.size) await tick();
    await rejected;
    assert.equal(tasks.size, 0);
  });
});

test('options are captured once before the first scheduled task', async () => {
  await withTasks(async ({ tasks, tick }) => {
    const input = graph(3);
    const options = { direction: 'x', layerGap: 10, nodeGap: 7 };
    const pending = layoutGraphDagAsync(input, options);
    options.direction = '-z';
    options.layerGap = 200;
    options.nodeGap = 100;
    while (tasks.size) await tick();
    const actual = await pending;
    const expected = layoutGraphDag(input, { direction: 'x', layerGap: 10, nodeGap: 7 });
    assert.deepEqual(actual.positions, expected.positions);
  });
});
