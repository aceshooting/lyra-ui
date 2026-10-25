import assert from 'node:assert/strict';
import test from 'node:test';
import { readModelJson } from '../dist/model/model-json-work.js';
import { readModelDataUri } from '../dist/model/model-resource-work.js';
import { createModelResourceBudget } from '../dist/model/model-admission-policy.js';
import { createModelGeneratorWork } from '../dist/model/model-work-generator.js';
import { ModelJsonString } from '../dist/model/model-json-string.js';

const utf8 = value => new TextEncoder().encode(value);
function measured(factory, quota = 4096) {
  let advances = 0;
  const work = createModelGeneratorWork(function* () {
    const iterator = factory();
    try {
      for (;;) {
        advances++;
        const next = iterator.next();
        if (next.done) return next.value;
        yield next.value;
      }
    } finally { iterator.return(); }
  });
  const used = { bytes: 0, scalars: 0, records: 0 };
  for (;;) {
    const step = work.step({ bytes: quota, scalars: quota, records: quota });
    for (const key of Object.keys(used)) { assert.ok(step.used[key] <= quota); used[key] += step.used[key]; }
    if (step.done) return { value: step.value, advances, used };
    assert.ok(step.used.bytes + step.used.scalars + step.used.records > 0);
  }
}
test('large JSON strings advance the generator at block boundaries instead of per character', () => {
  const text = 'A'.repeat(256 * 1024);
  const source = `{"value":"${text}"}`;
  const result = measured(() => readModelJson(utf8(source)));
  assert.ok(result.value.value instanceof ModelJsonString);
  assert.equal(result.value.value.chunks.join(''), text);
  assert.ok(result.advances < text.length / 64, `${result.advances} generator advances`);
});
test('long escaped strings, decimal tokens and whitespace also batch generator dispatch', () => {
  for (const source of [
    `{"value":"${'\\u0041'.repeat(16384)}"}`,
    `{"value":1${'0'.repeat(65536)}e-65536}`,
    `${' '.repeat(65536)}{"value":1}`,
  ]) {
    const result = measured(() => readModelJson(utf8(source)));
    const value = result.value.value instanceof ModelJsonString ? result.value.value.chunks.join('') : result.value.value;
    assert.equal(value, JSON.parse(source).value);
    assert.ok(result.advances < source.length / 64, `${result.advances} generator advances`);
  }
});
test('base64 validation and decoding do not resume the generator per scalar or quartet', () => {
  const bytes = Uint8Array.from({ length: 96 * 1024 }, (_, index) => index & 255);
  const uri = `data:application/octet-stream;base64,${Buffer.from(bytes).toString('base64')}`;
  const result = measured(() => readModelDataUri(uri, ['application/octet-stream'], createModelResourceBudget()));
  assert.deepEqual(result.value.bytes, bytes);
  assert.ok(result.advances < uri.length / 64, `${result.advances} generator advances`);
});
test('tiny and large quotas retain identical values and exact total unit accounting', () => {
  const source = `{"__proto__":4,"value":"${'ab\\u0041\\n'.repeat(600)}","number":-0.000123e+3}`;
  let expected;
  for (const quota of [1, 2, 7, 4096]) {
    const result = measured(() => readModelJson(utf8(source)), quota);
    assert.deepEqual(result.value, JSON.parse(source));
    if (expected) assert.deepEqual(result.used, expected);
    else expected = result.used;
  }
});

test('batch callbacks receive a fixed maximum grant and cannot bypass independent budgets', () => {
  let remaining = 10000; const grants = [];
  const work = createModelGeneratorWork(function* () {
    yield { unit: 'bytes', run(limit) { grants.push(limit); const used = Math.min(limit, remaining); remaining -= used; return { used, done: remaining === 0 }; } };
    yield 'scalars'; yield 'records'; return 1;
  });
  const first = work.step({ bytes: 1, scalars: 1, records: 1 });
  assert.equal(first.done, false); assert.deepEqual(first.used, { bytes: 1, scalars: 0, records: 0 });
  const last = work.step({ bytes: 100000, scalars: 1, records: 1 });
  assert.equal(last.done, true); assert.deepEqual(last.used, { bytes: 9999, scalars: 1, records: 1 });
  assert.ok(grants.every(limit => limit > 0 && limit <= 4096)); assert.ok(grants.length >= 4);
});

test('partial batches release their generator on disposal and remain terminal after failure', () => {
  let calls = 0; let closed = 0;
  const make = throwing => createModelGeneratorWork(function* () {
    try {
      yield { unit: 'scalars', run(limit) { calls++; if (throwing) throw new Error('batch failure'); return { used: limit, done: false }; } };
    } finally { closed++; }
  });
  const work = make(false); assert.equal(work.step({ bytes: 1, scalars: 1, records: 1 }).done, false);
  work.dispose(); work.dispose(); assert.equal(closed, 1); assert.equal(calls, 1);
  assert.throws(() => work.step({ bytes: 1, scalars: 1, records: 1 }), /no longer active/);
  const failed = make(true); assert.throws(() => failed.step({ bytes: 1, scalars: 1, records: 1 }), /batch failure/);
  assert.equal(closed, 2); assert.equal(calls, 2);
  assert.throws(() => failed.step({ bytes: 1, scalars: 1, records: 1 }), /no longer active/);
});

test('batch progress is checked before another callback can run', () => {
  for (const used of [-1, 0, 2, 0.5, NaN]) {
    const work = createModelGeneratorWork(function* () { yield { unit: 'bytes', run() { return { used, done: false }; } }; });
    assert.throws(() => work.step({ bytes: 1, scalars: 1, records: 1 }), /Invalid model batch progress/);
    assert.throws(() => work.step({ bytes: 1, scalars: 1, records: 1 }), /no longer active/);
  }
});
