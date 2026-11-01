import assert from 'node:assert/strict';
import test from 'node:test';
import { PerspectiveCamera, Scene } from 'three';
import {
  createViewportResources,
  replaceViewportGlow,
  restoreViewportContextMethods,
  retireViewportExtras,
  viewportResourceRetirement,
} from '../dist/core/viewport-resources.js';

function fixture() {
  const calls = [];
  const renderer = {
    dispose() { calls.push('renderer-dispose'); },
    render() { calls.push('renderer-render'); },
    setAnimationLoop() { calls.push('renderer-loop'); },
    forceContextLoss() { calls.push('context-release'); },
    getContext() { calls.push('context-access'); return { getExtension() { calls.push('extension-access'); } }; },
  };
  const canvas = { remove() { calls.push('canvas-remove'); } };
  const scene = new Scene(), pickScene = new Scene(), camera = new PerspectiveCamera();
  for (const [name, value] of [['scene', scene], ['pickScene', pickScene]]) {
    for (const method of ['add', 'remove', 'clear', 'traverse']) {
      const original = value[method].bind(value);
      value[method] = (...args) => { calls.push(`${name}-${method}`); return original(...args); };
    }
  }
  const picker = { dispose() { calls.push('picker-dispose'); } };
  const glow = { dispose() { calls.push('glow-dispose'); }, render() { calls.push('glow-render'); }, resize() { calls.push('glow-resize'); } };
  const restoreContextMethods = () => { calls.push('guard-restore'); };
  const input = { renderer, canvas, scene, pickScene, camera, picker, glow, restoreContextMethods };
  return { calls, input, renderer, canvas, scene, pickScene, camera, picker, glow, resources: createViewportResources(input) };
}
const invalidState = error => error instanceof DOMException && error.name === 'InvalidStateError';

test('viewport resources copy exactly the resource fields and initialise flags without effects', () => {
  const f = fixture(), extra = { extraInputSentinel: {} };
  const input = { ...f.input, ...extra }, resources = createViewportResources(input);
  assert.deepEqual(Object.keys(resources).sort(), [
    'camera', 'canvas', 'extrasRetired', 'glow', 'picker', 'renderer', 'restoreContextMethods', 'scene', 'pickScene', 'transferred',
  ].sort());
  for (const name of Object.keys(f.input)) assert.equal(resources[name], f.input[name]);
  assert.equal(resources.transferred, false); assert.equal(resources.extrasRetired, false);
  assert.equal('extraInputSentinel' in resources, false);
  input.glow = undefined; assert.equal(resources.glow, f.glow);
  assert.deepEqual(f.calls, []);
});

test('viewport glow exchange returns old ownership and identical exchange is effect-free', () => {
  const f = fixture(), next = { dispose() { f.calls.push('next-dispose'); } };
  assert.equal(replaceViewportGlow(f.resources, next), f.glow); assert.equal(f.resources.glow, next);
  assert.equal(replaceViewportGlow(f.resources, next), undefined); assert.equal(f.resources.glow, next);
  assert.equal(replaceViewportGlow(f.resources, undefined), next); assert.equal(f.resources.glow, undefined);
  assert.equal(replaceViewportGlow(f.resources, undefined), undefined);
  assert.deepEqual(f.calls, []);
});

test('transferred viewport resources refuse glow exchange without touching either owned handle', () => {
  const f = fixture(), next = { dispose() { f.calls.push('rejected-dispose'); } };
  f.resources.transferred = true;
  assert.throws(() => replaceViewportGlow(f.resources, next), invalidState);
  assert.equal(f.resources.glow, f.glow); assert.deepEqual(f.calls, []);
  next.dispose(); assert.deepEqual(f.calls, ['rejected-dispose']);
});

test('viewport extras clear owned handles before glow then picker cleanup and retain context guards', () => {
  const f = fixture(), guard = f.resources.restoreContextMethods;
  const assertTaken = () => {
    assert.equal(f.resources.extrasRetired, true); assert.equal(f.resources.glow, undefined); assert.equal(f.resources.picker, undefined);
    assert.equal(f.resources.restoreContextMethods, guard);
  };
  f.glow.dispose = () => { assertTaken(); f.calls.push('glow-dispose'); };
  f.picker.dispose = () => { assertTaken(); f.calls.push('picker-dispose'); };
  retireViewportExtras(f.resources);
  assert.deepEqual(f.calls, ['glow-dispose', 'picker-dispose']); assert.equal(f.resources.restoreContextMethods, guard);
});

