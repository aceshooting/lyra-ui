import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCpuStat, parseLoadAverage, parseSwapCounters, parseProcessStat, workloadLabels, createOwnershipTracker, intervalObservation, windowMetrics, ruleFailures, validateReview, makeReceipt } from './profile-quiet.mjs';
import { checkFreshQuietReceipt } from './profile-driver.mjs';

// Synthetic fixtures only. No /proc reader, monitor, campaign or inspected artifact runs here.
const hash = letter => letter.repeat(64);
function processRow(pid, { ppid = 1, start = 10n, cpu = 0n, comm = 'idle', labels = [] } = {}) {
  return { pid, ppid, startTimeTicks: start, cpuTicks: cpu, comm, labels };
}
function snapshot(second, processes, { busy = 200n, total = 1000n, bootId = 'boot', swap = 0n, load = .01 } = {}) {
  return { bootId, monotonicNs: BigInt(second) * 1_000_000_000n, observedAt: second * 1000, uptimeTicks: BigInt(1000 + second * 100),
    cpu: { busy, total, logicalCpus: 4, cpuIds: 'cpu0,cpu1,cpu2,cpu3' }, swap: { pswpin: swap, pswpout: 0n }, load: { normalizedOneMinuteLoad: load, oneMinute: load * 4 }, processes: new Map(processes.map(row => [row.pid, { ...row, readMonotonicNs: BigInt(second) * 1_000_000_000n }])) };
}
function intervals(offset = 0) {
  return Array.from({ length: 60 }, (_value, index) => ({ observedAt: (offset + index + 1) * 1000, monotonicNs: String(BigInt(offset + index + 1) * 1_000_000_000n), seconds: 1,
    cpuTicks: { busy: '1', total: '100' }, normalizedOneMinuteLoad: .01, maxUnrelatedProcessCpuFractionOfOneCore: .01, swapActivity: false,
    concurrentTaskWorkloads: false, coverageIssues: [], ownedCpuFractionOfOneCore: .02 }));
}
function artifacts() {
  const precheck = { schemaVersion: 1, kind: 'quiet-precheck', collectionId: 'synthetic-unit', inspected: false, requestedSeconds: 60, intervals: 60,
    startedAt: 0, endedAt: 60000, metrics: windowMetrics(intervals()), sampleSha256: hash('d') };
  const review = { schemaVersion: 1, kind: 'quiet-precheck-review', collectionId: 'synthetic-unit', inspected: true, decision: 'approved', reviewedAt: 60001,
    precheckSha256: hash('a'), ownershipSha256: hash('b') };
  return { precheck, review, precheckSha256: hash('a'), ownershipSha256: hash('b'), reviewSha256: hash('c') };
}

test('CPU counters avoid double-counted guest time and normalize real host load', () => {
  const cpu = parseCpuStat('cpu 100 20 30 800 10 5 5 0 10 2\ncpu0 0\ncpu1 0\n');
  assert.equal(cpu.total, 970n); assert.equal(cpu.busy, 160n); assert.equal(cpu.logicalCpus, 2);
  assert.deepEqual(parseLoadAverage('0.12 0.10 0.09 1/100 123', 2), { oneMinute: .12, normalizedOneMinuteLoad: .06 });
  assert.throws(() => parseCpuStat('cpu 1 2 3\ncpu0 0'));
  assert.throws(() => parseLoadAverage('NaN 0 0 1/1 1', 2));
});

test('process stat parser survives spaces and closing parentheses and excludes child CPU counters', () => {
  const fields = Array(20).fill('0'); fields[0] = 'S'; fields[1] = '10'; fields[11] = '7'; fields[12] = '3'; fields[13] = '999'; fields[14] = '999'; fields[19] = '1234';
  const row = parseProcessStat(`42 (name ) with spaces) ${fields.join(' ')}`);
  assert.equal(row.comm, 'name ) with spaces'); assert.equal(row.cpuTicks, 10n); assert.equal(row.startTimeTicks, 1234n); assert.equal(row.ppid, 10);
  assert.throws(() => parseProcessStat('42 invalid'));
});

