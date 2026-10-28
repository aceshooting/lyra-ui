import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { planSceneAllocations, createSceneResourceLedger } from '../src/scene/resource-ledger.mjs';

const runs = { seed: 0x5eed_1e57, numRuns: 200, includeErrorInReport: true };

test('NPOT texture payload arithmetic agrees with an independent bigint level oracle', () => {
  fc.assert(fc.property(fc.integer({ min: 1, max: 257 }), fc.integer({ min: 1, max: 257 }),
    fc.integer({ min: 1, max: 4 }), fc.constantFrom(1, 6), fc.constantFrom(1, 2, 4, 8, 16),
    (width, height, layers, faces, bytesPerPixel) => {
      let w = BigInt(width), h = BigInt(height), pixels = 0n, levels = 0;
      for (;;) {
        pixels += w * h; levels++;
        if (w === 1n && h === 1n) break;
        w = w > 1n ? w / 2n : 1n; h = h > 1n ? h / 2n : 1n;
      }
      const expected = Number(pixels * BigInt(layers) * BigInt(faces) * BigInt(bytesPerPixel));
      const resource = { kind: 'texture', key: 'texture', pool: 'gpu-texture', width, height, layers, faces, bytesPerPixel, mipLevels: levels };
      const plan = planSceneAllocations([resource, { ...resource }], { bytes: expected });
      assert.equal(plan.knownBytes, expected);
      assert.equal(plan.pools['gpu-texture'], expected);
      assert.throws(() => planSceneAllocations([resource], { bytes: expected - 1 }));
    }), runs);
});

test('permuted alias reservations and releases preserve exact union pool usage', () => {
  fc.assert(fc.property(fc.array(fc.record({ size: fc.integer({ min: 0, max: 1000 }),
    pool: fc.constantFrom('cpu-buffer', 'worker-buffer', 'gpu-buffer'), order: fc.integer() }), { maxLength: 32 }), rows => {
    const resources = rows.map((row, index) => ({ kind: 'bytes', key: `storage-${index}`, pool: row.pool, byteLength: row.size }));
    const cap = rows.reduce((sum, row) => sum + row.size, 0);
    const ledger = createSceneResourceLedger({ bytes: cap });
    const reservations = resources.map(resource => ledger.reserve([resource]));
    const aliases = resources.map(resource => ledger.reserve([{ ...resource }]));
    assert.equal(ledger.usage.knownBytes, cap);
    assert.deepEqual(planSceneAllocations([...resources].reverse(), { bytes: cap }), planSceneAllocations(resources, { bytes: cap }));
    let expected = cap;
    const order = rows.map((row, index) => ({ ...row, index })).sort((a, b) => a.order - b.order || a.index - b.index);
    for (const row of order) {
      reservations[row.index].release(); reservations[row.index].release();
      assert.equal(ledger.usage.knownBytes, expected);
      aliases[row.index].release(); expected -= row.size;
      assert.equal(ledger.usage.knownBytes, expected);
      assert.ok(ledger.usage.knownBytes >= 0 && ledger.usage.knownBytes <= cap);
    }
  }), runs);
});
