import test from 'node:test';
import assert from 'node:assert/strict';
import { profileCells, cellSchedule, validateCapabilities, validateOperation, validateSample, summarizeCell, sampleBudgetViolations, percentile, bootstrapP95, summarizeRetainedHeap, maximumCls } from './profile-results.mjs';
import { makeReviewedQuietEvidence } from './profile-admission.mjs';
import { reviewedQuietFixture, sharedHostQuietFixture, aggregateHostQuietFixture } from './profile-reviewed.test-fixture.mjs';

const capabilities = { longtask: { supported: true, positiveControl: true, receipt: 'longtask-control' }, layoutShift: { supported: false, positiveControl: false, reason: 'entry-type-unavailable' } };
const cell = () => profileCells()[0];
const descriptor = { id: 'edit', kind: 'interaction', trigger: 'event', expectedFingerprint: 'expected' };
const operation = () => ({ ...descriptor, generation: 'g1', fingerprint: 'expected', start: 10, listenerReceipt: 11, semanticCommit: 20, renderOpportunity: 40, censored: false });
const sample = index => ({ schemaVersion: 1, cellId: cell().id, batchIndex: Math.floor(index / 30), sampleIndex: index, warmup: false, capabilities, operations: [operation()], renderer: { supported: false, reason: 'synthetic-unit-case', taskMs: null, scriptMs: null, layoutMs: null, styleMs: null }, window: { start: 0, end: 50 }, observers: { longTasks: [], layoutShifts: null }, disposal: { connectedNodes: 0, connectedElements: 0, retainedSources: 0, pendingOperations: 0 }, contaminated: false });

test('schedule contains all ten workloads and exact distinct primary/narrow cells with excluded warmups', () => {
  const cells = profileCells();
  assert.equal(cells.length, 69);
  assert.equal(new Set(cells.map(row => row.id)).size, 69);
  assert.equal(cells.filter(row => row.width === 320).length, 9);
  const schedule = cellSchedule(cells[0]);
  assert.equal(schedule.length, 66);
  assert.equal(schedule.filter(row => row.warmup).length, 6);
  assert.deepEqual(schedule.filter(row => !row.warmup).map(row => row.sampleIndex), Array.from({ length: 60 }, (_, i) => i));
  assert.throws(() => cellSchedule({ ...cells[0], workload: 'unknown' }));
});

test('unsupported instrumentation stays explicit; failed or invented positive controls reject', () => {
  assert.doesNotThrow(() => validateCapabilities(capabilities));
  assert.throws(() => validateCapabilities({ ...capabilities, invented: { supported: true } }));
  for (const change of [undefined, { supported: true, positiveControl: false }, { supported: false, positiveControl: false }, { supported: true, positiveControl: true }]) {
    assert.throws(() => validateCapabilities({ ...capabilities, longtask: change }));
  }
});

test('operation admission refuses omitted timestamps, censoring and generation/result mismatches', () => {
  assert.doesNotThrow(() => validateOperation(operation(), descriptor, 'g1'));
  for (const patch of [{ renderOpportunity: undefined }, { censored: true }, { generation: 'g0' }, { fingerprint: 'other' }, { start: NaN }, { semanticCommit: 9 }, { listenerReceipt: 21 }]) {
    assert.throws(() => validateOperation({ ...operation(), ...patch }, descriptor, 'g1'));
  }
  assert.throws(() => validateOperation({ ...operation(), id: 'different' }, descriptor, 'g1'));
});

test('sample admission requires real metrics when supported and null only when unsupported', () => {
  assert.doesNotThrow(() => validateSample(sample(0), cell(), [descriptor]));
  for (const patch of [{ observers: { longTasks: null, layoutShifts: null } }, { observers: { longTasks: [], layoutShifts: [] } }, { operations: [] }, { contaminated: true }, { disposal: { ...sample(0).disposal, pendingOperations: 1 } }, { warmup: true }, { renderer: undefined }, { renderer: { supported: false, reason: 'unsupported', taskMs: 0, scriptMs: null, layoutMs: null, styleMs: null } }]) {
    assert.throws(() => validateSample({ ...sample(0), ...patch }, cell(), [descriptor]));
  }
  assert.throws(() => validateSample({ ...sample(0), operations: [operation(), operation()] }, cell(), [descriptor]));
});

