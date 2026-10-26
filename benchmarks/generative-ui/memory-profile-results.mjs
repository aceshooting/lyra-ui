import { MEMORY_PHASES } from './memory-workload.mjs';
import { PROFILE_SEED, summarizeRetainedHeap } from './profile-results.mjs';

export const MEMORY_PROFILE_LIFECYCLES = Object.freeze(['full-chat', 'full-dashboard']);
export const MEMORY_PROFILE_ARCHIVE_BYTES = 512 * 1024;
const controls = new Set([1, 10, 20, 30, 40]);
const require = (condition, message) => { if (!condition) throw new TypeError(message); };
const count = value => Number.isSafeInteger(value) && value >= 0;
const disposed = phase => phase === 'disposed' || phase === 'restored-disposed';

/** Measured cycles only. Each persistent process separately performs three excluded warmups. */
export function memoryProfileSchedule() {
  const rows = [];
  for (const lifecycle of MEMORY_PROFILE_LIFECYCLES) for (let runIndex = 0; runIndex < 3; runIndex++) {
    for (let cycle = 1; cycle <= 40; cycle++) {
      const regimes = controls.has(cycle) ? cycle % 2 ? ['persistent', 'fresh'] : ['fresh', 'persistent'] : ['persistent'];
      for (const regime of regimes) rows.push(Object.freeze({ lifecycle, runIndex, cycle, regime, admission: cycle % 2 ? 'direct' : 'adapters' }));
    }
  }
  return Object.freeze(rows);
}

/** Validate requested counters, without treating zero connected DOM as zero retained heap. */
export function validateMemoryObservation(value, { large = false } = {}) {
  require(value && [...MEMORY_PHASES, 'baseline'].includes(value.phase), 'Unknown memory phase.');
  require(value.gcPasses === 2 && value.taskBetweenGcPasses === true, 'Memory observation requires exactly two GC passes separated by a task.');
  require(count(value.heap?.usedSize) && value.heap.usedSize > 0 && count(value.heap.totalSize)
    && value.heap.totalSize >= value.heap.usedSize, 'Missing or invalid main-isolate heap counters.');
  for (const field of ['embedderHeapUsedSize', 'backingStorageSize']) require(value.heap[field] === null || count(value.heap[field]), 'Optional heap counters must be finite or explicit null.');
  for (const field of ['documents', 'nodes', 'jsEventListeners']) require(count(value.rendererDom?.[field]), 'Missing renderer DOM/listener counter.');
  for (const field of ['connectedFixtureNodes', 'connectedFixtureElements', 'sourceCharacters', 'controllerParts', 'controllerIslands', 'pendingOperations', 'actions', 'protocolOwners', 'protocolSurfaces', 'externalArchiveBytes']) require(count(value[field]), `Missing memory fixture counter ${field}.`);
  require(value.externalArchiveBytes <= MEMORY_PROFILE_ARCHIVE_BYTES, 'External archive exceeds its fixed ceiling.');
  require(value.connectedFixtureElements <= value.connectedFixtureNodes, 'Connected fixture counts are inconsistent.');
  require(value.pendingOperations === 0, 'Observation has pending application work.');
  if (disposed(value.phase)) {
    for (const field of ['connectedFixtureNodes', 'connectedFixtureElements', 'sourceCharacters', 'controllerParts', 'controllerIslands', 'protocolOwners', 'protocolSurfaces']) require(value[field] === 0, `Disposed application retained ${field}.`);
  } else if (value.phase !== 'baseline') {
    require(value.connectedFixtureElements > 0, 'Live observation has no connected application.');
    if (value.phase === 'mounted' || value.phase === 'restored') require(value.heap.usedSize <= (large ? 256 : 128) * 1024 * 1024, 'Live main-isolate heap exceeds its fixed ceiling.');
  }
  if (value.phase === 'released') require(value.sourceCharacters === 0, 'Source release retained transport characters.');
  if (value.phase === 'restored-disposed' || value.phase === 'baseline') require(value.externalArchiveBytes === 0, 'Archive must be released before final disposal or baseline.');
}

export function validateMemoryCycle(row) {
  require(MEMORY_PROFILE_LIFECYCLES.includes(row?.lifecycle) && Number.isInteger(row.runIndex) && row.runIndex >= 0 && row.runIndex < 3
    && Number.isInteger(row.cycle) && row.cycle >= 1 && row.cycle <= 40 && ['persistent', 'fresh'].includes(row.regime), 'Invalid memory cycle identity.');
  require(row.regime !== 'fresh' || controls.has(row.cycle), 'Fresh control is outside the fixed checkpoints.');
  require(row.admission === (row.cycle % 2 ? 'direct' : 'adapters'), 'Cycle admission parity changed.');
  require(Number.isSafeInteger(row.savedBytes) && row.savedBytes > 0 && row.savedBytes <= MEMORY_PROFILE_ARCHIVE_BYTES
    && /^[a-f0-9]{64}$/u.test(row.archiveSha256), 'External archive is missing, unbounded or unhashed.');
  require(row.semanticAssertionsPassed === true && row.contaminated === false, 'Memory semantics failed or the observation was contaminated.');
  require(Array.isArray(row.observations) && row.observations.length === MEMORY_PHASES.length, 'Memory cycle needs all five phases.');
  row.observations.forEach((value, index) => {
    require(value.phase === MEMORY_PHASES[index], 'Memory phases are missing or reordered.');
    validateMemoryObservation(value);
    require(value.actions === (value.phase === 'restored-disposed' ? 2 : 1), 'Only the two explicit native actions may execute.');
    if (!disposed(value.phase)) require(value.protocolSurfaces === 3 && value.protocolOwners === (row.admission === 'adapters' ? 2 : 0), 'Protocol ownership or matched shape changed.');
    require(value.externalArchiveBytes === (['released', 'disposed', 'restored'].includes(value.phase) ? row.savedBytes : 0), 'External archive lifetime changed.');
  });
}

export function summarizeMemoryRun(rows) {
  require(Array.isArray(rows) && rows.length === 40, 'A memory run requires forty persistent cycles.');
  rows.forEach((row, index) => {
    validateMemoryCycle(row);
    require(row.regime === 'persistent' && row.cycle === index + 1 && row.lifecycle === rows[0].lifecycle && row.runIndex === rows[0].runIndex, 'Cannot mix, reorder or pool memory runs.');
  });
  const final = rows.map(row => row.observations.at(-1));
  const heaps = final.map(value => value.heap.usedSize);
  const options = { seed: PROFILE_SEED, replicates: 10000 };
  const retained = summarizeRetainedHeap(heaps, { ...options, block: 5 });
  const sensitivity = [4, 8].map(block => summarizeRetainedHeap(heaps, { ...options, block }));
  const counters = Object.fromEntries(['documents', 'nodes', 'jsEventListeners'].map(field => {
    const sequence = final.map(value => value.rendererDom[field]);
    const firstMaximum = Math.max(...sequence.slice(0, 5)), lastMaximum = Math.max(...sequence.slice(-5));
    return [field, { sequence, firstMaximum, lastMaximum, withinBudget: lastMaximum <= firstMaximum }];
  }));
  return { lifecycle: rows[0].lifecycle, runIndex: rows[0].runIndex, retained, sensitivity, counters,
    withinBudget: retained.withinBudget && Object.values(counters).every(value => value.withinBudget),
    scope: 'One forty-cycle main-isolate run. Fresh controls are diagnostic and are not subtracted; no total-process or infinite-plateau claim.' };
}
