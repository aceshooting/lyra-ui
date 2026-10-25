import assert from 'node:assert/strict';
import test from 'node:test';
import * as three from 'three';
import { createGraphEngine } from '../dist/graph/engine.js';
import { createGraphLayoutKernel } from './graph-synchronous-fixture.mjs';
import { startLyra3dTask } from '../dist/core/worker.js';
import * as taskModule from './graph-synchronous-fixture.mjs';
import * as orbit from '../dist/core/orbit.js';
import * as style from '../dist/core/style.js';
import { graphData, viewportHarness } from './performance-fixture.mjs';

function input(count = 96) {
  return { ...graphData(count), pinned: new Uint8Array(count),
    options: { seed: 71, theta: 0, maxSteps: 6, cooling: 1, minAlpha: 0, stableSteps: 1000 } };
}
async function capturedTask(data) {
  const h = viewportHarness(three, orbit, style);
  let options;
  const engine = createGraphEngine({ viewport: () => h.viewport, task(value) {
    options = value; return { mode: 'main-thread', stop() {}, update() {} };
  } });
  try { engine.setData(data, 0); await engine.mount({}, h.host); } finally { engine.dispose(); }
  assert.ok(options, 'the real engine must create a layout task');
  return options;
}
function complete(kernel, limit = 2_000_000) {
  for (let calls = 1; calls <= limit; calls++) {
    const result = kernel.step();
    if (result.output !== undefined) return { ...result, calls };
    assert.equal(result.done, false, 'a partial iteration must not claim completion');
  }
  assert.fail('bounded fixture did not emit a complete iteration');
}

test('the graph engine task yields before completing one nontrivial iteration', async () => {
  const options = await capturedTask(input(2048));
  const kernel = options.kernel(options.input);
  const first = kernel.step();
  assert.equal(first.output === undefined, true, 'one task step must not execute the full graph iteration');
  assert.equal(first.done, false);
});

test('fallback cancellation runs before the first complete graph result', async () => {
  const options = await capturedTask(input(2048));
  let firstStep = true, calls = 0, outputs = 0, task, failure;
  let cancelled;
  const cancellation = new Promise(resolve => { cancelled = resolve; });
  // The queued callback is created from inside the first real numerical step, so it cannot
  // win merely because initialization was deferred until after an earlier timer.
  task = startLyra3dTask({ ...options, worker: () => { throw new Error('force fallback'); },
    sliceMs: 1,
    kernel(value) {
      const kernel = options.kernel(value);
      return { update: value => kernel.update?.(value), step() {
        calls++;
        if (firstStep) { firstStep = false; setTimeout(() => { task.stop(); cancelled(); }, 0); }
        return kernel.step();
      } };
    },
    onOutput() { outputs++; }, onError(error) { failure = error; cancelled(); },
  });
  let timeout;
  try {
    await Promise.race([cancellation, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('fallback did not yield')), 10_000); })]);
    assert.equal(failure, undefined); assert.ok(calls > 0);
    assert.equal(outputs, 0, 'a complete layout escaped before the queued cancellation');
    const stoppedCalls = calls;
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(calls, stoppedCalls, 'stopping cannot schedule more numerical work');
  } finally { clearTimeout(timeout); task.stop(); }
});

test('small progress quanta preserve every complete iteration and expose bounded phases', () => {
  // The fallback keeps this test executable on the original package: it fails on behavior,
  // not on importing an implementation module which does not exist yet.
  const factory = taskModule.createGraphIncrementalTaskKernel ?? taskModule.createGraphTaskKernel;
  const data = input(), kernel = factory({ type: 'start', data }, { operationsPerStep: 7 });
  const reference = createGraphLayoutKernel(data), phases = new Set();
  const initial = kernel.step();
  assert.equal(initial.output === undefined, true, 'the old complete-step adapter is not incremental');
  assert.ok(kernel.progress, 'the internal adapter exposes readonly phase diagnostics');
  for (let iteration = 0; iteration < 6; iteration++) {
    let actual;
    for (let calls = 0; calls < 2_000_000; calls++) {
      phases.add(kernel.progress.phase);
      const before = kernel.progress.operations;
      actual = kernel.step();
      phases.add(kernel.progress.phase);
      assert.ok(kernel.progress.operations >= before && kernel.progress.operations - before <= 7, 'a step stays within its primitive-operation budget');
      if (actual.output !== undefined) break;
      assert.equal(actual.done, false);
    }
    assert.ok(actual?.output, 'iteration completed');
    const expected = reference.step();
    const { epoch, ...output } = actual.output;
    assert.equal(epoch, 0); assert.equal(actual.done, expected.done); assert.deepEqual(output, expected.output);
  }
  for (const phase of ['initialize', 'tree', 'charge', 'springs', 'integrate', 'snapshot']) assert.ok(phases.has(phase), `observed ${phase} work`);
});

test('a pin during partial integration restarts from committed state and empty pins retain progress', () => {
  const factory = taskModule.createGraphIncrementalTaskKernel ?? taskModule.createGraphTaskKernel;
  const data = input(), kernel = factory({ type: 'start', data }, { operationsPerStep: 7 });
  const reference = createGraphLayoutKernel(data);
  const first = complete(kernel);
  assert.ok(first.calls > 1, 'the original complete-step adapter must fail before phase assertions');
  assert.deepEqual(first.output.positions, reference.step().output.positions);
  const firstCopy = first.output.positions.slice();
  for (let calls = 0; calls < 2_000_000 && kernel.progress.phase !== 'integrate'; calls++) {
    assert.equal(kernel.step().output === undefined, true, 'wait for integration of the next iteration');
  }
  assert.equal(kernel.progress.phase, 'integrate');
  kernel.step();
  const beforeInvalid = { ...kernel.progress };
  assert.throws(() => kernel.update({ type: 'pins', update: {
    indices: new Uint32Array([data.nodeCount]), positions: new Float32Array(3), pinned: new Uint8Array([1]),
  } }));
  assert.deepEqual({ ...kernel.progress }, beforeInvalid, 'invalid pins leave epoch and phase unchanged');
  const pin = { indices: new Uint32Array([0]), positions: new Float32Array([33, 44, 55]), pinned: new Uint8Array([1]) };
  reference.update(pin); kernel.update({ type: 'pins', update: pin }); pin.positions.fill(999);
  const next = complete(kernel), expected = reference.step();
  const { epoch, ...output } = next.output;
  assert.equal(epoch, 1); assert.deepEqual(output, expected.output);
  assert.deepEqual(first.output.positions, firstCopy, 'earlier output never aliases committed or partial state');
  const empty = { indices: new Uint32Array(), positions: new Float32Array(), pinned: new Uint8Array() };
  kernel.update({ type: 'pins', update: empty }); reference.update(empty);
  const afterEmpty = complete(kernel), emptyExpected = reference.step();
  assert.equal(afterEmpty.output.epoch, 2);
  assert.equal(afterEmpty.output.iteration, 2, 'empty pins do not reset convergence');
  assert.deepEqual(afterEmpty.output.positions, emptyExpected.output.positions);
  const received = structuredClone(afterEmpty.output, { transfer: [afterEmpty.output.positions.buffer] });
  assert.equal(afterEmpty.output.positions.byteLength, 0);
  assert.deepEqual(received.positions, emptyExpected.output.positions);
  assert.deepEqual(complete(kernel).output.positions, reference.step().output.positions, 'transferring a snapshot cannot detach live state');
});
