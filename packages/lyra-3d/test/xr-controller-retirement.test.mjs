import assert from 'node:assert/strict';
import test from 'node:test';
import { fixture, turns } from './xr-controller-fixture.mjs';

test('dispose during a prompt cancels enter but keeps one shared exit and exactly one late-session end', async () => {
  const f = fixture(), entered = f.controller.enter(), rejected = assert.rejects(entered, { code: 'aborted' });
  const notificationCount = f.trace.filter(value => value.startsWith('state:')).length;
  f.controller.dispose();
  assert.equal(f.trace.filter(value => value.startsWith('state:')).length, notificationCount);
  await rejected;
  const exiting = f.controller.exit(); let settled = false; void exiting.then(() => { settled = true; });
  assert.equal(f.controller.exit(), exiting); await turns(); assert.equal(settled, false); assert.equal(f.documentBusy(), true);
  await f.grant(); assert.equal(f.trace.includes('bind'), false); assert.equal(f.trace.filter(value => value === 'end').length, 1);
  f.ending.resolve(); await f.flush(); assert.equal(settled, false);
  f.end(); await f.flush(); assert.equal(settled, false);
  f.retirement.resolve(); await exiting;
  assert.equal(f.trace.filter(value => value.startsWith('state:')).length, notificationCount);
  assert.equal(f.listeners, 0); assert.equal(f.documentBusy(), false);
});

test('race-safe end replay prevents binding an already-ended grant', async () => {
  const f = fixture(), entered = f.controller.enter(), rejected = assert.rejects(entered, { code: 'aborted' });
  f.end(); await f.grant(); await rejected;
  assert.equal(f.trace.includes('bind'), false); assert.equal(f.trace.includes('end'), false);
  const exiting = f.controller.exit(); await f.flush(); f.retirement.resolve(); await exiting;
  assert.equal(f.documentBusy(), false); assert.equal(f.listeners, 0);
});

test('native end during binding quarantines late setup and stale submission/failure facts', async () => {
  const f = fixture(), entered = f.controller.enter(), rejected = assert.rejects(entered, { code: 'aborted' });
  await f.grant(); f.end(); await rejected;
  const exiting = f.controller.exit(); await f.flush();
  assert.equal(f.trace.includes('retire'), false, 'pending native binding still owns renderer');
  f.submit(); f.lateFailure('context-lost'); await turns();
  assert.equal(f.trace.includes('state:presenting'), false);
  f.binding.resolve(); await f.flush(); assert.equal(f.trace.filter(value => value === 'retire').length, 1);
  f.retirement.resolve(); await exiting;
  assert.equal(f.controller.state, 'disposed'); assert.equal(f.failureUnsubscriptions, 1);
});

test('failed native end rejects exit without releasing quarantine or retrying end', async () => {
  const f = fixture(); await f.present();
  const exiting = f.controller.exit(), rejection = assert.rejects(exiting, { code: 'failed' });
  f.ending.reject(new Error('private end failure')); await rejection; await f.flush();
  assert.equal(f.controller.state, 'ending'); assert.equal(f.documentBusy(), true);
  assert.equal(f.controller.exit(), exiting); assert.equal(f.trace.filter(value => value === 'end').length, 1);
  f.end(); await f.flush(); f.retirement.resolve(); await f.flush();
  assert.equal(f.controller.state, 'disposed'); assert.equal(f.documentBusy(), false);
  await assert.rejects(f.controller.exit(), { code: 'failed' });
});

test('a post-binding rendering failure rejects pending enter and retires the actual owned session', async () => {
  for (const reason of ['failed', 'context-lost']) {
    const f = fixture(), entered = f.controller.enter(), rejection = assert.rejects(entered, { code: reason });
    await f.grant(); f.binding.resolve(); await turns(); f.fail(reason); await rejection;
    assert.equal(f.controller.state, 'ending'); assert.equal(f.trace.filter(value => value === 'end').length, 1);
    const exiting = f.controller.exit(); await f.finish(); await exiting;
    assert.equal(f.failureUnsubscriptions, 1);
  }
});

