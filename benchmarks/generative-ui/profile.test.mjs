import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFixture, validatePrepared, validateCollectionManifest, runProfile, profilePlan, inspectQuietReceipt, collectionSchedule, validateInputInventory } from './profile.mjs';

test('fixture boundary is explicit and requires current operation inventory and authored identity', () => {
  assert.throws(() => validateFixture({ prepare() {} }));
  assert.doesNotThrow(() => validateFixture({ prepare() {}, runOperation() {}, readOracle() {}, dispose() {} }));
  const prepared = { generation: 'g1', manifest: { sha256: 'a'.repeat(64), workload: 'T' }, operations: [{ id: 'append', kind: 'interaction', trigger: 'host', expectedFingerprint: 'text-v2' }] };
  assert.doesNotThrow(() => validatePrepared(prepared, profilePlan().cells[0]));
  assert.throws(() => validatePrepared({ ...prepared, operations: [] }, profilePlan().cells[0]));
  assert.throws(() => validatePrepared({ ...prepared, operations: [...prepared.operations, ...prepared.operations] }, profilePlan().cells[0]));
});

test('runner plan cannot be mistaken for collected qualification', () => {
  const plan = profilePlan(); assert.equal(plan.status, 'not-collected'); assert.equal(plan.cells.length, 69);
  assert.equal(plan.measuredSamples, 4140); assert.equal(plan.warmupSamples, 414);
  assert.equal(Object.hasOwn(plan, 'metrics'), false);
});

test('collection refuses absent actual candidate/browser/control inventory and synthetic drivers', async () => {
  assert.throws(() => validateCollectionManifest({}));
  await assert.rejects(runProfile({ driver: { kind: 'synthetic' } }), /driver|manifest/u);
  await assert.rejects(runProfile({}), /driver|manifest/u);
});

test('quiet receipt fails closed for omitted inspection, load, swap or short precheck', () => {
  const good = { inspected: true, seconds: 60, meanCpuBusyFraction: .01, normalizedOneMinuteLoad: .01, maxUnrelatedProcessCpuFractionOfOneCore: 0, swapActivity: false, concurrentTaskWorkloads: false, sha256: 'b'.repeat(64) };
  assert.doesNotThrow(() => inspectQuietReceipt(good));
  for (const patch of [{ inspected: false }, { seconds: 59 }, { meanCpuBusyFraction: .06 }, { swapActivity: true }, { concurrentTaskWorkloads: true }, { normalizedOneMinuteLoad: undefined }]) assert.throws(() => inspectQuietReceipt({ ...good, ...patch }));
});

function manifest() {
  const capabilities = { longtask: { supported: false, positiveControl: false, reason: 'synthetic-unit-case' }, layoutShift: { supported: false, positiveControl: false, reason: 'synthetic-unit-case' } };
  const fixture = { sha256: 'c'.repeat(64), operations: [{ id: 'append', kind: 'interaction', trigger: 'host', expectedFingerprint: 'text-v2' }] };
  return { schemaVersion: 1, method: profilePlan().method, collection: { authorized: true, id: 'synthetic-contract-test', designSha256: 'a'.repeat(64) },
    candidate: { archiveSha256: 'b'.repeat(64), lockfileSha256: 'b'.repeat(64), buildSha256: 'b'.repeat(64) },
    harness: { runnerSha256: 'e'.repeat(64), resultsSha256: 'e'.repeat(64), measurementSha256: 'e'.repeat(64), driverSha256: 'e'.repeat(64) },
    fixtureBuild: { bundleSha256: 'f'.repeat(64), inputsSha256: 'f'.repeat(64), hostSha256: 'f'.repeat(64), recordingSha256: 'f'.repeat(64) },
    environment: { node: '22.23.2', os: 'synthetic', arch: 'synthetic', cpuModel: 'synthetic', logicalCpus: 1, memoryBytes: 1, playwright: 'test', esbuild: 'test',
      browsers: Object.fromEntries(['chromium', 'firefox', 'webkit'].map(engine => [engine, { version: 'synthetic', executableSha256: 'c'.repeat(64) }])) },
    fixtures: Object.fromEntries(['T', 'C', 'L', 'V', 'X', 'D', 'S', 'R', 'A', 'K'].map(id => [id, fixture])),
    controls: Object.fromEntries(['chromium', 'firefox', 'webkit'].map(id => [id, capabilities])),
    quietReceipt: { inspected: true, seconds: 60, meanCpuBusyFraction: 0, normalizedOneMinuteLoad: 0, maxUnrelatedProcessCpuFractionOfOneCore: 0, swapActivity: false, concurrentTaskWorkloads: false, sha256: 'd'.repeat(64) } };
}

