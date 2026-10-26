import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { MEMORY_PHASES } from './memory-workload.mjs';
import { memoryProfilePlan, validateMemoryManifest, runMemoryProfile } from './memory-profile.mjs';
import { reviewedQuietFixture, sharedHostQuietFixture, aggregateHostQuietFixture } from './profile-reviewed.test-fixture.mjs';
import { quietEvidenceFromBytes } from './profile-driver.mjs';

const digest = 'a'.repeat(64);
const manifest = () => ({ schemaVersion: 1, kind: 'memory-profile', authorized: true, collectionId: 'synthetic-contract-test',
  designSha256: digest, sourceSha256: digest, compositionSha256: digest,
  candidate: { archiveSha256: digest, lockfileSha256: digest, buildSha256: digest },
  browser: { engine: 'chromium', executableSha256: digest }, configuration: memoryProfilePlan() });
const observation = phase => ({ phase, gcPasses: 2, taskBetweenGcPasses: true,
  heap: { usedSize: 16 * 1024 * 1024, totalSize: 32 * 1024 * 1024, embedderHeapUsedSize: null, backingStorageSize: null },
  rendererDom: { documents: 1, nodes: 2, jsEventListeners: 0 }, connectedFixtureNodes: phase.includes('disposed') || phase === 'baseline' ? 0 : 20,
  connectedFixtureElements: phase.includes('disposed') || phase === 'baseline' ? 0 : 10, sourceCharacters: phase === 'mounted' ? 1024 : 0,
  controllerParts: phase.includes('disposed') ? 0 : 12, controllerIslands: phase.includes('disposed') ? 0 : 12,
  pendingOperations: 0, actions: phase === 'restored-disposed' ? 2 : 1, protocolOwners: 0, protocolSurfaces: phase.includes('disposed') || phase === 'baseline' ? 0 : 3,
  externalArchiveBytes: ['released', 'disposed', 'restored'].includes(phase) ? 1000 : 0 });
function fakeDriver({ failCycle = false, invalidBaseline = false, failLargeX = false, quietEvidence } = {}) {
  const opened = [], closed = [], calls = [], quietChecks = [];
  let driverClosed = false;
  return { opened, closed, calls, quietChecks, get driverClosed() { return driverClosed; },
    async verify() { calls.push('verify'); return { synthetic: true, admissionSha256: reviewedQuietFixture().receipt.admissionSha256 }; },
    async checkQuiet(identity) { quietChecks.push(identity); return structuredClone(quietEvidence ?? { contaminated: false, receiptSha256: digest }); },
    async openProcess(identity) {
      const processId = opened.length; opened.push(identity);
      return {
        async baseline() { calls.push(`baseline:${processId}`); return { ...observation('baseline'), ...(invalidBaseline ? { heap: { usedSize: -7, totalSize: 42 }, rendererDom: { documents: 9, nodes: 321, jsEventListeners: 87 } } : {}) }; },
        async cycle(task) {
          calls.push({ processId, ...task });
          return { ...task, savedBytes: 1000, archiveSha256: digest, semanticAssertionsPassed: !failCycle, contaminated: false,
            observations: MEMORY_PHASES.map(phase => ({ ...observation(phase), protocolOwners: !phase.includes('disposed') && task.admission === 'adapters' ? 2 : 0 })) };
        },
        async largeX() { if (failLargeX) throw Object.assign(new Error('Post-observation X oracle failed.'), { attempt: { kind: 'large-X', semanticAssertionsPassed: false, lastCommand: 'readXOracle', observation: observation('mounted') } }); return { semanticAssertionsPassed: true, observation: observation('mounted'),
          disposal: { connectedFixtureNodes: 0, connectedFixtureElements: 0, pendingOperations: 0, sourceCharacters: 0 } }; },
        async close() { assert.equal(closed.includes(processId), false, 'A process closed twice.'); closed.push(processId); },
      };
    },
    async close() { driverClosed = true; },
  };
}

