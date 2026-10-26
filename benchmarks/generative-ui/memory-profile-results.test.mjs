import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { MEMORY_PHASES } from './memory-workload.mjs';
import { memoryProfileSchedule, validateMemoryObservation, validateMemoryCycle, summarizeMemoryRun } from './memory-profile-results.mjs';
import { reviewedQuietFixture, sharedHostQuietFixture } from './profile-reviewed.test-fixture.mjs';

const observation = phase => ({ phase, gcPasses: 2, taskBetweenGcPasses: true,
  heap: { usedSize: 16 * 1024 * 1024, totalSize: 32 * 1024 * 1024, embedderHeapUsedSize: null, backingStorageSize: null },
  rendererDom: { documents: 1, nodes: 10, jsEventListeners: 2 }, connectedFixtureNodes: phase.includes('disposed') ? 0 : 20,
  connectedFixtureElements: phase.includes('disposed') ? 0 : 10, sourceCharacters: phase === 'mounted' ? 1024 : 0,
  controllerParts: phase.includes('disposed') ? 0 : 50, controllerIslands: phase.includes('disposed') ? 0 : 10,
  pendingOperations: 0, actions: phase === 'restored-disposed' ? 2 : 1, protocolOwners: 0, protocolSurfaces: phase.includes('disposed') ? 0 : 3,
  externalArchiveBytes: ['released', 'disposed', 'restored'].includes(phase) ? 524288 : 0 });
const cycle = number => ({ lifecycle: 'full-chat', runIndex: 0, cycle: number, regime: 'persistent', admission: number % 2 ? 'direct' : 'adapters',
  savedBytes: 524288, archiveSha256: 'a'.repeat(64), semanticAssertionsPassed: true, contaminated: false, observations: MEMORY_PHASES.map(phase => ({ ...observation(phase), protocolOwners: !phase.includes('disposed') && number % 2 === 0 ? 2 : 0 })) });

function reviewedCycle(number, fixture = reviewedQuietFixture()) {
  const { observer, receipt, receiptSource, receiptSha256 } = fixture;
  const evidence = { receiptSha256, receiptSource, contaminated: receipt.contaminated, receipt };
  return { ...cycle(number), collectionId: receipt.collectionId, quietObserver: observer, admissionSha256: receipt.admissionSha256, contaminated: true,
    quietEvidence: { before: evidence, after: structuredClone(evidence) }, preQuietSha256: receiptSha256, postQuietSha256: receiptSha256 };
}

test('memory result metadata cannot relabel a valid receipt as another fixed observer profile', () => {
  const row = reviewedCycle(1), shared = sharedHostQuietFixture().observer;
  const options = { quietObserver: row.quietObserver, collectionId: row.collectionId, admissionSha256: row.admissionSha256 };
  const relabelled = { ...row, quietObserver: { ...shared, configSha256: row.quietObserver.configSha256 } };
  assert.throws(() => validateMemoryCycle(relabelled, options), /observer/u);
});

test('shared-host memory evidence keeps observed background CPU and every original lifecycle budget', () => {
  const row = reviewedCycle(1, sharedHostQuietFixture());
  const options = { quietObserver: row.quietObserver, collectionId: row.collectionId, admissionSha256: row.admissionSha256 };
  assert.doesNotThrow(() => validateMemoryCycle(row, options));
  assert.equal(row.quietEvidence.before.receipt.maxUnrelatedProcessCpuFractionOfOneCore, .35875);
  assert.equal(row.contaminated, true);
  assert.ok(row.quietEvidence.before.receipt.failures.includes('unrelated-process-cpu'));
  assert.throws(() => validateMemoryCycle(row));
  assert.throws(() => validateMemoryCycle(row, { ...options, quietObserver: reviewedQuietFixture().observer }));
  for (const mutate of [value => { value.observations[0].gcPasses = 1; }, value => { value.savedBytes = 524289; },
    value => { value.lifecycle = 'unknown'; }, value => { value.observations.reverse(); },
    value => { value.observations[0].heap.usedSize = 134217729; value.observations[0].heap.totalSize = 268435456; },
  ]) {
    const changed = structuredClone(row); mutate(changed); assert.throws(() => validateMemoryCycle(changed, options));
  }
  const rows = Array.from({ length: 40 }, (_, index) => reviewedCycle(index + 1, sharedHostQuietFixture()));
  assert.equal(summarizeMemoryRun(rows, options).quietObserver.profile, 'shared-host-observed-v1');
  assert.throws(() => summarizeMemoryRun(rows.map((value, index) => index === 19 ? reviewedCycle(20) : value), options));
  rows.at(-1).observations.at(-1).rendererDom.jsEventListeners++;
  assert.equal(summarizeMemoryRun(rows, options).withinBudget, false, 'shared-host admission does not waive the original retained-counter bound');
});

