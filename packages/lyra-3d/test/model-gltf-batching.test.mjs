import assert from 'node:assert/strict';
import test from 'node:test';
import { admitModel } from '../dist/model/admission.js';
import { createModelAdmissionWork } from '../dist/model/model-admission-kernel.js';
import { snapshotModelInput } from '../dist/model/model-admission-policy.js';
import { drainModelWork } from '../dist/model/model-work.js';
import { triangleJson, utf8 } from './model-fixtures.mjs';

const count = 6000;
const budgets = [1, 2, 7, 4096].map(quota => ({ bytes: quota, scalars: quota, records: quota })).concat([{ bytes: 1, scalars: 7, records: 2 }, { bytes: 7, scalars: 2, records: 1 }]);
function fixture(invalidIndex = false) {
  const document = triangleJson();
  document.buffers = [{ byteLength: count * 24 }];
  document.bufferViews = [
    { buffer: 0, byteLength: count * 16, byteStride: 16 },
    { buffer: 0, byteOffset: count * 16, byteLength: count * 4 },
    { buffer: 0, byteOffset: count * 20, byteLength: count * 4 },
  ];
  document.accessors = [
    { bufferView: 0, componentType: 5126, count, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 1] },
    { bufferView: 1, componentType: 5121, normalized: true, count, type: 'VEC4' },
    { bufferView: 2, componentType: 5125, count, type: 'SCALAR' },
  ];
  document.meshes[0].primitives[0] = { attributes: { POSITION: 0, COLOR_0: 1 }, indices: 2 };
  const json = utf8(JSON.stringify(document)); const padded = Math.ceil(json.length / 4) * 4;
  const bytes = new Uint8Array(28 + padded + count * 24); const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, bytes.length, true);
  view.setUint32(12, padded, true); view.setUint32(16, 0x4e4f534a, true); bytes.fill(32, 20, 20 + padded); bytes.set(json, 20);
  view.setUint32(20 + padded, count * 24, true); view.setUint32(24 + padded, 0x004e4942, true);
  const start = 28 + padded;
  for (let row = 0; row < count; row++) {
    view.setFloat32(start + row * 16 + 12, NaN, true);
    bytes.fill(255, start + count * 16 + row * 4, start + count * 16 + row * 4 + 4);
    view.setUint32(start + count * 20 + row * 4, invalidIndex && row === count - 1 ? count : row, true);
  }
  return bytes;
}
test('accessor batches read every strided position, normalized color and index exactly once', () => {
  const bytes = fixture(); const { format, ...expected } = admitModel(bytes, 'glb');
  for (const budget of budgets) {
    const original = { getFloat32: DataView.prototype.getFloat32, getUint8: DataView.prototype.getUint8, getUint32: DataView.prototype.getUint32 };
    const reads = { positions: 0, colors: 0, indices: 0 };
    try {
      DataView.prototype.getFloat32 = function (...args) { if (this.byteLength === count * 16) reads.positions++; return original.getFloat32.apply(this, args); };
      DataView.prototype.getUint8 = function (...args) { if (this.byteLength === count * 4) reads.colors++; return original.getUint8.apply(this, args); };
      DataView.prototype.getUint32 = function (...args) { if (this.byteLength === count * 4) reads.indices++; return original.getUint32.apply(this, args); };
      const result = drainModelWork(createModelAdmissionWork(snapshotModelInput(bytes, format)), budget);
      assert.deepEqual(result.counts, expected);
      assert.deepEqual(reads, { positions: count * 3, colors: count * 4, indices: count });
    } finally { Object.assign(DataView.prototype, original); }
  }
});
test('the final partial accessor batch retains its maximum for index validation', () => {
  const bytes = fixture(true);
  assert.throws(() => admitModel(bytes, 'glb'), error => error.code === 'invalid');
  for (const budget of budgets) assert.throws(() => drainModelWork(createModelAdmissionWork(snapshotModelInput(bytes, 'glb')), budget), error => error.code === 'invalid');
});
