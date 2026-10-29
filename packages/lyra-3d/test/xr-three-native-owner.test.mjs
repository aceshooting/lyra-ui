import assert from 'node:assert/strict';
import test from 'node:test';
import { createThreeXrNativeOwner } from '../dist/xr/three-native-owner.js';
import { eyeViewports, nativeFixture, turns } from './xr-three-native-fixture.mjs';

const stateCount = f => f.trace.filter(value => value.startsWith('state:')).length;
function observeSettlement(promise) {
  const status = { settled: false };
  void promise.then(() => { status.settled = true; }, () => { status.settled = true; });
  return status;
}
async function finishRetirement(f, exiting) {
  f.resources.resolve(); await turns();
  assert.equal(f.counts.dispose, 1); assert.equal(f.counts.releaseRequests, 1);
  f.observeContextLoss(); await exiting; await turns();
  assert.deepEqual(f.queues(), { inline: 0, native: 0 });
  assert.equal(f.documentBusy(), false); assert.equal(f.session.endListeners.size, 0);
}
async function endAndRetire(f, exiting) {
  if (!f.session.ended) f.session.signalEnd();
  f.session.ending.resolve(); await f.flush();
  assert.equal(f.counts.resources, 1);
  await finishRetirement(f, exiting);
}

for (const branch of ['legacy', 'projection']) {
  test(`real manager ${branch}: preparation and unused disposal leave native and renderer ownership untouched`, async t => {
    const f = nativeFixture(t, createThreeXrNativeOwner, branch);
    assert.equal(f.counts.stop, 0); assert.equal(f.counts.requests, 0);
    assert.equal(f.counts.compatibility, 0); assert.equal(f.manager.getSession(), null);
    assert.deepEqual(f.queues(), { inline: 0, native: 0 });
    f.controller.dispose();
    assert.equal(f.counts.detach, 0); assert.equal(f.counts.dispose, 0); assert.equal(f.counts.resources, 0);
    await f.lease.released;
  });

  test(`real manager ${branch}: native binding and a valid recorded render return are both required for entry`, async t => {
    const f = nativeFixture(t, createThreeXrNativeOwner, branch), entered = f.controller.enter();
    const entry = observeSettlement(entered);
    assert.equal(f.counts.requests, 1); assert.equal(f.counts.stop, 1);
    assert.ok(f.trace.indexOf('native-request') < f.trace.indexOf('state:requesting'));
    await f.bind();
    assert.equal(f.manager.getSession(), f.session); assert.equal(f.manager.isPresenting, true);
    assert.deepEqual(f.session.referenceCalls, ['local']); assert.deepEqual(f.size(), [1600, 700]);
    assert.equal(f.manager.getReferenceSpace(), f.reference); assert.equal(entry.settled, false);
    assert.equal(f.manager.getBaseLayer(), branch === 'legacy' ? f.session.renderState.baseLayer : f.session.renderState.layers[0]);
    assert.deepEqual(f.queues(), { inline: 0, native: 1 });
    f.session.deliver(f.frame(false)); await turns();
    assert.equal(f.counts.draws, 0); assert.equal(entry.settled, false);
    f.session.deliver(f.frame()); await entered;
    assert.equal(f.counts.draws, 1); assert.equal(f.controller.state, 'presenting');
    assert.ok(f.trace.indexOf('recorded-render-return') < f.trace.indexOf('state:presenting'));
    assert.deepEqual(f.manager.getCamera().cameras.map(camera => camera.viewport.toArray()), eyeViewports);
    assert.equal(f.renderer.getRenderTarget().isXRRenderTarget, true);
    if (branch === 'legacy') { assert.equal(f.counts.framebuffer, 1); assert.equal(f.counts.subImages, 0); }
    else { assert.equal(f.counts.subImages, 2); assert.equal(f.counts.textures, 1); }
    await endAndRetire(f, f.controller.exit());
  });

  test(`real manager ${branch}: detach blocks application draws while native RAF and targets continue until actual end`, async t => {
    const f = nativeFixture(t, createThreeXrNativeOwner, branch), entered = f.controller.enter();
    await f.bind(); f.session.deliver(f.frame()); await entered;
    const exiting = f.controller.exit(), exit = observeSettlement(exiting);
    let released = false; void f.lease.released.then(() => { released = true; });
    assert.equal(f.counts.detach, 1); assert.equal(f.session.endCalls, 1);
    const draws = f.counts.draws, frames = f.counts.frames, nativeRequests = f.session.nextFrame;
    f.renderer.setRenderTarget(null); f.session.deliver(f.frame());
    assert.equal(f.counts.draws, draws); assert.equal(f.counts.frames, frames);
    assert.ok(f.session.nextFrame > nativeRequests); assert.equal(f.session.frames.size, 1);
    assert.equal(f.renderer.getRenderTarget().isXRRenderTarget, true, 'manager still owns target updates while quarantined');
    f.session.ending.resolve(); await f.flush();
    assert.equal(f.counts.resources, 0); assert.equal(f.counts.dispose, 0);
    assert.equal(f.documentBusy(), true); assert.equal(released, false); assert.equal(exit.settled, false);
    f.session.signalEnd();
    assert.equal(f.manager.getSession(), null); assert.equal(f.manager.isPresenting, false);
    assert.equal(f.counts.resources, 0, 'no retirement during native end dispatch');
    await turns(); assert.equal(f.counts.resources, 0, 'a microtask is not the finalization task');
    await f.flush(); assert.equal(f.counts.resources, 1);
    f.resources.resolve(); await turns();
    assert.equal(f.counts.dispose, 1); assert.equal(f.counts.releaseRequests, 1);
    assert.equal(f.gl.isContextLost(), false); assert.equal(exit.settled, false);
    assert.equal(f.documentBusy(), true); assert.equal(released, false);
    f.observeContextLoss(); await exiting; await turns();
    assert.equal(exit.settled, true); assert.equal(released, true); assert.equal(f.documentBusy(), false);
    assert.deepEqual(f.queues(), { inline: 0, native: 0 });
    assert.ok(f.trace.indexOf('manager-end') < f.trace.indexOf('resources-retire'));
    assert.ok(f.trace.indexOf('renderer-dispose') < f.trace.indexOf('context-loss-observed'));
  });

  test(`real manager ${branch}: end during reference binding quarantines the actual late sessionstart`, async t => {
    const f = nativeFixture(t, createThreeXrNativeOwner, branch), entered = f.controller.enter();
    const rejection = assert.rejects(entered, { code: 'aborted' });
    await f.grant(); f.compatibility.resolve(); await turns();
    assert.deepEqual(f.session.referenceCalls, ['local']);
    f.session.signalEnd(); await rejection;
    const exiting = f.controller.exit(); await f.flush();
    assert.equal(f.counts.resources, 0); assert.equal(f.manager.isPresenting, false);
    f.session.reference.resolve(f.reference); await turns();
    assert.deepEqual(f.trace.filter(value => value === 'manager-start' || value === 'manager-end'), ['manager-end', 'manager-start']);
    assert.equal(f.manager.isPresenting, true, 'the installed manager really resumes its ended binding continuation');
    assert.equal(f.manager.getSession(), null); assert.deepEqual(f.queues(), { inline: 0, native: 0 });
    assert.equal(f.counts.draws, 0); assert.equal(f.trace.includes('state:presenting'), false);
    assert.equal(f.session.endCalls, 0, 'observed native end requires no duplicate end request');
    await f.flush(); assert.equal(f.counts.resources, 1);
    await finishRetirement(f, exiting);
  });

  test(`real manager ${branch}: end during compatibility waits for the real rejected binding continuation`, async t => {
    const f = nativeFixture(t, createThreeXrNativeOwner, branch), entered = f.controller.enter();
    const rejection = assert.rejects(entered, { code: 'aborted' });
    await f.grant(); assert.equal(f.counts.compatibility, 1);
    f.session.signalEnd(); await rejection;
    const exiting = f.controller.exit(); await f.flush(); assert.equal(f.counts.resources, 0);
    f.compatibility.resolve(); await f.flush();
    assert.equal(f.trace.includes('manager-start'), false); assert.equal(f.manager.getSession(), null);
    assert.equal(f.counts.draws, 0); assert.equal(f.counts.resources, 1);
    await finishRetirement(f, exiting);
  });

  test(`real manager ${branch}: reference-space reset requests graceful abort without claiming native end`, async t => {
    const f = nativeFixture(t, createThreeXrNativeOwner, branch), entered = f.controller.enter();
    const rejection = assert.rejects(entered, { code: 'aborted' });
    await f.bind(); f.reference.dispatchEvent(new Event('reset')); await rejection;
    assert.equal(f.controller.state, 'ending'); assert.equal(f.session.endCalls, 1);
    assert.equal(f.session.ended, false); assert.equal(f.manager.isPresenting, true);
    const exiting = f.controller.exit(); await f.flush(); assert.equal(f.counts.resources, 0);
    f.session.deliver(f.frame()); assert.equal(f.counts.draws, 0);
    await endAndRetire(f, exiting);
  });

  test(`real manager ${branch}: failed rendering never publishes successful submission`, async t => {
    const f = nativeFixture(t, createThreeXrNativeOwner, branch), entered = f.controller.enter();
    const rejection = assert.rejects(entered, { code: 'failed' });
    await f.bind(); f.controls.renderError = new Error('recorded renderer failure');
    f.session.deliver(f.frame()); await rejection;
    assert.equal(f.trace.includes('state:presenting'), false); assert.equal(f.counts.draws, 0);
    assert.equal(f.counts.detach, 1); assert.equal(f.session.endCalls, 1);
    await endAndRetire(f, f.controller.exit());
  });

  test(`real manager ${branch}: failed native layer setup requests end without retrying another layer`, async t => {
    const f = nativeFixture(t, createThreeXrNativeOwner, branch, { layerError: new Error('layer unavailable') });
    const entered = f.controller.enter(), rejection = assert.rejects(entered, { code: 'failed' });
    await f.grant(); f.compatibility.resolve(); await rejection;
    assert.equal(f.session.endCalls, 1); assert.equal(f.trace.includes('manager-start'), false);
    assert.deepEqual(f.trace.filter(value => value === 'legacy-layer' || value === 'projection-layer'), [`${branch}-layer`]);
    const exiting = f.controller.exit(); await f.flush();
    assert.equal(f.counts.resources, 0); assert.equal(f.documentBusy(), true);
    await endAndRetire(f, exiting);
  });

  test(`real manager ${branch}: explicit disposal before late grant binds nothing and keeps all notifications silent`, async t => {
    const f = nativeFixture(t, createThreeXrNativeOwner, branch), entered = f.controller.enter();
    const rejection = assert.rejects(entered, { code: 'aborted' }), notifications = stateCount(f);
    f.controller.dispose(); await rejection; assert.equal(stateCount(f), notifications);
    const exiting = f.controller.exit(), exit = observeSettlement(exiting);
    await f.grant(); assert.equal(f.session.endCalls, 1); assert.equal(f.counts.compatibility, 0);
    assert.equal(f.manager.getSession(), null); assert.equal(f.manager.isPresenting, false);
    f.session.ending.resolve(); await f.flush();
    assert.equal(f.counts.resources, 0); assert.equal(exit.settled, false); assert.equal(f.documentBusy(), true);
    await endAndRetire(f, exiting); assert.equal(stateCount(f), notifications);
    assert.equal(f.controller.exit(), exiting); assert.equal(f.session.endCalls, 1);
  });
}