test('memory cycles require explicit matching observer and collection evidence while retaining strict failure', () => {
  const row = reviewedCycle(1), options = { quietObserver: row.quietObserver, collectionId: row.collectionId, admissionSha256: row.admissionSha256 };
  assert.doesNotThrow(() => validateMemoryCycle(row, options));
  assert.throws(() => validateMemoryCycle(row), /quiet profile/u);
  assert.throws(() => validateMemoryCycle(row, { quietObserver: row.quietObserver }), /collection/u);
  assert.throws(() => validateMemoryCycle(row, { ...options, admissionSha256: undefined }), /helper/u);
  for (const mutate of [value => { value.contaminated = false; }, value => { value.quietEvidence.before.contaminated = false; },
    value => { value.quietEvidence.after = null; }, value => { value.quietObserver.configSha256 = 'b'.repeat(64); },
    value => { value.preQuietSha256 = 'e'.repeat(64); }, value => { value.admissionSha256 = '8'.repeat(64); },
    value => { value.postQuietSha256 = 'e'.repeat(64); }, value => { value.observations[0].gcPasses = 1; },
    value => { value.quietEvidence.after.receiptSource += ' '; },
    value => { value.observations[0].heap.usedSize = 129 * 1024 * 1024; value.observations[0].heap.totalSize = 256 * 1024 * 1024; },
  ]) {
    const changed = structuredClone(row); mutate(changed); assert.throws(() => validateMemoryCycle(changed, options));
  }
  for (const [mutate, expected] of [
    [receipt => { receipt.collectionId = 'another'; }, /Invalid reviewed live receipt/u],
    [receipt => { receipt.admissionSha256 = '8'.repeat(64); receipt.precheck.admissionSha256 = '8'.repeat(64); }, /admission helper identity changed/u],
  ]) {
    const changed = structuredClone(row), after = changed.quietEvidence.after;
    mutate(after.receipt);
    after.receiptSource = `${JSON.stringify(after.receipt)}\n`;
    after.receiptSha256 = createHash('sha256').update(after.receiptSource).digest('hex');
    changed.postQuietSha256 = after.receiptSha256;
    assert.throws(() => validateMemoryCycle(changed, options), expected);
  }
});

test('memory summaries cannot pool observer scopes, configurations or collections', () => {
  const rows = Array.from({ length: 40 }, (_, index) => reviewedCycle(index + 1));
  const options = { quietObserver: rows[0].quietObserver, collectionId: rows[0].collectionId, admissionSha256: rows[0].admissionSha256 };
  const result = summarizeMemoryRun(rows, options);
  assert.equal(result.withinBudget, true); assert.deepEqual(result.quietObserver, options.quietObserver);
  assert.equal(result.collectionId, options.collectionId); assert.equal(rows.every(row => row.contaminated), true);
  assert.equal(result.admissionSha256, options.admissionSha256);
  assert.throws(() => summarizeMemoryRun(rows));
  for (const replacement of [cycle(20), { ...reviewedCycle(20), collectionId: 'another' },
    { ...reviewedCycle(20), quietObserver: { ...options.quietObserver, configSha256: 'b'.repeat(64) } },
    { ...reviewedCycle(20), admissionSha256: '8'.repeat(64) },
  ]) assert.throws(() => summarizeMemoryRun(rows.map((row, index) => index === 19 ? replacement : row), options));
});

