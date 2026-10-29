import assert from 'node:assert/strict';
import test from 'node:test';
import { PerspectiveCamera, Scene } from 'three';
import { captureViewportXrPreparation, consumeViewportXrPreparation, invalidateViewportXr,
  isViewportXrPreparationCurrent, registerViewportXr, releaseViewportXrPreparation,
  unregisterViewportXr } from '../dist/core/viewport-xr.js';
import { createViewportResources } from '../dist/core/viewport-resources.js';
import { acquireXrPreparation, releaseXrPreparation } from '../dist/xr/coordinator.js';

function fixture(register = true) {
  const effects = [], scope = {};
  const renderer = { dispose() { effects.push('renderer-dispose'); }, render() { effects.push('render'); },
    setAnimationLoop() { effects.push('loop'); }, getContext() { effects.push('context'); return {}; } };
  const canvas = { remove() { effects.push('canvas-remove'); } };
  const scene = new Scene(), pickScene = new Scene(), camera = new PerspectiveCamera();
  const resources = createViewportResources({ renderer, canvas, scene, pickScene, camera,
    picker: { dispose() { effects.push('picker-dispose'); } },
    glow: { dispose() { effects.push('glow-dispose'); } },
    restoreContextMethods() { effects.push('guard-restore'); },
  });
  const viewport = { renderer, canvas, scene, pickScene, camera };
  if (register) registerViewportXr(viewport, resources, scope);
  return { viewport, resources, scope, effects };
}

test('viewport XR registration and snapshot release leave all renderer ownership untouched', () => {
  const f = fixture(), prepared = captureViewportXrPreparation(f.viewport, false);
  assert.equal(Object.isFrozen(prepared), true);
  assert.deepEqual(Object.keys(prepared), ['kind']); assert.equal(prepared.kind, 'viewport-xr-preparation');
  assert.equal(isViewportXrPreparationCurrent(prepared), true);
  releaseViewportXrPreparation(prepared);
  assert.equal(isViewportXrPreparationCurrent(prepared), false);
  assert.throws(() => consumeViewportXrPreparation(prepared, false), { code: 'aborted' });
  assert.equal(f.resources.transferred, false); assert.equal(f.resources.extrasRetired, false);
  assert.deepEqual(f.effects, []);
});

test('duplicate viewport registrations and fabricated preparation tokens cannot acquire ownership', () => {
  const f = fixture(), prepared = captureViewportXrPreparation(f.viewport, false);
  assert.throws(() => registerViewportXr(f.viewport, f.resources, f.scope), { name: 'InvalidStateError' });
  const foreign = Object.freeze({ kind: 'viewport-xr-preparation' });
  assert.equal(isViewportXrPreparationCurrent(foreign), false);
  assert.throws(() => releaseViewportXrPreparation(foreign), TypeError);
  assert.throws(() => consumeViewportXrPreparation(foreign, false), TypeError);
  assert.equal(isViewportXrPreparationCurrent(prepared), true);
  assert.equal(f.resources.transferred, false); assert.deepEqual(f.effects, []);
});

test('pending data preparation and invalid scope or busy values refuse before changing resource ownership', () => {
  const f = fixture();
  assert.throws(() => captureViewportXrPreparation(f.viewport, true), { code: 'busy' });
  assert.throws(() => captureViewportXrPreparation(f.viewport, 'false'), TypeError);
  const prepared = captureViewportXrPreparation(f.viewport, false);
  assert.throws(() => consumeViewportXrPreparation(prepared, 0), TypeError);
  assert.equal(isViewportXrPreparationCurrent(prepared), true);
  const unregistered = fixture(false);
  assert.throws(() => registerViewportXr(unregistered.viewport, unregistered.resources, null), TypeError);
  assert.throws(() => registerViewportXr(unregistered.viewport, unregistered.resources, 1), TypeError);
  unregistered.resources.transferred = true;
  assert.throws(() => registerViewportXr(unregistered.viewport, unregistered.resources, unregistered.scope), { name: 'InvalidStateError' });
  unregistered.resources.transferred = false; unregistered.resources.extrasRetired = true;
  assert.throws(() => registerViewportXr(unregistered.viewport, unregistered.resources, unregistered.scope), { name: 'InvalidStateError' });
  unregistered.resources.extrasRetired = false;
  registerViewportXr(unregistered.viewport, unregistered.resources, unregistered.scope);
  assert.equal(f.resources.transferred, false); assert.deepEqual(f.effects, []);
  assert.deepEqual(unregistered.effects, []);
});

test('pending data preparation at consumption preserves the original snapshot for a later current retry', () => {
  const f = fixture(), prepared = captureViewportXrPreparation(f.viewport, false);
  assert.throws(() => consumeViewportXrPreparation(prepared, true), { code: 'busy' });
  assert.equal(isViewportXrPreparationCurrent(prepared), true);
  assert.equal(f.resources.transferred, false); assert.equal(f.resources.extrasRetired, false);
  assert.deepEqual(f.effects, []);
  assert.equal(consumeViewportXrPreparation(prepared, false), f.resources);
  assert.equal(f.resources.transferred, true); assert.deepEqual(f.effects, []);
});

