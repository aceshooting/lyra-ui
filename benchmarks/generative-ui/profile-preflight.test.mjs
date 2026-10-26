import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { validatePreflightAuthorization, positiveControlReceipt, preflightFixtureRecord, preflightManifestDraft, definitionDigest, createProfileDriver } from './profile-driver.mjs';
import { PROFILE_ENGINES, PROFILE_WORKLOADS, validateCapabilities } from './profile-results.mjs';
import { validateCollectionManifest } from './profile.mjs';

const hash = 'a'.repeat(64);
const authorization = () => ({ schemaVersion: 1, kind: 'profile-capability-preflight', authorized: true, sourceSha256: hash,
  candidate: { archiveSha256: hash, lockfileSha256: hash, buildSha256: hash },
  browsers: Object.fromEntries(PROFILE_ENGINES.map(engine => [engine, { executableSha256: hash }])), workloads: [...PROFILE_WORKLOADS] });

// Synthetic policy evidence only; these tests never capture browser capabilities.
test('preflight requires separate explicit all-engine/all-workload authorization and cannot authorize collection', () => {
  assert.doesNotThrow(() => validatePreflightAuthorization(authorization()));
  assert.throws(() => validatePreflightAuthorization({ ...authorization(), authorized: false }), /authorization/u);
  assert.throws(() => validatePreflightAuthorization({ ...authorization(), kind: 'functional-smoke' }), /authorization/u);
  assert.throws(() => validatePreflightAuthorization({ ...authorization(), workloads: ['T'] }), /complete/u);
  const missing = authorization(); delete missing.browsers.webkit;
  assert.throws(() => validatePreflightAuthorization(missing), /browser/u);
  const renamed = authorization(); renamed.browsers.chromium.engine = 'firefox';
  assert.throws(() => validatePreflightAuthorization(renamed), /field/u);
  for (const field of ['samples', 'collection', 'quietReceipt', 'gc']) assert.throws(() => validatePreflightAuthorization({ ...authorization(), [field]: true }), /cannot authorize/u);
  assert.throws(() => validateCollectionManifest(authorization()), /collection manifest/u);
});

test('positive controls identify exact retained JSON bytes and retain unsupported null observations honestly', () => {
  const probe = { longtask: { supported: true, durations: [80] }, layoutShift: { supported: false, values: null } };
  const result = positiveControlReceipt({ engine: 'chromium', browserVersion: 'synthetic-test', measurementSha256: hash, probe });
  assert.equal(result.sha256, createHash('sha256').update(`${JSON.stringify(result.receipt, null, 2)}\n`).digest('hex'));
  assert.equal(result.capabilities.longtask.receipt, result.sha256);
  assert.deepEqual(result.capabilities.layoutShift, { supported: false, positiveControl: false, reason: 'PerformanceObserver does not support layout-shift in this browser.' });
  assert.doesNotThrow(() => validateCapabilities(result.capabilities));
  probe.longtask.durations.push(200);
  assert.deepEqual(result.receipt.probe.longtask.durations, [80]);
  assert.throws(() => positiveControlReceipt({ engine: 'chromium', browserVersion: 'synthetic-test', measurementSha256: hash,
    probe: { longtask: { supported: true, durations: [] }, layoutShift: { supported: false, values: null } } }), /positive control/u);
  assert.throws(() => positiveControlReceipt({ engine: 'webkit', browserVersion: 'synthetic-test', measurementSha256: hash,
    probe: { longtask: { supported: false, durations: [] }, layoutShift: { supported: false, values: null } } }), /unsupported/u);
});

test('fixture inventory binds exact prepared identity, native descriptors and input bytes without operation results', () => {
  const definition = { workload: 'V', operations: [{ id: 'mount', kind: 'ready', trigger: 'host', expectedFingerprint: 'synthetic' }] };
  const prepared = { generation: 'synthetic', manifest: { workload: 'V', sha256: definitionDigest(definition) }, operations: definition.operations,
    inputs: { json: { sha256: hash, utf8Bytes: 25, utf16Units: 25 } } };
  const fixture = preflightFixtureRecord(definition, prepared, { workload: 'V' });
  assert.deepEqual(fixture, { sha256: definitionDigest(definition), operations: definition.operations, inputs: prepared.inputs });
  assert.throws(() => preflightFixtureRecord(definition, { ...prepared, manifest: { ...prepared.manifest, sha256: 'b'.repeat(64) } }, { workload: 'V' }), /fixture changed/u);
  assert.throws(() => preflightFixtureRecord(definition, { ...prepared, operations: [{ ...definition.operations[0], expectedFingerprint: 'changed' }] }, { workload: 'V' }), /inventory/u);
  assert.throws(() => preflightFixtureRecord(definition, { ...prepared, inputs: { json: { sha256: hash, utf8Bytes: -1, utf16Units: 25 } } }, { workload: 'V' }), /byte count/u);
});

test('manifest draft copies actual artifacts but supplies neither design authority nor fabricated quiet receipt', () => {
  const actual = { candidate: authorization().candidate, harness: { measurementSha256: hash }, fixtureBuild: { bundleSha256: hash },
    environment: { cpuModel: 'synthetic', browsers: {} }, fixtures: {}, controls: {} };
  const draft = preflightManifestDraft(actual);
  assert.deepEqual(draft.collection, { authorized: false, id: null, designSha256: null });
  assert.equal(draft.quietReceipt, null);
  assert.deepEqual(draft.candidate, actual.candidate);
  actual.environment.cpuModel = 'changed'; assert.equal(draft.environment.cpuModel, 'synthetic');
  assert.throws(() => validateCollectionManifest(draft), /collection manifest/u);
});

test('unapproved or cancelled preflight cannot initialize artifacts or open a collection sample', async () => {
  const driver = createProfileDriver({});
  try {
    await assert.rejects(driver.preflight({ ...authorization(), authorized: false }, { retain: async () => {} }), /authorization/u);
    const controller = new AbortController(); controller.abort();
    await assert.rejects(driver.preflight(authorization(), { retain: async () => {}, signal: controller.signal }), /aborted/u);
    await assert.rejects(driver.openSample({}), /unverified/u);
  } finally { await driver.close(); }
});