test('binding rejection requests end once and cannot retire before the end event', async () => {
  const f = fixture(), entered = f.controller.enter(), rejected = assert.rejects(entered, { code: 'failed' });
  await f.grant(); f.binding.reject(new Error('private binding detail')); await rejected;
  const exiting = f.controller.exit(); await f.flush();
  assert.equal(f.trace.includes('retire'), false); assert.equal(f.documentBusy(), true);
  assert.equal(f.trace.filter(value => value === 'end').length, 1);
  await f.finish(); await exiting; assert.equal(f.documentBusy(), false);
});

test('later context failure cannot rewrite a settled entry and explicitly disposed callbacks stay silent', async () => {
  const f = fixture(); await f.present(); f.fail('context-lost');
  assert.equal(f.controller.state, 'ending');
  const exiting = f.controller.exit();
  const notifications = f.trace.filter(value => value.startsWith('state:')).length;
  f.controller.dispose(); assert.equal(f.trace.filter(value => value.startsWith('state:')).length, notifications);
  f.lateFailure('failed'); f.submit(); await f.finish(); await exiting;
  assert.equal(f.controller.state, 'disposed');
  assert.equal(f.trace.filter(value => value.startsWith('state:')).length, notifications);
});

test('a hidden cleanup rejection is handled internally but remains rejected for a later exit caller', async () => {
  const f = fixture(); await f.present();
  const unhandled = [], observe = reason => { unhandled.push(reason); };
  process.on('unhandledRejection', observe);
  try {
    f.fail('context-lost'); f.ending.reject(new Error('private asynchronous end failure'));
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(unhandled, []);
    const exiting = f.controller.exit(); await assert.rejects(exiting, { code: 'failed' });
    assert.equal(f.controller.exit(), exiting); assert.equal(f.documentBusy(), true);
    f.end(); await f.flush(); f.retirement.resolve(); await f.flush();
    assert.equal(f.documentBusy(), false);
  } finally { process.removeListener('unhandledRejection', observe); }
});

test('retirement never runs inside native end dispatch even when binding already settled', async () => {
  const f = fixture(); await f.present(); f.end();
  assert.equal(f.trace.includes('retire'), false);
  await turns(); assert.equal(f.trace.includes('retire'), false, 'the finalization task has not run');
  const exiting = f.controller.exit(); await f.flush(); assert.equal(f.trace.filter(value => value === 'retire').length, 1);
  f.retirement.resolve(); await exiting;
});

test('retirement failure is terminal failed-release quarantine, not a fresh context license', async () => {
  const f = fixture(); await f.present();
  const exiting = f.controller.exit(), rejection = assert.rejects(exiting, { code: 'failed' });
  f.end(); f.ending.resolve(); await f.flush(); f.retirement.reject(new Error('private retirement failure'));
  await rejection; await f.flush();
  assert.equal(f.controller.state, 'ending'); assert.equal(f.documentBusy(), true);
  let released = false; void f.lease.released.then(() => { released = true; }); await turns(); assert.equal(released, false);
  f.controller.dispose(); await turns(); assert.equal(f.controller.state, 'disposed'); assert.equal(f.documentBusy(), true);
  assert.equal(f.trace.filter(value => value === 'retire').length, 1);
});

