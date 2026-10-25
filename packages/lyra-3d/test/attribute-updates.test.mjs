import assert from 'node:assert/strict';
import test from 'node:test';
import { Float32BufferAttribute } from 'three';
import { WebGLAttributes } from 'three/src/renderers/webgl/WebGLAttributes.js';
import { markAttributeFull, markAttributeRanges, markAttributeRows } from '../dist/core/attribute-updates.js';
import { uploadRecorder } from './performance-fixture.mjs';

test('initial allocation clears pending full ranges and preserves the upload callback', () => {
  const attribute = new Float32BufferAttribute(new Float32Array(48), 3);
  let uploads = 0;
  attribute.onUpload(() => { uploads++; });
  markAttributeFull(attribute);
  const gpu = uploadRecorder(new Map([['color', attribute]]), WebGLAttributes);
  try {
    assert.equal(uploads, 1); assert.deepEqual(attribute.updateRanges, []);
    attribute.setXYZ(7, 1, 2, 3); markAttributeRows(attribute, [7]);
    assert.deepEqual(gpu.flush(), [{ key: 'color', offset: 84, bytes: 12 }]);
    assert.equal(uploads, 2); assert.deepEqual(attribute.updateRanges, []);
  } finally { gpu.dispose(); }
});

test('pending row ranges merge without losing earlier full or sparse updates', () => {
  const attribute = new Float32BufferAttribute(new Float32Array(48), 3);
  const gpu = uploadRecorder(new Map([['color', attribute]]), WebGLAttributes);
  try {
    for (const row of [2, 3, 9]) attribute.setXYZ(row, row, 1, 2);
    markAttributeRows(attribute, [9, 2]); markAttributeRows(attribute, [3, 2]);
    assert.deepEqual(attribute.updateRanges, [{ start: 6, count: 6 }, { start: 27, count: 3 }]);
    gpu.flush(); assert.deepEqual(gpu.mirrors().color, Array.from(attribute.array));
    attribute.array.fill(4); markAttributeFull(attribute);
    attribute.setX(15, 7); markAttributeRanges(attribute, [{ start: 45, count: 1 }]);
    assert.deepEqual(attribute.updateRanges, [{ start: 0, count: 48 }]);
    assert.deepEqual(gpu.flush(), [{ key: 'color', offset: 0, bytes: 192 }]);
    assert.deepEqual(gpu.mirrors().color, Array.from(attribute.array));
    const version = attribute.version;
    markAttributeRows(attribute, [-1, 16, NaN, 1.5]);
    assert.equal(attribute.version, version); assert.deepEqual(gpu.flush(), []);
  } finally { gpu.dispose(); }
});


test('dense fragmented paint rows bound upload dispatch while preserving complete contents', () => {
  const attribute = new Float32BufferAttribute(new Float32Array(1024 * 4), 4);
  const gpu = uploadRecorder(new Map([['paint', attribute]]), WebGLAttributes);
  try {
    const rows = Array.from({ length: 256 }, (_, index) => index * 4);
    for (const row of rows) attribute.setXYZW(row, row, 1, 2, 3);
    markAttributeRows(attribute, rows);
    const calls = gpu.flush();
    assert.ok(calls.length <= 64, 'dense scattered paint cannot produce one driver call per row');
    assert.ok(calls.reduce((sum, call) => sum + call.bytes, 0) <= attribute.array.byteLength);
    assert.deepEqual(gpu.mirrors().paint, Array.from(attribute.array));
    attribute.setX(1023, 7); markAttributeRows(attribute, [1023]);
    assert.deepEqual(gpu.flush(), [{ key: 'paint', offset: 1023 * 16, bytes: 16 }]);
    assert.deepEqual(gpu.mirrors().paint, Array.from(attribute.array));
  } finally { gpu.dispose(); }
});

test('paint span promotion requires both quarter coverage and more than 64 runs', () => {
  for (const { count, changed, calls: expected } of [
    { count: 1024, changed: 255, calls: 255 },
    { count: 256, changed: 64, calls: 64 },
    { count: 260, changed: 65, calls: 1 },
  ]) {
    const attribute = new Float32BufferAttribute(new Float32Array(count * 4), 4);
    const gpu = uploadRecorder(new Map([['paint', attribute]]), WebGLAttributes);
    try {
      const rows = Array.from({ length: changed }, (_, index) => index * 4);
      for (const row of rows) attribute.setXYZW(row, row, 1, 2, 3);
      markAttributeRows(attribute, rows);
      assert.equal(gpu.flush().length, expected);
      assert.deepEqual(gpu.mirrors().paint, Array.from(attribute.array));
    } finally { gpu.dispose(); }
  }
});
