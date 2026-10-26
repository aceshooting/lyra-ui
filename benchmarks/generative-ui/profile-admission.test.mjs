import { createHash } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { REVIEWED_IDLE_SERVICE_PROFILE, REVIEWED_IDLE_SERVICE_SCOPE, validateObserverConfig, validateQuietObserver, reviewedAdmissionFailures, inspectReviewedQuietReceipt, makeReviewedQuietEvidence, validateQuietEvidence, parseObserverConfigBytes, validateObserverConfigSource } from './profile-admission.mjs';

const receiptBytes = receipt => {
  const receiptSource = `${JSON.stringify(receipt, null, 2)}\n`;
  return { receiptSource, receiptSha256: createHash('sha256').update(receiptSource).digest('hex') };
};

// Synthetic observer evidence only; no process inspection or monitor runs here.
function reviewedFixture() {
  const observer = { profile: REVIEWED_IDLE_SERVICE_PROFILE, configSha256: 'a'.repeat(64), scope: { ...REVIEWED_IDLE_SERVICE_SCOPE } };
  const identity = { pid: 20, startTimeTicks: '10', comm: 'idle-service', cmdlineSha256: 'b'.repeat(64) };
  const config = { schemaVersion: 1, kind: 'quiet-observer-config', profile: observer.profile, collectionId: 'synthetic', bootId: 'boot', scope: observer.scope, idleServices: [identity] };
  const configSource = `${JSON.stringify(config, null, 2)}\n`;
  observer.configSha256 = createHash('sha256').update(configSource).digest('hex');
  const admissionSha256 = '9'.repeat(64);
  const gap = { kind: 'unrelated-exit-final-cpu-unobserved', pid: 30, startTimeTicks: '5', comm: 'kernel-task', labels: [], flags: '2097152', kernelThread: true };
  const receipt = { schemaVersion: 1, kind: 'reviewed-idle-service-live-receipt', admissionSha256, collectionId: 'synthetic', bootId: 'boot', inspected: false,
    observedAt: 120000, seconds: 60.18, sha256: 'c'.repeat(64), ownershipSha256: 'd'.repeat(64), meanCpuBusyFraction: .01,
    normalizedOneMinuteLoad: .01, maxUnrelatedProcessCpuFractionOfOneCore: .02, swapActivity: false,
    concurrentTaskWorkloads: true, observationComplete: false, contaminated: true, failures: ['unrelated-workload', 'process-observation-incomplete'], coverageIssues: [gap],
    precheck: { sha256: 'c'.repeat(64), inspected: true, reviewSha256: 'e'.repeat(64), configSha256: observer.configSha256, admissionSha256, startedAt: 0, endedAt: 60180 },
    live: { intervals: 60, firstObservedAt: 61000, lastObservedAt: 120000 },
    admission: { ...observer, config, configSource, inspected: true, accepted: true, failures: [], metrics: { maxUnrelatedUserspaceProcessCpuFractionOfOneCore: .02,
      unapprovedTaskWorkloads: false, userspaceObservationComplete: true, idleServicesVerified: true },
      services: [{ identity, owned: false, observedIntervals: 60, zeroCpuIntervals: 60, identityMatchedIntervals: 60, firstCpuTicks: '25', lastCpuTicks: '25', maxCpuTickDelta: '0' }], kernelCoverageIssues: [gap] } };
  return { observer, config, receipt };
}
test('an explicit refined admission preserves raw strict failure and cannot pass as strict', () => {
  const { observer, receipt } = reviewedFixture();
  const bytes = receiptBytes(receipt);
  const evidence = makeReviewedQuietEvidence(receipt, bytes.receiptSha256, observer, { collectionId: 'synthetic', now: 120001, receiptSource: bytes.receiptSource });
  assert.equal(evidence.contaminated, true); assert.equal(evidence.receipt.observationComplete, false);
  assert.doesNotThrow(() => validateQuietEvidence(evidence, observer));
  assert.throws(() => validateQuietEvidence(evidence), /Strict/u);
  assert.throws(() => validateQuietEvidence({ ...evidence, contaminated: false }), /Strict/u);
  assert.throws(() => validateQuietEvidence({ ...evidence, contaminated: false }, observer), /contamination/u);
  assert.doesNotThrow(() => validateQuietEvidence({ contaminated: false, receiptSha256: 'f'.repeat(64) }));
});
test('config scope and identities cannot become wildcard or configurable gate policy', () => {
  const { config, observer } = reviewedFixture();
  assert.doesNotThrow(() => validateObserverConfig(config)); assert.doesNotThrow(() => validateQuietObserver(observer));
  for (const change of [value => { value.scope.coverage = 'all'; }, value => { value.cpuCeiling = 1; }, value => { value.idleServices.push(value.idleServices[0]); },
    value => { value.idleServices[0].pid = '*'; }, value => { value.idleServices[0].cmdlineSha256 = ''; }, value => { value.idleServices[0].descendants = true; }]) {
    const value = structuredClone(config); change(value); assert.throws(() => validateObserverConfig(value));
  }
});
test('missing, active, mismatched, stale or unreviewed evidence fails closed', () => {
  for (const change of [value => { value.admission.services[0].lastCpuTicks = '26'; }, value => { value.admission.services[0].owned = true; },
    value => { value.admission.services[0].identityMatchedIntervals = 59; }, value => { value.admission.inspected = false; },
    value => { value.admission.configSha256 = 'f'.repeat(64); }, value => { value.precheck.configSha256 = 'f'.repeat(64); },
    value => { value.failures = []; value.contaminated = false; }, value => { value.admission.config.bootId = 'another'; }, value => { value.admission.kernelCoverageIssues[0].flags = '0'; },
    value => { value.coverageIssues.push({ kind: 'unrelated-exit-final-cpu-unobserved', pid: 99, kernelThread: false, flags: '0' }); }]) {
    const { receipt, observer } = reviewedFixture(); change(receipt); assert.throws(() => inspectReviewedQuietReceipt(receipt, observer));
  }
  const { receipt, observer } = reviewedFixture();
  assert.throws(() => inspectReviewedQuietReceipt(receipt, observer, { now: 125001 }), /stale/u);
  assert.throws(() => inspectReviewedQuietReceipt(receipt, observer, { collectionId: 'other' }));
  assert.throws(() => inspectReviewedQuietReceipt(receipt, undefined));
});
test('whole-host, unrelated userspace, swap and coverage gates retain their exact boundaries', () => {
  const { receipt } = reviewedFixture(), metrics = receipt.admission.metrics;
  assert.deepEqual(reviewedAdmissionFailures(receipt, metrics), []);
  for (const patch of [{ meanCpuBusyFraction: .05 }, { normalizedOneMinuteLoad: .1 }, { swapActivity: true }]) assert.ok(reviewedAdmissionFailures({ ...receipt, ...patch }, metrics).length);
  for (const patch of [{ maxUnrelatedUserspaceProcessCpuFractionOfOneCore: .1 }, { unapprovedTaskWorkloads: true }, { userspaceObservationComplete: false }, { idleServicesVerified: false }]) assert.ok(reviewedAdmissionFailures(receipt, { ...metrics, ...patch }).length);
  assert.ok(reviewedAdmissionFailures({ ...receipt, peakNormalizedOneMinuteLoad: .1 }, metrics, { precheck: true }).includes('total-host-load'));
});

