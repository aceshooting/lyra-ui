import assert from 'node:assert/strict';
import test from 'node:test';
import { createThreeXrNativeOwner } from '../dist/xr/three-native-owner.js';
import { nativeFixture, turns } from './xr-three-native-fixture.mjs';

async function enterPresenting(f) {
  const entered = f.controller.enter(); await f.bind(); f.session.deliver(f.frame()); await entered;
}

test('XR retirement resolves without a loss event when the context is lost synchronously on release', async t => {
  const f = nativeFixture(t, createThreeXrNativeOwner); await enterPresenting(f);
  f.gl.getExtension = name => name === 'WEBGL_lose_context'
    ? { loseContext() { f.counts.releaseRequests++; f.controls.lost = true; } } : null;
  const exiting = f.controller.exit();
  f.session.signalEnd(); f.session.ending.resolve(); await f.flush();
  f.resources.resolve(); await exiting; await f.flush();
  assert.equal(f.counts.releaseRequests, 1); assert.equal(f.counts.dispose, 1);
  assert.equal(f.trace.includes('context-loss-observed'), false);
  assert.equal(f.documentBusy(), false); assert.equal(f.controller.state, 'disposed');
});

test('XR retirement fails closed when the native session record cannot drop its end listener', async t => {
  const f = nativeFixture(t, createThreeXrNativeOwner); await enterPresenting(f);
  const exiting = f.controller.exit(), rejected = assert.rejects(exiting, { code: 'failed' });
  f.session.signalEnd(); f.session.ending.resolve();
  const original = f.session.removeEventListener;
  f.session.removeEventListener = function (type, ...rest) {
    original.call(this, type, ...rest);
    if (type === 'end') throw new Error('private cleanup failure');
  };
  await f.flush(); f.resources.resolve(); await turns(); f.observeContextLoss(); await rejected; await f.flush();
  assert.equal(f.counts.dispose, 1); assert.equal(f.counts.releaseRequests, 1);
  assert.equal(f.session.endListeners.size, 0);
  assert.equal(f.documentBusy(), true, 'a failed retirement keeps the document lease quarantined');
});

test('XR failure fan-out stops once the presentation listener detaches the application', async t => {
  const f = nativeFixture(t, createThreeXrNativeOwner), entered = f.controller.enter();
  const rejection = assert.rejects(entered, { code: 'aborted' });
  await f.bind();
  const late = [];
  f.owner.observeFailure(reason => { late.push(reason); });
  f.reference.dispatchEvent(new Event('reset'));
  assert.equal(f.counts.detach, 1, 'the controller detaches synchronously on failure');
  assert.deepEqual(late, [], 'listeners after the detaching one are not notified');
  await rejection;
  const exiting = f.controller.exit();
  f.session.signalEnd(); f.session.ending.resolve(); await f.flush();
  f.resources.resolve(); await turns(); f.observeContextLoss(); await exiting;
  assert.equal(f.documentBusy(), false);
});

test('XR follows a replaced reference space so only the current space can request an abort', async t => {
  const f = nativeFixture(t, createThreeXrNativeOwner); await enterPresenting(f);
  const replacement = new EventTarget();
  f.manager.setReferenceSpace(replacement);
  f.manager.dispatchEvent({ type: 'sessionstart' });
  f.reference.dispatchEvent(new Event('reset')); await turns();
  assert.equal(f.controller.state, 'presenting', 'the retired reference space no longer reports resets');
  assert.equal(f.session.endCalls, 0);
  replacement.dispatchEvent(new Event('reset')); await turns();
  assert.equal(f.controller.state, 'ending'); assert.equal(f.session.endCalls, 1);
  const exiting = f.controller.exit();
  f.session.signalEnd(); f.session.ending.resolve(); await f.flush();
  f.resources.resolve(); await turns(); f.observeContextLoss(); await exiting;
  assert.equal(f.documentBusy(), false);
});