test('reentrant extras retirement and throwing reentrant guard restoration each run at most once', () => {
  const f = fixture(), failure = new Error('Guard restoration failure'); let guards = 0;
  f.resources.restoreContextMethods = () => {
    guards++; assert.equal(f.resources.restoreContextMethods, undefined);
    restoreViewportContextMethods(f.resources); throw failure;
  };
  const guard = f.resources.restoreContextMethods;
  assert.throws(() => restoreViewportContextMethods(f.resources), invalidState);
  assert.equal(f.resources.restoreContextMethods, guard); assert.equal(guards, 0);
  f.glow.dispose = () => { f.calls.push('glow-dispose'); retireViewportExtras(f.resources); };
  f.picker.dispose = () => { f.calls.push('picker-dispose'); retireViewportExtras(f.resources); };
  retireViewportExtras(f.resources); retireViewportExtras(f.resources);
  assert.deepEqual(f.calls, ['glow-dispose', 'picker-dispose']);
  f.renderer.dispose();
  assert.throws(() => restoreViewportContextMethods(f.resources), error => error === failure);
  restoreViewportContextMethods(f.resources); assert.equal(guards, 1);
});

test('extras cleanup attempts both destructors and rethrows the first original error while retaining guards', () => {
  const f = fixture(), first = new Error('Glow failure'), second = new Error('Picker failure');
  const guard = f.resources.restoreContextMethods;
  f.glow.dispose = () => { f.calls.push('glow-dispose'); throw first; };
  f.picker.dispose = () => { f.calls.push('picker-dispose'); throw second; };
  assert.throws(() => retireViewportExtras(f.resources), error => error === first);
  assert.deepEqual(f.calls, ['glow-dispose', 'picker-dispose']);
  assert.equal(f.resources.glow, undefined); assert.equal(f.resources.picker, undefined);
  assert.equal(f.resources.restoreContextMethods, guard); retireViewportExtras(f.resources);
  f.renderer.dispose(); restoreViewportContextMethods(f.resources);
  assert.deepEqual(f.calls, ['glow-dispose', 'picker-dispose', 'renderer-dispose', 'guard-restore']);
});

test('extras retirement leaves renderer context scenes and canvas to their independent owners', () => {
  const f = fixture();
  retireViewportExtras(f.resources);
  assert.deepEqual(f.calls, ['glow-dispose', 'picker-dispose']);
  for (const name of ['renderer', 'canvas', 'scene', 'pickScene', 'camera']) assert.equal(f.resources[name], f[name]);
  f.resources.renderer.dispose(); restoreViewportContextMethods(f.resources);
  assert.deepEqual(f.calls, ['glow-dispose', 'picker-dispose', 'renderer-dispose', 'guard-restore']);
  assert.equal(f.resources.restoreContextMethods, undefined);
});

test('resource retirement callbacks are receiverless and idempotent and retired glow exchange refuses new ownership', () => {
  const f = fixture(), other = fixture(), retirement = viewportResourceRetirement(f.resources);
  assert.equal(typeof retirement, 'function'); assert.deepEqual(f.calls, []);
  retirement(); retirement.call({ unrelated: true });
  assert.deepEqual(f.calls, ['glow-dispose', 'picker-dispose']); assert.deepEqual(other.calls, []);
  const next = { dispose() { f.calls.push('rejected-dispose'); } };
  assert.throws(() => replaceViewportGlow(f.resources, next), invalidState);
  assert.equal(f.resources.glow, undefined); assert.equal(f.resources.extrasRetired, true);
  next.dispose(); assert.deepEqual(f.calls, ['glow-dispose', 'picker-dispose', 'rejected-dispose']);
  const otherRetirement = viewportResourceRetirement(other.resources); otherRetirement();
  assert.deepEqual(other.calls, ['glow-dispose', 'picker-dispose']);
});
