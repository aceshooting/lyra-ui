#!/usr/bin/env node
// Linux quiet-host observer. Importing this module reads nothing and starts no monitor.
import { readFile, writeFile, appendFile, mkdir, rename } from 'node:fs/promises';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { validateObserverConfig, validateQuietObserver, reviewedAdmissionFailures, parseObserverConfigBytes, validateObserverConfigSource, observerReceiptKinds, SHARED_HOST_AGGREGATE_PROFILE } from './profile-admission.mjs';

const require = (condition, message) => { if (!condition) throw new Error(message); };
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const encode = value => `${JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? String(item) : item, 2)}\n`;
const uint = value => { require(typeof value === 'string' && /^\d+$/u.test(value), 'Invalid unsigned /proc counter.'); return BigInt(value); };
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
export const QUIET_RULES = Object.freeze({ cpuBusy: .05, normalizedLoad: .1, unrelatedProcessOneCore: .1, seconds: 60, intervals: 60, intervalMs: 1000 });

/** Schedule reads from a fixed epoch while preserving actual rolling-window coverage. */
export function quietSnapshotDeadline({ epochNs, tick, oldestBoundaryNs }) {
  require(typeof epochNs === 'bigint' && epochNs >= 0n && Number.isSafeInteger(tick) && tick > 0
    && (oldestBoundaryNs === undefined || typeof oldestBoundaryNs === 'bigint' && oldestBoundaryNs >= epochNs), 'Invalid quiet snapshot deadline input.');
  const scheduled = epochNs + BigInt(tick) * 1_000_000_000n;
  // Scan duration may shrink; wait for a full real window rather than padding its timestamps.
  const rolling = oldestBoundaryNs === undefined ? scheduled : oldestBoundaryNs + 60_000_000_000n;
  return scheduled > rolling ? scheduled : rolling;
}