test('memory authorization cannot be replaced by timing permission or altered procedure', () => {
  assert.doesNotThrow(() => validateMemoryManifest(manifest()));
  for (const mutate of [value => { value.authorized = false; }, value => { value.kind = 'functional-smoke'; },
    value => { value.configuration.gcPasses = 1; }, value => { value.configuration.archiveBytes++; }, value => { delete value.sourceSha256; }]) {
    const value = manifest(); mutate(value); assert.throws(() => validateMemoryManifest(value));
  }
});

function reviewedEvidence(collectionId = 'synthetic-contract-test') {
  return receiptEvidence(reviewedQuietFixture(collectionId));
}
function receiptEvidence({ observer, receipt, receiptSource, receiptSha256 }) {
  return { observer, evidence: { receiptSha256, receiptSource, contaminated: receipt.contaminated, receipt } };
}

test('aggregate memory admission retains service activity and userspace gaps at every unchanged boundary', async () => {
  const aggregate = receiptEvidence(aggregateHostQuietFixture()), driver = fakeDriver({ quietEvidence: aggregate.evidence });
  const result = await runMemoryProfile({ ...manifest(), quietObserver: aggregate.observer }, driver, { retain: async () => {} });
  assert.equal(result.status, 'collected-needs-review'); assert.equal(result.qualification, 'not-assessed');
  assert.equal(result.cycles.length, 270); assert.equal(result.warmups.length, 18); assert.equal(result.baselines.length, 37);
  assert.equal(driver.quietChecks.length, 614); assert.equal(driver.opened.length, 37); assert.equal(driver.closed.length, 37);
  for (const record of [...result.baselines, ...result.warmups, ...result.cycles, result.largeX]) {
    assert.equal(record.contaminated, true); assert.deepEqual(record.quietObserver, aggregate.observer);
    for (const evidence of Object.values(record.quietEvidence).filter(Boolean)) {
      assert.deepEqual(evidence, aggregate.evidence);
      const raw = evidence.receipt, { metrics, services } = raw.admission;
      assert.equal(raw.maxUnrelatedProcessCpuFractionOfOneCore, .37953);
      assert.equal(raw.inspected, false); assert.equal(raw.observationComplete, false); assert.equal(raw.concurrentTaskWorkloads, true);
      assert.deepEqual(raw.failures, ['unrelated-process-cpu', 'unrelated-workload', 'process-observation-incomplete']);
      assert.equal(metrics.configuredServiceIdentitiesVerified, true); assert.equal(metrics.idleServicesVerified, false);
      assert.equal(metrics.unapprovedTaskWorkloads, true); assert.equal(metrics.userspaceObservationComplete, false);
      assert.equal(services[0].firstCpuTicks, '25'); assert.equal(services[0].lastCpuTicks, '28');
      assert.equal(services[0].maxCpuTickDelta, '3'); assert.equal(services[0].zeroCpuIntervals, 59);
      assert.equal(services[0].identityMatchedIntervals, 60);
      assert.ok(raw.coverageIssues.some(gap => gap.kind === 'unrelated-exit-final-cpu-unobserved' && gap.kernelThread === false));
    }
  }
  assert.equal(result.baselines.every(row => row.quietEvidence.after === null), true, 'baselines retain only their actual pre-open gate');
  assert.equal(result.summaries.every(row => row.quietObserver.profile === 'shared-host-aggregate-v1'), true);
  for (const quietObserver of [undefined, reviewedQuietFixture().observer, sharedHostQuietFixture().observer]) {
    const refused = fakeDriver({ quietEvidence: aggregate.evidence });
    await assert.rejects(runMemoryProfile({ ...manifest(), ...(quietObserver ? { quietObserver } : {}) }, refused, { retain: async () => {} }), error => {
      assert.deepEqual(error.report.lastQuietAttempt.evidence, aggregate.evidence); return true;
    });
    assert.equal(refused.opened.length, 0); assert.equal(refused.quietChecks.length, 1); assert.equal(refused.driverClosed, true);
  }
  for (const fixture of [reviewedQuietFixture, sharedHostQuietFixture]) {
    const legacy = fixture(), source = aggregate.evidence.receipt;
    for (const key of ['maxUnrelatedProcessCpuFractionOfOneCore', 'failures', 'coverageIssues']) legacy.receipt[key] = structuredClone(source[key]);
    for (const key of ['metrics', 'services', 'kernelCoverageIssues']) legacy.receipt.admission[key] = structuredClone(source.admission[key]);
    legacy.receiptSource = `${JSON.stringify(legacy.receipt)}\n`;
    legacy.receiptSha256 = createHash('sha256').update(legacy.receiptSource).digest('hex');
    const { evidence } = receiptEvidence(legacy), refused = fakeDriver({ quietEvidence: evidence });
    await assert.rejects(runMemoryProfile({ ...manifest(), quietObserver: legacy.observer }, refused, { retain: async () => {} }), error => {
      assert.match(error.cause.message, /fixed gates/u);
      assert.deepEqual(error.report.lastQuietAttempt.evidence, evidence); return true;
    });
    assert.equal(refused.opened.length, 0); assert.equal(refused.quietChecks.length, 1);
  }
});