for (const failure of ['stopInline', 'requestSession']) {
  test(`attempted ${failure} failure still retires the existing renderer before releasing its slot`, async t => {
    const options = failure === 'stopInline' ? { stopError: new Error('stop failed') } : { requestError: new Error('request failed') };
    const f = nativeFixture(t, createThreeXrNativeOwner, 'legacy', options);
    await assert.rejects(f.controller.enter(), { code: 'failed' });
    assert.equal(f.counts.stop, 1); assert.equal(f.counts.requests, failure === 'stopInline' ? 0 : 1);
    const exiting = f.controller.exit(); await f.flush();
    assert.equal(f.counts.resources, 1); assert.equal(f.documentBusy(), true); assert.equal(f.session.endCalls, 0);
    await finishRetirement(f, exiting);
  });
}

test('context loss during synchronous request is latched until the controller subscribes to failures', async t => {
  const f = nativeFixture(t, createThreeXrNativeOwner);
  f.controls.requestHook = () => { f.observeContextLoss(); };
  const entered = f.controller.enter(), rejection = assert.rejects(entered, { code: 'context-lost' });
  await rejection; assert.equal(f.controller.state, 'ending');
  const exiting = f.controller.exit(); await f.flush(); assert.equal(f.counts.resources, 0);
  await f.grant(); assert.equal(f.session.endCalls, 1); assert.equal(f.counts.compatibility, 0);
  f.session.signalEnd(); f.session.ending.resolve(); await f.flush();
  f.resources.resolve(); await exiting;
  assert.equal(f.counts.dispose, 1); assert.equal(f.gl.isContextLost(), true); assert.equal(f.documentBusy(), false);
  assert.deepEqual(f.queues(), { inline: 0, native: 0 });
});

