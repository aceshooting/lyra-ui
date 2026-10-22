import assert from 'node:assert/strict';
import test from 'node:test';
import { serveLyra3dTask, startLyra3dTask } from '../dist/core/index.js';
import { settle, waitUntil } from './wait-until.mjs';

/** Counts to `input.steps`, emitting the running count as a fresh Float32Array every step. */
function countingKernel(input) {
  let count = 0;
  let limit = input.steps;
  return {
    step() {
      count += 1;
      return { done: count >= limit, output: new Float32Array([count, limit]) };
    },
    update(next) {
      limit = next.steps;
    },
  };
}

/** A Worker constructor in the global scope for one test, plus the stand-in worker it will hand out. */
function withWorkerGlobal(t) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  Object.defineProperty(globalThis, 'Worker', { configurable: true, value: class {} });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'Worker', previous);
    else delete globalThis.Worker;
  });
}

function fakeWorker() {
  const listeners = new Map();
  const worker = {
    posted: [],
    terminated: 0,
    addEventListener: (type, listener) => listeners.set(type, listener),
    postMessage: (message) => worker.posted.push(message),
    terminate: () => { worker.terminated += 1; },
    /** Delivers an event to the listener the task registered; returns the event for inspection. */
    emit(type, fields = {}) {
      const event = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...fields };
      listeners.get(type)(event);
      return event;
    },
  };
  return worker;
}

test('a worker task acknowledges each output, passes it on and reports kernel errors', (t) => {
  withWorkerGlobal(t);
  const worker = fakeWorker();
  const outputs = [];
  const errors = [];
  const input = { steps: 3 };
  const task = startLyra3dTask({
    input, kernel: countingKernel, worker: () => worker,
    onOutput: (output, done) => outputs.push([[...output], done]),
    onError: (error) => errors.push(error.message),
  });
  t.after(() => task.stop());
  assert.equal(task.mode, 'worker');
  assert.deepEqual(worker.posted, [{ type: 'start', input }]);
  const first = new Float32Array([1, 3]);
  worker.emit('message', { data: { type: 'output', output: first, done: false } });
  worker.emit('message', { data: { type: 'output', output: new Float32Array([3, 3]), done: true } });
  worker.emit('message', { data: { type: 'error', message: 'kernel diverged' } });
  assert.deepEqual(outputs, [[[1, 3], false], [[3, 3], true]]);
  assert.deepEqual(worker.posted.filter((message) => message.type === 'ack').length, 2, 'every output is acknowledged');
  assert.deepEqual(errors, ['kernel diverged']);
  assert.equal(task.mode, 'worker');
});

test('updates reach a worker that has been heard and are never replayed after it', (t) => {
  withWorkerGlobal(t);
  const worker = fakeWorker();
  const task = startLyra3dTask({ input: { steps: 3 }, kernel: countingKernel, worker: () => worker, onOutput() {} });
  t.after(() => task.stop());
  task.update({ steps: 9 });
  assert.deepEqual(worker.posted.at(-1), { type: 'update', input: { steps: 9 } });
  worker.emit('message', { data: { type: 'output', output: new Float32Array(2), done: false } });
  task.update({ steps: 12 });
  assert.deepEqual(worker.posted.at(-1), { type: 'update', input: { steps: 12 } });
});

test('a worker failing before its first message hands the whole computation, updates included, to the main thread', async (t) => {
  withWorkerGlobal(t);
  const worker = fakeWorker();
  const outputs = [];
  const errors = [];
  const task = startLyra3dTask({
    input: { steps: 2 }, kernel: countingKernel, worker: () => worker,
    onOutput: (output, done) => outputs.push([output[0], done]),
    onError: (error) => errors.push(error),
  });
  t.after(() => task.stop());
  task.update({ steps: 5 });
  const event = worker.emit('error', { message: 'blocked by policy' });
  assert.equal(event.defaultPrevented, true, 'the page does not see an error the task recovered from');
  assert.equal(task.mode, 'main-thread');
  assert.equal(worker.terminated, 1);
  await waitUntil(() => outputs.at(-1)?.[1] === true, 'the main-thread computation to finish');
  assert.deepEqual(outputs.at(-1), [5, true], 'the update made before the failure still applies');
  assert.deepEqual(errors, []);
  // Late events from the discarded worker are ignored.
  worker.emit('message', { data: { type: 'error', message: 'late' } });
  worker.emit('messageerror');
  assert.deepEqual(errors, []);
});

