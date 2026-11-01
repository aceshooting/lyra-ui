import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { createSceneResourceLedger } from '../dist/map/resource-ledger.js';

const runs = { seed: 0x5eed_1e57, numRuns: 200, includeErrorInReport: true };
test('arbitrary reservation release order preserves exact live residency and cap', () => {
  fc.assert(fc.property(fc.array(fc.record({ bytes: fc.integer({ min: 1, max: 100 }), order: fc.integer() }), { maxLength: 32 }), values => {
    const cap = values.reduce((sum, row) => sum + row.bytes, 0);
    const ledger = createSceneResourceLedger({ bytes: Math.max(1, cap) });
    const live = values.map((row, index) => ({ ...row, index,
      reservation: ledger.reserve(`owner-${index}`, [{ key: `backing-${index}`, bytes: row.bytes }]) }));
    assert.equal(ledger.bytes, cap);
    let expected = cap;
    for (const row of live.sort((a, b) => a.order - b.order || a.index - b.index)) {
      row.reservation.release(); row.reservation.release(); expected -= row.bytes;
      assert.equal(ledger.bytes, expected);
      assert.ok(ledger.bytes >= 0 && ledger.bytes <= Math.max(1, cap));
    }
    assert.equal(ledger.bytes, 0);
  }), runs);
});
