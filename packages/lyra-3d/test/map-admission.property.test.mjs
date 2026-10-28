import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { snapshotSceneModels } from '../dist/map/admission.js';

const runs = { seed: 0x5eed_1e57, numRuns: 200, includeErrorInReport: true };
test('unique plain model arrays retain order and independently copy all accepted byte views', () => {
  fc.assert(fc.property(fc.array(fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 1, maxLength: 32 }), { maxLength: 16 }), rows => {
    const input = rows.map((bytes, index) => ({ id: `model-${index}`, label: `Model ${index}`, kind: 'model',
      position: { lngLat: [index, 40] }, source: { format: 'glb', bytes: Uint8Array.from(bytes) } }));
    const output = snapshotSceneModels(input);
    assert.equal(output.length, rows.length);
    for (let index = 0; index < output.length; index++) {
      assert.equal(output[index].id, `model-${index}`);
      assert.deepEqual([...output[index].source.bytes], rows[index]);
      assert.notEqual(output[index].source.bytes.buffer, input[index].source.bytes.buffer);
      input[index].source.bytes.fill(0);
      assert.deepEqual([...output[index].source.bytes], rows[index]);
    }
  }), runs);
});
