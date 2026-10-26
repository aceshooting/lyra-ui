import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MEMORY_PHASES } from './memory-workload.mjs';
import { memoryProfileSchedule, validateMemoryObservation, validateMemoryCycle, summarizeMemoryRun } from './memory-profile-results.mjs';

const observation = phase => ({ phase, gcPasses: 2, taskBetweenGcPasses: true,
  heap: { usedSize: 16 * 1024 * 1024, totalSize: 32 * 1024 * 1024, embedderHeapUsedSize: null, backingStorageSize: null },
  rendererDom: { documents: 1, nodes: 10, jsEventListeners: 2 }, connectedFixtureNodes: phase.includes('disposed') ? 0 : 20,
  connectedFixtureElements: phase.includes('disposed') ? 0 : 10, sourceCharacters: phase === 'mounted' ? 1024 : 0,
  controllerParts: phase.includes('disposed') ? 0 : 50, controllerIslands: phase.includes('disposed') ? 0 : 10,
  pendingOperations: 0, actions: phase === 'restored-disposed' ? 2 : 1, protocolOwners: 0, protocolSurfaces: phase.includes('disposed') ? 0 : 3,
  externalArchiveBytes: ['released', 'disposed', 'restored'].includes(phase) ? 524288 : 0 });
const cycle = number => ({ lifecycle: 'full-chat', runIndex: 0, cycle: number, regime: 'persistent', admission: number % 2 ? 'direct' : 'adapters',
  savedBytes: 524288, archiveSha256: 'a'.repeat(64), semanticAssertionsPassed: true, contaminated: false, observations: MEMORY_PHASES.map(phase => ({ ...observation(phase), protocolOwners: !phase.includes('disposed') && number % 2 === 0 ? 2 : 0 })) });

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
