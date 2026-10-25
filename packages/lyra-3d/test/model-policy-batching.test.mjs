import assert from 'node:assert/strict';
import test from 'node:test';
import { admitModel } from '../dist/model/admission.js';
import { createModelAdmissionWork } from '../dist/model/model-admission-kernel.js';
import { createModelResourceBudget, snapshotModelInput } from '../dist/model/model-admission-policy.js';
import { readModelFormatPolicy } from '../dist/model/model-format-policy.js';
import { createModelGeneratorWork } from '../dist/model/model-work-generator.js';
import { drainModelWork, ModelWorkMeter } from '../dist/model/model-work.js';
import { triangleJson, utf8 } from './model-fixtures.mjs';

const vertices = 12000;
const budgets = [1, 2, 7, 4096].map(quota => ({ bytes: quota, scalars: quota, records: quota })).concat([{ bytes: 1, scalars: 7, records: 2 }, { bytes: 7, scalars: 2, records: 1 }]);
function fixture(format) {
  if (format === 'stl') {
    const bytes = new Uint8Array(84 + vertices / 3 * 50); const view = new DataView(bytes.buffer); view.setUint32(80, vertices / 3, true);
    for (let face = 0; face < vertices / 3; face++) view.setFloat32(84 + face * 50 + 8, 1, true);
    return bytes;
  }
  if (format === 'ply' || format === 'pcd') {
    const header = format === 'ply'
      ? `ply\nformat binary_little_endian 1.0\nelement vertex ${vertices}\nproperty float x\nproperty float y\nproperty float z\nelement face ${vertices / 3}\nproperty list uchar int vertex_indices\nend_header\n`
      : `VERSION .7\nFIELDS x y z rgb\nSIZE 4 4 4 4\nTYPE F F F U\nCOUNT 1 1 1 1\nWIDTH ${vertices}\nHEIGHT 1\nPOINTS ${vertices}\nDATA binary\n`;
    const prefix = utf8(header); const bytes = new Uint8Array(prefix.length + vertices * (format === 'ply' ? 12 : 16) + (format === 'ply' ? vertices / 3 * 13 : 0)); bytes.set(prefix);
    if (format === 'ply') { const view = new DataView(bytes.buffer); let offset = prefix.length + vertices * 12; for (let index = 0; index < vertices; index += 3) { bytes[offset++] = 3; for (let axis = 0; axis < 3; axis++) { view.setInt32(offset, index + axis, true); offset += 4; } } }
    return bytes;
  }
  const document = triangleJson(); delete document.buffers[0].uri; document.buffers[0].byteLength = vertices * 12; document.bufferViews[0].byteLength = vertices * 12; document.accessors[0].count = vertices;
  const json = utf8(JSON.stringify(document)); const padded = Math.ceil(json.length / 4) * 4; const bytes = new Uint8Array(28 + padded + vertices * 12); const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, bytes.length, true); view.setUint32(12, padded, true); view.setUint32(16, 0x4e4f534a, true); bytes.fill(32, 20, 20 + padded); bytes.set(json, 20);
  view.setUint32(20 + padded, vertices * 12, true); view.setUint32(24 + padded, 0x004e4942, true); return bytes;
}
for (const format of ['stl', 'ply', 'pcd', 'glb']) test(`${format} binary admission resumes at batch boundaries rather than per scalar`, () => {
  const bytes = fixture(format); const input = snapshotModelInput(bytes, format); const resources = createModelResourceBudget(); let advances = 0;
  const work = createModelGeneratorWork(function* () {
    const iterator = readModelFormatPolicy(input, resources);
    try { for (;;) { advances++; const next = iterator.next(); if (next.done) return next.value; yield next.value; } }
    finally { iterator.return(); }
  });
  const plan = drainModelWork(work); assert.equal(plan.format, format); assert.equal(resources.vertices, vertices);
  assert.ok(advances < vertices / 8, `${advances} generator advances`);
});

test('XYZ line scanning charges spans rather than invoking the meter for every character', () => {
  const bytes = utf8('1 2 3 128 64 255\n'.repeat(4000)); const input = snapshotModelInput(bytes, 'xyz');
  const original = ModelWorkMeter.prototype.take; let takes = 0;
  try {
    ModelWorkMeter.prototype.take = function (...args) { takes++; return original.apply(this, args); };
    assert.equal(drainModelWork(createModelAdmissionWork(input)).counts.vertices, 4000);
  } finally { ModelWorkMeter.prototype.take = original; }
  assert.ok(takes < bytes.length / 4, `${takes} meter calls`);
});

test('binary batches and XYZ spans preserve independent quotas and total charged units', () => {
  for (const format of ['stl', 'ply', 'pcd', 'glb', 'xyz']) {
    const bytes = format === 'xyz' ? utf8('1 2 3\r\n4 5 6 0 128 255\n') : fixture(format);
    const expected = admitModel(bytes, format); let totals;
    for (const budget of budgets) {
      const work = createModelAdmissionWork(snapshotModelInput(bytes, format)); const used = { bytes: 0, scalars: 0, records: 0 }; let value;
      for (;;) { const step = work.step(budget); for (const key of Object.keys(used)) { assert.ok(step.used[key] <= budget[key]); used[key] += step.used[key]; } if (step.done) { value = step.value; break; } assert.ok(step.used.bytes + step.used.scalars + step.used.records > 0); }
      const { format: admittedFormat, ...counts } = expected; assert.equal(value.plan.format, admittedFormat); assert.deepEqual(value.counts, counts);
      if (totals) assert.deepEqual(used, totals); else totals = used;
    }
  }
});

test('invalid scalars at either side of a batch boundary retain the original first refusal', () => {
  const code = action => { try { action(); return null; } catch (error) { return error.code ?? error.name; } };
  for (const format of ['stl', 'ply', 'pcd', 'glb']) for (const scalar of [4094, 4096]) {
    const bytes = fixture(format); const view = new DataView(bytes.buffer); let offset;
    if (format === 'stl') offset = 84 + Math.floor(scalar / 12) * 50 + scalar % 12 * 4;
    else if (format === 'glb') offset = 28 + view.getUint32(12, true) + scalar * 4;
    else { const text = new TextDecoder().decode(bytes.subarray(0, 512)); const end = format === 'ply' ? 'end_header\n' : 'DATA binary\n'; offset = text.indexOf(end) + end.length + scalar * 4; }
    view.setFloat32(offset, NaN, true);
    assert.equal(code(() => admitModel(bytes, format)), 'invalid');
    for (const budget of budgets) assert.equal(code(() => drainModelWork(createModelAdmissionWork(snapshotModelInput(bytes, format)), budget)), 'invalid');
  }
});