test('an end observed in the grant turn is replayed before native binding can start', async t => {
  const f = nativeFixture(t, createThreeXrNativeOwner), entered = f.controller.enter();
  const rejection = assert.rejects(entered, { code: 'aborted' });
  f.request.resolve(f.session);
  // The adapter's grant reaction installs observation before this later reaction ends the session.
  void f.request.promise.then(() => { f.session.signalEnd(); });
  await rejection;
  assert.equal(f.counts.compatibility, 0); assert.equal(f.manager.getSession(), null); assert.equal(f.session.endCalls, 0);
  const exiting = f.controller.exit(); await f.flush(); await finishRetirement(f, exiting);
});

test('foreign owned-session wrappers are rejected before the actual manager is changed', async t => {
  const f = nativeFixture(t, createThreeXrNativeOwner);
  const foreign = { end: () => Promise.resolve(), observeEnd: () => () => {} };
  await assert.rejects(async () => f.owner.bind(foreign, () => { assert.fail('foreign submission'); }), TypeError);
  assert.equal(f.counts.requests, 0); assert.equal(f.counts.compatibility, 0);
  assert.equal(f.manager.getSession(), null); assert.equal(f.manager.isPresenting, false);
  f.controller.dispose(); await f.lease.released;
});

test('reentrant explicit disposal from frame preparation prevents render and later state callbacks', async t => {
  const f = nativeFixture(t, createThreeXrNativeOwner), entered = f.controller.enter();
  const rejection = assert.rejects(entered, { code: 'aborted' });
  await f.bind(); const notifications = stateCount(f);
  f.controls.prepareHook = () => { f.controller.dispose(); };
  f.session.deliver(f.frame()); await rejection;
  assert.equal(f.counts.draws, 0); assert.equal(stateCount(f), notifications);
  const exiting = f.controller.exit();
  f.reference.dispatchEvent(new Event('reset')); f.session.deliver(f.frame());
  await endAndRetire(f, exiting);
  assert.equal(stateCount(f), notifications); assert.equal(f.counts.detach, 1); assert.equal(f.session.endCalls, 1);
});