test('shared-host memory admission alone accepts the source-bound background statistic without changing any gate or cycle', async () => {
  const shared = receiptEvidence(sharedHostQuietFixture()), driver = fakeDriver({ quietEvidence: shared.evidence });
  const result = await runMemoryProfile({ ...manifest(), quietObserver: shared.observer }, driver, { retain: async () => {} });
  assert.equal(result.quietObserver.profile, 'shared-host-observed-v1');
  assert.equal(result.status, 'collected-needs-review'); assert.equal(result.qualification, 'not-assessed');
  assert.equal(result.cycles.length, 270); assert.equal(result.warmups.length, 18); assert.equal(result.baselines.length, 37);
  assert.equal(driver.quietChecks.length, 614); assert.equal(driver.opened.length, 37); assert.equal(driver.closed.length, 37);
  for (const record of [...result.cycles, ...result.warmups, result.largeX]) {
    assert.equal(record.contaminated, true);
    assert.equal(record.quietObserver.profile, shared.observer.profile);
    for (const boundary of ['before', 'after']) {
      assert.deepEqual(record.quietEvidence[boundary], shared.evidence);
      assert.equal(record.quietEvidence[boundary].receipt.maxUnrelatedProcessCpuFractionOfOneCore, .35875);
      assert.ok(record.quietEvidence[boundary].receipt.failures.includes('unrelated-process-cpu'));
    }
  }
  assert.equal(result.baselines.every(row => row.quietEvidence.after === null), true);
  assert.equal(result.summaries.every(row => row.quietObserver.profile === shared.observer.profile), true);

  const reviewed = reviewedEvidence(), higherReviewed = reviewedEvidence();
  const raw = higherReviewed.evidence.receipt;
  raw.maxUnrelatedProcessCpuFractionOfOneCore = .35875;
  raw.admission.metrics.maxUnrelatedUserspaceProcessCpuFractionOfOneCore = .35875;
  raw.failures.unshift('unrelated-process-cpu');
  higherReviewed.evidence.receiptSource = `${JSON.stringify(raw)}\n`;
  higherReviewed.evidence.receiptSha256 = createHash('sha256').update(higherReviewed.evidence.receiptSource).digest('hex');
  for (const [quietObserver, evidence, expected] of [
    [undefined, shared.evidence, undefined], [reviewed.observer, shared.evidence, undefined],
    [shared.observer, reviewed.evidence, undefined], [reviewed.observer, higherReviewed.evidence, /fixed gates/u],
  ]) {
    const refused = fakeDriver({ quietEvidence: evidence });
    await assert.rejects(runMemoryProfile({ ...manifest(), ...(quietObserver ? { quietObserver } : {}) }, refused, { retain: async () => {} }), error => {
      assert.deepEqual(error.report.lastQuietAttempt.evidence, evidence);
      if (expected) assert.match(error.cause.message, expected);
      return true;
    });
    assert.equal(refused.opened.length, 0); assert.equal(refused.quietChecks.length, 1); assert.equal(refused.driverClosed, true);
  }
});

