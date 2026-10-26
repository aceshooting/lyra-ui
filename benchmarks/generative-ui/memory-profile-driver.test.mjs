import assert from 'node:assert/strict';
import { test } from 'node:test';
import { observeMemoryProcess, runMemoryCycle, runMemoryX } from './memory-profile-driver.mjs';
import { validateMemoryCycle } from './memory-profile-results.mjs';

function owner({ failNative = false } = {}) {
  const trace = []; let phase = 'baseline', archiveBytes = 0, actions = 0;
  const metrics = () => ({ connectedFixtureNodes: phase.includes('disposed') || phase === 'baseline' ? 0 : 100,
    connectedFixtureElements: phase.includes('disposed') || phase === 'baseline' ? 0 : 50,
    sourceCharacters: phase === 'mounted' ? 1000 : 0, controllerParts: phase.includes('disposed') ? 0 : 15,
    controllerIslands: phase.includes('disposed') ? 0 : 15, pendingOperations: 0, actions,
    protocolOwners: phase.includes('disposed') || phase === 'baseline' ? 0 : 2,
    protocolSurfaces: phase.includes('disposed') || phase === 'baseline' ? 0 : 3, externalArchiveBytes: archiveBytes });
  return { trace, services: {}, async hostCounts() { return { documents: 1, historyEntries: 2, instances: 1, bytes: 2048 }; },
    async activate(native) { trace.push(`native:${native.selector}`); },
    page: { async evaluate(_callback, input) {
      if (!input) { trace.push('browser-task'); return; }
      const { method, value } = input; trace.push(`${method}:${value ?? ''}`);
      if (method === 'metrics') return metrics();
      if (method === 'nativeActions') return (value === 'initial' ? ['edit', 'first'] : value === 'second' ? ['second'] : []).map(id => ({ id, native: { action: 'click', selector: `#${id}` } }));
      if (method === 'completeNative') { if (failNative) throw new Error('Native action failed.'); if (value !== 'edit') actions++; }
      if (method === 'readOracle') { phase = value; return { semanticAssertionsPassed: true, fingerprint: `semantic:${value}` }; }
      if (method === 'save') { archiveBytes = 1234; return { bytes: archiveBytes, sha256: 'a'.repeat(64) }; }
      if (method === 'releaseArchive') archiveBytes = 0;
    } },
    cdp: { async send(method, args) {
      trace.push(method); if (method === 'Runtime.releaseObjectGroup') assert.deepEqual(args, { objectGroup: 'memory-profile' });
      if (method === 'Runtime.getHeapUsage') return { usedSize: 16 * 1024 * 1024, totalSize: 32 * 1024 * 1024 };
      if (method === 'Memory.getDOMCounters') return { documents: 1, nodes: 10, jsEventListeners: 2 };
    } },
  };
}

test('observation releases handles and requests exactly two GC passes with an intervening browser task', async () => {
  const process = owner(), result = await observeMemoryProcess(process, 'baseline');
  assert.deepEqual(process.trace, ['settle:', 'metrics:', 'Runtime.releaseObjectGroup', 'HeapProfiler.collectGarbage', 'browser-task', 'HeapProfiler.collectGarbage', 'Runtime.getHeapUsage', 'Memory.getDOMCounters']);
  assert.equal(result.gcPasses, 2); assert.equal(result.taskBetweenGcPasses, true);
  assert.equal(result.heap.embedderHeapUsedSize, null); assert.equal(result.heap.backingStorageSize, null);
});

test('five phases bracket exact native actions, one external archive and truthful first disposal', async () => {
  const process = owner();
  const row = await runMemoryCycle(process, { lifecycle: 'full-chat', runIndex: 0, cycle: 2, regime: 'persistent', admission: 'adapters' });
  assert.doesNotThrow(() => validateMemoryCycle(row));
  assert.equal(process.trace.filter(item => item === 'HeapProfiler.collectGarbage').length, 10);
  for (const id of ['edit', 'first', 'second']) assert.ok(process.trace.indexOf(`armNative:${id}`) < process.trace.indexOf(`native:#${id}`)
    && process.trace.indexOf(`native:#${id}`) < process.trace.indexOf(`completeNative:${id}`));
  assert.ok(process.trace.indexOf('readOracle:disposed') < process.trace.indexOf('restore:'));
  assert.ok(process.trace.indexOf('releaseArchive:') < process.trace.indexOf('readOracle:restored-disposed'));
  assert.equal(row.observations[2].externalArchiveBytes, 1234); assert.equal(row.observations[4].externalArchiveBytes, 0);
  assert.deepEqual(row.hostAfter, { documents: 1, historyEntries: 2, instances: 1, bytes: 2048 });
});