test('a later renderer failure preserves the earlier entry receipt and stops future application frames', async t => {
  const f = nativeFixture(t, createThreeXrNativeOwner), entered = f.controller.enter();
  await f.bind(); f.session.deliver(f.frame()); await entered;
  f.controls.renderError = new Error('later rendering failed'); f.session.deliver(f.frame()); await turns();
  await entered; assert.equal(f.controller.state, 'ending'); assert.equal(f.counts.draws, 1);
  const frames = f.counts.frames; f.session.deliver(f.frame()); assert.equal(f.counts.frames, frames);
  assert.equal(f.session.endCalls, 1); await endAndRetire(f, f.controller.exit());
});

for (const phase of ['compatibility', 'reference']) {
  test(`real manager ${phase} rejection keeps native ownership until observed end`, async t => {
    const f = nativeFixture(t, createThreeXrNativeOwner), entered = f.controller.enter();
    const rejection = assert.rejects(entered, { code: 'failed' });
    await f.grant();
    if (phase === 'compatibility') f.compatibility.reject(new Error('compatibility failed'));
    else { f.compatibility.resolve(); await turns(); f.session.reference.reject(new Error('reference failed')); }
    await rejection;
    assert.equal(f.session.endCalls, 1); assert.equal(f.trace.includes('manager-start'), false);
    const exiting = f.controller.exit(); f.session.ending.resolve(); await f.flush();
    assert.equal(f.counts.resources, 0); assert.equal(f.documentBusy(), true);
    await endAndRetire(f, exiting);
  });
}

test('missing native context-release capability cannot certify retirement or permit a fresh slot', async t => {
  const f = nativeFixture(t, createThreeXrNativeOwner, 'legacy', { missingRelease: true });
  const entered = f.controller.enter(); await f.bind(); f.session.deliver(f.frame()); await entered;
  const exiting = f.controller.exit(), rejection = assert.rejects(exiting, { code: 'failed' });
  f.session.signalEnd(); f.session.ending.resolve(); await f.flush(); f.resources.resolve(); await rejection;
  assert.equal(f.counts.dispose, 1); assert.equal(f.gl.isContextLost(), false); assert.equal(f.counts.releaseRequests, 0);
  assert.equal(f.controller.state, 'ending'); assert.equal(f.documentBusy(), true);
  let released = false; void f.lease.released.then(() => { released = true; }); await turns(); assert.equal(released, false);
  assert.deepEqual(f.queues(), { inline: 0, native: 0 }); assert.equal(f.controller.exit(), exiting);
  f.controller.dispose();
});

test('resource retirement rejection still attempts independent renderer and context cleanup without releasing quarantine', async t => {
  const f = nativeFixture(t, createThreeXrNativeOwner), entered = f.controller.enter();
  await f.bind(); f.session.deliver(f.frame()); await entered;
  const exiting = f.controller.exit(), rejection = assert.rejects(exiting, { code: 'failed' });
  f.session.signalEnd(); f.session.ending.resolve(); await f.flush();
  f.resources.reject(new Error('resource retirement failed')); await turns();
  assert.equal(f.counts.dispose, 1); assert.equal(f.counts.releaseRequests, 1);
  f.observeContextLoss(); await rejection;
  assert.equal(f.documentBusy(), true); assert.equal(f.controller.state, 'ending');
  assert.deepEqual(f.queues(), { inline: 0, native: 0 }); assert.equal(f.controller.exit(), exiting);
  f.controller.dispose();
});