export function parseCpuStat(source) {
  const rows = source.trim().split('\n'), aggregate = rows.find(line => /^cpu\s/u.test(line));
  require(aggregate, 'Missing aggregate CPU counters.');
  const counters = aggregate.trim().split(/\s+/u).slice(1).map(uint);
  require(counters.length >= 8, 'Incomplete Linux CPU counters.');
  const cpus = rows.filter(line => /^cpu\d+\s/u.test(line)).map(line => line.split(/\s/u)[0]);
  require(cpus.length > 0 && new Set(cpus).size === cpus.length, 'Invalid logical CPU inventory.');
  // user/nice already include guest/guest_nice: do not count the last two fields twice.
  const total = counters.slice(0, 8).reduce((sum, value) => sum + value, 0n);
  return { total, busy: total - counters[3] - counters[4], logicalCpus: cpus.length, cpuIds: cpus.sort().join(',') };
}
export function parseLoadAverage(source, logicalCpus) {
  const fields = source.trim().split(/\s+/u), load = Number(fields[0]);
  require(fields.length === 5 && Number.isFinite(load) && load >= 0 && Number.isSafeInteger(logicalCpus) && logicalCpus > 0, 'Invalid Linux load average.');
  return { oneMinute: load, normalizedOneMinuteLoad: load / logicalCpus };
}
export function parseSwapCounters(source) {
  const values = {};
  for (const line of source.trim().split('\n')) {
    const [name, value] = line.trim().split(/\s+/u);
    if (name === 'pswpin' || name === 'pswpout') { require(values[name] === undefined, 'Duplicate swap counter.'); values[name] = uint(value); }
  }
  require(values.pswpin !== undefined && values.pswpout !== undefined, 'Missing swap counters.');
  return values;
}
export function parseProcessStat(source) {
  const left = source.indexOf('('), right = source.lastIndexOf(')');
  require(left > 0 && right > left, 'Invalid process stat command boundary.');
  const pid = Number(source.slice(0, left).trim()), fields = source.slice(right + 1).trim().split(/\s+/u);
  require(Number.isSafeInteger(pid) && pid > 0 && fields.length >= 20 && /^[A-Za-z]$/u.test(fields[0]), 'Invalid process stat fields.');
  const ppid = Number(fields[1]); require(Number.isSafeInteger(ppid) && ppid >= 0, 'Invalid parent PID.');
  return { pid, ppid, comm: source.slice(left + 1, right), state: fields[0], cpuTicks: uint(fields[11]) + uint(fields[12]), startTimeTicks: uint(fields[19]), flags: uint(fields[6]), kernelThread: (uint(fields[6]) & 0x00200000n) !== 0n };
}
export function workloadLabels(comm, commandLine = '') {
  const text = `${comm}\n${commandLine.replaceAll('\0', ' ')}`;
  const labels = [];
  if (/(?:^|[\s/])(?:make|ninja|cmake|gcc|g\+\+|clang(?:\+\+)?|rustc|cargo|tsc|esbuild|webpack|rollup|vite|pnpm|npm|yarn)(?:[\s/.]|$)/iu.test(text)) labels.push('build-or-package-tool');
  if (/(?:chrom(?:e|ium)|firefox|webkit|headless_shell|playwright|MiniBrowser)/iu.test(text)) labels.push('browser');
  if (/(?:openai|anthropic|bedrock|claude|codex|ollama|vllm|provider[-_ ]?(?:run|campaign|test))/iu.test(text)) labels.push('provider-or-agent');
  if (/(?:benchmarks\/|(?:profile|memory-profile|replay|tachometer)\.mjs)/iu.test(text)) labels.push('benchmark');
  return labels;
}
const identity = process => `${process.pid}:${process.startTimeTicks}`;
export function createOwnershipTracker({ bootId, roots }) {
  require(typeof bootId === 'string' && bootId.length > 0 && Array.isArray(roots) && roots.length > 0, 'Explicit boot-bound PID roots are required.');
  const rootMap = new Map(), proven = new Map();
  for (const root of roots) {
    require(Number.isSafeInteger(root.pid) && root.pid > 1 && typeof root.role === 'string' && root.role.length > 0 && !rootMap.has(root.pid), 'Invalid or duplicate owned root.');
    rootMap.set(root.pid, { ...root, startTimeTicks: uint(String(root.startTimeTicks)) });
  }
  return {
    classify(snapshot) {
      require(snapshot.bootId === bootId, 'Linux boot identity changed.');
      for (const root of rootMap.values()) {
        const current = snapshot.processes.get(root.pid);
        require(current && current.startTimeTicks === root.startTimeTicks, 'Owned root exited or its PID was reused.');
        proven.set(identity(current), { rootPid: root.pid, rootStartTimeTicks: String(root.startTimeTicks), role: root.role });
      }
      const owned = new Map();
      for (const process of snapshot.processes.values()) {
        const key = identity(process);
        if (proven.has(key)) { owned.set(key, proven.get(key)); continue; }
        const chain = [], visited = new Set(); let current = process;
        while (current && !visited.has(identity(current))) {
          visited.add(identity(current)); chain.push(current);
          const proof = proven.get(identity(current));
          if (proof) { for (const child of chain) { proven.set(identity(child), proof); owned.set(identity(child), proof); } break; }
          const parent = snapshot.processes.get(current.ppid);
          // A new process reusing a former parent's PID cannot establish ancestry.
          if (!parent || parent.startTimeTicks > current.startTimeTicks) break;
          current = parent;
        }
      }
      const liveIdentities = new Set([...snapshot.processes.values()].map(identity));
      for (const key of proven.keys()) if (!liveIdentities.has(key)) proven.delete(key);
      return owned;
    },
  };
}
export function intervalObservation(previous, current, { hz, ownedBefore, ownedAfter, observerConfig }) {
  require(Number.isSafeInteger(hz) && hz > 0 && previous.bootId === current.bootId && previous.cpu.cpuIds === current.cpu.cpuIds, 'Clock frequency, boot or CPU inventory changed.');
  const seconds = Number(current.monotonicNs - previous.monotonicNs) / 1e9;
  require(seconds > 0 && seconds <= 1.5, 'Process observation interval is missing or delayed.');
  const total = current.cpu.total - previous.cpu.total, busy = current.cpu.busy - previous.cpu.busy;
  require(total > 0n && busy >= 0n && busy <= total, 'CPU counters reset or are inconsistent.');
  require(current.swap.pswpin >= previous.swap.pswpin && current.swap.pswpout >= previous.swap.pswpout, 'Swap counters reset.');
  const processes = [], unrelatedWorkloads = [], coverageIssues = [];
  for (const process of current.processes.values()) {
    const before = previous.processes.get(process.pid), same = before?.startTimeTicks === process.startTimeTicks;
    const ticks = same ? process.cpuTicks - before.cpuTicks : process.cpuTicks;
    require(ticks >= 0n, 'Process CPU counter reset.');
    const owned = ownedAfter.has(identity(process));
    if (!same && process.startTimeTicks < previous.uptimeTicks) coverageIssues.push({ kind: 'previous-process-observation-missing', pid: process.pid, startTimeTicks: String(process.startTimeTicks), comm: process.comm, labels: process.labels, flags: String(process.flags ?? 0n), kernelThread: process.kernelThread === true });
    const processSeconds = same ? Number(process.readMonotonicNs - before.readMonotonicNs) / 1e9 : seconds;
    require(processSeconds > 0 && processSeconds <= 1.75, 'Process read interval is missing or delayed.');
    const cpuFractionOfOneCore = Number(ticks) / hz / processSeconds;
    const entry = { pid: process.pid, startTimeTicks: String(process.startTimeTicks), comm: process.comm, owned, observedSeconds: processSeconds, cpuTicks: String(ticks), previousCpuTicks: same ? String(before.cpuTicks) : null, currentCpuTicks: String(process.cpuTicks), cpuFractionOfOneCore, labels: process.labels, flags: String(process.flags ?? 0n), kernelThread: process.kernelThread === true };
    processes.push(entry);
    if (!owned && process.labels.length) unrelatedWorkloads.push({ pid: process.pid, startTimeTicks: entry.startTimeTicks, comm: process.comm, labels: process.labels });
  }
  for (const process of previous.processes.values()) {
    const after = current.processes.get(process.pid);
    if ((!after || after.startTimeTicks !== process.startTimeTicks) && !ownedBefore.has(identity(process))) coverageIssues.push({ kind: 'unrelated-exit-final-cpu-unobserved', pid: process.pid, startTimeTicks: String(process.startTimeTicks), comm: process.comm, labels: process.labels, flags: String(process.flags ?? 0n), kernelThread: process.kernelThread === true });
  }
  const unrelated = processes.filter(process => !process.owned);
  const reviewed = observerConfig ? reviewedInterval(previous, current, processes, coverageIssues, observerConfig, ownedBefore, ownedAfter) : undefined;
  return { observedAt: current.observedAt, monotonicNs: String(current.monotonicNs), seconds, logicalCpus: current.cpu.logicalCpus,
    ...(current.snapshot ? { snapshot: current.snapshot } : {}),
    cpuTicks: { busy: String(busy), total: String(total) }, cpuBusyFraction: Number(busy) / Number(total),
    normalizedOneMinuteLoad: current.load.normalizedOneMinuteLoad, oneMinuteLoad: current.load.oneMinute,
    maxUnrelatedProcessCpuFractionOfOneCore: Math.max(0, ...unrelated.map(process => process.cpuFractionOfOneCore)),
    ownedCpuFractionOfOneCore: processes.filter(process => process.owned).reduce((sum, process) => sum + process.cpuFractionOfOneCore, 0),
    swapActivity: current.swap.pswpin !== previous.swap.pswpin || current.swap.pswpout !== previous.swap.pswpout,
    swapPagesIn: String(current.swap.pswpin - previous.swap.pswpin), swapPagesOut: String(current.swap.pswpout - previous.swap.pswpout),
    concurrentTaskWorkloads: unrelatedWorkloads.length > 0, unrelatedWorkloads, coverageIssues,
    processesSeen: processes.length, ownedProcessesSeen: processes.length - unrelated.length,
    newOwnedProcesses: [...current.processes.values()].filter(process => ownedAfter.has(identity(process)) && !ownedBefore.has(identity(process))).map(process => ({ pid: process.pid, ppid: process.ppid, startTimeTicks: String(process.startTimeTicks), ...ownedAfter.get(identity(process)) })),
    busiestUnrelated: unrelated.sort((a, b) => b.cpuFractionOfOneCore - a.cpuFractionOfOneCore).slice(0, 5), ...(reviewed ? { reviewed } : {}) };
}
export function windowMetrics(samples) {
  require(Array.isArray(samples) && samples.length === 60, 'A quiet window requires exactly sixty retained intervals.');
  let busy = 0n, total = 0n, seconds = 0;
  for (let index = 0; index < samples.length; index++) {
    const row = samples[index];
    require(Number.isFinite(row.seconds) && row.seconds > 0 && row.seconds <= 1.5 && (index === 0 || BigInt(row.monotonicNs) > BigInt(samples[index - 1].monotonicNs)), 'Invalid quiet interval sequence.');
    busy += uint(row.cpuTicks.busy); total += uint(row.cpuTicks.total); seconds += row.seconds;
  }
  require(seconds >= 60 && seconds <= 61, 'Sixty scheduled intervals did not cover a bounded sixty-second window.');
  return { seconds, meanCpuBusyFraction: Number(busy) / Number(total), normalizedOneMinuteLoad: samples.at(-1).normalizedOneMinuteLoad,
    maxUnrelatedProcessCpuFractionOfOneCore: Math.max(...samples.map(row => row.maxUnrelatedProcessCpuFractionOfOneCore)),
    swapActivity: samples.some(row => row.swapActivity), concurrentTaskWorkloads: samples.some(row => row.concurrentTaskWorkloads),
    observationComplete: samples.every(row => row.coverageIssues.length === 0), peakNormalizedOneMinuteLoad: Math.max(...samples.map(row => row.normalizedOneMinuteLoad)) };
}
export function ruleFailures(metrics, { precheck = false } = {}) {
  const failures = [];
  if (!Number.isFinite(metrics.meanCpuBusyFraction) || metrics.meanCpuBusyFraction >= .05) failures.push('total-host-cpu');
  if (!Number.isFinite(metrics.normalizedOneMinuteLoad) || metrics.normalizedOneMinuteLoad >= .1 || precheck && metrics.peakNormalizedOneMinuteLoad >= .1) failures.push('total-host-load');
  if (!Number.isFinite(metrics.maxUnrelatedProcessCpuFractionOfOneCore) || metrics.maxUnrelatedProcessCpuFractionOfOneCore >= .1) failures.push('unrelated-process-cpu');
  if (metrics.swapActivity !== false) failures.push('swap-activity');
  if (metrics.concurrentTaskWorkloads !== false) failures.push('unrelated-workload');
  if (metrics.observationComplete !== true) failures.push('process-observation-incomplete');
  return failures;
}
export function validateReview(review, { precheck, precheckSha256, ownershipSha256 }) {
  require(review?.schemaVersion === 1 && review.kind === 'quiet-precheck-review' && review.inspected === true && review.decision === 'approved'
    && review.collectionId === precheck.collectionId && review.precheckSha256 === precheckSha256 && review.ownershipSha256 === ownershipSha256
    && Number.isFinite(review.reviewedAt) && review.reviewedAt >= precheck.endedAt && hash(precheckSha256) && hash(ownershipSha256), 'A matching explicit caller-reviewed precheck artifact is required.');
  require(precheck.kind === 'quiet-precheck' && precheck.inspected === false && precheck.requestedSeconds === 60 && precheck.intervals === 60 && precheck.metrics.seconds >= 60 && precheck.metrics.seconds <= 61 && hash(precheck.sampleSha256) && ruleFailures(precheck.metrics, { precheck: true }).length === 0, 'Historical precheck is incomplete or failed.');
  return review;
}
export function makeReceipt({ collectionId, samples, precheck, precheckSha256, review, reviewSha256, ownershipSha256, admissionSha256 }) {
  const metrics = windowMetrics(samples), failures = ruleFailures(metrics);
  const approved = Boolean(review);
  if (approved) { validateReview(review, { precheck, precheckSha256, ownershipSha256 }); require(hash(reviewSha256), 'Missing review artifact digest.'); }
  return { schemaVersion: 1, kind: 'quiet-live-receipt', collectionId, ...(admissionSha256 ? { admissionSha256 } : {}), observedAt: samples.at(-1).observedAt,
    inspected: approved && metrics.observationComplete, sha256: precheckSha256, ...metrics,
    concurrentTaskWorkloads: metrics.concurrentTaskWorkloads, contaminated: failures.length > 0, failures,
    semantics: { cpu: 'current-rolling-sixty-second-total-host-busy-including-owned', load: 'current-total-host-one-minute-load-per-logical-cpu',
      unrelatedProcess: 'maximum-sampled-one-core-fraction-in-current-sixty-interval-window', ownership: 'boot-pid-starttime-and-observed-ancestry',
      processCoverage: 'sampled-live-pids; unseen-short-lived-between-poll-processes-are-not-proven-absent' },
    precheck: { sha256: precheckSha256, startedAt: precheck.startedAt, endedAt: precheck.endedAt, inspected: approved, reviewSha256: approved ? reviewSha256 : null },
    live: { firstObservedAt: samples[0].observedAt, lastObservedAt: samples.at(-1).observedAt, intervals: 60, ownedCpuFractionOfOneCore: samples.at(-1).ownedCpuFractionOfOneCore }, ownershipSha256 };
}

