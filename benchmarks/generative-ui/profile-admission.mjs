import { createHash } from 'node:crypto';
const require = (condition, message) => { if (!condition) throw new TypeError(message); };
const digest = value => createHash('sha256').update(value).digest('hex');
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const uint = value => typeof value === 'string' && /^\d+$/u.test(value);
const finite = value => Number.isFinite(value) && value >= 0;
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
const same = (left, right) => canonical(left) === canonical(right);
const keys = (value, names) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name));
export const REVIEWED_IDLE_SERVICE_PROFILE = 'reviewed-idle-service-v1';
export const REVIEWED_IDLE_SERVICE_SCOPE = Object.freeze({ processCpu: 'all-unrelated-userspace', kernelCpu: 'whole-host-aggregate', coverage: 'sampled-userspace-with-explicit-kernel-gaps' });
export const SHARED_HOST_OBSERVED_PROFILE = 'shared-host-observed-v1';
export const SHARED_HOST_OBSERVED_SCOPE = Object.freeze({ ...REVIEWED_IDLE_SERVICE_SCOPE, processCpu: 'all-unrelated-userspace-observational' });
export const SHARED_HOST_AGGREGATE_PROFILE = 'shared-host-aggregate-v1';
export const SHARED_HOST_AGGREGATE_SCOPE = Object.freeze({ processCpu: 'sampled-unrelated-userspace-observational', kernelCpu: 'whole-host-aggregate', coverage: 'sampled-processes-observational-with-explicit-gaps' });
const validProfile = value => value === REVIEWED_IDLE_SERVICE_PROFILE || value === SHARED_HOST_OBSERVED_PROFILE || value === SHARED_HOST_AGGREGATE_PROFILE;
const validScope = (value, profile) => {
  const scope = profile === SHARED_HOST_AGGREGATE_PROFILE ? SHARED_HOST_AGGREGATE_SCOPE : profile === SHARED_HOST_OBSERVED_PROFILE ? SHARED_HOST_OBSERVED_SCOPE : REVIEWED_IDLE_SERVICE_SCOPE;
  return validProfile(profile) && keys(value, Object.keys(scope)) && Object.entries(scope).every(([key, expected]) => value[key] === expected);
};
export function observerReceiptKinds(profile) {
  require(validProfile(profile), 'Unknown observer admission profile.');
  const prefix = profile === SHARED_HOST_AGGREGATE_PROFILE ? 'shared-host-aggregate' : profile === SHARED_HOST_OBSERVED_PROFILE ? 'shared-host-observed' : 'reviewed-idle-service';
  return { precheck: `${prefix}-precheck`, review: `${prefix}-precheck-review`, live: `${prefix}-live-receipt` };
}

