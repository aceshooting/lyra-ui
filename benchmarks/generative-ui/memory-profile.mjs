import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { MEMORY_PHASES } from './memory-workload.mjs';
import { memoryProfileSchedule, validateMemoryObservation, validateMemoryCycleSemantics, validateMemoryCycle, summarizeMemoryRun } from './memory-profile-results.mjs';
import { validateQuietObserver, validateQuietEvidence } from './profile-admission.mjs';

const require = (condition, message) => { if (!condition) throw new TypeError(message); };
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const stable = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
const same = (left, right) => stable(left) === stable(right);
export function memoryProfilePlan() {
  return { lifecycles: ['full-chat', 'full-dashboard'], processRunsEach: 3, excludedWarmupsEach: 3,
    measuredPersistentCyclesEach: 40, freshControlsAtCycles: [1, 10, 20, 30, 40], phases: [...MEMORY_PHASES],
    gcPasses: 2, taskBetweenGcPasses: true, archiveSlots: 1, archiveBytes: 524288,
    protocolViews: 3, protocolNodes: 45, protocolTableCells: 1800, protocolChartValues: 900,
    normalLiveIsolateBytes: 134217728, largeXLiveIsolateBytes: 268435456,
    bootstrapSeed: 20261026, bootstrapReplicates: 10000, bootstrapBlock: 5, sensitivityBlocks: [4, 8],
    retainedGrowthBytes: 1048576, retainedGrowthFraction: 0.1, slopeUpperBytesPerCycle: 16384 };
}
export function validateMemoryManifest(value) {
  require(value?.schemaVersion === 1 && value.kind === 'memory-profile' && value.authorized === true
    && typeof value.collectionId === 'string' && value.collectionId.length > 0, 'Explicit memory-profile collection authorization is required.');
  require(hash(value.designSha256) && hash(value.sourceSha256) && hash(value.compositionSha256), 'Frozen memory design, source and composition identities are required.');
  require(['archiveSha256', 'lockfileSha256', 'buildSha256'].every(key => hash(value.candidate?.[key])), 'Exact candidate artifacts are required.');
  require(value.browser?.engine === 'chromium' && hash(value.browser.executableSha256), 'Exact Chromium identity is required.');
  validateQuietObserver(value.quietObserver);
  require(same(value.configuration, memoryProfilePlan()), 'The frozen memory procedure cannot be overridden.');
  return value;
}

