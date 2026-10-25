import assert from 'node:assert/strict';
import test from 'node:test';
import { Group, Scene } from 'three';
import { createModelEngine } from '../dist/model/engine.js';
import { admitModel, ModelAdmissionError } from '../dist/model/admission.js';
import { parseModel } from '../dist/model/model-parsers.js';
import { DEFAULT_ORBIT_CAMERA } from '../dist/core/orbit.js';
import { resolveLyra3dStyle } from '../dist/core/style.js';

const input = () => ({ format: 'obj', bytes: new TextEncoder().encode('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n') });
const native = async () => { const data = input(); return parseModel(admitModel(data.bytes, data.format)); };
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function queue() { const entries = [], waiters = []; return { push(value) { const waiter = waiters.shift(); if (waiter) waiter(value); else entries.push(value); }, next() { return entries.length ? Promise.resolve(entries.shift()) : new Promise(resolve => waiters.push(resolve)); }, get length() { return entries.length; } }; }
function harness() {
  const preparation = queue(), parsing = queue(), progress = queue(), events = [];
  const world = new Group(), scene = new Scene(); scene.add(world);
  const viewport = { world, scene, width: 640, height: 480, orbit: DEFAULT_ORBIT_CAMERA, style: resolveLyra3dStyle(), lost: false,
    setStyle(value) { this.style = resolveLyra3dStyle(value); }, setOrbit(value) { this.orbit = value; }, invalidate() {}, dispose() {}, resize() {}, project() { return null; },
  };
  const engine = createModelEngine({ viewport: () => viewport,
    prepare(owned, options) { const result = deferred(); preparation.push({ owned, options, ...result }); return result.promise; },
    parse(admitted, options) { const result = deferred(); parsing.push({ admitted, options, ...result }); return result.promise; },
  });
  const host = { hover() {}, pick() {}, camera() {}, progress(...value) { events.push(['progress', ...value]); progress.push(value); }, lost(...value) { events.push(['lost', ...value]); } };
  return { engine, host, world, preparation, parsing, progress, events };
}
const bounded = { timeout: 5000 };

