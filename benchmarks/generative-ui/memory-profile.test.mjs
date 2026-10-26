import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { MEMORY_PHASES } from './memory-workload.mjs';
import { memoryProfilePlan, validateMemoryManifest, runMemoryProfile } from './memory-profile.mjs';

const digest = 'a'.repeat(64);
const manifest = () => ({ schemaVersion: 1, kind: 'memory-profile', authorized: true, collectionId: 'synthetic-contract-test',
  designSha256: digest, sourceSha256: digest, compositionSha256: digest,
  candidate: { archiveSha256: digest, lockfileSha256: digest, buildSha256: digest },
  browser: { engine: 'chromium', executableSha256: digest }, configuration: memoryProfilePlan() });
const observation = phase => ({ phase, gcPasses: 2, taskBetweenGcPasses: true,
  heap: { usedSize: 16 * 1024 * 1024, totalSize: 32 * 1024 * 1024, embedderHeapUsedSize: null, backingStorageSize: null },
  rendererDom: { documents: 1, nodes: 2, jsEventListeners: 0 }, connectedFixtureNodes: phase.includes('disposed') || phase === 'baseline' ? 0 : 20,
  connectedFixtureElements: phase.includes('disposed') || phase === 'baseline' ? 0 : 10, sourceCharacters: phase === 'mounted' ? 1024 : 0,
  controllerParts: phase.includes('disposed') ? 0 : 12, controllerIslands: phase.includes('disposed') ? 0 : 12,
  pendingOperations: 0, actions: phase === 'restored-disposed' ? 2 : 1, protocolOwners: 0, protocolSurfaces: phase.includes('disposed') || phase === 'baseline' ? 0 : 3,
  externalArchiveBytes: ['released', 'disposed', 'restored'].includes(phase) ? 1000 : 0 });
function fakeDriver({ failCycle = false, invalidBaseline = false, failLargeX = false } = {}) {
  const opened = [], closed = [], calls = [];
  let driverClosed = false;
  return { opened, closed, calls, get driverClosed() { return driverClosed; },
    async verify() { calls.push('verify'); return { synthetic: true }; },
    async checkQuiet() { return { contaminated: false, receiptSha256: digest }; },
    async openProcess(identity) {
      const processId = opened.length; opened.push(identity);
      return {
        async baseline() { calls.push(`baseline:${processId}`); return { ...observation('baseline'), ...(invalidBaseline ? { heap: { usedSize: -7, totalSize: 42 }, rendererDom: { documents: 9, nodes: 321, jsEventListeners: 87 } } : {}) }; },
        async cycle(task) {
          calls.push({ processId, ...task });
          return { ...task, savedBytes: 1000, archiveSha256: digest, semanticAssertionsPassed: !failCycle, contaminated: false,
            observations: MEMORY_PHASES.map(phase => ({ ...observation(phase), protocolOwners: !phase.includes('disposed') && task.admission === 'adapters' ? 2 : 0 })) };
        },
        async largeX() { if (failLargeX) throw Object.assign(new Error('Post-observation X oracle failed.'), { attempt: { kind: 'large-X', semanticAssertionsPassed: false, lastCommand: 'readXOracle', observation: observation('mounted') } }); return { semanticAssertionsPassed: true, observation: observation('mounted'),
          disposal: { connectedFixtureNodes: 0, connectedFixtureElements: 0, pendingOperations: 0, sourceCharacters: 0 } }; },
        async close() { assert.equal(closed.includes(processId), false, 'A process closed twice.'); closed.push(processId); },
      };
    },
    async close() { driverClosed = true; },
  };
}

test('memory authorization cannot be replaced by timing permission or altered procedure', () => {
  assert.doesNotThrow(() => validateMemoryManifest(manifest()));
  for (const mutate of [value => { value.authorized = false; }, value => { value.kind = 'functional-smoke'; },
    value => { value.configuration.gcPasses = 1; }, value => { value.configuration.archiveBytes++; }, value => { delete value.sourceSha256; }]) {
    const value = manifest(); mutate(value); assert.throws(() => validateMemoryManifest(value));
  }
});

