import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runMemorySmoke } from './memory-profile-smoke.mjs';
import { validateMemorySmokeManifest } from './memory-profile-driver.mjs';

const digest = 'a'.repeat(64);
const manifest = () => ({ schemaVersion: 1, kind: 'memory-functional-smoke', authorized: true, sourceSha256: digest, compositionSha256: digest,
  candidate: { archiveSha256: digest, lockfileSha256: digest, buildSha256: digest }, browser: { engine: 'chromium', executableSha256: digest },
  lifecycles: ['full-chat', 'full-dashboard'], admissions: ['direct', 'adapters'], includeX: true });

test('memory smoke authorization is separate from the sampled forced-GC campaign', () => {
  assert.doesNotThrow(() => validateMemorySmokeManifest(manifest()));
  for (const mutate of [value => { value.kind = 'memory-profile'; }, value => { value.authorized = false; },
    value => { value.configuration = {}; }, value => { value.collectionId = 'campaign'; }, value => { value.admissions = ['adapters', 'adapters']; }]) {
    const value = manifest(); mutate(value); assert.throws(() => validateMemorySmokeManifest(value));
  }
});

test('semantic smoke uses one lifecycle pass per approved shape and never requests a baseline', async () => {
  const opened = [], closed = [], records = [];
  const driver = {
    async verify() { return { synthetic: true }; },
    async openProcess(identity) {
      opened.push(identity);
      return { browserVersion: 'synthetic', baseline() { assert.fail('Smoke cannot request GC baselines.'); },
        async cycle() { return { method: 'memory-semantic-smoke', semanticAssertionsPassed: true,
          observations: ['mounted', 'released', 'disposed', 'restored', 'restored-disposed'].map(phase => ({ phase, fingerprint: phase })) }; },
        async largeX() { return { semanticAssertionsPassed: true, observation: { phase: 'mounted' } }; },
        async close() { closed.push(identity); },
      };
    }, async close() {},
  };
  const result = await runMemorySmoke(manifest(), driver, { retain: async record => { records.push(record); } });
  assert.equal(result.status, 'complete'); assert.equal(opened.length, 5); assert.equal(closed.length, 5);
  assert.deepEqual(opened.slice(0, 4).map(row => [row.lifecycle, row.admission, row.cycle]), [
    ['full-chat', 'direct', 1], ['full-chat', 'adapters', 2], ['full-dashboard', 'direct', 1], ['full-dashboard', 'adapters', 2],
  ]);
  assert.equal(records.filter(row => row.kind === 'memory-functional-outcome').length, 5);
});