test('setDataAsync is additive, always returns a Promise, and snapshots accepted input before returning', bounded, async () => {
  const h = harness(); assert.equal(typeof h.engine.setDataAsync, 'function');
  const rejected = h.engine.setDataAsync({ format: 'unsupported', bytes: new Uint8Array() }, 0);
  assert.ok(rejected instanceof Promise); await assert.rejects(rejected, error => error instanceof ModelAdmissionError && error.code === 'unsupported');
  const data = input(), before = data.bytes.slice(); const pending = h.engine.setDataAsync(data, 0); data.bytes.fill(0);
  const job = await h.preparation.next(); assert.deepEqual(job.owned.bytes, before); assert.notEqual(job.owned.bytes.buffer, data.bytes.buffer);
  job.resolve(await native()); await pending; h.engine.dispose();
});
test('accepted deep failure consumes its revision and preserves the previously installed scene', bounded, async () => {
  const h = harness(); await h.engine.mount({}, h.host);
  const first = await native(); const installed = h.engine.setDataAsync(input(), 0); (await h.preparation.next()).resolve(first); await installed;
  assert.equal(first.object.parent, h.world);
  const failed = h.engine.setDataAsync(input(), 1); (await h.preparation.next()).reject(new ModelAdmissionError('limit'));
  await assert.rejects(failed, error => error.code === 'limit'); assert.equal(first.object.parent, h.world);
  await assert.rejects(h.engine.setDataAsync(input(), 1), RangeError);
  assert.deepEqual(h.events.filter(event => event[0] === 'lost'), [['lost', 'error', 'model-parse-failed']]);
  const next = h.engine.setDataAsync(input(), 2); (await h.preparation.next()).resolve(await native()); await next; h.engine.dispose();
});
test('basic async refusal leaves pending legacy work and the same next revision available', bounded, async () => {
  const h = harness(); await h.engine.mount({}, h.host); h.engine.setData(input(), 0); const legacy = await h.parsing.next();
  await assert.rejects(h.engine.setDataAsync({ format: 'unsupported', bytes: new Uint8Array() }, 1)); assert.equal(legacy.options.signal.aborted, false);
  legacy.resolve(await native()); await h.progress.next();
  const pending = h.engine.setDataAsync(input(), 1); const job = await h.preparation.next();
  assert.throws(() => h.engine.setData({ format: 'obj', bytes: new TextEncoder().encode('mtllib forbidden') }, 2)); assert.equal(job.options.signal.aborted, false);
  job.resolve(await native()); await pending; h.engine.dispose();
});
test('external abort rejects promptly, keeps the installed scene, and disposes a late candidate once', bounded, async () => {
  const h = harness(); await h.engine.mount({}, h.host); const first = await native();
  const installed = h.engine.setDataAsync(input(), 0); (await h.preparation.next()).resolve(first); await installed;
  const controller = new AbortController(); const pending = h.engine.setDataAsync(input(), 1, { signal: controller.signal }); const job = await h.preparation.next();
  controller.abort(); await assert.rejects(pending, { name: 'AbortError' }); assert.equal(first.object.parent, h.world); assert.equal(job.options.signal.aborted, true);
  const late = await native(), closed = deferred(); let disposals = 0; late.object.children[0].geometry.addEventListener('dispose', () => { disposals++; closed.resolve(); });
  job.resolve(late); await closed.promise; assert.equal(disposals, 1); assert.equal(h.events.filter(event => event[0] === 'lost').length, 0);
  await assert.rejects(h.engine.setDataAsync(input(), 1), RangeError); h.engine.dispose();
});
test('an accepted legacy replacement supersedes pending async preparation without stale events', bounded, async () => {
  const h = harness(); await h.engine.mount({}, h.host); const pending = h.engine.setDataAsync(input(), 0); const job = await h.preparation.next();
  h.engine.setData(input(), 1); await assert.rejects(pending, { name: 'AbortError' }); const legacy = await h.parsing.next(); legacy.resolve(await native()); await h.progress.next();
  const late = await native(), closed = deferred(); late.object.children[0].geometry.addEventListener('dispose', () => closed.resolve()); job.resolve(late); await closed.promise;
  assert.equal(h.events.filter(event => event[0] === 'progress').length, 1); assert.equal(h.events.filter(event => event[0] === 'lost').length, 0); h.engine.dispose();
});
test('pre-abort reserves nothing; disposal rejects accepted work and owns late cleanup', bounded, async () => {
  const h = harness(); const controller = new AbortController(); controller.abort();
  await assert.rejects(h.engine.setDataAsync(input(), 0, { signal: controller.signal }), { name: 'AbortError' }); assert.equal(h.preparation.length, 0);
  const pending = h.engine.setDataAsync(input(), 0); const job = await h.preparation.next(); h.engine.dispose(); await assert.rejects(pending, { name: 'AbortError' });
  const late = await native(), closed = deferred(); late.object.children[0].geometry.addEventListener('dispose', () => closed.resolve()); job.resolve(late); await closed.promise;
  await assert.rejects(h.engine.setDataAsync(input(), 1), { name: 'AbortError' }); assert.deepEqual(h.events, []);
});
test('pre-mount async completion stores an owned model and reports progress only through the eventual host', bounded, async () => {
  const h = harness(), model = await native(); const pending = h.engine.setDataAsync(input(), 0); (await h.preparation.next()).resolve(model); await pending;
  assert.equal(model.object.parent, null); assert.deepEqual(h.events, []); await h.engine.mount({}, h.host);
  assert.equal(model.object.parent, h.world); assert.equal(h.events.filter(event => event[0] === 'progress').length, 1); h.engine.dispose();
});
