import assert from 'node:assert/strict';
import test from 'node:test';
import { acquireXrSession, releaseXrSession } from '../dist/xr/coordinator.js';
import { fixture, turns } from './xr-controller-fixture.mjs';

test('enter requests synchronously before notifications and waits for binding plus first submission', async () => {
  const f = fixture(), entered = f.controller.enter(); let settled = false;
  void entered.then(() => { settled = true; });
  assert.equal(f.trace[0], 'request'); assert.equal(f.controller.state, 'requesting');
  assert.ok(f.trace.indexOf('state:requesting') > f.trace.indexOf('request'));
  await assert.rejects(f.controller.enter(), { code: 'busy' });
  await f.grant(); f.submit(); await turns(); assert.equal(settled, false);
  f.binding.resolve(); await entered;
  assert.equal(f.controller.state, 'presenting'); assert.equal(settled, true);
  const exiting = f.controller.exit(); assert.equal(f.controller.exit(), exiting);
  await f.finish(); await exiting; assert.equal(f.controller.state, 'disposed');
  await assert.rejects(f.controller.enter(), { code: 'aborted' });
});

test('first-frame wait is cancellable while exit still waits for actual cleanup', async () => {
  const f = fixture(), entered = f.controller.enter();
  const rejection = assert.rejects(entered, { code: 'aborted' });
  await f.grant(); f.binding.resolve(); await turns();
  assert.equal(f.controller.state, 'requesting');
  const exiting = f.controller.exit(); let cleaned = false; void exiting.then(() => { cleaned = true; });
  await rejection; await turns(); assert.equal(cleaned, false); assert.equal(f.documentBusy(), true);
  f.ending.resolve(); await f.flush(); assert.equal(cleaned, false);
  f.end(); await f.flush(); assert.equal(cleaned, false, 'retirement is also awaited');
  f.retirement.resolve(); await exiting; assert.equal(f.documentBusy(), false);
});

test('busy before request leaves an unused prepared controller reusable', async () => {
  const key = {}, other = acquireXrSession(key), f = fixture({ documentKey: key });
  await assert.rejects(f.controller.enter(), { code: 'busy' });
  assert.equal(f.controller.state, 'ready'); assert.deepEqual(f.trace, []);
  releaseXrSession(other); await f.present();
  const exiting = f.controller.exit(); await f.finish(); await exiting;
});

test('unused disposal and invalid preparation never detach or retire the live inline owner', async () => {
  const unused = fixture(); await unused.controller.exit(); assert.equal(unused.controller.state, 'ready');
  unused.controller.dispose(); unused.controller.dispose(); await unused.lease.released;
  assert.equal(unused.controller.state, 'disposed'); assert.deepEqual(unused.trace, []);
  await unused.controller.exit();
  const stale = fixture({ invalid: 'unsupported-scene' });
  await assert.rejects(stale.controller.enter(), { code: 'unsupported-scene' }); await stale.lease.released;
  assert.equal(stale.controller.state, 'disposed');
  assert.equal(stale.trace.some(value => ['request', 'detach', 'retire'].includes(value)), false);
});

test('native permission rejection uses fixed reasons and still retires consumed ownership', async () => {
  for (const [name, code] of [['NotAllowedError', 'not-allowed'], ['SecurityError', 'not-allowed'],
    ['NotSupportedError', 'unavailable'], ['AbortError', 'aborted'], ['UnknownError', 'failed']]) {
    const f = fixture(), entered = f.controller.enter();
    const rejection = assert.rejects(entered, error => error.code === code && !error.message.includes('private platform detail'));
    f.request.reject(new DOMException('private platform detail', name)); await rejection;
    const exiting = f.controller.exit(); await f.flush(); f.retirement.resolve(); await exiting;
    assert.equal(f.trace.includes('bind'), false); assert.equal(f.trace.includes('end'), false);
    assert.equal(f.documentBusy(), false);
  }
});

test('throwing or reentrant state observers cannot precede the request or obstruct cleanup', async () => {
  const original = new Error('application observer failed');
  const throwing = fixture({ onStateChange(state) { if (state === 'requesting') throw original; } });
  await throwing.present(); await turns(); assert.deepEqual(throwing.applicationErrors, [original]);
  const ending = throwing.controller.exit(); await throwing.finish(); await ending;
  const reentrant = fixture({ onStateChange(state, controller) { if (state === 'requesting') controller.dispose(); } });
  const entered = reentrant.controller.enter(), rejection = assert.rejects(entered, { code: 'aborted' });
  await rejection; assert.equal(reentrant.trace[0], 'request');
  await reentrant.grant(); const exiting = reentrant.controller.exit(); await reentrant.finish(); await exiting;
  assert.equal(reentrant.trace.includes('bind'), false);
  assert.equal(reentrant.trace.filter(value => value === 'end').length, 1);
});

test('synchronous native request exceptions reject the method promise without escaping enter', async () => {
  const f = fixture({ requestError: new DOMException('private policy detail', 'SecurityError') }); let entered;
  assert.doesNotThrow(() => { entered = f.controller.enter(); });
  await assert.rejects(entered, error => error.code === 'not-allowed' && !error.message.includes('private policy detail'));
  const exiting = f.controller.exit(); await f.flush(); f.retirement.resolve(); await exiting;
  assert.equal(f.documentBusy(), false);
});