test('an aborted stop before first submission rejects entry without certifying native or binding quiescence', async () => {
  for (const first of ['native-end', 'binding']) {
    const f = fixture(), entered = f.controller.enter(), rejection = assert.rejects(entered, { code: 'aborted' });
    let released = false;
    void f.lease.released.then(() => { released = true; });
    await f.grant(); f.fail('aborted'); await rejection;
    assert.equal(f.controller.state, 'ending');
    assert.equal(f.trace.filter(value => value === 'detach').length, 1);
    assert.equal(f.trace.filter(value => value === 'end').length, 1);
    const exiting = f.controller.exit(); let settled = false;
    void exiting.then(() => { settled = true; });
    assert.equal(f.controller.exit(), exiting);
    f.ending.resolve(); f.submit(); f.lateFailure('aborted'); await f.flush();
    assert.equal(f.trace.includes('state:presenting'), false);
    assert.equal(f.trace.includes('retire'), false, 'end fulfillment and aborted stop do not certify cleanup');
    assert.equal(f.documentBusy(), true); assert.equal(released, false); assert.equal(settled, false);
    if (first === 'native-end') f.end(); else f.binding.resolve();
    await f.flush();
    assert.equal(f.trace.includes('retire'), false, 'both native end and binding settlement are required');
    assert.equal(f.documentBusy(), true); assert.equal(released, false); assert.equal(settled, false);
    if (first === 'native-end') f.binding.resolve(); else f.end();
    await turns(); assert.equal(f.trace.includes('retire'), false, 'retirement waits for its later task');
    await f.flush(); assert.equal(f.trace.filter(value => value === 'retire').length, 1);
    assert.equal(f.documentBusy(), true); assert.equal(released, false); assert.equal(settled, false);
    f.retirement.resolve(); await exiting; await turns();
    assert.equal(f.controller.state, 'disposed'); assert.equal(f.documentBusy(), false);
    assert.equal(released, true); assert.equal(settled, true);
    assert.equal(f.trace.filter(value => value === 'end').length, 1);
  }
});

test('an aborted stop after entry preserves the successful receipt and waits for observed end and retirement', async () => {
  const f = fixture(), entered = f.controller.enter();
  await f.grant(); f.binding.resolve(); await turns(); f.submit(); await entered;
  assert.equal(f.controller.state, 'presenting');
  let released = false;
  void f.lease.released.then(() => { released = true; });
  f.fail('aborted'); assert.equal(f.controller.state, 'ending');
  await entered;
  const exiting = f.controller.exit(); let settled = false;
  void exiting.then(() => { settled = true; });
  f.ending.resolve(); await f.flush();
  assert.equal(f.trace.includes('retire'), false); assert.equal(f.documentBusy(), true);
  assert.equal(released, false); assert.equal(settled, false);
  f.end(); await f.flush();
  assert.equal(f.trace.filter(value => value === 'retire').length, 1);
  assert.equal(f.documentBusy(), true); assert.equal(released, false); assert.equal(settled, false);
  f.retirement.resolve(); await exiting; await turns(); await entered;
  assert.equal(f.controller.state, 'disposed'); assert.equal(f.documentBusy(), false); assert.equal(released, true);
  assert.equal(f.trace.filter(value => value === 'state:presenting').length, 1);
  assert.equal(f.trace.filter(value => value === 'end').length, 1);
});

test('explicit disposal during an aborted stop silences late callbacks without releasing pending cleanup', async () => {
  const f = fixture(), entered = f.controller.enter(), rejection = assert.rejects(entered, { code: 'aborted' });
  let released = false;
  void f.lease.released.then(() => { released = true; });
  await f.grant(); f.fail('aborted'); await rejection;
  const exiting = f.controller.exit(); let settled = false;
  void exiting.then(() => { settled = true; });
  const notifications = f.trace.filter(value => value.startsWith('state:')).length;
  f.controller.dispose();
  assert.equal(f.controller.state, 'disposed'); assert.equal(f.controller.exit(), exiting);
  assert.equal(f.trace.filter(value => value.startsWith('state:')).length, notifications);
  f.lateFailure('aborted'); f.submit(); f.ending.resolve(); f.end(); await f.flush();
  assert.equal(f.trace.includes('retire'), false, 'binding remains pending after disposal and native end');
  assert.equal(f.documentBusy(), true); assert.equal(released, false); assert.equal(settled, false);
  f.binding.resolve(); await f.flush();
  assert.equal(f.trace.filter(value => value === 'retire').length, 1);
  assert.equal(f.documentBusy(), true); assert.equal(released, false); assert.equal(settled, false);
  f.retirement.resolve(); await exiting; await turns(); f.lateFailure('aborted'); f.submit();
  assert.equal(f.trace.filter(value => value.startsWith('state:')).length, notifications);
  assert.equal(f.documentBusy(), false); assert.equal(released, true); assert.equal(settled, true);
  assert.equal(f.trace.filter(value => value === 'end').length, 1); assert.equal(f.listeners, 0);
});