test('after the first message a worker error is reported, not recovered', (t) => {
  withWorkerGlobal(t);
  const worker = fakeWorker();
  const errors = [];
  const task = startLyra3dTask({
    input: { steps: 3 }, kernel: countingKernel, worker: () => worker, onOutput() {},
    onError: (error) => errors.push(error),
  });
  t.after(() => task.stop());
  worker.emit('message', { data: { type: 'output', output: new Float32Array(2), done: false } });
  const cause = new Error('worker crashed');
  worker.emit('error', { error: cause });
  worker.emit('error', { message: 'script error' });
  worker.emit('error', {});
  worker.emit('messageerror');
  assert.equal(errors[0], cause);
  assert.equal(errors[1].message, 'script error');
  assert.equal(errors[2].message, 'Worker error');
  assert.equal(errors[3].message, 'Worker message could not be deserialized');
  assert.equal(task.mode, 'worker');
  assert.equal(worker.terminated, 0);
});

test('a worker that cannot even be constructed runs the kernel on the main thread', async (t) => {
  withWorkerGlobal(t);
  const outputs = [];
  const task = startLyra3dTask({
    input: { steps: 2 }, kernel: countingKernel,
    worker: () => { throw new Error('blocked by Content-Security-Policy'); },
    onOutput: (output, done) => outputs.push([output[0], done]),
  });
  t.after(() => task.stop());
  assert.equal(task.mode, 'main-thread');
  await waitUntil(() => outputs.at(-1)?.[1] === true, 'the main-thread computation to finish');
  assert.deepEqual(outputs.at(-1), [2, true]);
});

test('a kernel factory that throws is reported once and leaves an inert task', () => {
  const errors = [];
  const task = startLyra3dTask({
    input: {}, kernel: () => { throw new Error('bad input'); },
    onOutput: () => assert.fail('no output expected'),
    onError: (error) => errors.push(error.message),
  });
  assert.deepEqual(errors, ['bad input']);
  assert.doesNotThrow(() => { task.update({}); task.stop(); task.stop(); });
});

test('a kernel that finishes without a final output marks the last output as done', async () => {
  const outputs = [];
  let step = 0;
  const task = startLyra3dTask({
    input: {},
    kernel: () => ({ step: () => (++step === 1 ? { done: false, output: new Float32Array([1]) } : { done: true }) }),
    sliceMs: 50,
    onOutput: (output, done) => outputs.push([output[0], done]),
  });
  await waitUntil(() => outputs.length > 0, 'the output');
  task.stop();
  assert.deepEqual(outputs, [[1, true]]);
});

test('a worker-side kernel that finishes without a final output flags the still-pending output as done', async () => {
  const posted = [];
  const listeners = [];
  const scope = { postMessage: (message) => posted.push(message), addEventListener: (_type, listener) => listeners.push(listener) };
  let step = 0;
  serveLyra3dTask(() => ({
    step: () => (++step <= 3 ? { done: false, output: new Float32Array([step]) } : { done: true }),
  }), scope);
  listeners[0]({ data: { type: 'start', input: {} } });
  await waitUntil(() => step === 4, 'the kernel to finish');
  // Two outputs are in flight, so the third waits for an acknowledgement while the kernel finishes.
  assert.deepEqual(posted.map((message) => [message.output[0], message.done]), [[1, false], [2, false]]);
  listeners[0]({ data: { type: 'ack' } });
  assert.deepEqual(posted.map((message) => [message.output[0], message.done]).at(-1), [3, true]);
  listeners[0]({ data: { type: 'stop' } });
});

test('worker-side messages for a task that never started are ignored', async () => {
  const posted = [];
  const listeners = [];
  const scope = { postMessage: (message) => posted.push(message), addEventListener: (_type, listener) => listeners.push(listener) };
  serveLyra3dTask(countingKernel, scope);
  listeners[0]({ data: { type: 'update', input: { steps: 3 } } });
  listeners[0]({ data: { type: 'ack' } });
  listeners[0]({ data: { type: 'stop' } });
  await settle();
  assert.deepEqual(posted, []);
});
