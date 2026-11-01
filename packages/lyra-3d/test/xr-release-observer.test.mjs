import assert from 'node:assert/strict';
import test from 'node:test';
import { observeXrRelease } from '../dist/xr/release-observer.js';
import { deferred, turns } from './xr-controller-fixture.mjs';

test('release observation invokes recovery once after settlement with no service receiver', async () => {
  const released = deferred(), errors = []; let calls = 0;
  observeXrRelease(released.promise, function () { assert.equal(this, undefined); calls++; }, error => errors.push(error));
  assert.equal(calls, 0); released.resolve(); assert.equal(calls, 0);
  await turns(); assert.equal(calls, 1); assert.deepEqual(errors, []);
  released.resolve(); await turns(); assert.equal(calls, 1);
});

test('cancellation before pending release prevents recovery without changing release settlement', async () => {
  const released = deferred(), errors = []; let calls = 0, settled = false;
  void released.promise.then(() => { settled = true; });
  const remove = observeXrRelease(released.promise, () => { calls++; }, error => errors.push(error));
  remove(); await turns(); assert.equal(settled, false);
  released.resolve(); await turns();
  assert.equal(settled, true); assert.equal(calls, 0); assert.deepEqual(errors, []);
});

test('cancellation after fulfillment but before its reaction prevents recovery', async () => {
  const errors = []; let calls = 0;
  const remove = observeXrRelease(Promise.resolve(), () => { calls++; }, error => errors.push(error));
  remove(); await turns(); assert.equal(calls, 0); assert.deepEqual(errors, []);
});

test('repeated cancellation is harmless before and after release', async () => {
  const released = deferred(), errors = []; let calls = 0;
  const remove = observeXrRelease(released.promise, () => { calls++; }, error => errors.push(error));
  assert.equal(remove(), undefined); assert.equal(remove(), undefined);
  released.resolve(); await turns(); assert.equal(remove(), undefined);
  assert.equal(calls, 0); assert.deepEqual(errors, []);
});

test('reentrant removal and new observation cannot redeliver an already executing recovery', async () => {
  const released = deferred(), errors = [], trace = [];
  let remove;
  remove = observeXrRelease(released.promise, () => {
    trace.push('first'); remove(); remove();
    observeXrRelease(released.promise, () => { trace.push('second'); }, error => errors.push(error));
  }, error => errors.push(error));
  released.resolve(); await turns();
  assert.deepEqual(trace, ['first', 'second']); assert.deepEqual(errors, []);
  remove(); await turns(); assert.deepEqual(trace, ['first', 'second']);
});

test('a thrown recovery callback reports the original error once without an unhandled rejection', async () => {
  const failure = new Error('Recovery callback failed'), errors = []; let calls = 0;
  const remove = observeXrRelease(Promise.resolve(), () => { calls++; throw failure; }, function (error) {
    assert.equal(this, undefined); errors.push(error);
  });
  await turns(); assert.equal(calls, 1); assert.equal(errors.length, 1); assert.equal(errors[0], failure);
  remove(); await turns(); assert.equal(errors.length, 1);
});

test('rejected release reports the original error without invoking recovery', async () => {
  const released = deferred(), failure = new Error('Release failed'), errors = []; let calls = 0;
  const remove = observeXrRelease(released.promise, () => { calls++; }, error => errors.push(error));
  released.reject(failure); await turns();
  assert.equal(calls, 0); assert.equal(errors.length, 1); assert.equal(errors[0], failure);
  remove(); await turns(); assert.equal(errors.length, 1);
});

test('a canceled rejected release stays recovery-silent while the global reporter observes failure', async () => {
  const released = deferred(), failure = new Error('Canceled release failed'), errors = []; let calls = 0;
  const remove = observeXrRelease(released.promise, () => { calls++; }, function (error) {
    assert.equal(this, undefined); errors.push(error);
  });
  remove(); released.reject(failure); await turns();
  assert.equal(calls, 0); assert.equal(errors.length, 1); assert.equal(errors[0], failure);
  remove(); await turns(); assert.equal(errors.length, 1);
});
