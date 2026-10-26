import { createHash } from 'node:crypto';
/** Synthetic receipt data for admission contracts; no observation or collection occurs here. */
export function reviewedQuietFixture(collectionId = 'synthetic-contract-test') {
  const scope = { processCpu: 'all-unrelated-userspace', kernelCpu: 'whole-host-aggregate', coverage: 'sampled-userspace-with-explicit-kernel-gaps' };
  const observer = { profile: 'reviewed-idle-service-v1', configSha256: 'a'.repeat(64), scope };
  const identity = { pid: 20, startTimeTicks: '10', comm: 'idle-service', cmdlineSha256: 'b'.repeat(64) };
  const config = { schemaVersion: 1, kind: 'quiet-observer-config', profile: observer.profile, collectionId, bootId: 'synthetic-boot', scope, idleServices: [identity] };
  const configSource = `${JSON.stringify(config, null, 2)}\n`;
  observer.configSha256 = createHash('sha256').update(configSource).digest('hex');
  const admissionSha256 = '9'.repeat(64);
  const gap = { kind: 'unrelated-exit-final-cpu-unobserved', pid: 30, startTimeTicks: '5', comm: 'kernel-task', labels: [], flags: '2097152', kernelThread: true };
  const receipt = { schemaVersion: 1, kind: 'reviewed-idle-service-live-receipt', admissionSha256, collectionId, bootId: config.bootId, inspected: false,
    observedAt: 120000, seconds: 60.18, sha256: 'c'.repeat(64), ownershipSha256: 'd'.repeat(64), meanCpuBusyFraction: .01,
    normalizedOneMinuteLoad: .01, maxUnrelatedProcessCpuFractionOfOneCore: .02, swapActivity: false,
    concurrentTaskWorkloads: true, observationComplete: false, contaminated: true, failures: ['unrelated-workload', 'process-observation-incomplete'], coverageIssues: [gap],
    precheck: { sha256: 'c'.repeat(64), inspected: true, reviewSha256: 'e'.repeat(64), configSha256: observer.configSha256, admissionSha256, startedAt: 0, endedAt: 60180 },
    live: { intervals: 60, firstObservedAt: 61000, lastObservedAt: 120000 },
    admission: { ...observer, config, configSource, inspected: true, accepted: true, failures: [], metrics: { maxUnrelatedUserspaceProcessCpuFractionOfOneCore: .02,
      unapprovedTaskWorkloads: false, userspaceObservationComplete: true, idleServicesVerified: true },
      services: [{ identity, owned: false, observedIntervals: 60, zeroCpuIntervals: 60, identityMatchedIntervals: 60, firstCpuTicks: '25', lastCpuTicks: '25', maxCpuTickDelta: '0' }], kernelCoverageIssues: [gap] } };
  const receiptSource = `${JSON.stringify(receipt, null, 2)}\n`, receiptSha256 = createHash('sha256').update(receiptSource).digest('hex');
  return { observer, receipt, receiptSource, receiptSha256 };
}
