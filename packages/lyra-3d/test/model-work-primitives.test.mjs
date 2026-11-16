import assert from 'node:assert/strict';
import test from 'node:test';
import { ModelJsonStringBuilder, ModelJsonStringCursor } from '../dist/model/model-json-string.js';
import { prepareModel } from '../dist/model/model-preparation.js';
import { snapshotModelInput } from '../dist/model/model-admission-policy.js';
import { createModelTransferWork } from '../dist/model/model-worker-protocol.js';
import { drainModelWork, ModelWorkMeter } from '../dist/model/model-work.js';
import { utf8 } from './model-fixtures.mjs';

test('work meters refuse non-positive or fractional unit counts without spending budget', () => {
  const meter = new ModelWorkMeter({ bytes: 4, scalars: 4, records: 4 });
  for (const count of [0, -1, 1.5, Number.NaN]) assert.throws(() => meter.take('bytes', count), RangeError);
  assert.deepEqual(meter.used, { bytes: 0, scalars: 0, records: 0 });
  assert.equal(meter.take('bytes', 4), true);
  assert.equal(meter.take('bytes'), false);
  assert.deepEqual(meter.used, { bytes: 4, scalars: 0, records: 0 });
});

test('worker transfer lists each distinct geometry backing once, including index attributes', () => {
  const shared = new Float32Array(9), index = new Uint16Array([0, 1, 2]), strided = new Uint8Array(12), mask = new Uint8Array(3);
  const attribute = array => ({ array, itemSize: 3, normalized: false, count: 3, stride: 3, offset: 0 });
  const descriptor = { geometries: [
    { attributes: { position: attribute(shared), normal: attribute(shared), color: { ...attribute(new Float64Array(9)), colorConversion: { space: 'srgb', scale: 1, output: 'f32', authoredRows: mask } } }, index },
    { attributes: { position: attribute(shared) }, index: null, indexAttribute: { array: strided, itemSize: 1, normalized: false, count: 3, stride: 4, offset: 0 } },
    { attributes: { position: attribute(new Float32Array(9)) }, index: null },
  ] };
  const buffers = drainModelWork(createModelTransferWork(descriptor), { bytes: 1, scalars: 1, records: 1 });
  assert.equal(buffers.length, 6);
  for (const array of [shared, index, strided, mask]) assert.ok(buffers.includes(array.buffer));
  assert.equal(new Set(buffers).size, buffers.length);
});

test('long JSON string cursors start inside any chunk, stay chunk-bounded and read an empty span past the end', () => {
  const builder = new ModelJsonStringBuilder();
  const text = Array.from({ length: 6 * 1024 }, (_, index) => String.fromCharCode(97 + index % 26)).join('');
  builder.append(text);
  const value = builder.finish();
  assert.notEqual(typeof value, 'string');
  for (const start of [0, 100, 1023, 1024, 2500, 5000, 6143]) {
    const cursor = new ModelJsonStringCursor(value, start);
    assert.equal(cursor.span(3), text.slice(start, Math.min(start + 3, (Math.floor(start / 1024) + 1) * 1024)), 'a span never crosses a chunk');
    assert.equal(String.fromCharCode(cursor.takeCode()), text[start]);
  }
  const end = new ModelJsonStringCursor(value, text.length);
  assert.equal(end.span(8), '');
  assert.ok(Number.isNaN(end.takeCode()));
});

test('preparation without a worker service decodes locally when the platform has no Worker', async () => {
  assert.equal(typeof globalThis.Worker, 'undefined');
  const parsed = await prepareModel(snapshotModelInput(utf8('0 0 0\n1 2 3\n'), 'xyz'));
  try { assert.equal(parsed.vertices, 2); } finally { parsed.dispose(); }
});