test('approved config byte identity cannot survive a coordinated service and proof rewrite', () => {
  const { receipt, observer } = reviewedFixture();
  receipt.admission.config.idleServices[0].pid = 999;
  receipt.admission.services[0].identity.pid = 999;
  assert.throws(() => inspectReviewedQuietReceipt(receipt, observer), /config/u);
});

test('strict retained receipt cannot contradict its uncontaminated evidence wrapper', () => {
  const clean = { kind: 'quiet-live-receipt', inspected: true, sha256: 'a'.repeat(64), seconds: 60, contaminated: false, failures: [],
    observationComplete: true, concurrentTaskWorkloads: false, swapActivity: false, meanCpuBusyFraction: .01, normalizedOneMinuteLoad: .01, maxUnrelatedProcessCpuFractionOfOneCore: .01 };
  const evidence = receipt => ({ ...receiptBytes(receipt), contaminated: false, receipt });
  assert.doesNotThrow(() => validateQuietEvidence(evidence(clean)));
  for (const patch of [{ contaminated: true }, { failures: ['unrelated-workload'] }, { observationComplete: false },
    { concurrentTaskWorkloads: true }, { swapActivity: true }]) {
    assert.throws(() => validateQuietEvidence(evidence({ ...clean, ...patch })), /Strict/u);
  }
});