test('fixed memory schedule has 240 persistent cycles, 30 fresh controls and parity ordering', () => {
  const schedule = memoryProfileSchedule();
  assert.equal(schedule.length, 270); assert.equal(schedule.length * MEMORY_PHASES.length, 1350);
  assert.equal(schedule.filter(row => row.regime === 'persistent').length, 240);
  assert.equal(schedule.filter(row => row.regime === 'fresh').length, 30);
  assert.equal(new Set(schedule.map(row => `${row.lifecycle}/${row.runIndex}/${row.cycle}/${row.regime}`)).size, 270);
  for (const lifecycle of ['full-chat', 'full-dashboard']) for (let runIndex = 0; runIndex < 3; runIndex++) {
    const rows = schedule.filter(row => row.lifecycle === lifecycle && row.runIndex === runIndex);
    assert.deepEqual(rows.filter(row => row.regime === 'fresh').map(row => row.cycle), [1, 10, 20, 30, 40]);
    assert.deepEqual(rows.filter(row => row.cycle === 1).map(row => row.regime), ['persistent', 'fresh']);
    assert.deepEqual(rows.filter(row => row.cycle === 10).map(row => row.regime), ['fresh', 'persistent']);
    assert.equal(rows.every(row => row.admission === (row.cycle % 2 ? 'direct' : 'adapters')), true);
  }
});

test('observation admission rejects missing counters, wrong GC, live excess and retained disposed state', () => {
  assert.doesNotThrow(() => validateMemoryCycle(cycle(1)));
  for (const modify of [row => { row.gcPasses = 1; }, row => { row.gcPasses = 3; }, row => { row.taskBetweenGcPasses = false; },
    row => { delete row.rendererDom.nodes; }, row => { row.heap.usedSize = NaN; }, row => { delete row.heap.backingStorageSize; }, row => { row.pendingOperations = 1; }]) {
    const value = observation('mounted'); modify(value); assert.throws(() => validateMemoryObservation(value));
  }
  const live = observation('mounted'); live.heap.totalSize = 512 * 1024 * 1024; live.heap.usedSize = 128 * 1024 * 1024;
  assert.doesNotThrow(() => validateMemoryObservation(live)); live.heap.usedSize++;
  assert.throws(() => validateMemoryObservation(live), /ceiling/u);
  live.heap.usedSize = 256 * 1024 * 1024; assert.doesNotThrow(() => validateMemoryObservation(live, { large: true }));
  live.heap.usedSize++; assert.throws(() => validateMemoryObservation(live, { large: true }), /ceiling/u);
  for (const field of ['connectedFixtureNodes', 'connectedFixtureElements', 'sourceCharacters', 'controllerParts', 'controllerIslands']) {
    const value = observation('restored-disposed'); value[field] = 1; assert.throws(() => validateMemoryObservation(value));
  }
  for (const modify of [row => { row.savedBytes++; }, row => { row.observations.reverse(); }, row => { row.observations[3].actions = 2; },
    row => { row.semanticAssertionsPassed = false; }, row => { row.contaminated = true; }, row => { row.admission = 'adapters'; }]) {
    const row = cycle(1); modify(row); assert.throws(() => validateMemoryCycle(row));
  }
});

test('one-run summary reuses signed fixed-block statistics and applies every renderer counter tail gate', () => {
  const rows = Array.from({ length: 40 }, (_, index) => cycle(index + 1));
  rows.forEach((row, index) => { row.observations.at(-1).heap.usedSize -= index * 1024; });
  const result = summarizeMemoryRun(rows);
  assert.equal(result.retained.deltaBytes, -35 * 1024); assert.equal(result.retained.slope, -1024); assert.equal(result.withinBudget, true);
  assert.equal(result.retained.block, 5); assert.equal(result.retained.replicates, 10000); assert.equal(result.retained.seed, 20261026);
  assert.deepEqual(result.sensitivity.map(item => item.block), [4, 8]);
  rows.at(-1).observations.at(-1).rendererDom.jsEventListeners++;
  const growth = summarizeMemoryRun(rows); assert.equal(growth.retained.withinBudget, true); assert.equal(growth.counters.jsEventListeners.withinBudget, false); assert.equal(growth.withinBudget, false);
  assert.throws(() => summarizeMemoryRun(rows.slice(1)), /forty/u);
  rows[10].regime = 'fresh'; assert.throws(() => summarizeMemoryRun(rows)); rows[10].regime = 'persistent';
  rows[10].runIndex = 1; assert.throws(() => summarizeMemoryRun(rows), /pool/u);
});
