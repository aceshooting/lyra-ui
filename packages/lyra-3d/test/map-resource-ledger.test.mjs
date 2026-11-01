import assert from 'node:assert/strict';
import test from 'node:test';
import { createSceneResourceLedger } from '../dist/map/resource-ledger.js';

test('installed, candidate and scratch residency share one physical allocation ceiling', () => {
  const ledger = createSceneResourceLedger({ bytes: 100 });
  const old = ledger.reserve('installed', [{ key: 'old', bytes: 60 }]);
  assert.throws(() => ledger.reserve('candidate', [{ key: 'new', bytes: 41 }]));
  assert.equal(ledger.bytes, 60);
  const candidate = ledger.reserve('candidate', [{ key: 'new', bytes: 30 }]);
  const scratch = ledger.reserve('scratch', [{ key: 'copy', bytes: 10 }]);
  assert.equal(ledger.bytes, 100);
  assert.throws(() => ledger.reserve('overflow', [{ key: 'extra', bytes: 1 }]));
  scratch.release(); scratch.release(); candidate.release();
  assert.equal(ledger.bytes, 60);
  old.release(); assert.equal(ledger.bytes, 0);
});

test('shared backing is counted once across reservations but distinct copies remain resident', () => {
  const ledger = createSceneResourceLedger({ bytes: 100 });
  const first = ledger.reserve('first', [{ key: 'backing', bytes: 60 }]);
  const alias = ledger.reserve('alias', [{ key: 'backing', bytes: 60 }]);
  assert.equal(ledger.bytes, 60);
  assert.throws(() => ledger.reserve('conflict', [{ key: 'backing', bytes: 59 }]));
  assert.throws(() => ledger.reserve('copy', [{ key: 'copy', bytes: 60 }]));
  first.release(); assert.equal(ledger.bytes, 60);
  alias.release(); assert.equal(ledger.bytes, 0);
});

test('allocation arithmetic rejects nonintegers and overflow without mutating reservations', () => {
  const ledger = createSceneResourceLedger({ bytes: Number.MAX_SAFE_INTEGER });
  for (const bytes of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => ledger.reserve('invalid', [{ key: 'invalid', bytes }]));
    assert.equal(ledger.bytes, 0);
  }
  assert.throws(() => ledger.reserve('sum', [{ key: 'a', bytes: Number.MAX_SAFE_INTEGER }, { key: 'b', bytes: 1 }]));
  assert.equal(ledger.bytes, 0);
});