test('collection CLI rejects invalid arguments without an import-cycle deadlock or browser work', () => {
  const result = spawnSync(process.execPath, [new URL('./memory-profile.mjs', import.meta.url).pathname, '--invalid'], { encoding: 'utf8', timeout: 5000 });
  assert.equal(result.status, 1); assert.equal(result.error, undefined); assert.match(result.stderr, /Explicit memory authorization/u);
});

test('injected runner executes fixed independent processes, excluded warmups and one-shot X', async () => {
  const driver = fakeDriver(), retained = [];
  const result = await runMemoryProfile(manifest(), driver, { retain: async row => { retained.push(row.kind); } });
  assert.equal(result.status, 'collected-needs-review'); assert.equal(result.cycles.length, 270); assert.equal(result.warmups.length, 18);
  assert.equal(result.baselines.length, 37); assert.equal(result.summaries.length, 6);
  assert.equal(driver.opened.length, 37); assert.equal(driver.closed.length, 37); assert.equal(driver.driverClosed, true);
  const persistent = driver.opened.flatMap((identity, index) => identity.regime === 'persistent' ? [index] : []);
  assert.equal(persistent.length, 6);
  for (const processId of persistent) {
    const cycles = driver.calls.filter(item => item.processId === processId);
    assert.equal(cycles.length, 43); assert.equal(cycles.slice(0, 3).every(item => item.warmup), true);
    assert.deepEqual(cycles.slice(3).map(item => item.cycle), Array.from({ length: 40 }, (_, index) => index + 1));
  }
  assert.equal(retained.filter(kind => kind === 'cycle-attempt').length, 270);
  assert.equal(retained.filter(kind => kind === 'large-X-attempt').length, 1);
});

test('first failed semantic cycle is retained and closes the process without retry', async () => {
  const driver = fakeDriver({ failCycle: true }), retained = [];
  await assert.rejects(runMemoryProfile(manifest(), driver, { retain: async row => { retained.push(row); } }), error => {
    assert.equal(error.report.status, 'incomplete'); assert.equal(error.report.cycles.length, 0); return /stopped/u.test(error.message);
  });
  assert.equal(driver.opened.length, 1); assert.equal(driver.closed.length, 1); assert.equal(driver.driverClosed, true);
  assert.equal(retained.some(row => row.kind === 'warmup-attempt' && row.value.semanticAssertionsPassed === false), true);
  assert.equal(retained.at(-1).kind, 'failure');
});


test('malformed first baseline retains its raw heap and DOM counters before validation stops the run', async () => {
  const driver = fakeDriver({ invalidBaseline: true }), retained = [];
  await assert.rejects(runMemoryProfile(manifest(), driver, { retain: async row => { retained.push(row); } }), error => {
    assert.equal(error.report.baselines.length, 0);
    assert.deepEqual(error.report.lastAttempt.observation.heap, { usedSize: -7, totalSize: 42 });
    assert.equal(error.report.lastAttempt.observation.rendererDom.jsEventListeners, 87); return true;
  });
  assert.deepEqual(retained.map(row => row.kind), ['baseline-attempt', 'failure']);
  assert.equal(retained[0].value.observation.rendererDom.nodes, 321);
  assert.equal(driver.calls.some(item => typeof item === 'object'), false);
  assert.equal(driver.opened.length, 1); assert.equal(driver.closed.length, 1); assert.equal(driver.driverClosed, true);
});

test('a thrown X failure retains its partial observation and closes the independent process', async () => {
  const driver = fakeDriver({ failLargeX: true }), retained = [];
  await assert.rejects(runMemoryProfile(manifest(), driver, { retain: async row => { retained.push(row); } }), error => {
    assert.equal(error.report.lastAttempt.kind, 'large-X');
    assert.equal(error.report.lastAttempt.lastCommand, 'readXOracle');
    assert.equal(error.report.lastAttempt.observation.heap.usedSize, 16 * 1024 * 1024); return true;
  });
  assert.equal(retained.filter(row => row.kind === 'large-X-attempt').length, 1);
  assert.equal(retained.at(-1).kind, 'failure');
  assert.equal(driver.opened.length, 37); assert.equal(driver.closed.length, 37); assert.equal(driver.driverClosed, true);
});
