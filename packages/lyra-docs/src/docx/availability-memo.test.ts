import assert from 'node:assert/strict';
import test from 'node:test';
import { AvailabilityMemo } from './availability-memo.js';

test('answers are computed once per snapshot and recomputed after it changes', () => {
  const memo = new AvailabilityMemo<{ enabled: boolean; reason?: string }>();
  const first = {}, second = {};
  let calls = 0;
  const query = (owner: object) => memo.get(owner, 'bold', () => ({ enabled: ++calls > 0 }));
  assert.equal(query(first), query(first));
  assert.equal(calls, 1);
  query(second);
  assert.equal(calls, 2);
});

test('transient busy and composing answers are not remembered', () => {
  const memo = new AvailabilityMemo<{ enabled: boolean; reason?: string }>();
  const owner = {};
  let calls = 0;
  for (const reason of ['busy', 'composing']) {
    memo.get(owner, reason, () => { calls++; return { enabled: false, reason }; });
    memo.get(owner, reason, () => { calls++; return { enabled: false, reason }; });
  }
  assert.equal(calls, 4);
});
