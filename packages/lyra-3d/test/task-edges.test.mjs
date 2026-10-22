import assert from 'node:assert/strict';
import test from 'node:test';
import { serveLyra3dTask, startLyra3dTask } from '../dist/core/index.js';
import { settle, waitUntil } from './wait-until.mjs';

test('a worker-side kernel that throws a non-Error reports its text', async () => {
  const posted = [];
  const listeners = [];
  serveLyra3dTask(() => ({ step() { throw 'plain failure'; } }), {
    postMessage: (message) => posted.push(message),
    addEventListener: (_type, listener) => listeners.push(listener),
  });
  listeners[0]({ data: { type: 'start', input: {} } });
  await waitUntil(() => posted.length > 0, 'the error report');
  assert.deepEqual(posted, [{ type: 'error', message: 'plain failure' }]);
});

test('stopping from inside an output callback ends the main-thread task without another slice', async () => {
  let steps = 0;
  let task;
  const outputs = [];
  task = startLyra3dTask({
    input: {},
    kernel: () => ({ step: () => ({ done: false, output: new Float32Array([++steps]) }) }),
    sliceMs: 1,
    onOutput(output) { outputs.push(output[0]); task.stop(); },
  });
  await waitUntil(() => outputs.length === 1, 'the first output');
  const seen = steps;
  await settle();
  assert.equal(outputs.length, 1);
  assert.equal(steps, seen, 'no step runs after stop');
  assert.doesNotThrow(() => task.update({}));
});
