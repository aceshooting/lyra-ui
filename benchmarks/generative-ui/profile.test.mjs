import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFixture, validatePrepared, validateCollectionManifest, runProfile, profilePlan, inspectQuietReceipt, collectionSchedule, validateInputInventory } from './profile.mjs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { reviewedQuietFixture, sharedHostQuietFixture, aggregateHostQuietFixture } from './profile-reviewed.test-fixture.mjs';
import { quietEvidenceFromBytes } from './profile-driver.mjs';

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

test('normal timing CLI rejects missing arguments through its real driver without an entrypoint await cycle', () => {
  for (const args of [[], ['--invalid']]) {
    const result = spawnSync(process.execPath, [new URL('./profile.mjs', import.meta.url).pathname, ...args], { encoding: 'utf8', timeout: 5000 });
    assert.equal(result.error, undefined); assert.equal(result.signal, null);
    assert.equal(result.status, 1, result.stderr); assert.equal(result.stdout, '');
    assert.equal(result.stderr, 'Profile collection stopped without qualification. Inspect retained failure evidence and explicit authorization receipts.\n');
    assert.doesNotMatch(result.stderr, /unsettled|top-level await/iu);
  }
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
    harness: { runnerSha256: 'e'.repeat(64), resultsSha256: 'e'.repeat(64), measurementSha256: 'e'.repeat(64), driverSha256: 'e'.repeat(64), admissionSha256: '9'.repeat(64) },
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
  assert.throws(() => validateCollectionManifest({ ...manifest(), quietObserver: { profile: 'unknown' } }));
  const refinedReceipt = manifest(); refinedReceipt.quietReceipt.admission = { profile: 'reviewed-idle-service-v1', accepted: true };
  assert.throws(() => validateCollectionManifest(refinedReceipt));
  for (const kind of ['shared-host-observed-live-receipt', 'shared-host-aggregate-live-receipt', 'unknown-live-receipt']) {
    const nonStrict = manifest(); nonStrict.quietReceipt.kind = kind; assert.throws(() => validateCollectionManifest(nonStrict));
  }
});

test('reviewed manifests bind exact observer, current helper, collection and independently approved receipt', () => {
  const { observer, receipt } = reviewedQuietFixture(), value = { ...manifest(), quietObserver: observer, quietReceipt: receipt };
  validateCollectionManifest(value);
  assert.equal(value.quietReceipt.contaminated, true);
  for (const mutate of [value => { delete value.harness.admissionSha256; }, value => { value.quietObserver.configSha256 = 'f'.repeat(64); },
    value => { value.quietObserver.scope.processCpu = 'all-processes'; }, value => { value.quietReceipt.admission.inspected = false; },
    value => { value.collection.id = 'different'; }, value => { value.harness.admissionSha256 = '8'.repeat(64); }, value => { delete value.quietObserver; }]) {
    const changed = structuredClone(value); mutate(changed); assert.throws(() => validateCollectionManifest(changed));
  }
});

test('shared-host manifest explicitly binds its different admission and retains original strict failure', () => {
  const shared = sharedHostQuietFixture(), reviewed = reviewedQuietFixture();
  const value = { ...manifest(), quietObserver: shared.observer, quietReceipt: shared.receipt };
  validateCollectionManifest(value);
  assert.equal(value.quietReceipt.contaminated, true); assert.equal(value.quietReceipt.maxUnrelatedProcessCpuFractionOfOneCore, .35875);
  assert.throws(() => validateCollectionManifest({ ...value, quietObserver: undefined }));
  assert.throws(() => validateCollectionManifest({ ...value, quietObserver: reviewed.observer }));
  assert.throws(() => validateCollectionManifest({ ...value, quietReceipt: reviewed.receipt }));
});

test('aggregate manifest requires its own explicit profile while preserving strict diagnostics', () => {
  const aggregate = aggregateHostQuietFixture(), value = { ...manifest(), quietObserver: aggregate.observer, quietReceipt: aggregate.receipt };
  validateCollectionManifest(value);
  assert.equal(value.quietReceipt.contaminated, true); assert.equal(value.quietReceipt.admission.metrics.idleServicesVerified, false);
  assert.equal(value.quietObserver.scope.processCpu, 'sampled-unrelated-userspace-observational');
  for (const observer of [undefined, reviewedQuietFixture().observer, sharedHostQuietFixture().observer]) assert.throws(() => validateCollectionManifest({ ...value, quietObserver: observer }));
  for (const receipt of [reviewedQuietFixture().receipt, sharedHostQuietFixture().receipt]) assert.throws(() => validateCollectionManifest({ ...value, quietReceipt: receipt }));
});