test('native failure returns its partial attempt and never observes or retries the failed cycle', async () => {
  const process = owner({ failNative: true });
  await assert.rejects(runMemoryCycle(process, { lifecycle: 'full-dashboard', runIndex: 1, cycle: 1, regime: 'fresh', admission: 'direct' }), error => {
    assert.equal(error.attempt.lastCommand, 'completeNative'); assert.equal(error.attempt.semanticAssertionsPassed, false);
    assert.equal(error.attempt.observations.length, 0); return true;
  });
  assert.equal(process.trace.some(item => item === 'HeapProfiler.collectGarbage'), false);
  assert.equal(process.trace.filter(item => item.startsWith('native:')).length, 1);
});

test('independent memory semantic smoke completes all five phases without any CDP or heap operation', async () => {
  const process = owner(); process.cdp.send = () => assert.fail('Correctness smoke must not request CDP counters or GC.');
  const row = await runMemoryCycle(process, { lifecycle: 'full-chat', runIndex: 0, cycle: 2, regime: 'persistent', admission: 'adapters' }, { collect: false });
  assert.equal(row.method, 'memory-semantic-smoke'); assert.equal(row.observations.length, 5); assert.equal(row.semanticAssertionsPassed, true);
  assert.equal(row.observations.some(item => 'heap' in item || 'gcPasses' in item || 'rendererDom' in item), false);
});

function xOwner({ failAfterObservation = false } = {}) {
  const process = owner(), original = process.page.evaluate;
  process.page.evaluate = async (callback, input) => {
    const method = input?.method;
    if (method === 'mountX' || method === 'readXOracle') {
      process.trace.push(method);
      if (method === 'readXOracle' && failAfterObservation) throw new Error('X actual chart changed.');
      return { semanticAssertionsPassed: true, fingerprint: 'full-X' };
    }
    if (method === 'metrics') return { connectedFixtureNodes: 100, connectedFixtureElements: 50, sourceCharacters: 12345,
      controllerParts: 1, controllerIslands: 1, pendingOperations: 0, actions: 0, protocolOwners: 0, protocolSurfaces: 0, externalArchiveBytes: 0 };
    if (method === 'disposeX') return { connectedFixtureNodes: 0, connectedFixtureElements: 0, sourceCharacters: 0,
      controllerParts: 0, controllerIslands: 0, pendingOperations: 0, externalArchiveBytes: 0,
      fixtureDisposal: { connectedNodes: 0, connectedElements: 0, retainedSources: 0, pendingOperations: 0 } };
    return original(callback, input);
  };
  return process;
}

test('one-shot X smoke observes actual scalar ownership without a CDP or GC operation', async () => {
  const process = xOwner(); process.cdp.send = () => assert.fail('X semantic smoke cannot use CDP.');
  const result = await runMemoryX(process, { collect: false, fixtureSha256: 'a'.repeat(64) });
  assert.equal(result.semanticAssertionsPassed, true); assert.equal(result.observation.sourceCharacters, 12345);
  assert.equal(result.observation.controllerIslands, 1); assert.equal('heap' in result.observation, false);
  assert.deepEqual(result.disposal.fixtureDisposal, { connectedNodes: 0, connectedElements: 0, retainedSources: 0, pendingOperations: 0 });
  assert.equal(process.currentAttempt, undefined);
});

test('one-shot X failure preserves its collected raw observation before a later oracle throws', async () => {
  const process = xOwner({ failAfterObservation: true });
  await assert.rejects(runMemoryX(process, { fixtureSha256: 'a'.repeat(64) }), error => {
    assert.equal(error.attempt.kind, 'large-X'); assert.equal(error.attempt.lastCommand, 'readXOracle');
    assert.equal(error.attempt.observation.sourceCharacters, 12345);
    assert.equal(error.attempt.observation.heap.usedSize, 16 * 1024 * 1024);
    assert.deepEqual(error.attempt.observation.rendererDom, { documents: 1, nodes: 10, jsEventListeners: 2 });
    assert.equal(error.attempt.semanticAssertionsPassed, false); return true;
  });
  assert.equal(process.trace.filter(value => value === 'HeapProfiler.collectGarbage').length, 2);
  assert.equal(process.trace.includes('close:'), false);
});