test('memory observer admission is explicit and cannot alter the frozen lifecycle procedure', () => {
  const { observer } = reviewedEvidence();
  assert.doesNotThrow(() => validateMemoryManifest({ ...manifest(), quietObserver: observer }));
  for (const patch of [{ profile: 'unknown' }, { configSha256: '' }, { scope: { ...observer.scope, coverage: 'all' } }, { cpuCeiling: .5 }])
    assert.throws(() => validateMemoryManifest({ ...manifest(), quietObserver: { ...observer, ...patch } }));
  const changed = { ...manifest(), quietObserver: observer };
  changed.configuration.gcPasses = 1;
  assert.throws(() => validateMemoryManifest(changed), /procedure/u);
});

test('reviewed memory evidence retains strict contamination at every actual boundary without changing the schedule', async () => {
  const { observer, evidence } = reviewedEvidence(), driver = fakeDriver({ quietEvidence: evidence });
  const frozenObserver = structuredClone(observer);
  const retained = [], expected = { ...manifest(), quietObserver: observer };
  driver.verify = async value => {
    assert.equal(Object.isFrozen(value.quietObserver), true);
    assert.equal(Object.isFrozen(value.quietObserver.scope), true);
    expected.quietObserver.configSha256 = 'b'.repeat(64);
    return { synthetic: true, admissionSha256: evidence.receipt.admissionSha256 };
  };
  const result = await runMemoryProfile(expected, driver, { retain: async row => { retained.push(structuredClone(row)); } });
  assert.equal(result.status, 'collected-needs-review'); assert.equal(result.qualification, 'not-assessed');
  assert.equal(result.cycles.length, 270); assert.equal(result.warmups.length, 18); assert.equal(result.baselines.length, 37);
  assert.deepEqual(result.quietObserver, frozenObserver);
  for (const record of [...result.cycles, ...result.warmups, result.largeX]) {
    assert.equal(record.collectionId, expected.collectionId); assert.deepEqual(record.quietObserver, frozenObserver);
    assert.equal(record.admissionSha256, result.artifacts.admissionSha256);
    assert.equal(record.contaminated, true);
    for (const boundary of ['before', 'after']) {
      assert.deepEqual(record.quietEvidence[boundary], evidence);
      assert.equal(record.quietEvidence[boundary].receipt.admission.accepted, true);
      assert.equal(record.quietEvidence[boundary].receipt.observationComplete, false);
      assert.equal(record.quietEvidence[boundary].receipt.concurrentTaskWorkloads, true);
    }
  }
  for (const record of result.baselines) {
    assert.deepEqual(record.quietEvidence.before, evidence);
    assert.equal(record.quietEvidence.after, null, 'there is no post-baseline gate');
    assert.equal(record.admissionSha256, result.artifacts.admissionSha256);
    assert.equal(record.contaminated, true);
  }
  assert.equal(retained.filter(row => row.kind === 'cycle-attempt').length, 270);
  assert.equal(retained.find(row => row.kind === 'cycle-attempt').value.quietEvidence.after, null);
  assert.equal(result.summaries.every(row => row.quietObserver.configSha256 === frozenObserver.configSha256), true);
  assert.equal(result.summaries.every(row => row.admissionSha256 === result.artifacts.admissionSha256), true);
  assert.equal(driver.opened.length, 37); assert.equal(driver.closed.length, 37);
  assert.equal(driver.quietChecks.length, 614, 'original gate locations and counts remain unchanged');
});