for (const fixture of [reviewedQuietFixture, sharedHostQuietFixture, aggregateHostQuietFixture]) test(`runner retains ${fixture.name} strict failures and both quiet observations before stopping`, async () => {
  const { observer, receipt } = fixture(), input = { ...manifest(), quietObserver: observer, quietReceipt: receipt };
  const retained = [], trace = []; let quietChecks = 0, opens = 0, rejectPost = false;
  const clean = structuredClone(receipt); Object.assign(clean, { contaminated: false, failures: [], observationComplete: true, coverageIssues: [], concurrentTaskWorkloads: false,
    maxUnrelatedProcessCpuFractionOfOneCore: .02 }); clean.admission.kernelCoverageIssues = []; clean.admission.metrics.maxUnrelatedUserspaceProcessCpuFractionOfOneCore = .02;
  if (fixture === aggregateHostQuietFixture) Object.assign(clean, structuredClone(receipt));
  const sources = [JSON.stringify(receipt), `\n${JSON.stringify(clean, null, 2)}\n`];
  const hashes = sources.map(source => createHash('sha256').update(source).digest('hex'));
  const evidence = hash => quietEvidenceFromBytes(Buffer.from(sources[hash === '1' ? 0 : 1]), input.collection.id,
    { now: 120001, quietObserver: observer, admissionSha256: input.harness.admissionSha256 });
  const disposal = { connectedNodes: 0, connectedElements: 0, retainedSources: 0, pendingOperations: 0 };
  const operation = input.fixtures.T.operations[0];
  const session = { temperatureEvidence: { freshContext: true, primedMounts: 0, fullyDisposedBeforeSample: true },
    async prepare() { return { generation: 'g1', manifest: { workload: 'T', sha256: input.fixtures.T.sha256 }, operations: [operation] }; },
    async runOperation() { return { ...operation, generation: 'g1', fingerprint: operation.expectedFingerprint, start: 1, listenerReceipt: null, semanticCommit: 2,
      renderOpportunity: 3, censored: false, firstMount: { scope: 'first-operation-lifecycle', operationId: operation.id, generation: 'g1', start: 0, semanticCommit: 2, renderOpportunity: 3 } }; },
    async readOracle() { return { generation: 'g1', status: 'committed', fingerprint: operation.expectedFingerprint, connected: true, visible: true }; },
    async dispose() { trace.push('dispose'); return disposal; }, async close() { trace.push('close'); }, async startObservation() {}, async phase() {}, async activate() {},
    async finishObservation() { return { capabilities: input.controls.chromium, window: { start: 0, end: 4 }, observers: { longTasks: null, layoutShifts: null },
      renderer: { supported: false, reason: 'synthetic', taskMs: null, scriptMs: null, layoutMs: null, styleMs: null } }; } };
  const driver = { kind: 'playwright-profile-v1', async verify() { return { kind: 'browser-artifact-verification', actual: { candidate: input.candidate, harness: input.harness,
    environment: input.environment, fixtures: input.fixtures, controls: input.controls, fixtureBuild: input.fixtureBuild } }; },
    async openSample() { opens++; return session; }, async checkQuiet() {
      quietChecks++;
      if (quietChecks === 3) throw new Error('Synthetic stop after one retained sample.');
      if (quietChecks === 2 && rejectPost) {
        const refused = structuredClone(receipt); refused.admission.accepted = false;
        return quietEvidenceFromBytes(Buffer.from(JSON.stringify(refused)), input.collection.id, { now: 120001, quietObserver: observer, admissionSha256: input.harness.admissionSha256 });
      }
      return evidence(quietChecks === 1 ? '1' : '2');
    },
    async close() { trace.push('driver-close'); } };
  await assert.rejects(runProfile({ driver, manifest: input, retain: async record => { retained.push(structuredClone(record)); } }), error => {
    const sample = error.report.warmups[0];
    assert.equal(sample.contaminated, true); assert.equal(sample.quietEvidence.before.receiptSha256, hashes[0]);
    assert.equal(sample.quietEvidence.after.receiptSha256, hashes[1]); assert.deepEqual(sample.quietEvidence.before.receipt.failures, receipt.failures);
    assert.equal(sample.quietEvidence.after.receiptSource, sources[1]); assert.equal(sample.admissionSha256, input.harness.admissionSha256);
    assert.equal(sample.quietEvidence.after.contaminated, clean.contaminated); assert.deepEqual(sample.quietEvidence.after.receipt.failures, clean.failures);
    assert.equal(error.report.qualification, 'not-assessed'); assert.deepEqual(error.report.quietObserver, observer); return true;
  });
  assert.equal(opens, 1); assert.deepEqual(trace, ['dispose', 'close', 'driver-close']);
  assert.deepEqual(retained.map(row => row.kind), ['verification', 'warmup', 'failure']);
  quietChecks = 0; opens = 0; rejectPost = true; retained.length = 0; trace.length = 0;
  await assert.rejects(runProfile({ driver, manifest: input, retain: async record => { retained.push(structuredClone(record)); } }), error => {
    assert.equal(error.report.warmups.length, 0);
    const refused = error.report.lastAttempt.quietEvidence.after;
    assert.equal(refused.contaminated, true); assert.equal(refused.receipt.admission.accepted, false);
    assert.equal(refused.receiptSource, JSON.stringify(refused.receipt));
    assert.deepEqual(refused.receipt.failures, receipt.failures); assert.deepEqual(error.report.refusedQuietEvidence, refused);
    return true;
  });
  assert.equal(opens, 1); assert.deepEqual(trace.slice(-2), ['close', 'driver-close']);
  assert.deepEqual(retained.map(row => row.kind), ['verification', 'failure']);
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

test('rejected operation retains completed response measurement and partial settlement before cleanup', async () => {
  const input = manifest(), trace = [], retained = [];
  input.fixtures.T.operations = [{ ...input.fixtures.T.operations[0], id: 'release-reader' }];
  const diagnostic = { readerRelease: { measurement: { id: 'release-reader', generation: 'g1', start: 10, semanticCommit: 40, renderOpportunity: 50 },
    completion: { schemaVersion: 1, endpoint: 'follow-release-visible-v1', nativeEventStart: 10, firstTopAt: 90, scrollEndAt: null,
      settledAt: null, finalTop: 0, finalFollowing: false, eventToTopMs: 80, eventToScrollEndMs: null, eventToSettledMs: null } } };
  const original = Object.assign(new Error('Native settlement timed out.'), { diagnostic });
  const session = { temperatureEvidence: { freshContext: true, primedMounts: 0, fullyDisposedBeforeSample: true },
    async prepare() { return { generation: 'g1', manifest: { workload: 'T', sha256: input.fixtures.T.sha256 }, operations: input.fixtures.T.operations }; },
    async startObservation() {}, async phase() { trace.push('phase'); }, async activate() {},
    async runOperation() { trace.push('operation'); throw original; },
    async readOracle() { assert.fail('A rejected operation cannot commit its oracle.'); }, async finishObservation() { assert.fail('A rejected operation cannot finish a sample.'); },
    async dispose() { trace.push('dispose'); diagnostic.readerRelease.measurement.renderOpportunity = 999; },
    async close() { trace.push('close'); } };
  const driver = { kind: 'playwright-profile-v1', async verify() { return { kind: 'browser-artifact-verification', actual: { candidate: input.candidate, harness: input.harness, environment: input.environment, fixtures: input.fixtures, controls: input.controls, fixtureBuild: input.fixtureBuild } }; },
    async openSample() { return session; }, async checkQuiet() { return { contaminated: false, receiptSha256: '1'.repeat(64) }; }, async close() { trace.push('driver-close'); } };
  await assert.rejects(runProfile({ driver, manifest: input, retain: async row => { retained.push(structuredClone(row)); if (row.kind === 'failure') trace.push('retain-failure'); } }), error => {
    assert.equal(error.cause, original); assert.equal(error.report.status, 'incomplete'); assert.equal(error.report.qualification, 'not-assessed');
    assert.equal(error.report.samples.length, 0); assert.equal(error.report.warmups.length, 0); assert.deepEqual(error.report.lastAttempt.operations, []);
    assert.equal(error.report.lastAttempt.diagnostic.readerRelease.measurement.renderOpportunity, 50);
    assert.equal(error.report.lastAttempt.diagnostic.readerRelease.completion.scrollEndAt, null); return true;
  });
  assert.deepEqual(trace, ['phase', 'operation', 'retain-failure', 'dispose', 'close', 'driver-close']);
  assert.equal(retained.at(-1).value.lastAttempt.diagnostic.readerRelease.measurement.renderOpportunity, 50);
  assert.equal(retained.at(-1).value.lastAttempt.diagnostic.readerRelease.completion.firstTopAt, 90);
});

test('input byte inventories cannot omit identity or substitute character counts for byte counts', () => {
  const input = { json: { sha256: 'a'.repeat(64), utf8Bytes: 4, utf16Units: 2 } };
  assert.doesNotThrow(() => validateInputInventory(input));
  for (const value of [{}, { json: { ...input.json, sha256: 'unbound' } }, { json: { ...input.json, utf8Bytes: undefined } }, { json: { ...input.json, utf16Units: -1 } }]) assert.throws(() => validateInputInventory(value));
});