test('config source binds formatting and rejects lossy UTF8 as well as replaced identities', () => {
  const { config, receipt, observer } = reviewedFixture(), source = receipt.admission.configSource;
  const parsed = parseObserverConfigBytes(Buffer.from(source));
  assert.equal(parsed.configSource, source); assert.equal(parsed.configSha256, observer.configSha256);
  assert.deepEqual(parsed.config, config);
  assert.throws(() => validateObserverConfigSource(config, `${source} `, observer.configSha256), /approved file bytes/u);
  assert.throws(() => parseObserverConfigBytes(Buffer.from([0x7b, 0xff, 0x7d])), /UTF8/u);
  receipt.admission.config.idleServices[0].comm = 'other-service';
  receipt.admission.configSource = JSON.stringify(receipt.admission.config);
  assert.throws(() => inspectReviewedQuietReceipt(receipt, observer), /approved file bytes/u);
});

test('retained helper identity must match the reviewed precheck and verified harness', () => {
  const { receipt, observer } = reviewedFixture();
  assert.doesNotThrow(() => inspectReviewedQuietReceipt(receipt, observer, { admissionSha256: '9'.repeat(64) }));
  assert.throws(() => inspectReviewedQuietReceipt(receipt, observer, { admissionSha256: '8'.repeat(64) }), /helper identity/u);
  receipt.precheck.admissionSha256 = '8'.repeat(64);
  assert.throws(() => inspectReviewedQuietReceipt(receipt, observer), /helper identity/u);
});


test('retained receipt keeps exact whitespace bytes and rejects body or source substitution', () => {
  const { receipt, observer } = reviewedFixture();
  const receiptSource = `  ${JSON.stringify(receipt, null, 4)}\n\n`, receiptSha256 = createHash('sha256').update(receiptSource).digest('hex');
  const evidence = makeReviewedQuietEvidence(receipt, receiptSha256, observer, { receiptSource });
  assert.equal(evidence.receiptSource, receiptSource);
  const changed = structuredClone(evidence); changed.receipt.observedAt++;
  assert.throws(() => validateQuietEvidence(changed, observer), /source bytes/u);
  assert.throws(() => validateQuietEvidence({ ...evidence, receiptSource: `${receiptSource} ` }, observer), /source bytes/u);
  assert.throws(() => makeReviewedQuietEvidence(receipt, receiptSha256, observer), /source bytes/u);
  assert.throws(() => validateQuietEvidence({ ...evidence, receiptSource: '\ud800' }, observer), /source bytes/u);
});


test('retained strict evidence accepts its actual clean receipt and refuses pending review or excessive raw load', () => {
  const receipt = { kind: 'quiet-live-receipt', inspected: true, sha256: 'a'.repeat(64), seconds: 60, contaminated: false, failures: [],
    observationComplete: true, concurrentTaskWorkloads: false, swapActivity: false, meanCpuBusyFraction: .01, normalizedOneMinuteLoad: .01, maxUnrelatedProcessCpuFractionOfOneCore: .01 };
  const evidence = value => ({ receipt: value, ...receiptBytes(value), contaminated: false });
  assert.doesNotThrow(() => validateQuietEvidence(evidence(receipt)));
  for (const patch of [{ inspected: false }, { meanCpuBusyFraction: .05 }, { normalizedOneMinuteLoad: .1 }, { maxUnrelatedProcessCpuFractionOfOneCore: .1 }]) {
    assert.throws(() => validateQuietEvidence(evidence({ ...receipt, ...patch })), /Strict/u);
  }
});
