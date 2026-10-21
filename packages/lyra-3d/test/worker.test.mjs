import assert from 'node:assert/strict';
import test from 'node:test';
import { serveLyra3dTask, startLyra3dTask, transferablesOf } from '../dist/core/index.js';

/** Counts to `input.steps`, emitting the running count as a fresh Float32Array every step. */
function countingKernel(input) {
  let count = 0;
  let limit = input.steps;
  return {
    step() {
      count += 1;
      const busyUntil = performance.now() + (input.stepMs ?? 0);
      while (performance.now() < busyUntil);
      return { done: count >= limit, output: new Float32Array([count, limit]) };
    },
    update(next) {
      limit = next.steps;
    },
  };
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('collects the typed-array buffers of an output for transfer', () => {
  const positions = new Float32Array(3);
  const ids = new Uint32Array(2);
  assert.deepEqual(transferablesOf(positions), [positions.buffer]);
  assert.deepEqual(transferablesOf({ positions, ids, label: 'x' }), [positions.buffer, ids.buffer]);
  assert.deepEqual(transferablesOf({ a: positions, b: positions }), [positions.buffer], 'one buffer is listed once');
  assert.deepEqual(transferablesOf('text'), []);
});

test('runs on the main thread in slices when no worker is available', async () => {
  assert.equal(typeof Worker, 'undefined', 'this runtime has no Worker global');
  const outputs = [];
  let finished;
  const done = new Promise((resolve) => (finished = resolve));
  let timerFired = false;
  const task = startLyra3dTask({
    input: { steps: 40, stepMs: 2 },
    kernel: countingKernel,
    worker: () => {
      throw new Error('never called without a Worker global');
    },
    sliceMs: 6,
    onOutput(output, isDone) {
      outputs.push([output[0], isDone]);
      if (isDone) finished();
    },
  });
  setTimeout(() => (timerFired = true), 0);
  assert.equal(task.mode, 'main-thread');
  assert.equal(outputs.length, 0, 'the first slice starts after the current task');
  await done;
  assert.ok(timerFired, 'a timer queued after start ran before the work finished');
  assert.ok(outputs.length > 1 && outputs.length < 40, `one output per slice, got ${outputs.length}`);
  assert.deepEqual(outputs.at(-1), [40, true]);
  assert.ok(outputs.every(([count], index) => index === 0 || count > outputs[index - 1][0]));
});

test('resumes a finished main-thread kernel on update and stops on request', async () => {
  const outputs = [];
  const task = startLyra3dTask({ input: { steps: 3 }, kernel: countingKernel, onOutput: (output, done) => outputs.push([output[0], done]) });
  await wait(30);
  assert.deepEqual(outputs.at(-1), [3, true]);
  task.update({ steps: 6 });
  await wait(30);
  assert.deepEqual(outputs.at(-1), [6, true]);
  task.update({ steps: 1000 });
  task.stop();
  const count = outputs.length;
  await wait(30);
  assert.equal(outputs.length, count, 'no output after stop');
});

test('terminates a worker and falls back when its initial post cannot clone input', async () => {
  const previousWorker = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  let terminated = 0;
  const outputs = [];
  let task;
  Object.defineProperty(globalThis, 'Worker', { configurable: true, value: class {} });
  try {
    const completed = new Promise((resolve, reject) => {
      task = startLyra3dTask({
        input: { steps: 3, callback: () => undefined },
        kernel: countingKernel,
        worker: () => ({
          addEventListener() {},
          postMessage() { throw new DOMException('Input cannot be cloned', 'DataCloneError'); },
          terminate() { terminated += 1; },
        }),
        onOutput(output, done) {
          outputs.push([output[0], done]);
          if (done) resolve();
        },
        onError: reject,
      });
    });
    assert.equal(task.mode, 'main-thread');
    assert.equal(terminated, 1);
    await completed;
    assert.deepEqual(outputs.at(-1), [3, true]);
  } finally {
    task?.stop();
    if (previousWorker) Object.defineProperty(globalThis, 'Worker', previousWorker);
    else delete globalThis.Worker;
  }
});

test('terminates a worker even when posting the stop message throws', () => {
  const previousWorker = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  const listeners = new Map();
  let terminated = 0;
  let stopPosts = 0;
  let task;
  Object.defineProperty(globalThis, 'Worker', { configurable: true, value: class {} });
  try {
    task = startLyra3dTask({
      input: { steps: 3 },
      kernel: countingKernel,
      worker: () => ({
        addEventListener(type, listener) { listeners.set(type, listener); },
        postMessage(message) {
          if (message.type === 'stop') {
            stopPosts += 1;
            throw new Error('Worker channel closed');
          }
        },
        terminate() { terminated += 1; },
      }),
      onOutput: () => assert.fail('a stopped task must ignore late output'),
      onError: () => assert.fail('a stopped task must ignore late errors'),
    });
    assert.equal(task.mode, 'worker');
    assert.doesNotThrow(() => task.stop());
    assert.equal(terminated, 1);
    task.stop();
    assert.equal(stopPosts, 1);
    assert.equal(terminated, 1);
    listeners.get('message')({ data: { type: 'output', output: new Float32Array([3]), done: true } });
    listeners.get('error')({ error: new Error('late failure') });
  } finally {
    task?.stop();
    if (previousWorker) Object.defineProperty(globalThis, 'Worker', previousWorker);
    else delete globalThis.Worker;
  }
});

test('reports a throwing kernel instead of looping', async () => {
  const errors = [];
  startLyra3dTask({
    input: {},
    kernel: () => ({ step() { throw new Error('diverged'); } }),
    onOutput: () => assert.fail('no output expected'),
    onError: (error) => errors.push(error.message),
  });
  await wait(20);
  assert.deepEqual(errors, ['diverged']);
});

/** A stand-in worker global: records posts and delivers messages like a worker's `self`. */
function fakeScope() {
  const listeners = [];
  const posted = [];
  return {
    posted,
    postMessage(message, transfer) {
      posted.push({ message, transfer });
    },
    addEventListener(type, listener) {
      if (type === 'message') listeners.push(listener);
    },
    send(data) {
      for (const listener of listeners) listener({ data });
    },
  };
}

test('serves a kernel from a worker scope with transfer and bounded in-flight outputs', async () => {
  const scope = fakeScope();
  serveLyra3dTask(countingKernel, scope);
  scope.send({ type: 'start', input: { steps: 50 } });
  await wait(50);
  assert.equal(scope.posted.length, 2, 'at most two outputs wait for acknowledgement');
  const first = scope.posted[0];
  assert.equal(first.message.type, 'output');
  assert.deepEqual(first.transfer, [first.message.output.buffer]);
  scope.send({ type: 'ack' });
  scope.send({ type: 'ack' });
  await wait(20);
  const last = scope.posted.at(-1).message;
  assert.equal(last.done, true);
  assert.equal(last.output[0], 50, 'the newest output is posted after the backlog clears');
  scope.send({ type: 'ack' });
  scope.send({ type: 'update', input: { steps: 55 } });
  await wait(30);
  for (let ack = 0; ack < 3; ack += 1) scope.send({ type: 'ack' });
  await wait(10);
  assert.equal(scope.posted.at(-1).message.output[0], 55, 'an update resumes a finished kernel');
  scope.send({ type: 'stop' });
});

test('reports a kernel error from a worker scope', async () => {
  const scope = fakeScope();
  serveLyra3dTask(() => ({ step() { throw new Error('bad input'); } }), scope);
  scope.send({ type: 'start', input: {} });
  await wait(10);
  assert.deepEqual(scope.posted.map(({ message }) => message), [{ type: 'error', message: 'bad input' }]);
});