test('strict samples cannot silently admit a different observer profile even when its raw flag is clean', () => {
  const row = { ...sample(0), quietObserver: { profile: 'reviewed-idle-service-v1', configSha256: 'a'.repeat(64), scope: {
    processCpu: 'all-unrelated-userspace', kernelCpu: 'whole-host-aggregate', coverage: 'sampled-userspace-with-explicit-kernel-gaps' } } };
  assert.throws(() => validateSample(row, cell(), [descriptor]));
  assert.throws(() => sampleBudgetViolations(row, cell(), [descriptor]));
  assert.throws(() => summarizeCell(cell(), Array.from({ length: 60 }, (_, index) => ({ ...sample(index), quietObserver: row.quietObserver })), [descriptor], { replicates: 100 }));
});

test('reviewed samples preserve strict contamination and cannot mix observer or collection scopes', () => {
  const { observer, receipt, receiptSource, receiptSha256 } = reviewedQuietFixture();
  const before = makeReviewedQuietEvidence(receipt, receiptSha256, observer, { receiptSource }), after = makeReviewedQuietEvidence(receipt, receiptSha256, observer, { receiptSource });
  const options = { quietObserver: observer, collectionId: receipt.collectionId, admissionSha256: receipt.admissionSha256, replicates: 100 };
  const row = { ...sample(0), quietObserver: observer, collectionId: receipt.collectionId, admissionSha256: receipt.admissionSha256,
    contaminated: true, quietEvidence: { before, after }, quietReceiptSha256: after.receiptSha256 };
  validateSample(row, cell(), [descriptor], options);
  assert.deepEqual(sampleBudgetViolations(row, cell(), [descriptor], options), []);
  const rows = Array.from({ length: 60 }, (_, index) => ({ ...structuredClone(row), batchIndex: Math.floor(index / 30), sampleIndex: index }));
  const summary = summarizeCell(cell(), rows, [descriptor], options);
  assert.equal(summary.status, 'within-scoped-budgets'); assert.deepEqual(summary.quietObserver, observer); assert.equal(summary.collectionId, receipt.collectionId);
  assert.equal(row.contaminated, true); assert.equal(row.quietEvidence.after.receipt.observationComplete, false);
  for (const changes of [{ contaminated: false }, { quietEvidence: { before } }, { quietReceiptSha256: '0'.repeat(64) },
    { collectionId: 'different' }, { admissionSha256: '8'.repeat(64) }, { quietObserver: undefined }]) assert.throws(() => validateSample({ ...row, ...changes }, cell(), [descriptor], options));
  for (const scope of [{}, { quietObserver: observer }, { ...options, collectionId: 'different' }, { ...options, admissionSha256: '8'.repeat(64) }, { ...options, quietObserver: { ...observer, configSha256: '0'.repeat(64) } }]) {
    assert.throws(() => validateSample(row, cell(), [descriptor], scope));
    assert.throws(() => summarizeCell(cell(), rows, [descriptor], scope));
  }
  const hidden = { ...row, quietObserver: undefined, contaminated: false };
  assert.throws(() => validateSample(hidden, cell(), [descriptor]));
  const strict = { ...sample(0), quietObserver: observer, collectionId: receipt.collectionId, quietEvidence: {
    before: { receiptSha256: 'b'.repeat(64), contaminated: false }, after: { receiptSha256: 'f'.repeat(64), contaminated: false } }, quietReceiptSha256: 'f'.repeat(64) };
  assert.throws(() => validateSample(strict, cell(), [descriptor], options));
  const mixed = structuredClone(rows); mixed[20] = sample(20);
  assert.throws(() => summarizeCell(cell(), mixed, [descriptor], options));
  const slow = structuredClone(row); slow.operations[0].renderOpportunity = 111; slow.window.end = 150;
  assert.deepEqual(sampleBudgetViolations(slow, cell(), [descriptor], options), ['operation:edit']);
});

