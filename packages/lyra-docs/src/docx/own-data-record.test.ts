import assert from 'node:assert/strict';
import test from 'node:test';
import { ownDataRecord } from './own-data-record.js';

test('copies own data without invoking accessors', () => {
  let reads = 0;
  const input = Object.defineProperty({ type: 'bold' }, 'danger', { enumerable: true, get() { reads++; return 'x'; } });
  assert.equal(ownDataRecord(input), null);
  assert.equal(reads, 0);
  const copied = ownDataRecord(Object.assign(Object.create(null), { type: 'bold' }));
  assert.equal(copied?.type, 'bold');
  assert.equal(Object.getPrototypeOf(copied), null);
});

test('rejects symbols and custom prototypes', () => {
  assert.equal(ownDataRecord({ [Symbol('x')]: 1 }), null);
  assert.equal(ownDataRecord(new Date()), null);
});
