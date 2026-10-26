import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createHostServices } from './dashboard-host.mjs';

const loadLibrary = name => {
  if (name === '@aceshooting/lyra-gen/persistence.js') return import('../../../packages/lyra-gen/dist/persistence.js');
  if (name === '@aceshooting/lyra-gen/catalog.js') return import('../../../packages/lyra-gen/dist/catalog.js');
  throw new Error('Unexpected library.');
};
const call = async (host, operation, values = {}, role = 'viewer') => {
  const result = await host.routes[0].handle({ method: 'POST', headers: { 'x-fixture-session': role }, body: new TextEncoder().encode(JSON.stringify({ operation, ...values })) });
  return { status: result.status, value: JSON.parse(result.body).value };
};

test('process-owned hosts seed once, preserve advancing CAS and isolate fresh controls without pruning history', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lyra-memory-host-test-')); let persistent, fresh;
  try {
    await mkdir(join(directory, 'persistent')); await mkdir(join(directory, 'fresh'));
    persistent = await createHostServices({ loadLibrary, scratchDirectory: join(directory, 'persistent') });
    assert.equal((await persistent.counts()).instanceRevision, 1);
    for (let revision = 1; revision <= 3; revision++) {
      const saved = await call(persistent, 'save-state', { expectedRevision: revision, state: { version: 1, values: { note: `Edit ${revision}` } } });
      assert.equal(saved.status, 200); assert.equal(saved.value.revision, revision + 1);
    }
    const before = await persistent.counts(); assert.equal(before.historyEntries, 2); assert.equal(before.documents, 1); assert.equal(before.instances, 1); assert.equal(before.instanceRevision, 4);
    assert.equal((await call(persistent, 'reset', {}, 'author')).status, 403);
    assert.equal((await call(persistent, 'publish', { expectedRevision: 2 }, 'author')).status, 403);
    assert.equal((await call(persistent, 'save-state', { expectedRevision: 1, state: { version: 1, values: { note: 'Stale' } } })).status, 409);
    fresh = await createHostServices({ loadLibrary, scratchDirectory: join(directory, 'fresh') });
    assert.equal((await fresh.counts()).instanceRevision, 1);
    assert.equal((await call(fresh, 'save-state', { expectedRevision: 1, state: { version: 1, values: { note: 'Control' } } })).status, 200);
    assert.deepEqual(await persistent.counts(), before);
  } finally { await persistent?.dispose(); await fresh?.dispose(); await rm(directory, { recursive: true, force: true }); }
});