for (const fixture of [sharedHostQuietFixture, aggregateHostQuietFixture]) test(`${fixture.name} samples cannot pool profiles and still fail unchanged timing, CLS and long-task ceilings`, () => {
  const shared = fixture(), reviewed = reviewedQuietFixture();
  const evidence = makeReviewedQuietEvidence(shared.receipt, shared.receiptSha256, shared.observer, { receiptSource: shared.receiptSource });
  const options = { quietObserver: shared.observer, collectionId: shared.receipt.collectionId, admissionSha256: shared.receipt.admissionSha256, replicates: 100 };
  const row = { ...sample(0), contaminated: true, quietObserver: shared.observer, collectionId: options.collectionId, admissionSha256: options.admissionSha256,
    quietEvidence: { before: evidence, after: evidence }, quietReceiptSha256: evidence.receiptSha256 };
  validateSample(row, cell(), [descriptor], options);
  assert.deepEqual(sampleBudgetViolations(row, cell(), [descriptor], options), []);
  const rows = Array.from({ length: 60 }, (_, index) => ({ ...structuredClone(row), batchIndex: Math.floor(index / 30), sampleIndex: index }));
  const summary = summarizeCell(cell(), rows, [descriptor], options);
  assert.equal(summary.status, 'within-scoped-budgets'); assert.equal(summary.quietObserver.profile, shared.observer.profile);
  assert.equal(row.quietEvidence.before.receipt.admission.metrics.maxUnrelatedUserspaceProcessCpuFractionOfOneCore, fixture === aggregateHostQuietFixture ? .37953 : .35875);
  assert.throws(() => validateSample(row, cell(), [descriptor]));
  assert.throws(() => validateSample(row, cell(), [descriptor], { ...options, quietObserver: reviewed.observer }));
  const mixed = structuredClone(rows), oldEvidence = makeReviewedQuietEvidence(reviewed.receipt, reviewed.receiptSha256, reviewed.observer, { receiptSource: reviewed.receiptSource });
  mixed[30].quietObserver = reviewed.observer; mixed[30].quietEvidence = { before: oldEvidence, after: oldEvidence }; mixed[30].quietReceiptSha256 = oldEvidence.receiptSha256;
  assert.throws(() => summarizeCell(cell(), mixed, [descriptor], options));
  if (fixture === aggregateHostQuietFixture) {
    const previous = sharedHostQuietFixture();
    assert.throws(() => validateSample(row, cell(), [descriptor], { ...options, quietObserver: previous.observer }));
    const priorEvidence = makeReviewedQuietEvidence(previous.receipt, previous.receiptSha256, previous.observer, { receiptSource: previous.receiptSource });
    mixed[30].quietObserver = previous.observer; mixed[30].quietEvidence = { before: priorEvidence, after: priorEvidence }; mixed[30].quietReceiptSha256 = priorEvidence.receiptSha256;
    assert.throws(() => summarizeCell(cell(), mixed, [descriptor], options));
    assert.equal(row.quietEvidence.before.receipt.admission.metrics.userspaceObservationComplete, false);
    const incorrect = structuredClone(row); incorrect.operations[0].fingerprint = 'wrong-semantic-result';
    assert.throws(() => validateSample(incorrect, cell(), [descriptor], options));
  }
  const slow = structuredClone(row); slow.operations[0].renderOpportunity = 111; slow.window.end = 300;
  assert.deepEqual(sampleBudgetViolations(slow, cell(), [descriptor], options), ['operation:edit']);
  const shifted = structuredClone(row); shifted.capabilities.layoutShift = { supported: true, positiveControl: true, receipt: 'synthetic-control' };
  shifted.observers.layoutShifts = [{ startTime: 25, value: .10001, hadRecentInput: false, phase: 'edit' }];
  assert.deepEqual(sampleBudgetViolations(shifted, cell(), [descriptor], options), ['cls']);
  const blocked = structuredClone(row); blocked.window.end = 300; blocked.observers.longTasks = [{ startTime: 0, duration: 200.01, phase: 'edit' }];
  assert.deepEqual(sampleBudgetViolations(blocked, cell(), [descriptor], options), ['longtask']);
});

