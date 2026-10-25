import assert from 'node:assert/strict';
import test from 'node:test';
import { admitModel, readModelAdmission, ModelAdmissionError } from '../dist/model/admission.js';
import { snapshotModelInput, createModelResourceBudget, chargeModelGeometry } from '../dist/model/model-admission-policy.js';
import { createModelAdmissionWork } from '../dist/model/model-admission-kernel.js';
import { drainModelWork, ModelWorkMeter } from '../dist/model/model-work.js';
import { MODEL_LIMITS } from '../dist/model/limits.js';

const utf8 = value => new TextEncoder().encode(value);
const outcome = action => { try { return { value: action() }; } catch (error) { return { code: error instanceof ModelAdmissionError ? error.code : error.name }; } };
const cases = [
  '', '# comment\r\n\n', '0 0 0', '\ufeff1 2 3\r\n', '# é 😀\r\n1 2 3 10 11 254\n',
  '1e-3 +2 -.5\n2 3 4 128 0 255\n', '1 2 3\n\n# tail', '1 2 3 4', '1 2 nope',
  '1 2 3 256 0 0', '1 2 3 1.5 0 0', '1e21 2 3', '1 2 3\u00a0',
  `#${'x'.repeat(MODEL_LIMITS.lineBytes - 1)}\n1 2 3`, `#${'x'.repeat(MODEL_LIMITS.lineBytes)}\n`,
].map(utf8);
cases.push(Uint8Array.of(0xc3), Uint8Array.from([...utf8('1 2 3 4\n'), 0xc3]), Uint8Array.from([...utf8(`#${'x'.repeat(MODEL_LIMITS.lineBytes)}\n`), 0xc3]));

test('shared sliced XYZ policy matches original counts, bytes and first refusal at every quota', () => {
  for (const bytes of cases) for (const quota of [1, 2, 7, 64, 65536]) {
    const original = outcome(() => admitModel(bytes, 'xyz'));
    const shared = outcome(() => drainModelWork(createModelAdmissionWork(snapshotModelInput(bytes, 'xyz')), { bytes: quota, scalars: quota, records: quota }));
    assert.equal(shared.code, original.code, `quota${quota}, bytes${bytes.length}`);
    if (original.value) {
      const { format, ...counts } = original.value;
      assert.equal(shared.value.plan.format, format); assert.deepEqual(shared.value.counts, counts);
      assert.deepEqual(shared.value.input.bytes, readModelAdmission(original.value).bytes);
      assert.deepEqual(shared.value.resources, readModelAdmission(original.value).resources);
    }
  }
});

test('shared input snapshot and geometry charges retain original admission behavior', () => {
  const bytes = utf8('1 2 3\n'); const original = admitModel(bytes, 'xyz'); const owned = snapshotModelInput(bytes, 'xyz');
  bytes.fill(0); assert.deepEqual(owned.bytes, readModelAdmission(original).bytes);
  const budget = createModelResourceBudget(); chargeModelGeometry(budget, 1, 0);
  assert.equal(budget.decoded, original.decodedBytes); assert.equal(budget.vertices, original.vertices);
  for (const [input, format] of [[null, 'xyz'], [new Uint8Array(), 'unknown'], [new Uint8Array(new SharedArrayBuffer(8)), 'xyz'], [new Uint8Array(new ArrayBuffer(8, { maxByteLength: 16 })), 'xyz']]) {
    assert.deepEqual(outcome(() => snapshotModelInput(input, format)), outcome(() => admitModel(input, format)));
  }
});

test('work caps are independent, state survives yields and disposal cannot publish a result', () => {
  const meter = new ModelWorkMeter({ bytes: 2, scalars: 1, records: 1 });
  assert.equal(meter.take('bytes', 3), false); assert.equal(meter.take('bytes', 2), true); assert.equal(meter.take('bytes'), false);
  assert.equal(meter.take('scalars'), true); assert.equal(meter.take('records'), true); assert.deepEqual(meter.used, { bytes: 2, scalars: 1, records: 1 });
  for (const invalid of [0, -1, 0.5, NaN, Infinity]) assert.throws(() => new ModelWorkMeter({ bytes: invalid, scalars: 1, records: 1 }), RangeError);
  const source = snapshotModelInput(utf8('# é 😀\r\n1 2 3\n4 5 6'), 'xyz');
  for (const cutoff of [0, 1, 5, 20]) {
    const work = createModelAdmissionWork(source);
    for (let i = 0; i < cutoff; i++) { const step = work.step({ bytes: 1, scalars: 1, records: 1 }); assert.equal(step.done, false); assert.ok(step.used.bytes <= 1 && step.used.scalars <= 1 && step.used.records <= 1); }
    work.dispose(); work.dispose(); assert.throws(() => work.step({ bytes: 1, scalars: 1, records: 1 }), /no longer active/);
  }
  const finished = createModelAdmissionWork(source); assert.equal(drainModelWork(finished).counts.vertices, 2);
  assert.throws(() => finished.step({ bytes: 1, scalars: 1, records: 1 }), /no longer active/);
});

test('failed XYZ admission is terminal even when another valid record follows', () => {
  for (const source of ['1 2 3 4\n1 2 3\n', '1 2 invalid\n1 2 3\n']) {
    const work = createModelAdmissionWork(snapshotModelInput(utf8(source), 'xyz'));
    assert.throws(() => work.step({ bytes: 65536, scalars: 65536, records: 64 }), ModelAdmissionError);
    assert.throws(() => work.step({ bytes: 65536, scalars: 65536, records: 64 }), /no longer active/);
  }
});