function exactIdleIdentity(process, expected, owned) {
  return Boolean(process && process.pid === expected.pid && String(process.startTimeTicks) === expected.startTimeTicks
    && process.comm === expected.comm && process.cmdlineSha256 === expected.cmdlineSha256
    && process.kernelThread === false && typeof process.flags === 'bigint' && (process.flags & 0x00200000n) === 0n && !owned.has(identity(process)));
}
export function validateObserverBaseline(snapshot, owned, config) {
  validateObserverConfig(config);
  require(snapshot.bootId === config.bootId && config.idleServices.every(expected => exactIdleIdentity(snapshot.processes.get(expected.pid), expected, owned)), 'Reviewed idle service is missing, changed, kernel-owned or campaign-owned.');
}
function reviewedInterval(previous, current, processes, coverageIssues, config, ownedBefore, ownedAfter) {
  require(previous.bootId === config.bootId && current.bootId === config.bootId, 'Reviewed observer boot changed.');
  const services = config.idleServices.map(expected => {
    const before = previous.processes.get(expected.pid), after = current.processes.get(expected.pid);
    const matched = exactIdleIdentity(before, expected, ownedBefore) && exactIdleIdentity(after, expected, ownedAfter);
    const delta = before && after && before.startTimeTicks === after.startTimeTicks ? after.cpuTicks - before.cpuTicks : null;
    return { identity: expected, owned: Boolean(before && ownedBefore.has(identity(before)) || after && ownedAfter.has(identity(after))), identityMatched: matched,
      zeroCpu: matched && delta === 0n, previousCpuTicks: before ? String(before.cpuTicks) : null, currentCpuTicks: after ? String(after.cpuTicks) : null,
      cpuTickDelta: delta === null ? null : String(delta), previousReadMonotonicNs: before ? String(before.readMonotonicNs) : null,
      currentReadMonotonicNs: after ? String(after.readMonotonicNs) : null, observedCmdlineSha256: after?.cmdlineSha256 ?? null,
      observedComm: after?.comm ?? null, observedStartTimeTicks: after ? String(after.startTimeTicks) : null, observedFlags: after ? String(after.flags) : null };
  });
  const userspace = processes.filter(process => !process.owned && !process.kernelThread);
  return { services, configuredServiceIdentitiesVerified: services.every(service => service.identityMatched && !service.owned),
    idleServicesVerified: services.every(service => service.identityMatched && service.zeroCpu && !service.owned),
    maxUnrelatedUserspaceProcessCpuFractionOfOneCore: Math.max(0, ...userspace.map(process => process.cpuFractionOfOneCore)),
    unapprovedTaskWorkloads: userspace.some(process => process.labels.length > 0 && !services.some(service => service.identity.pid === process.pid && service.identityMatched && service.zeroCpu)),
    userspaceObservationComplete: coverageIssues.every(issue => issue.kernelThread === true && (BigInt(issue.flags) & 0x00200000n) !== 0n),
    kernelCoverageIssues: coverageIssues.filter(issue => issue.kernelThread === true && (BigInt(issue.flags) & 0x00200000n) !== 0n) };
}
export function reviewedWindowAdmission(samples, config, configSha256, { precheck = false, configSource } = {}) {
  validateObserverConfigSource(config, configSource, configSha256);
  validateQuietObserver({ profile: config.profile, configSha256, scope: config.scope });
  const raw = windowMetrics(samples);
  require(samples.every(row => row.reviewed && row.reviewed.services.length === config.idleServices.length), 'Missing reviewed per-interval evidence.');
  const metrics = { maxUnrelatedUserspaceProcessCpuFractionOfOneCore: Math.max(...samples.map(row => row.reviewed.maxUnrelatedUserspaceProcessCpuFractionOfOneCore)),
    unapprovedTaskWorkloads: samples.some(row => row.reviewed.unapprovedTaskWorkloads), userspaceObservationComplete: samples.every(row => row.reviewed.userspaceObservationComplete),
    idleServicesVerified: samples.every(row => row.reviewed.idleServicesVerified), configuredServiceIdentitiesVerified: samples.every(row => row.reviewed.configuredServiceIdentitiesVerified === true) };
  const services = config.idleServices.map((expected, index) => {
    const proofs = samples.map(row => row.reviewed.services[index]);
    require(proofs.every(proof => JSON.stringify(proof.identity) === JSON.stringify(expected)), 'Idle-service identity changed within the retained window.');
    const deltas = proofs.map(proof => proof.cpuTickDelta === null ? null : BigInt(proof.cpuTickDelta));
    return { identity: expected, owned: proofs.some(proof => proof.owned), observedIntervals: proofs.length,
      zeroCpuIntervals: proofs.filter(proof => proof.zeroCpu).length, identityMatchedIntervals: proofs.filter(proof => proof.identityMatched).length,
      firstCpuTicks: proofs[0].previousCpuTicks, lastCpuTicks: proofs.at(-1).currentCpuTicks,
      maxCpuTickDelta: deltas.some(value => value === null) ? null : String(deltas.reduce((max, value) => value > max ? value : max, 0n)) };
  });
  const failures = reviewedAdmissionFailures(raw, metrics, { precheck, profile: config.profile });
  return { profile: config.profile, configSha256, scope: config.scope, config, configSource, inspected: false, accepted: failures.length === 0, failures, metrics, services,
    kernelCoverageIssues: samples.flatMap(row => row.reviewed.kernelCoverageIssues) };
}
export function validateReviewedReview(review, { precheck, precheckSha256, ownershipSha256, observerConfig, configSha256, admissionSha256 }) {
  validateObserverConfig(observerConfig);
  const expected = { profile: observerConfig.profile, configSha256, scope: observerConfig.scope };
  validateQuietObserver(review?.quietObserver); require(review?.quietObserver !== undefined, 'Missing reviewed observer binding.');
  require(review?.schemaVersion === 1 && review.kind === observerReceiptKinds(observerConfig.profile).review && review.inspected === true && review.decision === 'approved'
    && review.collectionId === precheck.collectionId && review.precheckSha256 === precheckSha256 && review.ownershipSha256 === ownershipSha256
    && hash(admissionSha256) && review.admissionSha256 === admissionSha256 && precheck.admissionSha256 === admissionSha256
    && review.quietObserver.profile === expected.profile && review.quietObserver.configSha256 === expected.configSha256
    && Number.isFinite(review.reviewedAt) && review.reviewedAt >= precheck.endedAt && hash(precheckSha256) && hash(ownershipSha256), 'A matching reviewed observer precheck authorization is required.');
  require(precheck.kind === observerReceiptKinds(observerConfig.profile).precheck && precheck.inspected === false && precheck.requestedSeconds === 60 && precheck.intervals === 60
    && precheck.metrics.seconds >= 60 && precheck.metrics.seconds <= 61 && hash(precheck.sampleSha256)
    && precheck.collectionId === observerConfig.collectionId && precheck.admission?.profile === expected.profile && precheck.admission.configSha256 === configSha256 && precheck.admission.accepted === true
    && JSON.stringify(precheck.admission.config) === JSON.stringify(observerConfig)
    && reviewedAdmissionFailures(precheck.metrics, precheck.admission.metrics, { precheck: true, profile: observerConfig.profile }).length === 0, 'Reviewed observer precheck is incomplete or failed.');
  validateObserverConfigSource(precheck.admission.config, precheck.admission.configSource, configSha256);
  return review;
}
export function makeReviewedReceipt({ collectionId, samples, precheck, precheckSha256, review, reviewSha256, ownershipSha256, observerConfig, configSha256, configSource, admissionSha256 }) {
  require(hash(admissionSha256), 'Missing observer admission helper identity.');
  const metrics = windowMetrics(samples), failures = ruleFailures(metrics), admission = reviewedWindowAdmission(samples, observerConfig, configSha256, { configSource });
  if (review) {
    validateReviewedReview(review, { precheck, precheckSha256, ownershipSha256, observerConfig, configSha256, admissionSha256 });
    require(hash(reviewSha256), 'Missing reviewed observer authorization digest.'); admission.inspected = true;
  }
  return { schemaVersion: 1, kind: observerReceiptKinds(observerConfig.profile).live, collectionId, admissionSha256, bootId: observerConfig.bootId,
    observedAt: samples.at(-1).observedAt, inspected: false, sha256: precheckSha256, ...metrics, contaminated: failures.length > 0, failures,
    coverageIssues: samples.flatMap(row => row.coverageIssues), admission,
    semantics: { cpu: 'current-rolling-total-host-including-owned-services-and-kernel', processCpu: observerConfig.scope.processCpu,
      coverage: observerConfig.scope.coverage, inactivity: observerConfig.profile === SHARED_HOST_AGGREGATE_PROFILE ? 'observed-service-activity-is-diagnostic-not-an-idle-requirement' : 'zero-observed-cpu-ticks-not-proof-of-no-io-or-gpu-work',
      processCoverage: 'unseen-short-lived-between-poll-processes-are-not-proven-absent' },
    precheck: { sha256: precheckSha256, startedAt: precheck.startedAt, endedAt: precheck.endedAt, inspected: Boolean(review),
      reviewSha256: review ? reviewSha256 : null, configSha256, admissionSha256 },
    live: { firstObservedAt: samples[0].observedAt, lastObservedAt: samples.at(-1).observedAt, intervals: 60,
      ownedCpuFractionOfOneCore: samples.at(-1).ownedCpuFractionOfOneCore }, ownershipSha256 };
}

