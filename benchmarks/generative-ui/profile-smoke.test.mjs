import test from 'node:test';
import assert from 'node:assert/strict';
import { smokeOptions } from './profile-smoke.mjs';
import { createProfileDriver, validateSmokeAuthorization, semanticSmokeOutcome } from './profile-driver.mjs';
import { validateCollectionManifest } from './profile.mjs';

const authorization = () => ({ schemaVersion: 1, kind: 'functional-smoke', authorized: true, sourceSha256: 'a'.repeat(64),
  candidate: { archiveSha256: 'b'.repeat(64), lockfileSha256: 'c'.repeat(64), buildSha256: 'd'.repeat(64) },
  browser: { engine: 'chromium', executableSha256: 'e'.repeat(64) }, workloads: ['T', 'C', 'L', 'V', 'X', 'D', 'S', 'R', 'A', 'K'] });

test('functional authorization is exact and cannot substitute for collection authorization', () => {
  assert.doesNotThrow(() => validateSmokeAuthorization(authorization()));
  assert.throws(() => validateCollectionManifest(authorization()));
  for (const patch of [{ kind: 'collection' }, { authorized: false }, { sourceSha256: '' }, { workloads: ['T', 'T'] }, { workloads: ['unknown'] }, { workloads: [] }, { samples: 60 }, { collection: { authorized: true } }]) {
    assert.throws(() => validateSmokeAuthorization({ ...authorization(), ...patch }));
  }
  assert.throws(() => validateSmokeAuthorization({ ...authorization(), candidate: {} }));
  assert.throws(() => validateSmokeAuthorization({ ...authorization(), browser: { engine: 'chromium' } }));
});

test('narrow smoke admits only the declared viewport and responsive workloads', () => {
  const narrow = { ...authorization(), workloads: ['L', 'D', 'R'], viewport: { width: 320, height: 900 } };
  assert.doesNotThrow(() => validateSmokeAuthorization(narrow));
  assert.doesNotThrow(() => validateSmokeAuthorization({ ...authorization(), viewport: { width: 1280, height: 900 } }));
  for (const viewport of [null, {}, { width: 319, height: 900 }, { width: 320, height: 800 }, { width: 1280, height: 900, scale: 2 }]) {
    assert.throws(() => validateSmokeAuthorization({ ...narrow, viewport }), /viewport/u);
  }
  assert.throws(() => validateSmokeAuthorization({ ...narrow, workloads: ['X'] }), /responsive/u);
});

test('smoke CLI cannot change repetitions, budgets, browser or authorized workload scope', () => {
  const args = ['manifest', 'archive', 'build-manifest', 'output'].map(name => `--${name}=fixture-${name}`);
  assert.equal(smokeOptions(args).manifest, 'fixture-manifest');
  for (const extra of ['--samples=2', '--budget=100', '--browser=webkit', '--workload=T', '--manifest=second']) assert.throws(() => smokeOptions([...args, extra]));
  assert.throws(() => smokeOptions(args.slice(1)));
});

test('functional outcomes discard timings and raw extras while requiring actual generation and visible semantics', () => {
  const operation = { id: 'edit', kind: 'interaction', trigger: 'host', expectedFingerprint: 'edited' };
  const record = { ...operation, generation: 'g1', fingerprint: 'edited', start: 10, listenerReceipt: null, semanticCommit: 20, renderOpportunity: 40, censored: false, extras: { durationMs: 30 } };
  const oracle = { generation: 'g1', status: 'committed', fingerprint: 'edited', connected: true, visible: true };
  assert.deepEqual(semanticSmokeOutcome(record, operation, 'g1', oracle), { id: 'edit', status: 'committed', trigger: 'host', fingerprint: 'edited' });
  for (const patch of [{ generation: 'stale' }, { visible: false }, { connected: false }, { status: 'pending' }, { fingerprint: 'wrong' }]) assert.throws(() => semanticSmokeOutcome(record, operation, 'g1', { ...oracle, ...patch }));
  assert.throws(() => semanticSmokeOutcome({ ...record, censored: true }, operation, 'g1', oracle));
});

test('a smoke attempt with no authorization cannot initialize artifacts or open collection sessions', async () => {
  const driver = createProfileDriver({});
  await assert.rejects(driver.smoke({}, { retain: async () => {} }), /functional-smoke/u);
  await assert.rejects(driver.openSample({}), /unverified/u);
  await driver.close();
});
