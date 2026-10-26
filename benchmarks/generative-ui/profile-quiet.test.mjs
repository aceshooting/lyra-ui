import { createHash } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCpuStat, parseLoadAverage, parseSwapCounters, parseProcessStat, workloadLabels, createOwnershipTracker, intervalObservation, windowMetrics, ruleFailures, validateReview, makeReceipt, quietSnapshotDeadline, validateObserverBaseline, reviewedWindowAdmission, validateReviewedReview, makeReviewedReceipt } from './profile-quiet.mjs';
import { REVIEWED_IDLE_SERVICE_PROFILE, REVIEWED_IDLE_SERVICE_SCOPE, SHARED_HOST_OBSERVED_PROFILE, SHARED_HOST_OBSERVED_SCOPE, makeReviewedQuietEvidence, parseObserverConfigBytes } from './profile-admission.mjs';
import { checkFreshQuietReceipt } from './profile-driver.mjs';

// Synthetic fixtures only. No /proc reader, monitor, campaign or inspected artifact runs here.
const hash = letter => letter.repeat(64);
function processRow(pid, { ppid = 1, start = 10n, cpu = 0n, comm = 'idle', labels = [], flags = 0n, cmdlineSha256 = hash('b') } = {}) {
  return { pid, ppid, startTimeTicks: start, cpuTicks: cpu, comm, labels, flags, kernelThread: (flags & 0x00200000n) !== 0n, cmdlineSha256 };
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
  before.processes.get(20).comm = 'exited-worker'; before.processes.get(20).labels = ['build-or-package-tool'];
  const incomplete = intervalObservation(before, missing, { hz: 100, ownedBefore: owned, ownedAfter: owned });
  assert.deepEqual(incomplete.coverageIssues, [{ kind: 'unrelated-exit-final-cpu-unobserved', pid: 20, startTimeTicks: '10', comm: 'exited-worker', labels: ['build-or-package-tool'], flags: '0', kernelThread: false }]);
  const rows = intervals(); rows[0].coverageIssues = incomplete.coverageIssues;
  assert.equal(windowMetrics(rows).observationComplete, false);
  assert.ok(ruleFailures(windowMetrics(rows)).includes('process-observation-incomplete'));
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

function scheduledSnapshots(deadlineFor, scanCost, count = 121) {
  const epochNs = 0n, rows = [], endpoints = [epochNs], deadlines = [], windows = [];
  let previous = snapshot(0, [processRow(10)]);
  for (let tick = 1; tick <= count; tick++) {
    const deadline = deadlineFor({ epochNs, tick, previousCompletionNs: previous.monotonicNs,
      oldestBoundaryNs: rows.length === 60 ? BigInt(rows[0].monotonicNs) : undefined });
    const started = deadline > previous.monotonicNs ? deadline : previous.monotonicNs;
    const completed = started + scanCost(tick);
    const current = snapshot(tick, [processRow(10)], { busy: 200n + BigInt(tick), total: 1000n + BigInt(tick) * 400n });
    current.monotonicNs = completed; current.observedAt = Number(completed) / 1e6;
    current.processes.get(10).readMonotonicNs = completed;
    const row = intervalObservation(previous, current, { hz: 100, ownedBefore: new Map(), ownedAfter: new Map() });
    rows.push(row); if (rows.length > 60) rows.shift();
    endpoints.push(completed); deadlines.push(deadline);
    if (rows.length === 60) windows.push(windowMetrics(rows));
    previous = current;
  }
  return { rows, endpoints, deadlines, windows };
}

test('absolute scan deadlines absorb read cost instead of adding it to every interval', () => {
  const cost = () => 180_000_000n;
  assert.throws(() => scheduledSnapshots(({ previousCompletionNs }) => previousCompletionNs + 1_000_000_000n, cost, 60), /sixty-second/u);
  const result = scheduledSnapshots(quietSnapshotDeadline, cost, 60);
  assert.equal(result.endpoints[60], 60_180_000_000n);
  assert.equal(result.windows[0].seconds, 60.18);
  assert.equal(result.deadlines[1] - result.deadlines[0], 1_000_000_000n);
  assert.equal(result.rows[0].seconds, 1.18); assert.equal(result.rows[1].seconds, 1);
  assert.equal(BigInt(result.rows[59].monotonicNs), result.deadlines[59] + cost());
});

test('the rolling boundary guard keeps variable-cost windows real and at least sixty seconds', () => {
  const cost = tick => tick === 1 ? 240_000_000n : BigInt(20 + tick % 7 * 25) * 1_000_000n;
  assert.throws(() => scheduledSnapshots(({ epochNs, tick }) => epochNs + BigInt(tick) * 1_000_000_000n, cost), /sixty-second/u);
  const result = scheduledSnapshots(quietSnapshotDeadline, cost, 181);
  assert.equal(result.windows.length, 122);
  assert.equal(new Set(result.endpoints).size, 182);
  for (const window of result.windows) assert.ok(window.seconds >= 60 && window.seconds <= 61);
  for (let tick = 1; tick <= 181; tick++) {
    assert.equal(result.endpoints[tick], result.deadlines[tick - 1] + cost(tick));
    if (tick > 60) assert.ok(result.deadlines[tick - 1] >= result.endpoints[tick - 60] + 60_000_000_000n);
  }
});

test('deadline scheduling cannot disguise a delayed actual observation or invalid clock input', () => {
  assert.throws(() => scheduledSnapshots(quietSnapshotDeadline, () => 600_000_000n, 1), /interval is missing or delayed/u);
  for (const input of [{ epochNs: 0, tick: 1 }, { epochNs: 0n, tick: 0 }, { epochNs: 0n, tick: 1.5 },
    { epochNs: 0n, tick: 61, oldestBoundaryNs: 1 }, { epochNs: 2n, tick: 61, oldestBoundaryNs: 1n }]) {
    assert.throws(() => quietSnapshotDeadline(input), /deadline/u);
  }
});

function observerConfig() {
  return { schemaVersion: 1, kind: 'quiet-observer-config', profile: REVIEWED_IDLE_SERVICE_PROFILE, collectionId: 'synthetic-unit', bootId: 'boot',
    scope: { ...REVIEWED_IDLE_SERVICE_SCOPE }, idleServices: [{ pid: 20, startTimeTicks: '10', comm: 'idle-service', cmdlineSha256: hash('b') }] };
}
const idleService = options => processRow(20, { comm: 'idle-service', labels: ['provider-or-agent'], ...options });
function observerRow({ beforeRows = [], afterRows = [], beforeService = idleService(), afterService = idleService(), owned = new Map(), config = observerConfig() } = {}) {
  const before = snapshot(0, [processRow(10), ...(beforeService ? [beforeService] : []), ...beforeRows]);
  const current = snapshot(1, [processRow(10), ...(afterService ? [afterService] : []), ...afterRows], { busy: 201n, total: 1400n });
  return { before, current, row: intervalObservation(before, current, { hz: 100, ownedBefore: owned, ownedAfter: owned, observerConfig: config }) };
}
function windowAdmission(samples, config = observerConfig(), options = {}) {
  const { configSource, configSha256 } = parseObserverConfigBytes(Buffer.from(`${JSON.stringify(config)}\n`));
  return reviewedWindowAdmission(samples, config, configSha256, { ...options, configSource });
}
function reviewedRows(row) {
  return intervals().map((base, index) => ({ ...row, observedAt: base.observedAt, monotonicNs: base.monotonicNs, seconds: base.seconds,
    coverageIssues: index === 0 ? row.coverageIssues : [], reviewed: { ...row.reviewed, kernelCoverageIssues: index === 0 ? row.reviewed.kernelCoverageIssues : [] } }));
}

test('PF_KTHREAD comes from stat flags, never a kernel-looking command name', () => {
  const fields = Array(20).fill('0'); fields[0] = 'S'; fields[1] = '2'; fields[6] = '2097152';
  const kernel = parseProcessStat(`30 (ordinary-name) ${fields.join(' ')}`);
  assert.equal(kernel.flags, 0x00200000n); assert.equal(kernel.kernelThread, true);
  fields[6] = '0'; assert.equal(parseProcessStat(`30 (kworker/0:1) ${fields.join(' ')}`).kernelThread, false);
  fields[6] = 'invalid'; assert.throws(() => parseProcessStat(`30 (kworker/0:1) ${fields.join(' ')}`));
});

test('reviewed idle identity stays unrelated and permits only zero observed CPU ticks', () => {
  const config = observerConfig(), { before, row } = observerRow();
  assert.doesNotThrow(() => validateObserverBaseline(before, new Map(), config));
  assert.equal(row.concurrentTaskWorkloads, true); assert.equal(row.reviewed.unapprovedTaskWorkloads, false);
  assert.equal(row.reviewed.services[0].owned, false); assert.equal(row.reviewed.services[0].cpuTickDelta, '0');
  assert.equal(row.reviewed.services[0].previousReadMonotonicNs, '0'); assert.equal(row.reviewed.services[0].currentReadMonotonicNs, '1000000000');
  assert.ok(ruleFailures(windowMetrics(reviewedRows(row))).includes('unrelated-workload'));
  const active = observerRow({ afterService: idleService({ cpu: 1n }) }).row;
  assert.equal(active.reviewed.maxUnrelatedUserspaceProcessCpuFractionOfOneCore, .01);
  assert.equal(active.reviewed.idleServicesVerified, false); assert.equal(active.reviewed.unapprovedTaskWorkloads, true);
  assert.ok(windowAdmission(reviewedRows(active), config).failures.includes('idle-service-not-idle-or-changed'));
});

test('idle-service allowance fails identity changes, disappearance and owned-root or descendant overlap', () => {
  for (const change of [{ start: 11n }, { comm: 'renamed' }, { cmdlineSha256: hash('c') }, { flags: 0x00200000n }]) {
    const { row } = observerRow({ afterService: idleService(change) }); assert.equal(row.reviewed.idleServicesVerified, false);
  }
  assert.equal(observerRow({ afterService: null }).row.reviewed.idleServicesVerified, false);
  const { before } = observerRow();
  assert.throws(() => validateObserverBaseline(before, new Map([['20:10', {}]]), observerConfig()), /campaign-owned/u);
  assert.throws(() => validateObserverBaseline({ ...before, bootId: 'changed' }, new Map(), observerConfig()), /changed/u);
  assert.equal(observerRow({ owned: new Map([['20:10', { role: 'campaign-descendant' }]]) }).row.reviewed.idleServicesVerified, false);
  const child = processRow(21, { ppid: 20, labels: ['provider-or-agent'] });
  const row = observerRow({ beforeRows: [child], afterRows: [child] }).row;
  assert.equal(row.reviewed.idleServicesVerified, true); assert.equal(row.reviewed.unapprovedTaskWorkloads, true);
});

test('only proven kernel coverage gaps are outside reviewed userspace coverage; host CPU still includes them', () => {
  const kernel = processRow(30, { flags: 0x00200000n, comm: 'ordinary-name' });
  const { row } = observerRow({ beforeRows: [kernel] });
  assert.equal(row.coverageIssues[0].kernelThread, true); assert.equal(row.reviewed.userspaceObservationComplete, true);
  assert.equal(windowMetrics(reviewedRows(row)).observationComplete, false);
  assert.equal(windowAdmission(reviewedRows(row)).accepted, true);
  const userspace = observerRow({ beforeRows: [processRow(30, { comm: 'kworker/0:1' })] }).row;
  assert.equal(userspace.reviewed.userspaceObservationComplete, false);
  assert.equal(windowAdmission(reviewedRows(userspace)).accepted, false);
  const loaded = reviewedRows(row); loaded[0].cpuTicks.busy = '1200'; loaded[0].cpuTicks.total = '1400';
  assert.ok(windowAdmission(loaded).failures.includes('total-host-cpu'));
});

test('reviewed receipt retains raw strict failure, requires exact manual config review and remains distinct', () => {
  const config = observerConfig(), { configSource, configSha256 } = parseObserverConfigBytes(Buffer.from(`${JSON.stringify(config)}\n`)), admissionSha256 = hash('9'), row = observerRow({ beforeRows: [processRow(30, { flags: 0x00200000n })] }).row;
  const samples = reviewedRows(row), values = artifacts();
  const precheck = { ...values.precheck, kind: 'reviewed-idle-service-precheck', admissionSha256, metrics: windowMetrics(samples), admission: reviewedWindowAdmission(samples, config, configSha256, { precheck: true, configSource }) };
  const quietObserver = { profile: config.profile, configSha256, scope: config.scope };
  const review = { ...values.review, kind: 'reviewed-idle-service-precheck-review', quietObserver, admissionSha256 };
  const options = { ...values, collectionId: 'synthetic-unit', samples, precheck, review, observerConfig: config, configSha256, configSource, admissionSha256 };
  const receipt = makeReviewedReceipt(options);
  assert.equal(receipt.inspected, false); assert.equal(receipt.contaminated, true); assert.equal(receipt.observationComplete, false);
  assert.equal(receipt.admission.inspected, true); assert.equal(receipt.admission.accepted, true);
  assert.throws(() => checkFreshQuietReceipt(receipt, 'synthetic-unit', 60001));
  const receiptSource = `${JSON.stringify(receipt, null, 2)}\n`, receiptSha256 = createHash('sha256').update(receiptSource).digest('hex');
  assert.doesNotThrow(() => makeReviewedQuietEvidence(receipt, receiptSha256, quietObserver, { collectionId: 'synthetic-unit', now: 60001, receiptSource }));
  const pending = makeReviewedReceipt({ ...options, review: undefined }); assert.equal(pending.admission.inspected, false);
  assert.throws(() => makeReviewedQuietEvidence(pending, hash('f'), quietObserver));
  assert.throws(() => validateReviewedReview({ ...review, quietObserver: { ...quietObserver, configSha256: hash('e') } }, options));
  assert.throws(() => validateReviewedReview(values.review, options));
  assert.throws(() => validateReviewedReview({ ...review, admissionSha256: hash('8') }, options), /authorization/u);
});


test('shared-host monitor preserves actual CPU attribution and uses separately reviewed receipt kinds', () => {
  const config = { ...observerConfig(), profile: SHARED_HOST_OBSERVED_PROFILE, scope: { ...SHARED_HOST_OBSERVED_SCOPE } };
  const { before, current } = observerRow({ config, beforeRows: [processRow(40)], afterRows: [processRow(40, { cpu: 36n })] });
  const cpuIds = Array.from({ length: 60 }, (_, index) => `cpu${index}`).join(',');
  before.cpu = { ...before.cpu, logicalCpus: 60, cpuIds };
  current.cpu = { busy: 236n, total: 7000n, logicalCpus: 60, cpuIds };
  current.monotonicNs = 1_003_480_000n; current.observedAt = 1003.48;
  for (const process of current.processes.values()) process.readMonotonicNs = current.monotonicNs;
  const row = intervalObservation(before, current, { hz: 100, ownedBefore: new Map(), ownedAfter: new Map(), observerConfig: config });
  assert.equal(row.reviewed.maxUnrelatedUserspaceProcessCpuFractionOfOneCore, .36 / 1.00348);
  assert.equal(row.cpuBusyFraction, 36 / 6000);
  const samples = reviewedRows(row), parsed = parseObserverConfigBytes(Buffer.from(`${JSON.stringify(config)}\n`));
  assert.equal(windowAdmission(samples, config).accepted, true);
  assert.deepEqual(windowAdmission(samples).failures, ['unrelated-userspace-cpu']);
  assert.ok(ruleFailures(windowMetrics(samples)).includes('unrelated-process-cpu'));
  const values = artifacts(), admissionSha256 = hash('9');
  const precheck = { ...values.precheck, kind: 'shared-host-observed-precheck', admissionSha256, metrics: windowMetrics(samples),
    admission: reviewedWindowAdmission(samples, config, parsed.configSha256, { precheck: true, configSource: parsed.configSource }) };
  const quietObserver = { profile: config.profile, configSha256: parsed.configSha256, scope: config.scope };
  const review = { ...values.review, kind: 'shared-host-observed-precheck-review', quietObserver, admissionSha256 };
  const options = { ...values, collectionId: 'synthetic-unit', samples, precheck, review, observerConfig: config, ...parsed, admissionSha256 };
  const receipt = makeReviewedReceipt(options), receiptSource = `${JSON.stringify(receipt, null, 2)}\n`, receiptSha256 = createHash('sha256').update(receiptSource).digest('hex');
  assert.equal(receipt.kind, 'shared-host-observed-live-receipt'); assert.equal(receipt.contaminated, true); assert.equal(receipt.inspected, false);
  assert.equal(receipt.admission.accepted, true); assert.equal(receipt.admission.metrics.maxUnrelatedUserspaceProcessCpuFractionOfOneCore, row.reviewed.maxUnrelatedUserspaceProcessCpuFractionOfOneCore);
  assert.doesNotThrow(() => makeReviewedQuietEvidence(receipt, receiptSha256, quietObserver, { receiptSource, admissionSha256 }));
  assert.throws(() => validateReviewedReview({ ...review, kind: 'reviewed-idle-service-precheck-review' }, options), /authorization/u);
  const active = observerRow({ config, afterService: idleService({ cpu: 1n }) }).row;
  assert.ok(windowAdmission(reviewedRows(active), config).failures.includes('idle-service-not-idle-or-changed'));
});
