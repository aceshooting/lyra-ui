import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { memoizedHistoryVerification } from './published-history-memo.mjs';

test('memoizedHistoryVerification computes once per history content and freezes the result', () => {
  const dir = mkdtempSync(join(tmpdir(), 'history-memo-'));
  try {
    writeFileSync(join(dir, 'a.json'), '{"v":1}');
    let calls = 0;
    const compute = () => { calls += 1; return { nested: { n: calls } }; };
    const first = memoizedHistoryVerification('kind', dir, compute);
    assert.equal(memoizedHistoryVerification('kind', dir, compute), first);
    assert.equal(calls, 1);
    assert(Object.isFrozen(first) && Object.isFrozen(first.nested));
    writeFileSync(join(dir, 'a.json'), '{"v":2}');
    assert.notEqual(memoizedHistoryVerification('kind', dir, compute), first);
    assert.equal(calls, 2);
    memoizedHistoryVerification('other', dir, compute);
    assert.equal(calls, 3);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('memoizedHistoryVerification never stores a failing verification', () => {
  const dir = mkdtempSync(join(tmpdir(), 'history-memo-'));
  try {
    writeFileSync(join(dir, 'a.json'), '{}');
    let calls = 0;
    const compute = () => { calls += 1; if (calls === 1) throw new Error('bad history'); return { ok: true }; };
    assert.throws(() => memoizedHistoryVerification('fail', dir, compute), /bad history/u);
    assert.deepEqual(memoizedHistoryVerification('fail', dir, compute), { ok: true });
    assert.equal(calls, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