async function atomicJson(filename, value) {
  const temporary = `${filename}.tmp-${process.pid}-${randomUUID()}`;
  await writeFile(temporary, encode(value), { flag: 'wx', mode: 0o600 }); await rename(temporary, filename);
}
export async function retainMonitorFailure(error, { collectionId, previous, receipt, output, signal }) {
  const failure = { schemaVersion: 1, kind: 'quiet-monitor-stopped', collectionId, inspected: false, observedAt: previous.observedAt,
    stoppedAt: Date.now(), reason: signal?.aborted ? 'operator-stop' : String(error.message), lastReceipt: receipt ?? null,
    ...(error.snapshot ? { snapshot: error.snapshot } : {}) };
  await atomicJson(join(output, 'receipt.json'), failure); await writeFile(join(output, 'stopped.json'), encode(failure), { flag: 'wx', mode: 0o600 });
}
/** Completion describes the scan, never admission under its duration or host rules. */
export async function readSnapshot(hz, observerConfig, { readFileSync: read = readFileSync, readdirSync: list = readdirSync,
  monotonicNow = process.hrtime.bigint, wallNow = Date.now } = {}) {
  const start = monotonicNow(), processes = new Map();
  let stage = 'cpu-stat', pid = null, listedPids = null, completedPids = 0, disappearedPids = 0, complete = false, end;
  const diagnostic = () => ({ startMonotonicNs: String(start), endMonotonicNs: String(end), durationNs: String(end - start),
    listedPids, completedPids, disappearedPids, stage, pid, complete });
  try {
    const statText = read('/proc/stat', 'utf8');
    stage = 'loadavg'; const loadText = read('/proc/loadavg', 'utf8');
    stage = 'vmstat'; const vmText = read('/proc/vmstat', 'utf8');
    stage = 'uptime'; const uptimeText = read('/proc/uptime', 'utf8');
    stage = 'boot-id'; const bootId = read('/proc/sys/kernel/random/boot_id', 'utf8');
    stage = 'pid-list'; const pids = list('/proc').filter(entry => /^\d+$/u.test(entry)); listedPids = pids.length;
    stage = 'cpu-stat'; const cpu = parseCpuStat(statText);
    for (const entry of pids) {
      pid = Number(entry);
      try {
        stage = 'process-stat-before'; const firstText = read(`/proc/${entry}/stat`, 'utf8');
        stage = 'process-cmdline'; const commandLine = read(`/proc/${entry}/cmdline`);
        stage = 'process-stat-before'; const first = parseProcessStat(firstText);
        stage = 'process-stat-after'; const second = parseProcessStat(read(`/proc/${entry}/stat`, 'utf8'));
        require(first.pid === pid && first.startTimeTicks === second.startTimeTicks, 'PID was reused during sampling.');
        processes.set(first.pid, { ...second, readMonotonicNs: monotonicNow(), labels: workloadLabels(second.comm, commandLine.toString('utf8')), ...(observerConfig?.idleServices.some(service => service.pid === first.pid) ? { cmdlineSha256: digest(commandLine) } : {}) });
        completedPids++;
      } catch (error) {
        if (error.code !== 'ENOENT' && error.code !== 'ESRCH') throw error;
        disappearedPids++;
      }
    }
    pid = null;
    stage = 'uptime'; const uptime = Number(uptimeText.trim().split(/\s/u)[0]); require(Number.isFinite(uptime) && uptime >= 0, 'Invalid uptime.');
    const uptimeTicks = BigInt(Math.floor(uptime * hz));
    stage = 'loadavg'; const load = parseLoadAverage(loadText, cpu.logicalCpus);
    stage = 'vmstat'; const swap = parseSwapCounters(vmText);
    stage = 'boot-id'; const observedBootId = bootId.trim();
    stage = 'complete'; complete = true; end = monotonicNow();
    require(end - start <= 250_000_000n, 'A /proc snapshot took too long to attribute a one-second interval.');
    return { bootId: observedBootId, monotonicNs: end, observedAt: wallNow(), cpu, load, swap, uptimeTicks, processes, snapshot: diagnostic() };
  } catch (error) {
    if (end === undefined) end = monotonicNow();
    error.snapshot = diagnostic();
    error.message = `${error.message} Snapshot duration: ${error.snapshot.durationNs}ns.`;
    throw error;
  }
}
export async function runMonitor({ collectionId, ownershipPath, reviewPath, observerConfigPath, output, signal }) {
  require(process.platform === 'linux' && process.versions.node === '22.23.2', 'Use Linux and exact Node22.23.2.');
  require(typeof collectionId === 'string' && /^[a-zA-Z0-9_-]{1,100}$/u.test(collectionId), 'Invalid collection identity.');
  const toolSha256 = digest(await readFile(new URL(import.meta.url))), admissionSha256 = digest(await readFile(new URL('./profile-admission.mjs', import.meta.url)));
  const ownershipBytes = await readFile(ownershipPath), ownership = JSON.parse(ownershipBytes), ownershipSha256 = digest(ownershipBytes);
  require(ownership.schemaVersion === 1 && ownership.collectionId === collectionId && ownership.monitorOwned === true && Array.isArray(ownership.roots) && ownership.roots.length > 0, 'Explicit campaign roots and monitor ownership are required.');
  const configBytes = observerConfigPath ? await readFile(observerConfigPath) : undefined;
  const parsedConfig = configBytes ? parseObserverConfigBytes(configBytes) : undefined;
  const observerConfig = parsedConfig?.config, configSha256 = parsedConfig?.configSha256, configSource = parsedConfig?.configSource;
  if (observerConfig) require(observerConfig.collectionId === collectionId, 'Observer configuration belongs to another collection.');
  const hz = Number(execFileSync('getconf', ['CLK_TCK'], { encoding: 'utf8' }).trim());
  require(Number.isSafeInteger(hz) && hz > 0, 'Invalid real CLK_TCK.');
  await mkdir(output, { recursive: false, mode: 0o700 });
  let previous = await readSnapshot(hz, observerConfig), receipt, precheck, precheckSha256, review, reviewSha256;
  const self = previous.processes.get(process.pid); require(self, 'Monitor PID is missing.');
  const roots = [...ownership.roots, { pid: self.pid, startTimeTicks: String(self.startTimeTicks), role: 'quiet-monitor' }];
  const tracker = createOwnershipTracker({ bootId: previous.bootId, roots }); let ownedBefore = tracker.classify(previous);
  if (observerConfig) validateObserverBaseline(previous, ownedBefore, observerConfig);
  const baseline = { collectionId, bootId: previous.bootId, startedAt: previous.observedAt, monotonicNs: String(previous.monotonicNs), snapshot: previous.snapshot, hz, logicalCpus: previous.cpu.logicalCpus, roots, ownershipSha256, toolSha256, admissionSha256, ...(observerConfig ? { quietObserver: { profile: observerConfig.profile, configSha256, scope: observerConfig.scope }, observerConfig } : {}),
    initialOwnedProcesses: [...previous.processes.values()].filter(process => ownedBefore.has(identity(process))).map(process => ({ pid: process.pid, ppid: process.ppid, startTimeTicks: String(process.startTimeTicks), ...ownedBefore.get(identity(process)) })) };
  await writeFile(join(output, 'baseline.json'), encode(baseline), { flag: 'wx', mode: 0o600 });
  await writeFile(join(output, 'samples.jsonl'), '', { flag: 'wx', mode: 0o600 });
  const initialAt = previous.observedAt, epochNs = previous.monotonicNs, samples = [], sampleDigest = createHash('sha256');
  let tick = 0;
  try {
    while (!signal?.aborted) {
      tick++;
      const deadline = quietSnapshotDeadline({ epochNs, tick, oldestBoundaryNs: samples.length === 60 ? BigInt(samples[0].monotonicNs) : undefined });
      while (process.hrtime.bigint() < deadline) await delay(Math.max(1, Number(deadline - process.hrtime.bigint()) / 1e6), undefined, { signal });
      if (observerConfigPath) require(digest(await readFile(observerConfigPath)) === configSha256, 'Observer configuration changed during collection.');
      const current = await readSnapshot(hz, observerConfig), ownedAfter = tracker.classify(current);
      const row = intervalObservation(previous, current, { hz, ownedBefore, ownedAfter, observerConfig });
      const line = `${JSON.stringify(row)}\n`; await appendFile(join(output, 'samples.jsonl'), line); sampleDigest.update(line);
      samples.push(row); if (samples.length > 60) samples.shift();
      previous = current; ownedBefore = ownedAfter;
      if (tick < 60) continue;
      if (!precheck) {
        precheck = { schemaVersion: 1, kind: observerConfig ? observerReceiptKinds(observerConfig.profile).precheck : 'quiet-precheck', collectionId, inspected: false, requestedSeconds: 60, intervals: 60,
          startedAt: initialAt, endedAt: current.observedAt, metrics: windowMetrics(samples), sampleSha256: sampleDigest.copy().digest('hex'), ownershipSha256, toolSha256, admissionSha256, bootId: current.bootId, roots, ...(observerConfig ? { admission: reviewedWindowAdmission(samples, observerConfig, configSha256, { precheck: true, configSource }) } : {}) };
        const bytes = encode(precheck); await writeFile(join(output, 'precheck.json'), bytes, { flag: 'wx', mode: 0o600 }); precheckSha256 = digest(bytes);
        require((observerConfig ? precheck.admission.failures : ruleFailures(precheck.metrics, { precheck: true })).length === 0, 'The retained precheck failed; caller review cannot approve it.');
      }
      try {
        const bytes = await readFile(reviewPath), nextReview = JSON.parse(bytes);
        if (observerConfig) validateReviewedReview(nextReview, { precheck, precheckSha256, ownershipSha256, observerConfig, configSha256, admissionSha256 });
        else validateReview(nextReview, { precheck, precheckSha256, ownershipSha256 });
        if (reviewSha256) require(digest(bytes) === reviewSha256, 'Reviewed precheck authorization changed.');
        review = nextReview; reviewSha256 = digest(bytes);
      } catch (error) { if (error.code !== 'ENOENT' || review) throw error; }
      receipt = (observerConfig ? makeReviewedReceipt : makeReceipt)({ collectionId, samples, precheck, precheckSha256, review, reviewSha256, ownershipSha256, observerConfig, configSha256, configSource, admissionSha256 });
      await atomicJson(join(output, 'receipt.json'), receipt);
      require(observerConfig ? receipt.admission.accepted : !receipt.contaminated && receipt.observationComplete, 'Live quiet observation failed; monitor stops without suppressing evidence.');
    }
    if (signal?.aborted) throw new Error('Operator stopped monitor.');
  } catch (error) {
    await retainMonitorFailure(error, { collectionId, previous, receipt, output, signal });
    if (!signal?.aborted) throw error;
  }
}
function options(args) {
  const values = {};
  require(args.includes('--run'), 'Explicit --run required. No monitor started.');
  for (const argument of args.filter(item => item !== '--run')) {
    const match = /^--(collection|ownership|review|observer-config|output)=(.+)$/u.exec(argument);
    require(match && !Object.hasOwn(values, match[1]), 'Invalid or duplicate monitor option.'); values[match[1]] = match[2];
  }
  require(['collection', 'ownership', 'review', 'output'].every(key => values[key]), 'Supply collection, ownership, review and output.');
  return { collectionId: values.collection, ownershipPath: values.ownership, reviewPath: values.review, observerConfigPath: values['observer-config'], output: values.output };
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const controller = new AbortController(); const stop = () => controller.abort(); process.once('SIGINT', stop); process.once('SIGTERM', stop);
  try { await runMonitor({ ...options(process.argv.slice(2)), signal: controller.signal }); }
  catch (error) { process.stderr.write(error.snapshot ? encode({ message: String(error.message), snapshot: error.snapshot }) : `${String(error.message)}\n`); process.exitCode = 1; }
  finally { process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); }
}
