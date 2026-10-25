import assert from 'node:assert/strict';
import test from 'node:test';
import { admitModel } from '../dist/model/admission.js';
import { createModelAdmissionWork } from '../dist/model/model-admission-kernel.js';
import { createModelResourceBudget, snapshotModelInput } from '../dist/model/model-admission-policy.js';
import { readModelFormatPolicy } from '../dist/model/model-format-policy.js';
import { createModelGeneratorWork } from '../dist/model/model-work-generator.js';
import { drainModelWork, ModelWorkMeter } from '../dist/model/model-work.js';
import { utf8 } from './model-fixtures.mjs';

const budgets = [1, 2, 7, 4096].map(quota => ({ bytes: quota, scalars: quota, records: quota })).concat([{ bytes: 1, scalars: 7, records: 2 }, { bytes: 7, scalars: 2, records: 1 }]);
const pcdHeader = count => `VERSION .7\nFIELDS x y z\nSIZE 4 4 4\nTYPE F F F\nCOUNT 1 1 1\nWIDTH ${count}\nHEIGHT 1\nPOINTS ${count}\nDATA ascii\n`;
function fixture(format, count = 4095) {
  if (format === 'xyz') return utf8('0 0 0 128 64 255\n'.repeat(count));
  if (format === 'obj') return utf8('v 0 0 0\n'.repeat(count) + Array.from({ length: count / 3 }, (_, index) => `f ${index * 3 + 1} ${index * 3 + 2} ${index * 3 + 3}\n`).join(''));
  if (format === 'stl') return utf8(`solid sample\n${'facet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\n'.repeat(count / 3)}endsolid sample\n`);
  if (format === 'ply') return utf8(`ply\nformat ascii 1.0\nelement vertex ${count}\nproperty float x\nproperty float y\nproperty float z\nend_header\n${'0 0 0\n'.repeat(count)}`);
  return utf8(pcdHeader(count) + '0 0 0\n'.repeat(count));
}
for (const format of ['obj', 'stl', 'ply', 'pcd']) test(`${format} text admission batches short lines without per-line generator dispatch`, () => {
  const bytes = fixture(format); const input = snapshotModelInput(bytes, format); const budget = createModelResourceBudget(); let advances = 0;
  const work = createModelGeneratorWork(function* () {
    const iterator = readModelFormatPolicy(input, budget);
    try { for (;;) { advances++; const next = iterator.next(); if (next.done) return next.value; yield next.value; } }
    finally { iterator.return(); }
  });
  assert.equal(drainModelWork(work).format, format); assert.equal(budget.vertices, 4095);
  assert.ok(advances < 4095 / 4, `${advances} generator advances`);
});
test('XYZ shares line batching without per-record meter calls', () => {
  const original = ModelWorkMeter.prototype.take; let takes = 0;
  try {
    ModelWorkMeter.prototype.take = function (...args) { takes++; return original.apply(this, args); };
    assert.equal(drainModelWork(createModelAdmissionWork(snapshotModelInput(fixture('xyz'), 'xyz'))).counts.vertices, 4095);
  } finally { ModelWorkMeter.prototype.take = original; }
  assert.ok(takes < 4095 / 4, `${takes} meter calls`);
});
test('text batches retain exact unit totals and counts across tiny and mixed budgets', () => {
  for (const format of ['xyz', 'obj', 'stl', 'ply', 'pcd']) {
    const bytes = fixture(format, 96); const { format: expectedFormat, ...expectedCounts } = admitModel(bytes, format); let total;
    for (const budget of budgets) {
      const work = createModelAdmissionWork(snapshotModelInput(bytes, format)); const used = { bytes: 0, scalars: 0, records: 0 };
      for (;;) {
        const step = work.step(budget); for (const key of Object.keys(used)) { assert.ok(step.used[key] <= budget[key]); used[key] += step.used[key]; }
        if (step.done) { assert.equal(step.value.plan.format, expectedFormat); assert.deepEqual(step.value.counts, expectedCounts); break; }
        assert.ok(step.used.bytes + step.used.scalars + step.used.records > 0);
      }
      if (total) assert.deepEqual(used, total); else total = used;
    }
  }
});
test('queued later line failures cannot overtake earlier semantic or canonical refusals', () => {
  const long = '#'.repeat(16385) + '\n';
  const cases = [
    ['obj', `usemtl material\n${long}`, 'external-resource'],
    ['obj', `unknown 1\n${long}`, 'unsupported'],
    ['xyz', `0 0 nope\n${long}`, 'invalid'],
    ['xyz', `0 0 0\n${long}`, 'limit'],
    ['pcd', `${pcdHeader(2)} 0 0 0\n${long}`, 'unsupported'],
    ['pcd', `${pcdHeader(2)}nope 0 0\n 0 0 0\n`, 'invalid'],
  ];
  const code = action => { try { action(); return null; } catch (error) { return error.code ?? error.name; } };
  for (const [format, source, expected] of cases) {
    const bytes = utf8(source); assert.equal(code(() => admitModel(bytes, format)), expected);
    for (const budget of budgets) assert.equal(code(() => drainModelWork(createModelAdmissionWork(snapshotModelInput(bytes, format)), budget)), expected);
  }
  const prefix = utf8('usemtl material\n'); const bytes = new Uint8Array(prefix.length + 1); bytes.set(prefix); bytes[prefix.length] = 0xc3;
  for (const budget of budgets) assert.equal(code(() => drainModelWork(createModelAdmissionWork(snapshotModelInput(bytes, 'obj')), budget)), 'invalid');
});
test('line batches preserve line-length boundaries, CRLF, empty input and final blank lines', () => {
  const sources = ['', '\n', '\n\n', '0 0 0', '0 0 0\r\n\n', '#'.repeat(16384), '#'.repeat(16384) + '\n', '#'.repeat(16384) + '\r\n', '#'.repeat(16383) + '\r\n0 0 0\n'];
  const outcome = action => { try { return action(); } catch (error) { return error.code ?? error.name; } };
  for (const source of sources) for (const budget of budgets) {
    const bytes = utf8(source); const expected = outcome(() => admitModel(bytes, 'xyz'));
    const actual = outcome(() => drainModelWork(createModelAdmissionWork(snapshotModelInput(bytes, 'xyz')), budget));
    if (typeof expected === 'string') assert.equal(actual, expected);
    else { const { format, ...counts } = expected; assert.equal(actual.plan.format, format); assert.deepEqual(actual.counts, counts); }
  }
});
