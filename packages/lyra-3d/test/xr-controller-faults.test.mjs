import assert from 'node:assert/strict';
import test from 'node:test';
import { createXrPresentationController } from '../dist/xr/controller.js';
import { fixture, turns } from './xr-controller-fixture.mjs';

const privateFailure = () => { throw new Error('private native failure'); };
const failed = error => error.code === 'failed' && !error.message.includes('private');

for (const [name, error] of [
  ['null', null], ['primitive', 'private failure'], ['unnamed object', {}],
  ['throwing name', { get name() { return privateFailure(); } }],
  ['throwing presence trap', new Proxy({}, { has: privateFailure })],
]) {
  test(`XR request rejection with ${name} keeps a fixed public reason and releases consumed ownership`, async () => {
    const f = fixture(), rejection = assert.rejects(f.controller.enter(), failed);
    f.request.reject(error); await rejection;
    const exiting = f.controller.exit(); await f.flush();
    assert.equal(f.documentBusy(), true, 'retirement must certify release');
    f.retirement.resolve(); await exiting; await f.lease.released;
    assert.equal(f.documentBusy(), false);
    assert.equal(f.trace.includes('bind'), false);
  });
}

test('one preparation lease cannot transfer into two live XR controllers', async () => {
  const f = fixture();
  assert.throws(() => createXrPresentationController(f.services), { code: 'busy' });
  await f.present();
  const exiting = f.controller.exit(); await f.finish(); await exiting;
  assert.equal(f.trace.filter(value => value === 'request').length, 1);
  assert.equal(f.documentBusy(), false);
});

test('throwing XR preparation validation releases its unused lease without touching the native owner', async () => {
  const f = fixture({ configure({ services }) { services.validatePrepared = privateFailure; } });
  await assert.rejects(f.controller.enter(), failed); await f.lease.released;
  assert.equal(f.controller.state, 'disposed'); assert.deepEqual(f.trace, []);
  assert.equal(f.documentBusy(), false);
});

for (const operation of ['detach', 'end', 'removeFailure', 'removeEnd']) {
  test(`throwing XR ${operation} rejects exit while allowing certified retirement`, async () => {
    const f = fixture({ configure({ owner, nativeSession }) {
      if (operation === 'detach') owner.detach = privateFailure;
      if (operation === 'end') nativeSession.end = privateFailure;
      if (operation === 'removeFailure') owner.observeFailure = () => privateFailure;
      if (operation === 'removeEnd') {
        const observe = nativeSession.observeEnd;
        nativeSession.observeEnd = callback => {
          const remove = observe(callback);
          return () => { remove(); privateFailure(); };
        };
      }
    } });
    await f.present();
    const exiting = f.controller.exit(), rejection = assert.rejects(exiting, failed);
    assert.equal(f.documentBusy(), true);
    f.end(); f.ending.resolve(); await f.flush(); await rejection;
    assert.equal(f.trace.filter(value => value === 'retire').length, 1);
    f.retirement.resolve(); await f.flush(); await f.lease.released;
    assert.equal(f.documentBusy(), false); assert.equal(f.listeners, 0);
    assert.equal(f.controller.state, 'disposed');
    await assert.rejects(f.controller.exit(), failed);
  });
}

for (const operation of ['retire', 'enqueueFinalizer']) {
  test(`throwing XR ${operation} preserves quarantine and never retries native release`, async () => {
    let calls = 0;
    const f = fixture({ configure({ owner, services }) {
      const fail = () => { calls++; privateFailure(); };
      if (operation === 'retire') owner.retire = fail;
      else services.enqueueFinalizer = fail;
    } });
    await f.present();
    const exiting = f.controller.exit(), rejection = assert.rejects(exiting, failed);
    f.end(); f.ending.resolve(); await f.flush(); await rejection;
    let released = false; void f.lease.released.then(() => { released = true; });
    f.controller.dispose(); f.end(); await f.flush();
    assert.equal(calls, 1); assert.equal(released, false);
    assert.equal(f.documentBusy(), true); assert.equal(f.controller.exit(), exiting);
  });
}

test('synchronously throwing XR binding still waits for native end before releasing the renderer', async () => {
  const f = fixture({ configure({ owner }) { owner.bind = privateFailure; } });
  const rejection = assert.rejects(f.controller.enter(), failed);
  await f.grant(); await rejection;
  const exiting = f.controller.exit(); await f.flush();
  assert.equal(f.trace.includes('retire'), false); assert.equal(f.documentBusy(), true);
  f.end(); f.ending.resolve(); await f.flush(); f.retirement.resolve(); await exiting;
  assert.equal(f.documentBusy(), false);
});

test('a grant that cannot observe native end is ended once and remains quarantined', async () => {
  const f = fixture({ configure({ nativeSession }) { nativeSession.observeEnd = privateFailure; } });
  const rejection = assert.rejects(f.controller.enter(), failed);
  await f.grant(); await rejection;
  f.ending.resolve(); await f.flush(); f.controller.dispose(); await f.flush();
  assert.equal(f.trace.includes('bind'), false); assert.equal(f.trace.includes('retire'), false);
  assert.equal(f.trace.filter(value => value === 'end').length, 1);
  assert.equal(f.documentBusy(), true);
});

test('throwing failure-observer installation cancels entry and retires a late grant', async () => {
  const f = fixture({ configure({ owner }) { owner.observeFailure = privateFailure; } });
  await assert.rejects(f.controller.enter(), failed);
  await f.grant();
  const exiting = f.controller.exit(); await f.finish(); await exiting;
  assert.equal(f.trace.includes('bind'), false); assert.equal(f.documentBusy(), false);
});

for (const throws of [false, true]) {
  test(`synchronously replayed XR failure removes its observer once${throws ? ' even when removal throws' : ''}`, async () => {
    let removed = 0;
    const f = fixture({ configure({ owner }) {
      owner.observeFailure = listener => {
        listener('context-lost');
        return () => { removed++; if (throws) privateFailure(); };
      };
    } });
    await assert.rejects(f.controller.enter(), { code: 'context-lost' });
    const exiting = f.controller.exit();
    const rejection = throws ? assert.rejects(exiting, failed) : undefined;
    await f.grant(); await f.finish();
    if (rejection) await rejection; else await exiting;
    assert.equal(removed, 1); assert.equal(f.trace.includes('bind'), false);
    assert.equal(f.documentBusy(), false); assert.equal(f.controller.state, 'disposed');
  });
}

test('replayed end notifications and a repeated finalizer cannot retire an XR owner twice', async () => {
  let nativeEnd;
  const f = fixture({ configure({ nativeSession }) {
    const observe = nativeSession.observeEnd;
    nativeSession.observeEnd = callback => { nativeEnd = callback; return observe(callback); };
  } });
  await f.present();
  const exiting = f.controller.exit(); f.end(); f.ending.resolve(); await turns();
  assert.equal(f.finalizers.length, 1);
  const finalize = f.finalizers.shift(); finalize(); nativeEnd(); finalize();
  f.retirement.resolve(); await exiting; nativeEnd(); finalize();
  assert.equal(f.trace.filter(value => value === 'retire').length, 1);
  assert.equal(f.documentBusy(), false); assert.equal(f.listeners, 0);
});