test('strict, different-configuration and different-collection memory receipts cannot cross-admit', async () => {
  const { observer, evidence } = reviewedEvidence();
  const activeService = structuredClone(evidence);
  activeService.receipt.admission.services[0].lastCpuTicks = '26';
  const wrongHelper = structuredClone(evidence);
  wrongHelper.receipt.admissionSha256 = '8'.repeat(64); wrongHelper.receipt.precheck.admissionSha256 = '8'.repeat(64);
  for (const synthetic of [activeService, wrongHelper]) {
    synthetic.receiptSource = `${JSON.stringify(synthetic.receipt)}\n`;
    synthetic.receiptSha256 = createHash('sha256').update(synthetic.receiptSource).digest('hex');
  }
  for (const [binding, quietEvidence] of [
    [undefined, evidence],
    [observer, { contaminated: false, receiptSha256: digest }],
    [{ ...observer, configSha256: 'b'.repeat(64) }, evidence],
    [observer, reviewedEvidence('another-collection').evidence],
    [observer, activeService],
    [observer, wrongHelper],
  ]) {
    const driver = fakeDriver({ quietEvidence }), retained = [];
    await assert.rejects(runMemoryProfile({ ...manifest(), ...(binding ? { quietObserver: binding } : {}) }, driver,
      { retain: async record => { retained.push(record); } }));
    assert.equal(driver.opened.length, 0); assert.equal(driver.driverClosed, true);
    assert.equal(retained.at(-1).kind, 'failure');
    assert.deepEqual(retained.find(record => record.kind === 'quiet-attempt').value.evidence, quietEvidence);
  }
});

test('reviewed memory collection refuses a driver without a verified helper digest', async () => {
  const { observer, evidence } = reviewedEvidence(), driver = fakeDriver({ quietEvidence: evidence });
  driver.verify = async () => ({ synthetic: true });
  await assert.rejects(runMemoryProfile({ ...manifest(), quietObserver: observer }, driver, { retain: async () => {} }), error => /helper identity/u.test(error.cause.message));
  assert.equal(driver.opened.length, 0); assert.equal(driver.quietChecks.length, 0); assert.equal(driver.driverClosed, true);
});

test('a refused post-cycle receipt retains its exact raw outcome and the preceding attempted cycle', async () => {
  const { observer, evidence } = reviewedEvidence(), driver = fakeDriver({ quietEvidence: evidence });
  const refused = structuredClone(evidence.receipt); refused.admission.services[0].lastCpuTicks = '26';
  const bytes = Buffer.from(`${JSON.stringify(refused)}\n`), retained = [];
  const check = driver.checkQuiet; let checks = 0;
  driver.checkQuiet = async identity => {
    if (++checks === 3) return quietEvidenceFromBytes(bytes, manifest().collectionId, { now: 120001, quietObserver: observer, admissionSha256: evidence.receipt.admissionSha256 });
    return check(identity);
  };
  await assert.rejects(runMemoryProfile({ ...manifest(), quietObserver: observer }, driver, { retain: async record => { retained.push(record); } }), error => {
    assert.equal(error.report.lastQuietAttempt.position, 'after');
    assert.equal(error.report.lastQuietAttempt.evidence.receiptSha256, createHash('sha256').update(bytes).digest('hex'));
    assert.deepEqual(error.report.lastQuietAttempt.evidence.receipt, refused);
    assert.equal(error.report.lastQuietAttempt.evidence.contaminated, true);
    assert.equal(error.report.warmups.length, 0); assert.equal(error.report.cycles.length, 0); return true;
  });
  const attempted = retained.find(record => record.kind === 'warmup-attempt').value;
  assert.deepEqual(attempted.quietEvidence.before, evidence); assert.equal(attempted.quietEvidence.after, null);
  assert.equal(checks, 3); assert.equal(driver.opened.length, 1); assert.equal(driver.closed.length, 1);
  assert.equal(retained.at(-1).kind, 'failure');
});

test('collection CLI rejects invalid arguments without an import-cycle deadlock or browser work', () => {
  for (const args of [[], ['--invalid']]) {
    const result = spawnSync(process.execPath, [new URL('./memory-profile.mjs', import.meta.url).pathname, ...args], { encoding: 'utf8', timeout: 5000 });
    assert.equal(result.error, undefined); assert.equal(result.signal, null);
    assert.equal(result.status, 1, result.stderr); assert.equal(result.stdout, '');
    assert.equal(result.stderr, 'Memory profile stopped. Explicit memory authorization and retained failure evidence are required.\n');
    assert.doesNotMatch(result.stderr, /unsettled|top-level await/iu);
  }
});

