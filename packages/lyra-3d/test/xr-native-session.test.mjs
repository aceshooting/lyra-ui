import assert from 'node:assert/strict';
import test from 'node:test';
import { observeNativeXrSession } from '../dist/xr/native-session.js';

const unreleased = { name: 'InvalidStateError', message: 'The native XR session has not ended.' };

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

// Only native event/method ordering is simulated here; this is not an XR device.
class Session extends EventTarget {
  endListeners = new Set();
  endCalls = 0;
  ending = deferred();
  endError;

  addEventListener(type, listener, options) {
    if (type === 'end') this.endListeners.add(listener);
    super.addEventListener(type, listener, options);
  }

  removeEventListener(type, listener, options) {
    if (type === 'end') this.endListeners.delete(listener);
    super.removeEventListener(type, listener, options);
  }

  end() {
    assert.ok(this instanceof Session, 'native end retains its receiver');
    this.endCalls++;
    if (this.endError) throw this.endError;
    return this.ending.promise;
  }

  signalEnd() { this.dispatchEvent(new Event('end')); }
}

test('native session observation starts before the owned wrapper is exposed and replays a previous end', () => {
  const native = new Session(), record = observeNativeXrSession(native);
  assert.equal(record.native, native); assert.equal(record.ended, false);
  assert.equal(native.endListeners.size, 1);
  native.signalEnd(); assert.equal(record.ended, true);
  let calls = 0;
  const unsubscribe = record.owned.observeEnd(() => { calls++; });
  assert.equal(calls, 1, 'an already-observed end is replayed synchronously');
  native.signalEnd(); assert.equal(calls, 1, 'duplicate native delivery does not publish another end');
  unsubscribe(); unsubscribe(); record.release();
  assert.equal(record.native, null); assert.equal(record.ended, true); assert.equal(native.endListeners.size, 0);
  let lateCalls = 0;
  const unsubscribeLate = record.owned.observeEnd(() => { lateCalls++; });
  assert.equal(lateCalls, 1, 'released records retain the ended fact for synchronous replay');
  unsubscribeLate(); unsubscribeLate(); record.release(); native.signalEnd(); assert.equal(lateCalls, 1);
});

test('native end observation supports unsubscribe without detaching the native lifetime observer', () => {
  const native = new Session(), record = observeNativeXrSession(native);
  let first = 0, second = 0;
  const unsubscribe = record.owned.observeEnd(() => { first++; });
  record.owned.observeEnd(() => { second++; });
  unsubscribe(); unsubscribe(); assert.equal(native.endListeners.size, 1);
  native.signalEnd(); assert.equal(first, 0); assert.equal(second, 1); assert.equal(record.ended, true);
  record.release(); record.release(); assert.equal(record.native, null); assert.equal(native.endListeners.size, 0);
});

test('native end is invoked once with stable promise identity and fulfillment cannot authorize release', async () => {
  const native = new Session(), record = observeNativeXrSession(native);
  let notifications = 0;
  record.owned.observeEnd(() => { notifications++; });
  assert.throws(() => record.release(), unreleased);
  const ending = record.owned.end();
  assert.ok(ending instanceof Promise); assert.equal(record.owned.end(), ending); assert.equal(native.endCalls, 1);
  native.ending.resolve(); await ending;
  assert.equal(record.owned.end(), ending); assert.equal(native.endCalls, 1);
  assert.equal(record.ended, false); assert.equal(notifications, 0);
  assert.throws(() => record.release(), unreleased);
  assert.equal(record.native, native); assert.equal(native.endListeners.size, 1);
  native.signalEnd(); assert.equal(record.ended, true); assert.equal(notifications, 1);
  record.release(); assert.equal(record.native, null); assert.equal(native.endListeners.size, 0);
  assert.equal(record.owned.end(), ending); assert.equal(native.endCalls, 1);
});

test('native end rejection preserves observation and cannot retry or release native ownership', async () => {
  const native = new Session(), record = observeNativeXrSession(native), failure = new Error('native end rejected');
  const ending = record.owned.end(), rejection = assert.rejects(ending, error => error === failure);
  native.ending.reject(failure); await rejection;
  assert.equal(record.owned.end(), ending); assert.equal(native.endCalls, 1); assert.equal(record.ended, false);
  assert.throws(() => record.release(), unreleased);
  assert.equal(record.native, native); assert.equal(native.endListeners.size, 1);
  native.signalEnd(); record.release();
  assert.equal(record.native, null); assert.equal(native.endListeners.size, 0);
  await assert.rejects(ending, error => error === failure);
});

test('a synchronous native end throw becomes the same rejected promise without a second invocation', async () => {
  const native = new Session(), failure = new Error('native end threw');
  native.endError = failure;
  const record = observeNativeXrSession(native);
  let ending;
  assert.doesNotThrow(() => { ending = record.owned.end(); });
  await assert.rejects(ending, error => error === failure);
  assert.equal(record.owned.end(), ending); assert.equal(native.endCalls, 1); assert.equal(record.ended, false);
  assert.throws(() => record.release(), unreleased);
  native.signalEnd(); record.release(); assert.equal(record.native, null);
});

test('an already-observed native end requires no native end call', async () => {
  const native = new Session(), record = observeNativeXrSession(native);
  native.signalEnd();
  const ending = record.owned.end();
  await ending; assert.equal(record.owned.end(), ending); assert.equal(native.endCalls, 0);
  record.release(); assert.equal(record.native, null); assert.equal(native.endListeners.size, 0);
  assert.equal(record.ended, true); assert.equal(record.owned.end(), ending); assert.equal(native.endCalls, 0);
});