test('cell summary enforces every sample index and does not combine duplicate/missing observations', () => {
  const rows = Array.from({ length: 60 }, (_, i) => sample(i));
  const summary = summarizeCell(cell(), rows, [descriptor], { replicates: 100 });
  assert.equal(summary.status, 'within-scoped-budgets');
  assert.equal(summary.operations.edit.endToEnd.max, 30);
  assert.equal(summary.cls, null);
  assert.throws(() => summarizeCell(cell(), rows.slice(1), [descriptor]));
  assert.throws(() => summarizeCell(cell(), [...rows.slice(1), rows[1]], [descriptor]));
  const slow = structuredClone(rows); slow[59].operations[0].renderOpportunity = 150; slow[59].window.end = 160;
  assert.equal(summarizeCell(cell(), slow, [descriptor], { replicates: 100 }).status, 'budget-exceeded');
});

test('statistics retain exact boundaries and deterministic bootstrap rather than inventing confidence claims', () => {
  assert.equal(percentile([1, 2, 3, 4], .95), 4);
  assert.deepEqual(bootstrapP95([5, 5, 5], { replicates: 100 }), { p95: 5, upper95: 5, replicates: 100, seed: 20261026 });
  assert.deepEqual(bootstrapP95([1, 2, 8, 10], { replicates: 100 }), bootstrapP95([1, 2, 8, 10], { replicates: 100 }));
  assert.throws(() => percentile([], .95));
  assert.throws(() => bootstrapP95([1, NaN]));
  assert.throws(() => bootstrapP95([1], { replicates: 0 }));
  const flat = summarizeRetainedHeap(Array(40).fill(1_000_000), { replicates: 100 });
  assert.equal(flat.deltaBytes, 0); assert.equal(flat.slopeUpper95, 0); assert.equal(flat.withinBudget, true);
  const rising = summarizeRetainedHeap(Array.from({ length: 40 }, (_, i) => 1_000_000 + i * 20_000), { replicates: 100 });
  assert.equal(rising.withinBudget, false); assert.ok(rising.slopeUpper95 > 16384);
  assert.throws(() => summarizeRetainedHeap(Array(39).fill(1)));
});

test('CLS preserves session windows and excludes recent-input entries without summing phase maxima', () => {
  const entries = [{ startTime: 0, value: .03, hadRecentInput: false }, { startTime: 500, value: .04, hadRecentInput: false }, { startTime: 1000, value: 1, hadRecentInput: true }, { startTime: 2000, value: .06, hadRecentInput: false }];
  assert.equal(maximumCls(entries), .07);
  assert.throws(() => maximumCls([{ startTime: 0, value: -1, hadRecentInput: false }]));
});

test('one over-budget observation is detectable immediately without collecting the remaining cell', () => {
  assert.deepEqual(sampleBudgetViolations(sample(0), cell(), [descriptor]), []);
  const row = sample(0); row.operations[0].renderOpportunity = 110; row.window.end = 200;
  assert.deepEqual(sampleBudgetViolations(row, cell(), [descriptor]), []);
  row.operations[0].renderOpportunity = 110.01;
  assert.deepEqual(sampleBudgetViolations(row, cell(), [descriptor]), ['operation:edit']);
});

test('supplemental first-mount lifecycle preserves cadence evidence without inheriting operation ceilings', () => {
  const row = sample(0), value = row.operations[0];
  Object.assign(value, { start: 10000, listenerReceipt: 10001, semanticCommit: 10010, renderOpportunity: 10040,
    firstMount: { scope: 'first-operation-lifecycle', operationId: descriptor.id, generation: 'g1', start: 0, semanticCommit: 10010, renderOpportunity: 10040 } });
  row.window.end = 10050;
  assert.deepEqual(sampleBudgetViolations(row, cell(), [descriptor]), []);
  for (const patch of [{ generation: 'stale' }, { operationId: 'other' }, { start: 10001 }, { semanticCommit: 10011 }, { renderOpportunity: 10041 }]) {
    assert.throws(() => validateOperation({ ...value, firstMount: { ...value.firstMount, ...patch } }, descriptor, 'g1'));
  }
});