/** No imports of browser tooling and no automatic retries. The concrete driver owns each process. */
export async function runMemoryProfile(manifest, driver, { signal, retain } = {}) {
  validateMemoryManifest(manifest);
  const owned = structuredClone(manifest);
  if (owned.quietObserver) { Object.freeze(owned.quietObserver.scope); Object.freeze(owned.quietObserver); }
  Object.freeze(owned);
  const binding = { quietObserver: owned.quietObserver, collectionId: owned.collectionId };
  require(typeof retain === 'function', 'An immutable evidence writer is required.');
  for (const name of ['verify', 'checkQuiet', 'openProcess', 'close']) require(typeof driver?.[name] === 'function', `Memory driver lacks ${name}.`);
  const report = { schemaVersion: 1, kind: 'memory-profile', collectionId: owned.collectionId, status: 'incomplete', qualification: 'not-assessed',
    ...(owned.quietObserver ? { quietObserver: owned.quietObserver } : {}),
    baselines: [], warmups: [], cycles: [], summaries: [], failures: [] };
  let persistent, control;
  const active = () => { require(!signal?.aborted, 'Memory profile aborted.'); };
  const quiet = async (identity, position) => {
    active(); let evidence;
    try {
      evidence = structuredClone(await driver.checkQuiet(identity));
      validateQuietEvidence(evidence, owned.quietObserver, { collectionId: owned.collectionId, admissionSha256: binding.admissionSha256 });
    } catch (error) {
      const refused = evidence ?? error.quietEvidence;
      if (refused !== undefined) {
        report.lastQuietAttempt = { ...identity, ...binding, position, evidence: structuredClone(refused) };
        await retain({ kind: 'quiet-attempt', value: report.lastQuietAttempt });
      }
      throw error;
    }
    return evidence;
  };
  const withQuiet = (record, before, after = null) => ({ ...record, collectionId: owned.collectionId,
    ...(owned.quietObserver ? { quietObserver: owned.quietObserver, admissionSha256: binding.admissionSha256 } : {}), quietEvidence: { before, after },
    preQuietSha256: before.receiptSha256, postQuietSha256: after?.receiptSha256 ?? null,
    contaminated: Boolean(record.contaminated || before.contaminated || after?.contaminated) });
  const open = async identity => {
    active();
    const process = await driver.openProcess({ ...identity, signal });
    for (const name of ['baseline', 'cycle', 'close']) require(typeof process?.[name] === 'function', `Memory process lacks ${name}.`);
    return process;
  };
  const baseline = async (process, identity, before) => {
    const observation = await process.baseline(), record = withQuiet({ ...identity, observation }, before);
    report.lastAttempt = record; await retain({ kind: 'baseline-attempt', value: record });
    require(observation.phase === 'baseline', 'Process has no distinct post-load baseline.'); validateMemoryObservation(observation);
    report.baselines.push(record); await retain({ kind: 'baseline', value: record }); delete report.lastAttempt;
  };
  const cycle = async (process, task) => {
    const before = await quiet(task, 'before');
    let row;
    try { row = await process.cycle({ ...task, signal }); }
    catch (error) {
      if (error.attempt) {
        error.attempt = withQuiet(error.attempt, before); report.lastAttempt = error.attempt;
        await retain({ kind: task.warmup ? 'warmup-attempt' : 'cycle-attempt', value: error.attempt });
      }
      throw error;
    }
    // Keep every returned attempt before validating or evaluating budgets.
    report.lastAttempt = withQuiet(row, before); await retain({ kind: task.warmup ? 'warmup-attempt' : 'cycle-attempt', value: report.lastAttempt });
    const identity = Object.fromEntries(['lifecycle', 'runIndex', 'cycle', 'regime', 'admission'].map(key => [key, task[key]]));
    require(Object.entries(identity).every(([key, value]) => row[key] === value), 'Memory driver changed cycle identity.');
    validateMemoryCycleSemantics(row);
    if (owned.quietObserver === undefined) require(row.contaminated === undefined || row.contaminated === false, 'Memory observation was contaminated.');
    const after = await quiet(task, 'after'), record = { ...withQuiet(row, before, after), warmup: Boolean(task.warmup) };
    validateMemoryCycle(record, binding);
    (task.warmup ? report.warmups : report.cycles).push(record);
    await retain({ kind: task.warmup ? 'warmup' : 'cycle', value: record }); delete report.lastAttempt;
  };
  try {
    active(); report.artifacts = structuredClone(await driver.verify(owned));
    if (owned.quietObserver) {
      require(hash(report.artifacts?.admissionSha256), 'Memory driver has no verified admission-helper identity.');
      binding.admissionSha256 = report.artifacts.admissionSha256;
    }
    for (const lifecycle of memoryProfilePlan().lifecycles) for (let runIndex = 0; runIndex < 3; runIndex++) {
      const owner = { lifecycle, runIndex, regime: 'persistent' };
      const before = await quiet(owner, 'before-open'); persistent = await open(owner); await baseline(persistent, owner, before);
      for (let warmupIndex = 0; warmupIndex < 3; warmupIndex++) await cycle(persistent,
        { ...owner, cycle: warmupIndex + 1, admission: warmupIndex % 2 ? 'adapters' : 'direct', warmup: true, warmupIndex });
      for (const task of memoryProfileSchedule().filter(item => item.lifecycle === lifecycle && item.runIndex === runIndex)) {
        if (task.regime === 'persistent') await cycle(persistent, task);
        else {
          const before = await quiet(task, 'before-open'); control = await open(task); await baseline(control, task, before);
          try { await cycle(control, task); } finally { await control.close(); control = undefined; }
        }
      }
      await persistent.close(); persistent = undefined;
      const summary = summarizeMemoryRun(report.cycles.filter(row => row.lifecycle === lifecycle && row.runIndex === runIndex && row.regime === 'persistent'), binding);
      report.summaries.push(summary); await retain({ kind: 'run-summary', value: summary });
      require(summary.withinBudget, 'A memory run exceeded the frozen retained-state bounds.');
    }
    const beforeX = await quiet({ lifecycle: 'large-X' }, 'before-open'); control = await open({ lifecycle: 'large-X', regime: 'fresh', runIndex: 0 });
    await baseline(control, { lifecycle: 'large-X', regime: 'fresh', runIndex: 0 }, beforeX);
    require(typeof control.largeX === 'function', 'Memory process lacks the separate X observation.');
    try { report.largeX = withQuiet(await control.largeX({ signal }), beforeX); }
    catch (error) { if (error.attempt) error.attempt = withQuiet(error.attempt, beforeX); throw error; }
    await retain({ kind: 'large-X-attempt', value: report.largeX });
    require(report.largeX.semanticAssertionsPassed === true && report.largeX.observation?.phase === 'mounted', 'X semantics did not pass.');
    validateMemoryObservation(report.largeX.observation, { large: true });
    require(report.largeX.disposal?.connectedFixtureNodes === 0 && report.largeX.disposal.connectedFixtureElements === 0
      && report.largeX.disposal.pendingOperations === 0 && report.largeX.disposal.sourceCharacters === 0, 'X retained application state after disposal.');
    const afterX = await quiet({ lifecycle: 'large-X' }, 'after');
    report.largeX = withQuiet(report.largeX, beforeX, afterX);
    await retain({ kind: 'large-X', value: report.largeX });
    await control.close(); control = undefined;
    require(report.cycles.length === 270 && report.warmups.length === 18 && report.baselines.length === 37, 'Memory schedule is incomplete.');
    report.status = 'collected-needs-review';
  } catch (error) {
    if (error.attempt && error.attempt !== report.lastAttempt) {
      report.lastAttempt = error.attempt;
      await retain({ kind: error.attempt.kind === 'large-X' ? 'large-X-attempt' : 'process-attempt', value: error.attempt });
    }
    report.failures.push({ category: signal?.aborted ? 'aborted' : 'memory-profile-failed', message: 'Memory collection stopped without qualification.' });
    await retain({ kind: 'failure', value: report });
    throw Object.assign(new Error('Memory profile stopped without qualification.', { cause: error }), { report });
  } finally {
    try { if (control) await control.close(); } finally { try { if (persistent) await persistent.close(); } finally { await driver.close(); } }
  }
  await retain({ kind: 'report', value: report }); return report;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  if (process.argv.length === 3 && process.argv[2] === '--plan') process.stdout.write(`${JSON.stringify(memoryProfilePlan(), null, 2)}\n`);
  else {
    void import('./memory-profile-driver.mjs').then(({ runMemoryProfileCli }) => runMemoryProfileCli(process.argv.slice(2)))
      .catch(() => { process.stderr.write('Memory profile stopped. Explicit memory authorization and retained failure evidence are required.\n'); process.exitCode = 1; });
  }
}