test('artifact verification mismatch stops before opening samples, retains failure and closes driver', async () => {
  let opened = 0, closed = 0; const retained = [];
  const driver = { kind: 'playwright-profile-v1', async verify() { return { kind: 'browser-artifact-verification', actual: {} }; }, async openSample() { opened++; }, async checkQuiet() {}, async close() { closed++; } };
  await assert.rejects(runProfile({ driver, manifest: manifest(), retain: async record => retained.push(record) }), /without qualification/u);
  assert.equal(opened, 0); assert.equal(closed, 1);
  assert.equal(retained[0].kind, 'failure'); assert.equal(retained[0].value.qualification, 'not-assessed');
  assert.equal(retained[0].value.status, 'incomplete');
});

test('manifest refuses missing workload or unsupported browser identity before driver access', () => {
  const value = manifest(); assert.doesNotThrow(() => validateCollectionManifest(value));
  delete value.fixtures.K; assert.throws(() => validateCollectionManifest(value));
  const noBrowser = manifest(); delete noBrowser.environment.browsers.webkit.executableSha256; assert.throws(() => validateCollectionManifest(noBrowser));
  const wrongControl = manifest(); wrongControl.controls.chromium = { ...wrongControl.controls.chromium, longtask: { supported: true, positiveControl: true, receipt: 'not-a-hash' } };
  assert.throws(() => validateCollectionManifest(wrongControl));
});

test('collection ordering pairs cold and warm without retaining sixty pages or mixing sample identities', () => {
  const schedule = collectionSchedule();
  assert.equal(schedule.length, 4554);
  assert.equal(schedule[0].cell.temperature, 'cold');
  assert.equal(schedule[1].cell.temperature, 'warm');
  assert.equal(schedule[0].pairId, schedule[1].pairId);
  assert.equal(schedule[0].keepContext, true); assert.equal(schedule[1].keepContext, false);
  assert.equal(schedule.filter(row => row.primeCold).length, 9 * 66);
  assert.equal(new Set(schedule.filter(row => !row.position.warmup).map(row => `${row.cell.id}/${row.position.sampleIndex}`)).size, 4140);
});

test('a synthetic contract mismatch cleans up a prepared session and cannot produce a qualification report', async () => {
  const input = manifest(), retained = []; let disposed = 0, closed = 0, driverClosed = 0;
  const session = { temperatureEvidence: { freshContext: true, primedMounts: 0, fullyDisposedBeforeSample: true },
    async prepare() { return { generation: 'g1', manifest: { workload: 'T', sha256: '0'.repeat(64) }, operations: input.fixtures.T.operations }; },
    async runOperation() {}, async readOracle() {}, async dispose() { disposed++; }, async close() { closed++; },
    async startObservation() {}, async phase() {}, async finishObservation() {}, async activate() {} };
  const driver = { kind: 'playwright-profile-v1', async verify() { return { kind: 'browser-artifact-verification', actual: { candidate: input.candidate, harness: input.harness, environment: input.environment, fixtures: input.fixtures, controls: input.controls, fixtureBuild: input.fixtureBuild } }; },
    async openSample() { return session; }, async checkQuiet() { return { contaminated: false, receiptSha256: '1'.repeat(64) }; }, async close() { driverClosed++; } };
  await assert.rejects(runProfile({ driver, manifest: input, retain: async row => retained.push(row) }), /without qualification/u);
  assert.equal(disposed, 1); assert.equal(closed, 1); assert.equal(driverClosed, 1);
  assert.equal(retained.length, 2); assert.equal(retained[0].kind, 'verification'); assert.equal(retained[1].value.samples.length, 0);
  assert.equal(retained[1].value.qualification, 'not-assessed');
});

test('input byte inventories cannot omit identity or substitute character counts for byte counts', () => {
  const input = { json: { sha256: 'a'.repeat(64), utf8Bytes: 4, utf16Units: 2 } };
  assert.doesNotThrow(() => validateInputInventory(input));
  for (const value of [{}, { json: { ...input.json, sha256: 'unbound' } }, { json: { ...input.json, utf8Bytes: undefined } }, { json: { ...input.json, utf16Units: -1 } }]) assert.throws(() => validateInputInventory(value));
});