test('injected runner executes fixed independent processes, excluded warmups and one-shot X', async () => {
  const driver = fakeDriver(), retained = [];
  const result = await runMemoryProfile(manifest(), driver, { retain: async row => { retained.push(row.kind); } });
  assert.equal(result.status, 'collected-needs-review'); assert.equal(result.cycles.length, 270); assert.equal(result.warmups.length, 18);
  assert.equal(result.baselines.length, 37); assert.equal(result.summaries.length, 6);
  assert.equal(driver.opened.length, 37); assert.equal(driver.closed.length, 37); assert.equal(driver.driverClosed, true);
  assert.equal(driver.quietChecks.length, 614);
  const persistent = driver.opened.flatMap((identity, index) => identity.regime === 'persistent' ? [index] : []);
  assert.equal(persistent.length, 6);
  for (const processId of persistent) {
    const cycles = driver.calls.filter(item => item.processId === processId);
    assert.equal(cycles.length, 43); assert.equal(cycles.slice(0, 3).every(item => item.warmup), true);
    assert.deepEqual(cycles.slice(3).map(item => item.cycle), Array.from({ length: 40 }, (_, index) => index + 1));
  }
  assert.equal(retained.filter(kind => kind === 'cycle-attempt').length, 270);
  assert.equal(retained.filter(kind => kind === 'large-X-attempt').length, 1);
});

test('first failed semantic cycle is retained and closes the process without retry', async () => {
  const driver = fakeDriver({ failCycle: true }), retained = [];
  await assert.rejects(runMemoryProfile(manifest(), driver, { retain: async row => { retained.push(row); } }), error => {
    assert.equal(error.report.status, 'incomplete'); assert.equal(error.report.cycles.length, 0); return /stopped/u.test(error.message);
  });
  assert.equal(driver.opened.length, 1); assert.equal(driver.closed.length, 1); assert.equal(driver.driverClosed, true);
  assert.equal(retained.some(row => row.kind === 'warmup-attempt' && row.value.semanticAssertionsPassed === false), true);
  assert.equal(retained.at(-1).kind, 'failure');
});


test('malformed first baseline retains its raw heap and DOM counters before validation stops the run', async () => {
  const driver = fakeDriver({ invalidBaseline: true }), retained = [];
  await assert.rejects(runMemoryProfile(manifest(), driver, { retain: async row => { retained.push(row); } }), error => {
    assert.equal(error.report.baselines.length, 0);
    assert.deepEqual(error.report.lastAttempt.observation.heap, { usedSize: -7, totalSize: 42 });
    assert.equal(error.report.lastAttempt.observation.rendererDom.jsEventListeners, 87); return true;
  });
  assert.deepEqual(retained.map(row => row.kind), ['baseline-attempt', 'failure']);
  assert.equal(retained[0].value.observation.rendererDom.nodes, 321);
  assert.equal(driver.calls.some(item => typeof item === 'object'), false);
  assert.equal(driver.opened.length, 1); assert.equal(driver.closed.length, 1); assert.equal(driver.driverClosed, true);
});

test('a thrown X failure retains its partial observation and closes the independent process', async () => {
  const driver = fakeDriver({ failLargeX: true }), retained = [];
  await assert.rejects(runMemoryProfile(manifest(), driver, { retain: async row => { retained.push(row); } }), error => {
    assert.equal(error.report.lastAttempt.kind, 'large-X');
    assert.equal(error.report.lastAttempt.lastCommand, 'readXOracle');
    assert.equal(error.report.lastAttempt.observation.heap.usedSize, 16 * 1024 * 1024); return true;
  });
  assert.equal(retained.filter(row => row.kind === 'large-X-attempt').length, 1);
  assert.equal(retained.at(-1).kind, 'failure');
  assert.equal(driver.opened.length, 37); assert.equal(driver.closed.length, 37); assert.equal(driver.driverClosed, true);
});