test('native consumption transfers once, aborts exact token reuse and makes sibling snapshots busy', () => {
  const f = fixture(), first = captureViewportXrPreparation(f.viewport, false);
  const sibling = captureViewportXrPreparation(f.viewport, false);
  assert.equal(consumeViewportXrPreparation(first, false), f.resources);
  assert.equal(f.resources.transferred, true); assert.equal(f.resources.extrasRetired, false);
  assert.equal(isViewportXrPreparationCurrent(first), false); assert.equal(isViewportXrPreparationCurrent(sibling), false);
  assert.throws(() => consumeViewportXrPreparation(first, false), { code: 'aborted' });
  assert.throws(() => consumeViewportXrPreparation(sibling, false), { code: 'busy' });
  assert.throws(() => captureViewportXrPreparation(f.viewport, false), { code: 'busy' });
  releaseViewportXrPreparation(first); releaseViewportXrPreparation(sibling);
  assert.deepEqual(f.effects, []);
});

test('inline invalidation aborts old snapshots and permits a new snapshot without disposing resources', () => {
  const f = fixture(), old = captureViewportXrPreparation(f.viewport, false);
  invalidateViewportXr(f.viewport); invalidateViewportXr(f.viewport);
  assert.equal(isViewportXrPreparationCurrent(old), false);
  assert.throws(() => consumeViewportXrPreparation(old, false), { code: 'aborted' });
  assert.equal(f.resources.transferred, false); assert.deepEqual(f.effects, []);
  const current = captureViewportXrPreparation(f.viewport, false);
  releaseViewportXrPreparation(old); assert.equal(isViewportXrPreparationCurrent(current), true);
  assert.equal(consumeViewportXrPreparation(current, false), f.resources);
  assert.deepEqual(f.effects, []);
});

test('unused snapshot release neither reserves nor releases the coordinator preparation lease', () => {
  const f = fixture(), lease = acquireXrPreparation(f.scope);
  try {
    const first = captureViewportXrPreparation(f.viewport, false), second = captureViewportXrPreparation(f.viewport, false);
    releaseViewportXrPreparation(first); releaseViewportXrPreparation(first);
    assert.equal(isViewportXrPreparationCurrent(second), true);
    assert.throws(() => acquireXrPreparation(f.scope), { code: 'busy' });
    const fresh = captureViewportXrPreparation(f.viewport, false);
    releaseViewportXrPreparation(second);
    assert.equal(consumeViewportXrPreparation(fresh, false), f.resources);
    assert.throws(() => acquireXrPreparation(f.scope), { code: 'busy' });
    assert.deepEqual(f.effects, []);
  } finally { releaseXrPreparation(lease); }
  const freshLease = acquireXrPreparation(f.scope); releaseXrPreparation(freshLease);
});

test('unregister closes snapshots permanently and never revives the same viewport identity', () => {
  const f = fixture(), prepared = captureViewportXrPreparation(f.viewport, false);
  unregisterViewportXr(f.viewport); unregisterViewportXr(f.viewport);
  assert.equal(isViewportXrPreparationCurrent(prepared), false);
  assert.throws(() => consumeViewportXrPreparation(prepared, false), { code: 'aborted' });
  assert.throws(() => captureViewportXrPreparation(f.viewport, false), { code: 'aborted' });
  assert.throws(() => registerViewportXr(f.viewport, fixture(false).resources, {}), { name: 'InvalidStateError' });
  assert.equal(f.resources.transferred, false); assert.equal(f.resources.extrasRetired, false);
  assert.deepEqual(f.effects, []);
});

test('unregister and invalidation after native consumption leave resources with native cleanup', () => {
  const f = fixture(), prepared = captureViewportXrPreparation(f.viewport, false);
  const sibling = captureViewportXrPreparation(f.viewport, false);
  consumeViewportXrPreparation(prepared, false);
  invalidateViewportXr(f.viewport); unregisterViewportXr(f.viewport); invalidateViewportXr(f.viewport);
  assert.equal(f.resources.transferred, true); assert.equal(f.resources.extrasRetired, false);
  assert.throws(() => captureViewportXrPreparation(f.viewport, false), { code: 'aborted' });
  assert.throws(() => consumeViewportXrPreparation(sibling, false), { code: 'aborted' });
  assert.throws(() => consumeViewportXrPreparation(prepared, false), { code: 'aborted' });
  assert.deepEqual(f.effects, []);
});

test('independent viewport identities preserve their own original epochs and resource records', () => {
  const a = fixture(), b = fixture();
  const first = captureViewportXrPreparation(a.viewport, false), second = captureViewportXrPreparation(b.viewport, false);
  invalidateViewportXr(a.viewport);
  assert.equal(isViewportXrPreparationCurrent(first), false); assert.equal(isViewportXrPreparationCurrent(second), true);
  assert.equal(consumeViewportXrPreparation(second, false), b.resources);
  assert.equal(a.resources.transferred, false); assert.equal(b.resources.transferred, true);
  const fresh = captureViewportXrPreparation(a.viewport, false);
  assert.equal(consumeViewportXrPreparation(fresh, false), a.resources);
  assert.deepEqual(a.effects, []); assert.deepEqual(b.effects, []);
});