test('swap and workload classifications distinguish real activity from a resident allocation', () => {
  assert.deepEqual(parseSwapCounters('nr_free_pages 1\npswpin 7\npswpout 9\n'), { pswpin: 7n, pswpout: 9n });
  assert.throws(() => parseSwapCounters('pswpin 1'));
  assert.ok(workloadLabels('node', 'node_modules/esbuild/bin/esbuild').includes('build-or-package-tool'));
  assert.ok(workloadLabels('chromium').includes('browser'));
  assert.ok(workloadLabels('python', 'provider_campaign.py').includes('provider-or-agent'));
  assert.deepEqual(workloadLabels('unknown-service', 'unknown-service --idle'), []);
});

test('ownership follows proven descendants across reparenting but never PID reuse', () => {
  const tracker = createOwnershipTracker({ bootId: 'boot', roots: [{ pid: 10, startTimeTicks: '10', role: 'campaign' }] });
  const root = processRow(10), child = processRow(11, { ppid: 10, start: 20n });
  assert.equal(tracker.classify(snapshot(0, [root, child])).has('11:20'), true);
  assert.equal(tracker.classify(snapshot(1, [root, { ...child, ppid: 1 }])).has('11:20'), true);
  assert.equal(tracker.classify(snapshot(2, [root, processRow(11, { start: 30n })])).has('11:30'), false);
  assert.throws(() => tracker.classify(snapshot(3, [processRow(10, { start: 99n })])), /reused/u);
  assert.throws(() => tracker.classify(snapshot(3, [root], { bootId: 'different' })), /boot/u);
});

test('a child older than its reused parent PID cannot inherit a new ownership proof', () => {
  const tracker = createOwnershipTracker({ bootId: 'boot', roots: [{ pid: 10, startTimeTicks: '10', role: 'campaign' }] });
  tracker.classify(snapshot(0, [processRow(10), processRow(11, { ppid: 10, start: 20n })]));
  const owned = tracker.classify(snapshot(1, [processRow(10), processRow(11, { ppid: 10, start: 50n }), processRow(12, { ppid: 11, start: 30n })]));
  assert.equal(owned.has('11:50'), true); assert.equal(owned.has('12:30'), false);
});

test('process CPU uses actual elapsed time and leaves owned CPU in the host total', () => {
  const before = snapshot(0, [processRow(10, { cpu: 100n }), processRow(20, { cpu: 10n })]);
  const after = snapshot(1, [processRow(10, { cpu: 130n }), processRow(20, { cpu: 12n })], { busy: 232n, total: 1400n });
  const owned = new Map([['10:10', {}]]);
  const row = intervalObservation(before, after, { hz: 100, ownedBefore: owned, ownedAfter: owned });
  assert.equal(row.ownedCpuFractionOfOneCore, .3); assert.equal(row.maxUnrelatedProcessCpuFractionOfOneCore, .02);
  assert.equal(row.cpuBusyFraction, .08); assert.equal(row.swapActivity, false);
  const missing = snapshot(1, [processRow(10, { cpu: 130n })], { busy: 232n, total: 1400n });
  assert.ok(intervalObservation(before, missing, { hz: 100, ownedBefore: owned, ownedAfter: owned }).coverageIssues.some(item => item.kind === 'unrelated-exit-final-cpu-unobserved'));
});

test('sampled unrelated build/browser/provider activity and swap produce explicit failure reasons', () => {
  const before = snapshot(0, [processRow(10), processRow(20, { labels: ['browser'] })]);
  const after = snapshot(1, [processRow(10), processRow(20, { labels: ['browser'] })], { busy: 201n, total: 1400n, swap: 1n });
  const row = intervalObservation(before, after, { hz: 100, ownedBefore: new Map(), ownedAfter: new Map() });
  assert.equal(row.concurrentTaskWorkloads, true); assert.equal(row.swapActivity, true);
  const metrics = windowMetrics(intervals());
  assert.deepEqual(ruleFailures({ ...metrics, swapActivity: true, concurrentTaskWorkloads: true }), ['swap-activity', 'unrelated-workload']);
});

