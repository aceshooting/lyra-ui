import assert from 'node:assert/strict';
import test from 'node:test';
import { createThreeXrNativeOwner } from '../dist/xr/three-native-owner.js';
import { nativeFixture, turns } from './xr-three-native-fixture.mjs';

async function finish(f) {
  f.session.signalEnd(); f.session.ending.resolve(); await f.flush();
  f.resources.resolve(); await turns(); f.observeContextLoss(); await f.flush();
}

for (const branch of ['legacy', 'projection']) {
  for (const when of ['before rendering', 'after rendering']) {
    test(`XR ${branch} detects context loss ${when} without publishing a successful frame`, async t => {
      const f = nativeFixture(t, createThreeXrNativeOwner, branch);
      const rejected = assert.rejects(f.controller.enter(), { code: 'context-lost' });
      await f.bind();
      if (when === 'before rendering') f.controls.lost = true;
      else {
        const render = f.renderer.render;
        f.renderer.render = (...args) => { render(...args); f.controls.lost = true; };
      }
      f.session.deliver(f.frame()); await rejected;
      assert.equal(f.trace.includes('state:presenting'), false);
      assert.equal(f.counts.draws, when === 'before rendering' ? 0 : 1);
      const exiting = f.controller.exit(); await finish(f); await exiting;
      assert.equal(f.counts.releaseRequests, 0, 'an already lost context needs no second loss request');
      assert.equal(f.documentBusy(), false);
    });
  }

  test(`XR ${branch} suspends hidden-session frames and resumes without replacing the session`, async t => {
    const f = nativeFixture(t, createThreeXrNativeOwner, branch), entered = f.controller.enter();
    await f.bind(); f.session.visibilityState = 'hidden';
    f.session.deliver(f.frame()); await turns();
    assert.equal(f.counts.frames, 0); assert.equal(f.counts.draws, 0);
    assert.equal(f.controller.state, 'requesting');
    f.session.visibilityState = 'visible'; f.session.deliver(f.frame()); await entered;
    assert.equal(f.counts.draws, 1); assert.equal(f.counts.requests, 1);
    const exiting = f.controller.exit(); await finish(f); await exiting;
  });
}

for (const operation of ['reference observer', 'session observer', 'animation loop', 'application detach']) {
  test(`XR detachment attempts the remaining cleanup after a failed ${operation}`, async t => {
    const f = nativeFixture(t, createThreeXrNativeOwner), entered = f.controller.enter();
    await f.bind(); f.session.deliver(f.frame()); await entered;
    let failures = 0;
    const failOnce = () => { if (failures++ === 0) throw new Error('private detach failure'); };
    if (operation === 'application detach') f.controls.detachHook = failOnce;
    else {
      const target = operation === 'reference observer' ? f.reference
        : operation === 'session observer' ? f.manager : f.renderer;
      const method = operation === 'animation loop' ? 'setAnimationLoop' : 'removeEventListener';
      const original = target[method];
      target[method] = function (...args) { const result = original.apply(this, args); failOnce(); return result; };
    }
    const exiting = f.controller.exit(), rejected = assert.rejects(exiting, { code: 'failed' });
    await rejected;
    assert.equal(f.counts.detach, 1); assert.equal(f.session.endCalls, 1);
    const draws = f.counts.draws; f.session.deliver(f.frame()); assert.equal(f.counts.draws, draws);
    await finish(f); await f.lease.released;
    assert.equal(f.documentBusy(), false); assert.equal(f.counts.dispose, 1);
    assert.equal(f.controller.state, 'disposed');
  });
}

for (const operation of ['resources', 'animation loop', 'renderer', 'after renderer', 'context observer']) {
  test(`XR retirement attempts all remaining releases after failed ${operation} and keeps its lease quarantined`, async t => {
    let afterRenderer = 0;
    const f = nativeFixture(t, transfer => createThreeXrNativeOwner({ ...transfer,
      afterRendererDispose() { afterRenderer++; if (operation === 'after renderer') throw new Error('private cleanup failure'); },
    }));
    const entered = f.controller.enter(); await f.bind(); f.session.deliver(f.frame()); await entered;
    const exiting = f.controller.exit(), rejected = assert.rejects(exiting, { code: 'failed' });
    f.session.signalEnd(); f.session.ending.resolve();
    if (operation === 'renderer' || operation === 'animation loop' || operation === 'context observer') {
      const target = operation === 'context observer' ? f.canvas : f.renderer;
      const method = operation === 'renderer' ? 'dispose' : operation === 'animation loop' ? 'setAnimationLoop' : 'removeEventListener';
      const original = target[method];
      target[method] = function (...args) { original.apply(this, args); throw new Error('private cleanup failure'); };
    }
    await f.flush();
    if (operation === 'resources') f.resources.reject(new Error('private cleanup failure')); else f.resources.resolve();
    await turns(); f.observeContextLoss(); await rejected; await f.flush();
    assert.equal(f.counts.resources, 1); assert.equal(f.counts.dispose, 1);
    assert.equal(afterRenderer, 1); assert.equal(f.counts.releaseRequests, 1);
    assert.equal(f.session.endListeners.size, 0);
    assert.equal(f.documentBusy(), true); assert.equal(f.controller.state, 'ending');
    f.controller.dispose(); await f.flush();
    assert.equal(f.counts.resources, 1); assert.equal(afterRenderer, 1);
  });
}

test('synchronous native binding setup failure ends the granted session and releases the renderer once', async t => {
  const f = nativeFixture(t, createThreeXrNativeOwner);
  f.manager.setReferenceSpaceType = () => { throw new Error('private native setup failure'); };
  const rejected = assert.rejects(f.controller.enter(), { code: 'failed' });
  await f.grant(); await rejected;
  assert.equal(f.counts.compatibility, 0); assert.equal(f.session.endCalls, 1);
  const exiting = f.controller.exit(); await finish(f); await exiting;
  assert.equal(f.counts.dispose, 1); assert.equal(f.documentBusy(), false);
});

test('consumed native XR owners reject another request and ignore late failure observers', async t => {
  const f = nativeFixture(t, createThreeXrNativeOwner), entered = f.controller.enter();
  await f.bind(); f.session.deliver(f.frame()); await entered;
  assert.throws(() => f.owner.request(), { name: 'InvalidStateError' });
  let lateFailures = 0;
  const exiting = f.controller.exit();
  const unsubscribe = f.owner.observeFailure(() => { lateFailures++; });
  await finish(f); await exiting; unsubscribe(); unsubscribe();
  assert.equal(lateFailures, 0); assert.equal(f.counts.requests, 1);
});
