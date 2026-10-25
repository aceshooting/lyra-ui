import assert from 'node:assert/strict';
import test from 'node:test';
import { ModelAdmissionError, admitModel } from '../dist/model/admission.js';
import { snapshotModelInput } from '../dist/model/model-admission-policy.js';
import { prepareModel } from '../dist/model/model-preparation.js';
import { parseModel } from '../dist/model/model-parsers.js';
import { serveModelPreparation } from '../dist/model/model.worker.js';
import { decodeOwnedModel } from '../dist/model/model-preparation-kernel.js';
import { runModelWork } from '../dist/model/model-work-runner.js';
import { utf8, triangleJson } from './model-fixtures.mjs';
import { plyFixture, pcdFixture } from './fixtures/model-prepared-binary.mjs';
import { binaryStl } from './fixtures/model-prepared-text.mjs';

const bounded = { timeout: 10000 };
class FakeWorker extends EventTarget {
  terminations = 0;
  constructor(start) { super(); this.start = start; }
  postMessage(message) { this.message = message; this.start(this, structuredClone(message)); }
  terminate() { this.terminations++; }
  emit(data) { this.dispatchEvent(new MessageEvent('message', { data })); }
  fail() { this.dispatchEvent(new Event('error', { cancelable: true })); }
}
const owned = text => snapshotModelInput(utf8(text), 'xyz');
const ready = (worker, message) => worker.emit({ protocol: 1, job: message.job, type: 'ready' });
function loopback() {
  let receive;
  const worker = new FakeWorker((_worker, message) => queueMicrotask(() => receive({ data: message })));
  serveModelPreparation({ addEventListener(_type, listener) { receive = listener; }, postMessage(message, transfers) { const data = structuredClone(message, { transfer: transfers }); queueMicrotask(() => worker.emit(data)); } });
  return worker;
}
function geometrySnapshot(object) {
  const values = [];
  object.traverse(node => { if (node.geometry) values.push({ kind: node.type, attributes: Object.fromEntries(Object.entries(node.geometry.attributes).map(([name, attribute]) => [name, { array: Array.from(attribute.array), normalized: attribute.normalized, count: attribute.count }])), index: node.geometry.index ? Array.from(node.geometry.index.array) : null }); });
  return values;
}
test('bounded local preparation preserves native all-format output', bounded, async () => {
  const sources = [['xyz', utf8('0 0 0\n1 2 3 128 64 255\n')], ['obj', utf8('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n')], ['ply', plyFixture({ variant: 'binary-be', faces: [[0, 1, 2]] }).input.input.bytes], ['pcd', pcdFixture({ variant: 'binary' }).input.input.bytes], ['stl', binaryStl()], ['gltf', utf8(JSON.stringify(triangleJson()))]];
  for (const [format, bytes] of sources) {
    const reference = await parseModel(admitModel(bytes, format)); let result;
    try { result = await prepareModel(snapshotModelInput(bytes, format), {}, { worker: () => undefined }); assert.deepEqual(geometrySnapshot(result.object), geometrySnapshot(reference.object), format); assert.deepEqual(result.bounds, reference.bounds); } finally { result?.dispose(); reference.dispose(); }
  }
});
test('worker construction and pre-message startup failure use the same local fallback', bounded, async () => {
  let failed;
  for (const factory of [() => { throw new Error('Worker blocked'); }, () => { failed = new FakeWorker(worker => queueMicrotask(() => worker.fail())); return failed; }]) {
    const parsed = await prepareModel(owned('0 0 0'), {}, { worker: factory }); assert.equal(parsed.vertices, 1); parsed.dispose();
  }
  assert.equal(failed.terminations, 1);
});
test('worker protocol transfers owned arrays and preserves mixed XYZ masks', bounded, async () => {
  const worker = loopback(); const parsed = await prepareModel(owned('0 0 0\n1 2 3 128 64 255\n4 5 6'), {}, { worker: () => worker });
  try { assert.equal(parsed.vertices, 3); assert.deepEqual(Array.from(parsed.object.geometry.attributes.color.array.slice(0, 3)), [1, 1, 1]); assert.deepEqual(Array.from(parsed.object.geometry.attributes.color.array.slice(6)), [1, 1, 1]); assert.equal(worker.terminations, 1); } finally { parsed.dispose(); }
});
test('errors after worker readiness fail closed rather than silently retrying locally', bounded, async () => {
  const worker = new FakeWorker((active, message) => queueMicrotask(() => { ready(active, message); active.fail(); }));
  await assert.rejects(prepareModel(owned('0 0 0'), {}, { worker: () => worker }), error => error instanceof ModelAdmissionError && error.code === 'invalid'); assert.equal(worker.terminations, 1);
});
test('wrong jobs and malformed worker descriptors are independently rejected', bounded, async () => {
  for (const change of [value => { value.job++; }, value => { value.descriptor.geometries[0].attributes.position.array = Float32Array.of(0, 0, 0, NaN, 0, 0); }]) {
    const descriptor = await decodeOwnedModel(owned('0 0 0'));
    const worker = new FakeWorker((active, message) => queueMicrotask(() => { ready(active, message); const result = { protocol: 1, job: message.job, type: 'result', descriptor }; change(result); active.emit(result); }));
    await assert.rejects(prepareModel(owned('0 0 0'), {}, { worker: () => worker }), ModelAdmissionError); assert.equal(worker.terminations, 1);
  }
});
test('abort terminates an active worker promptly and ignores its late completion', bounded, async () => {
  let entered; const started = new Promise(resolve => { entered = resolve; }); const controller = new AbortController();
  const worker = new FakeWorker((active, message) => { ready(active, message); entered(message); });
  const pending = prepareModel(owned('0 0 0'), { signal: controller.signal }, { worker: () => worker }); const message = await started;
  controller.abort(); await assert.rejects(pending, { name: 'AbortError' });
  worker.emit({ protocol: 1, job: message.job, type: 'result', descriptor: await decodeOwnedModel(owned('1 2 3')) }); assert.equal(worker.terminations, 1);
});
test('genuine admission refusal happens before worker construction', bounded, async () => {
  let created = 0;
  await assert.rejects(prepareModel(snapshotModelInput(utf8('mtllib forbidden'), 'obj'), {}, { worker: () => { created++; return loopback(); } }), error => error.code === 'external-resource'); assert.equal(created, 0);
});
test('worker independently refuses unsupported input', bounded, async () => {
  let receive; let finish; const result = new Promise(resolve => { finish = resolve; });
  serveModelPreparation({ addEventListener(_type, listener) { receive = listener; }, postMessage(message) { if (message.type === 'error') finish(message); } });
  receive({ data: { protocol: 1, job: 1, type: 'start', input: snapshotModelInput(utf8('mtllib forbidden'), 'obj') } });
  assert.deepEqual(await result, { protocol: 1, job: 1, type: 'error', code: 'external-resource' });
});
test('the real bounded runner yields to queued input and disposes cancelled work', bounded, async () => {
  const controller = new AbortController(); let steps = 0; let disposed = 0; let inputTick = false;
  const pending = runModelWork({ step() { steps++; return { done: false, used: { bytes: 1, scalars: 0, records: 0 } }; }, dispose() { disposed++; } }, controller.signal);
  setTimeout(() => { inputTick = true; controller.abort(); }, 0);
  await assert.rejects(pending, { name: 'AbortError' }); assert.ok(inputTick); assert.ok(steps > 0); assert.equal(disposed, 1);
});

