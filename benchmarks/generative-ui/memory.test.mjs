import assert from 'node:assert/strict';
import test from 'node:test';
import { memoryOptions, checkMemoryCycle, summarizeMemory } from './memory.mjs';
import { memorySource, memoryProse, expectedNote, MEMORY_PHASES } from './memory-workload.mjs';

test('memory cohort options require an explicit new output and bound repeated work', () => {
  assert.deepEqual(memoryOptions(['--output=memory.json']), { cycles: 20, output: 'memory.json' });
  for (const option of ['--cycles=0', '--cycles=101', '--cycles=2.5', '--browser=firefox']) assert.throws(() => memoryOptions([option, '--output=memory.json']));
  assert.throws(() => memoryOptions([]));
});

function cycle() {
  return { cycle: 1, regime: 'persistent', savedBytes: 1024, sourceCharactersBefore: 4096, sourceCharactersAfter: 0,
    assertions: { savedData: true, retainedAfterRelease: true, controllerCleared: true, restoredData: true, restoredProse: true, restoredEdit: true, dirtySurvivedRevision: true, noActionReplay: true },
    observations: MEMORY_PHASES.map(phase => ({ phase, actions: phase === 'restored-disposed' ? 2 : 1, connectedFixtureElements: phase.includes('disposed') ? 0 : 4, connectedFixtureNodes: phase.includes('disposed') ? 0 : 8,
      heap: { usedSize: 2000, totalSize: 4000 }, rendererDom: { documents: 1, nodes: 20, jsEventListeners: 5 } })) };
}

test('memory admission fails a missing phase, uncollected counters, lost edits, source retention or replayed action', () => {
  checkMemoryCycle(cycle());
  for (const mutate of [
    value => { value.observations.pop(); },
    value => { value.observations[0].heap.usedSize = NaN; },
    value => { value.observations[1].rendererDom.jsEventListeners = undefined; },
    value => { value.assertions.dirtySurvivedRevision = false; },
    value => { value.sourceCharactersAfter = 1; },
    value => { value.observations[3].actions = 2; },
    value => { value.observations[4].connectedFixtureElements = 1; },
  ]) { const value = cycle(); mutate(value); assert.throws(() => checkMemoryCycle(value)); }
});

test('heap summaries preserve negative collection differences and do not infer a ceiling', () => {
  const row = cycle(); row.observations[1].heap.usedSize = 1500;
  const summary = summarizeMemory([row]);
  assert.equal(summary.regimes.persistent.sourceReleaseDeltaBytes.median, -500);
  assert.match(summary.limitations, /not.*ceiling/u);
});

test('transport is generated per call and remains bounded while restored values are independently predictable', () => {
  const first = memorySource(1), second = memorySource(2);
  assert.notEqual(first, second);
  assert.ok(new TextEncoder().encode(first).byteLength < 65536);
  assert.ok(first.startsWith(memoryProse()));
  assert.equal(expectedNote(1), 'Edited note 0001');
});