export function validateQuietObserver(value) {
  if (value === undefined) return value;
  require(keys(value, ['profile', 'configSha256', 'scope']) && validProfile(value.profile) && hash(value.configSha256) && validScope(value.scope, value.profile), 'Invalid reviewed quiet observer binding.');
  return value;
}
export function validateObserverConfig(value) {
  require(keys(value, ['schemaVersion', 'kind', 'profile', 'collectionId', 'bootId', 'scope', 'idleServices'])
    && value.schemaVersion === 1 && value.kind === 'quiet-observer-config' && validProfile(value.profile)
    && typeof value.collectionId === 'string' && /^[a-zA-Z0-9_-]{1,100}$/u.test(value.collectionId)
    && typeof value.bootId === 'string' && value.bootId.length > 0 && validScope(value.scope, value.profile)
    && Array.isArray(value.idleServices) && value.idleServices.length > 0 && value.idleServices.length <= 16, 'Invalid reviewed observer configuration.');
  const pids = new Set();
  for (const service of value.idleServices) {
    require(keys(service, ['pid', 'startTimeTicks', 'comm', 'cmdlineSha256']) && Number.isSafeInteger(service.pid) && service.pid > 1
      && !pids.has(service.pid) && uint(service.startTimeTicks) && typeof service.comm === 'string' && service.comm.length > 0 && hash(service.cmdlineSha256), 'Invalid exact idle-service identity.');
    pids.add(service.pid);
  }
  return value;
}
export function parseObserverConfigBytes(bytes) {
  require(bytes instanceof Uint8Array, 'Observer config requires exact UTF8 file bytes.');
  const configSource = Buffer.from(bytes).toString('utf8');
  require(Buffer.from(configSource, 'utf8').equals(Buffer.from(bytes)), 'Observer config is not lossless UTF8.');
  return { config: validateObserverConfig(JSON.parse(configSource)), configSource, configSha256: digest(bytes) };
}
export function validateObserverConfigSource(config, configSource, configSha256) {
  validateObserverConfig(config);
  require(typeof configSource === 'string' && hash(configSha256) && digest(configSource) === configSha256
    && same(JSON.parse(configSource), config), 'Embedded observer config does not match the approved file bytes.');
  return config;
}
export function reviewedAdmissionFailures(raw, metrics, { precheck = false, profile = REVIEWED_IDLE_SERVICE_PROFILE } = {}) {
  require(validProfile(profile), 'Unknown observer admission profile.');
  const failures = [];
  if (!finite(raw.meanCpuBusyFraction) || raw.meanCpuBusyFraction >= .05) failures.push('total-host-cpu');
  if (!finite(raw.normalizedOneMinuteLoad) || raw.normalizedOneMinuteLoad >= .1
    || precheck && (!finite(raw.peakNormalizedOneMinuteLoad) || raw.peakNormalizedOneMinuteLoad >= .1)) failures.push('total-host-load');
  if (raw.swapActivity !== false) failures.push('swap-activity');
  if (profile === SHARED_HOST_AGGREGATE_PROFILE) {
    require(finite(metrics.maxUnrelatedUserspaceProcessCpuFractionOfOneCore)
      && ['unapprovedTaskWorkloads', 'userspaceObservationComplete', 'idleServicesVerified', 'configuredServiceIdentitiesVerified'].every(key => typeof metrics[key] === 'boolean'), 'Invalid aggregate process diagnostics.');
    if (!metrics.configuredServiceIdentitiesVerified) failures.push('configured-service-identity-changed');
    return failures;
  }
  if (!finite(metrics.maxUnrelatedUserspaceProcessCpuFractionOfOneCore) || profile !== SHARED_HOST_OBSERVED_PROFILE && metrics.maxUnrelatedUserspaceProcessCpuFractionOfOneCore >= .1) failures.push('unrelated-userspace-cpu');
  if (metrics.unapprovedTaskWorkloads !== false) failures.push('unapproved-workload');
  if (metrics.userspaceObservationComplete !== true) failures.push('userspace-observation-incomplete');
  if (metrics.idleServicesVerified !== true) failures.push('idle-service-not-idle-or-changed');
  return failures;
}
export function inspectReviewedQuietReceipt(receipt, observer, { collectionId, now, admissionSha256 } = {}) {
  validateQuietObserver(observer); require(observer !== undefined, 'Explicit reviewed observer binding required.');
  require(receipt?.schemaVersion === 1 && receipt.kind === observerReceiptKinds(observer.profile).live && receipt.inspected === false
    && typeof receipt.collectionId === 'string' && (!collectionId || receipt.collectionId === collectionId)
    && finite(receipt.observedAt) && finite(receipt.seconds) && receipt.seconds >= 60 && receipt.seconds <= 61, 'Invalid reviewed live receipt.');
  if (now !== undefined) require(finite(now) && receipt.observedAt <= now && now - receipt.observedAt <= 5000, 'Reviewed live receipt is stale.');
  require(typeof receipt.contaminated === 'boolean' && typeof receipt.observationComplete === 'boolean' && typeof receipt.concurrentTaskWorkloads === 'boolean'
    && finite(receipt.maxUnrelatedProcessCpuFractionOfOneCore) && Array.isArray(receipt.failures) && receipt.failures.every(value => typeof value === 'string')
    && receipt.contaminated === (receipt.failures.length > 0), 'Missing raw strict quiet outcome.');
  const strictFailures = [];
  if (!finite(receipt.meanCpuBusyFraction) || receipt.meanCpuBusyFraction >= .05) strictFailures.push('total-host-cpu');
  if (!finite(receipt.normalizedOneMinuteLoad) || receipt.normalizedOneMinuteLoad >= .1) strictFailures.push('total-host-load');
  if (receipt.maxUnrelatedProcessCpuFractionOfOneCore >= .1) strictFailures.push('unrelated-process-cpu');
  if (receipt.swapActivity !== false) strictFailures.push('swap-activity');
  if (receipt.concurrentTaskWorkloads) strictFailures.push('unrelated-workload');
  if (!receipt.observationComplete) strictFailures.push('process-observation-incomplete');
  require(same(receipt.failures, strictFailures), 'Raw strict failure reasons were changed.');
  const admission = receipt.admission;
  require(admission?.profile === observer.profile && admission.configSha256 === observer.configSha256 && validScope(admission.scope, observer.profile)
    && admission.inspected === true && admission.accepted === true && Array.isArray(admission.failures) && admission.failures.length === 0, 'Reviewed admission is missing, mismatched or refused.');
  const config = validateObserverConfigSource(admission.config, admission.configSource, observer.configSha256);
  require(hash(receipt.admissionSha256) && receipt.precheck?.admissionSha256 === receipt.admissionSha256
    && (admissionSha256 === undefined || receipt.admissionSha256 === admissionSha256), 'Observer admission helper identity changed.');
  require(config.profile === observer.profile && same(config.scope, observer.scope) && config.collectionId === receipt.collectionId && config.bootId === receipt.bootId, 'Reviewed configuration belongs to another collection or boot.');
  require(reviewedAdmissionFailures(receipt, admission.metrics, { profile: observer.profile }).length === 0, 'Reviewed live receipt failed its fixed gates.');
  require(hash(receipt.sha256) && hash(receipt.ownershipSha256) && receipt.precheck?.sha256 === receipt.sha256 && receipt.precheck.inspected === true
    && hash(receipt.precheck.reviewSha256) && receipt.precheck.configSha256 === observer.configSha256
    && finite(receipt.precheck.startedAt) && finite(receipt.precheck.endedAt) && receipt.precheck.endedAt >= receipt.precheck.startedAt
    && receipt.live?.intervals === 60 && receipt.live.lastObservedAt === receipt.observedAt, 'Reviewed historical/live evidence is incomplete.');
  require(Array.isArray(admission.services) && admission.services.length === config.idleServices.length, 'Missing idle-service interval proof.');
  for (let index = 0; index < config.idleServices.length; index++) {
    const expected = config.idleServices[index], proof = admission.services[index];
    require(same(proof.identity, expected) && proof.owned === false && proof.observedIntervals === 60 && proof.identityMatchedIntervals === 60
      && uint(proof.firstCpuTicks) && uint(proof.lastCpuTicks), 'Configured service identity proof is incomplete.');
    if (observer.profile === SHARED_HOST_AGGREGATE_PROFILE) {
      require(Number.isSafeInteger(proof.zeroCpuIntervals) && proof.zeroCpuIntervals >= 0 && proof.zeroCpuIntervals <= 60 && uint(proof.maxCpuTickDelta), 'Invalid observed service activity proof.');
      const activeIntervals = BigInt(60 - proof.zeroCpuIntervals), total = BigInt(proof.lastCpuTicks) - BigInt(proof.firstCpuTicks), maximum = BigInt(proof.maxCpuTickDelta);
      require(activeIntervals === 0n ? total === 0n && maximum === 0n : maximum > 0n && total >= maximum + activeIntervals - 1n && total <= maximum * activeIntervals, 'Observed service activity counters are inconsistent.');
    } else require(proof.zeroCpuIntervals === 60 && proof.firstCpuTicks === proof.lastCpuTicks && proof.maxCpuTickDelta === '0', 'Idle-service proof is incomplete or active.');
  }
  require(Array.isArray(admission.kernelCoverageIssues) && admission.kernelCoverageIssues.every(issue => issue.kernelThread === true
    && uint(issue.flags) && (BigInt(issue.flags) & 0x00200000n) !== 0n), 'Kernel coverage gap lacks PF_KTHREAD proof.');
  require(Array.isArray(receipt.coverageIssues) && receipt.observationComplete === (receipt.coverageIssues.length === 0), 'Raw coverage completeness changed.');
  if (observer.profile === SHARED_HOST_AGGREGATE_PROFILE) {
    require(receipt.coverageIssues.every(issue => ['previous-process-observation-missing', 'unrelated-exit-final-cpu-unobserved'].includes(issue.kind)
      && Number.isSafeInteger(issue.pid) && issue.pid > 0 && uint(issue.startTimeTicks) && typeof issue.comm === 'string'
      && Array.isArray(issue.labels) && issue.labels.every(label => typeof label === 'string') && uint(issue.flags)
      && issue.kernelThread === ((BigInt(issue.flags) & 0x00200000n) !== 0n)), 'Invalid observed process coverage diagnostic.');
    const kernelGaps = receipt.coverageIssues.filter(issue => issue.kernelThread);
    require(same(kernelGaps, admission.kernelCoverageIssues) && admission.metrics.userspaceObservationComplete === (kernelGaps.length === receipt.coverageIssues.length)
      && admission.metrics.idleServicesVerified === admission.services.every(proof => proof.zeroCpuIntervals === 60), 'Observed process diagnostics contradict their retained proofs.');
  } else require(receipt.coverageIssues.every(issue => admission.kernelCoverageIssues.some(kernel => same(kernel, issue))), 'Raw coverage gaps were hidden or include userspace.');
  return receipt;
}
export function makeReviewedQuietEvidence(receipt, receiptSha256, observer, options = {}) {
  const evidence = { receiptSha256, contaminated: receipt.contaminated, receipt: JSON.parse(JSON.stringify(receipt)), receiptSource: options.receiptSource };
  validateQuietEvidence(evidence, observer, options);
  return evidence;
}
export function validateQuietEvidence(evidence, observer, options) {
  validateQuietObserver(observer);
  require(hash(evidence?.receiptSha256), 'Missing quiet evidence digest.');
  if (evidence.receipt !== undefined) {
    require(typeof evidence.receiptSource === 'string' && Buffer.from(evidence.receiptSource, 'utf8').toString('utf8') === evidence.receiptSource
      && digest(evidence.receiptSource) === evidence.receiptSha256 && same(JSON.parse(evidence.receiptSource), evidence.receipt), 'Retained receipt body does not match its exact source bytes.');
  }
  if (observer === undefined) {
    if (evidence.receipt !== undefined) {
      const raw = evidence.receipt;
      require(raw && typeof raw === 'object' && !Array.isArray(raw) && raw.kind === 'quiet-live-receipt' && raw.inspected === true
        && hash(raw.sha256) && finite(raw.seconds) && raw.seconds >= 60 && raw.contaminated === false && Array.isArray(raw.failures) && raw.failures.length === 0
        && raw.observationComplete === true && raw.concurrentTaskWorkloads === false && raw.swapActivity === false
        && finite(raw.meanCpuBusyFraction) && raw.meanCpuBusyFraction < .05 && finite(raw.normalizedOneMinuteLoad) && raw.normalizedOneMinuteLoad < .1
        && finite(raw.maxUnrelatedProcessCpuFractionOfOneCore) && raw.maxUnrelatedProcessCpuFractionOfOneCore < .1, 'Strict retained receipt contradicts uncontaminated evidence.');
    }
    require(evidence.contaminated === false && evidence.admission === undefined && evidence.quietObserver === undefined
      && evidence.receipt?.admission === undefined && evidence.receipt?.kind !== 'reviewed-idle-service-live-receipt', 'Strict quiet evidence cannot admit another observer profile.');
  } else {
    inspectReviewedQuietReceipt(evidence.receipt, observer, options);
    require(evidence.contaminated === evidence.receipt.contaminated, 'Raw strict contamination changed in retained evidence.');
  }
  return evidence;
}