test('worker results transfer each owned buffer once, including the XYZ authored-row mask', bounded, async () => {
  let receive, finish; const completed = new Promise(resolve => { finish = resolve; });
  serveModelPreparation({ addEventListener(_type, listener) { receive = listener; }, postMessage(message, transfers) {
    if (message.type !== 'result') return;
    assert.equal(new Set(transfers).size, transfers.length); assert.equal(transfers.length, 3);
    const originals = transfers.slice(); const transferred = structuredClone(message, { transfer: transfers });
    assert.ok(originals.every(buffer => buffer.byteLength === 0)); finish(transferred);
  } });
  receive({ data: { protocol: 1, job: 2, type: 'start', input: owned('0 0 0\n1 2 3 128 64 255') } });
  const result = await completed; assert.deepEqual(Array.from(result.descriptor.geometries[0].attributes.color.colorConversion.authoredRows), [0, 1]);
});

for (const code of ['invalid', 'limit', 'unsupported', 'external-resource', 'unexpected-code']) test(`ready worker ${code} response fails closed and retires its listeners`, bounded, async () => {
  const worker = new FakeWorker((active, message) => queueMicrotask(() => { ready(active, message); active.emit({ protocol: 1, job: message.job, type: 'error', code }); }));
  let creations = 0;
  await assert.rejects(prepareModel(owned('0 0 0'), {}, { worker: () => { creations++; return worker; } }), error => error instanceof ModelAdmissionError && error.code === (code === 'unexpected-code' ? 'invalid' : code));
  assert.equal(creations, 1); assert.equal(worker.terminations, 1);
  worker.emit({ protocol: 1, job: worker.message.job, type: 'result', descriptor: await decodeOwnedModel(owned('1 2 3')) });
  worker.fail(); assert.equal(worker.terminations, 1, 'late messages and failures cannot re-enter completion or fallback');
});

test('worker admission ignores invalid envelopes and cannot accept a second job', bounded, async () => {
  let receive; let finish; const messages = [];
  const completed = new Promise(resolve => { finish = resolve; });
  serveModelPreparation({ addEventListener(_type, listener) { receive = listener; }, postMessage(message) { messages.push(message); if (message.type === 'error') finish(); } });
  for (const data of [null, {}, { protocol: 2, type: 'start', job: 1 }, { protocol: 1, type: 'result', job: 1 }, { protocol: 1, type: 'start', job: 0 }, { protocol: 1, type: 'start', job: 1.5 }]) receive({ data });
  assert.deepEqual(messages, [], 'invalid envelopes do not reserve a worker job');
  receive({ data: { protocol: 1, type: 'start', job: 7 } });
  receive({ data: { protocol: 1, type: 'start', job: 8, input: owned('1 2 3') } });
  await completed;
  assert.deepEqual(messages, [{ protocol: 1, job: 7, type: 'ready' }, { protocol: 1, job: 7, type: 'error', code: 'invalid' }]);
});

test('worker result transport failure reports invalid and retains single-job ownership', bounded, async () => {
  let receive; let finish; let resultAttempts = 0; const messages = [];
  const completed = new Promise(resolve => { finish = resolve; });
  serveModelPreparation({ addEventListener(_type, listener) { receive = listener; }, postMessage(message) {
    if (message.type === 'result') { resultAttempts++; throw new DOMException('Transfer failed', 'DataCloneError'); }
    messages.push(message); if (message.type === 'error') finish();
  } });
  receive({ data: { protocol: 1, type: 'start', job: 9, input: owned('1 2 3') } });
  await completed;
  receive({ data: { protocol: 1, type: 'start', job: 10, input: owned('4 5 6') } });
  assert.equal(resultAttempts, 1);
  assert.deepEqual(messages, [{ protocol: 1, job: 9, type: 'ready' }, { protocol: 1, job: 9, type: 'error', code: 'invalid' }]);
});
