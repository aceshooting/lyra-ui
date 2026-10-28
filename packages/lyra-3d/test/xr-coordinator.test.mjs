import assert from 'node:assert/strict';
import test from 'node:test';
import { acquireXrPreparation, releaseXrPreparation, acquireXrSession, releaseXrSession } from '../dist/xr/coordinator.js';

test('preparation and document leases have independent, exclusive ownership', async () => {
  const key = {}, preparation = acquireXrPreparation(key), session = acquireXrSession(key);
  assert.throws(() => acquireXrPreparation(key), { code: 'busy' });
  assert.throws(() => acquireXrSession(key), { code: 'busy' });
  const other = acquireXrSession({}); releaseXrSession(other); await other.released;
  releaseXrPreparation(preparation); await preparation.released;
  assert.throws(() => acquireXrSession(key), { code: 'busy' });
  releaseXrSession(session); await session.released;
});

test('stale and fabricated releases cannot release a newer owner', async () => {
  for (const [acquire, release] of [[acquireXrPreparation, releaseXrPreparation], [acquireXrSession, releaseXrSession]]) {
    const key = {}, first = acquire(key); let settled = false;
    void first.released.then(() => { settled = true; }); await Promise.resolve(); assert.equal(settled, false);
    release(first); await first.released; assert.equal(settled, true);
    const next = acquire(key); release(first);
    assert.throws(() => acquire(key), { code: 'busy' });
    assert.throws(() => release({ released: Promise.resolve() }), TypeError);
    release(next); release(next); await next.released;
  }
});