test('all frozen boundaries are strict and incomplete observations cannot pass', () => {
  const good = windowMetrics(intervals()); assert.deepEqual(ruleFailures(good), []);
  for (const patch of [{ meanCpuBusyFraction: .05 }, { normalizedOneMinuteLoad: .1 }, { maxUnrelatedProcessCpuFractionOfOneCore: .1 }, { observationComplete: false }, { meanCpuBusyFraction: NaN }]) assert.ok(ruleFailures({ ...good, ...patch }).length);
  assert.throws(() => windowMetrics(intervals().slice(1)));
  const short = intervals(); short[0].seconds = .99; assert.throws(() => windowMetrics(short), /sixty-second/u);
});

test('pending precheck never fabricates inspection and manual review binds exact retained identity', () => {
  const values = artifacts();
  const pending = makeReceipt({ ...values, review: undefined, collectionId: 'synthetic-unit', samples: intervals(60) });
  assert.equal(pending.inspected, false); assert.equal(pending.precheck.inspected, false);
  assert.throws(() => checkFreshQuietReceipt(pending, 'synthetic-unit', 120001));
  for (const patch of [{ inspected: false }, { precheckSha256: hash('f') }, { ownershipSha256: hash('f') }, { reviewedAt: 59999 }, { decision: 'pending' }]) assert.throws(() => validateReview({ ...values.review, ...patch }, values));
});

test('fresh receipt uses live observations while preserving a separate historical reviewed digest', () => {
  const values = artifacts(), rows = intervals(60); rows.forEach(row => { row.cpuTicks.busy = '2'; });
  const receipt = makeReceipt({ ...values, collectionId: 'synthetic-unit', samples: rows });
  assert.equal(receipt.meanCpuBusyFraction, .02); assert.equal(values.precheck.metrics.meanCpuBusyFraction, .01);
  assert.equal(receipt.observedAt, 120000); assert.equal(receipt.precheck.endedAt, 60000); assert.equal(receipt.sha256, hash('a')); assert.equal(receipt.precheck.reviewSha256, hash('c'));
  assert.doesNotThrow(() => checkFreshQuietReceipt(receipt, 'synthetic-unit', 120001));
  assert.throws(() => checkFreshQuietReceipt(receipt, 'synthetic-unit', 125001));
  const contaminated = intervals(60); contaminated.at(-1).normalizedOneMinuteLoad = .1;
  assert.throws(() => checkFreshQuietReceipt(makeReceipt({ ...values, collectionId: 'synthetic-unit', samples: contaminated }), 'synthetic-unit', 120001));
});

test('process-specific read timestamps determine one-core fractions and reused PIDs cannot hide new work', () => {
  const before = snapshot(0, [processRow(10, { cpu: 0n })]);
  const after = snapshot(1, [processRow(10, { cpu: 10n })], { busy: 210n, total: 1400n });
  after.processes.get(10).readMonotonicNs = 1_250_000_000n;
  const row = intervalObservation(before, after, { hz: 100, ownedBefore: new Map(), ownedAfter: new Map() });
  assert.equal(row.maxUnrelatedProcessCpuFractionOfOneCore, .08);
  const reused = snapshot(1, [processRow(10, { start: 1050n, cpu: 20n, labels: ['build-or-package-tool'] })], { busy: 220n, total: 1400n });
  const observed = intervalObservation(before, reused, { hz: 100, ownedBefore: new Map([['10:10', {}]]), ownedAfter: new Map() });
  assert.equal(observed.maxUnrelatedProcessCpuFractionOfOneCore, .2); assert.equal(observed.concurrentTaskWorkloads, true);
});
