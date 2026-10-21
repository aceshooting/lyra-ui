import assert from 'node:assert/strict';
import { test } from 'node:test';
import { guardContextEpoch } from '../dist/core/context-epoch.js';

function fixture() {
  const canvas = new EventTarget(); let lost = false; const calls = [];
  const context = { canvas, isContextLost: () => lost };
  for (const [create, remove] of [['createBuffer', 'deleteBuffer'], ['fenceSync', 'deleteSync']]) {
    context[create] = function (...args) { if (this !== context) throw new TypeError('receiver'); const handle = lost ? null : {}; calls.push({ name: create, args, handle }); return handle; };
    context[remove] = function (handle) { if (this !== context) throw new TypeError('receiver'); calls.push({ name: remove, handle }); if (handle?.invalid) throw new Error('native invalid'); };
  }
  const change = value => { lost = value; canvas.dispatchEvent(new Event(value ? 'webglcontextlost' : 'webglcontextrestored')); };
  return { context, canvas, calls, change };
}
test('only skips already destroyed handles belonging to this context and resource family', () => {
  const { context, calls, change } = fixture(); const release = guardContextEpoch(context);
  const old = context.createBuffer(); context.deleteBuffer(old); assert.equal(calls.filter(call => call.name === 'deleteBuffer').length, 1);
  change(true); change(false); context.deleteBuffer(old); assert.equal(calls.filter(call => call.name === 'deleteBuffer').length, 1);
  const current = context.createBuffer(); context.deleteBuffer(current); context.deleteBuffer(null); context.deleteBuffer({ foreign: true }); context.deleteSync(old);
  assert.equal(calls.filter(call => call.name === 'deleteBuffer').length, 4); assert.equal(calls.at(-1).name, 'deleteSync');
  current.invalid = true; assert.throws(() => context.deleteBuffer(current), /native invalid/);
  assert.throws(() => context.deleteBuffer({ invalid: true, foreign: true }), /native invalid/); release();
});
test('forwards borrowed receivers, native errors, sync arguments and return values', () => {
  const { context, calls, change } = fixture(); const release = guardContextEpoch(context);
  const sync = context.fenceSync(11, 22); assert.deepEqual(calls.at(-1).args, [11, 22]); assert.equal(calls.at(-1).handle, sync);
  const buffer = context.createBuffer(); change(true); change(false);
  assert.throws(() => context.deleteBuffer.call({}, buffer), /receiver/); assert.throws(() => context.createBuffer.call({}), /receiver/);
  context.deleteSync(sync); assert.equal(calls.filter(call => call.name === 'deleteSync').length, 0); release();
});
test('synthetic and duplicate loss events do not retire live handles', () => {
  const { context, canvas, calls, change } = fixture(); const release = guardContextEpoch(context);
  const first = context.createBuffer(); canvas.dispatchEvent(new Event('webglcontextlost')); context.deleteBuffer(first);
  assert.equal(calls.filter(call => call.name === 'deleteBuffer').length, 1);
  change(true); canvas.dispatchEvent(new Event('webglcontextlost')); assert.equal(context.createBuffer(), null); change(false);
  const next = context.createBuffer(); canvas.dispatchEvent(new Event('webglcontextlost')); context.deleteBuffer(next);
  assert.equal(calls.filter(call => call.name === 'deleteBuffer').length, 2); release();
});
test('restores exact own descriptors and supports idempotent cleanup without clobbering later wrappers', () => {
  const { context, canvas, calls, change } = fixture(); const descriptor = Object.getOwnPropertyDescriptor(context, 'createBuffer');
  const inherited = context.deleteBuffer; delete context.deleteBuffer; Object.setPrototypeOf(context, { deleteBuffer: inherited });
  const release = guardContextEpoch(context); const created = context.createBuffer(); release(); release();
  assert.deepEqual(Object.getOwnPropertyDescriptor(context, 'createBuffer'), descriptor); assert.equal(Object.hasOwn(context, 'deleteBuffer'), false);
  change(true); change(false); context.deleteBuffer(created); assert.equal(calls.filter(call => call.name === 'deleteBuffer').length, 1);
  const second = guardContextEpoch(context); const later = () => {}; context.createBuffer = later; second(); assert.equal(context.createBuffer, later);
  canvas.dispatchEvent(new Event('webglcontextlost'));
});
test('partial installation failure restores methods already wrapped', () => {
  const { context } = fixture(); const before = Object.getOwnPropertyDescriptor(context, 'createBuffer');
  Object.defineProperty(context, 'deleteBuffer', { value: context.deleteBuffer, configurable: false, writable: false });
  assert.throws(() => guardContextEpoch(context), TypeError); assert.deepEqual(Object.getOwnPropertyDescriptor(context, 'createBuffer'), before);
});
