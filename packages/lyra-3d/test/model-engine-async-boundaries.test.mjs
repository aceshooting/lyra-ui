import assert from 'node:assert/strict';
import test from 'node:test';
import { Group, Scene } from 'three';
import { createModelEngine } from '../dist/model/engine.js';
import { admitModel, ModelAdmissionError } from '../dist/model/admission.js';
import { prepareModel } from '../dist/model/model-preparation.js';
import { snapshotModelInput } from '../dist/model/model-admission-policy.js';
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


for (const mode of ['prepared', 'native']) test(`installed ${mode} materials and highlights are released exactly once`, bounded, async () => {
  const h = harness(); await h.engine.mount({}, h.host);
  const data = input(); const model = mode === 'prepared' ? await prepareModel(snapshotModelInput(data.bytes, data.format), {}, { worker: () => undefined }) : await native();
  const original = model.object.children[0].material; let originalCount = 0;
  original.addEventListener('dispose', () => originalCount++);
  const pending = h.engine.setDataAsync(data, 0); (await h.preparation.next()).resolve(model); await pending;
  const painted = model.object.children[0].material; let paintCount = 0;
  assert.notEqual(painted, original); painted.addEventListener('dispose', () => paintCount++);
  h.engine.setState({ selected: new Set([0]), dimmed: new Set(), hover: -1, focus: -1 });
  const highlight = model.object.children[0].material; let highlightCount = 0;
  assert.notEqual(highlight, painted); highlight.addEventListener('dispose', () => highlightCount++);
  const next = h.engine.setDataAsync(input(), 1); (await h.preparation.next()).resolve(await native()); await next;
  assert.equal(paintCount, 1); assert.equal(highlightCount, 1); assert.equal(originalCount, 1);
  h.engine.dispose(); assert.equal(paintCount, 1); assert.equal(highlightCount, 1); assert.equal(originalCount, 1);
});

test('an abort after the synchronous commit cannot reject an installed model', bounded, async () => {
  const h = harness(); await h.engine.mount({}, h.host);
  const first = await native(), next = await native();
  const initial = h.engine.setDataAsync(input(), 0); (await h.preparation.next()).resolve(first); await initial;
  const abort = new AbortController(); const pending = h.engine.setDataAsync(input(), 1, { signal: abort.signal });
  (await h.preparation.next()).resolve(next);
  queueMicrotask(() => { assert.equal(next.object.parent, h.world); abort.abort(); });
  await pending; assert.equal(next.object.parent, h.world); assert.equal(first.object.parent, null);
  assert.equal(h.events.filter(event => event[0] === 'progress').length, 2); h.engine.dispose();
});

test('progress-triggered cancellation observes completed installation', bounded, async () => {
  const h = harness(), abort = new AbortController();
  const progress = h.host.progress; h.host.progress = (...args) => { progress(...args); abort.abort(); };
  await h.engine.mount({}, h.host); const model = await native();
  const pending = h.engine.setDataAsync(input(), 0, { signal: abort.signal }); (await h.preparation.next()).resolve(model);
  await pending; assert.equal(model.object.parent, h.world); assert.equal(h.events.filter(event => event[0] === 'progress').length, 1); h.engine.dispose();
});

test('input getters cannot supersede a newer accepted revision', bounded, async () => {
  const h = harness(); let inner;
  const bytes = input().bytes;
  const outer = h.engine.setDataAsync({ format: 'obj', get bytes() { inner = h.engine.setDataAsync(input(), 2); return bytes; } }, 1);
  const innerOutcome = inner.then(() => null, error => error);
  void outer.catch(() => {});
  assert.equal(h.preparation.length, 1);
  await assert.rejects(outer, RangeError); const job = await h.preparation.next(); assert.equal(job.options.signal.aborted, false);
  job.resolve(await native()); assert.equal(await innerOutcome, null);
  await assert.rejects(h.engine.setDataAsync(input(), 2), RangeError); h.engine.dispose();
});

test('input getters cannot accept work after disposing the engine', bounded, async () => {
  const h = harness(), bytes = input().bytes;
  const pending = h.engine.setDataAsync({ format: 'obj', get bytes() { h.engine.dispose(); return bytes; } }, 0);
  void pending.catch(() => {}); assert.equal(h.preparation.length, 0);
  await assert.rejects(pending, { name: 'AbortError' });
});

test('the original signal is captured once and its listener is removed on completion', bounded, async () => {
  const h = harness(), original = new AbortController(), replacement = new AbortController();
  const added = new Set(); const add = original.signal.addEventListener.bind(original.signal), remove = original.signal.removeEventListener.bind(original.signal);
  original.signal.addEventListener = (type, callback, options) => { if (type === 'abort') added.add(callback); add(type, callback, options); };
  original.signal.removeEventListener = (type, callback, options) => { if (type === 'abort') added.delete(callback); remove(type, callback, options); };
  let reads = 0, signal = original.signal;
  const options = { get signal() { reads++; return signal; } };
  const pending = h.engine.setDataAsync(input(), 0, options); const job = await h.preparation.next();
  signal = replacement.signal; job.resolve(await native()); await pending;
  assert.equal(added.size, 0); assert.equal(reads, 1); original.abort(); h.engine.dispose();
});
