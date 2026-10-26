import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { MEMORY_PHASES } from './memory-workload.mjs';
import { memoryProfileSchedule, validateMemoryObservation, validateMemoryCycle, summarizeMemoryRun } from './memory-profile-results.mjs';

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
  require(same(value.configuration, memoryProfilePlan()), 'The frozen memory procedure cannot be overridden.');
  return value;
}

/** No imports of browser tooling and no automatic retries. The concrete driver owns each process. */
export async function runMemoryProfile(manifest, driver, { signal, retain } = {}) {
  validateMemoryManifest(manifest);
  require(typeof retain === 'function', 'An immutable evidence writer is required.');
  for (const name of ['verify', 'checkQuiet', 'openProcess', 'close']) require(typeof driver?.[name] === 'function', `Memory driver lacks ${name}.`);
  const report = { schemaVersion: 1, kind: 'memory-profile', collectionId: manifest.collectionId, status: 'incomplete',
    baselines: [], warmups: [], cycles: [], summaries: [], failures: [] };
  let persistent, control;
  const active = () => { require(!signal?.aborted, 'Memory profile aborted.'); };
  const quiet = async identity => {
    active(); const receipt = await driver.checkQuiet(identity);
    require(receipt?.contaminated === false && hash(receipt.receiptSha256), 'Memory quiet-window evidence is missing or contaminated.');
    return receipt.receiptSha256;
  };
  const open = async identity => {
    active();
    const process = await driver.openProcess({ ...identity, signal });
    for (const name of ['baseline', 'cycle', 'close']) require(typeof process?.[name] === 'function', `Memory process lacks ${name}.`);
    return process;
  };
  const baseline = async (process, identity) => {
    const observation = await process.baseline(), record = { ...identity, observation };
    report.lastAttempt = record; await retain({ kind: 'baseline-attempt', value: record });
    require(observation.phase === 'baseline', 'Process has no distinct post-load baseline.'); validateMemoryObservation(observation);
    report.baselines.push(record); await retain({ kind: 'baseline', value: record }); delete report.lastAttempt;
  };
  const cycle = async (process, task) => {
    const preQuietSha256 = await quiet(task);
    let row;
    try { row = await process.cycle({ ...task, signal }); }
    catch (error) {
      if (error.attempt) { report.lastAttempt = error.attempt; await retain({ kind: task.warmup ? 'warmup-attempt' : 'cycle-attempt', value: error.attempt }); }
      throw error;
    }
    // Keep every returned attempt before validating or evaluating budgets.
    report.lastAttempt = row; await retain({ kind: task.warmup ? 'warmup-attempt' : 'cycle-attempt', value: row });
    const identity = Object.fromEntries(['lifecycle', 'runIndex', 'cycle', 'regime', 'admission'].map(key => [key, task[key]]));
    require(Object.entries(identity).every(([key, value]) => row[key] === value), 'Memory driver changed cycle identity.');
    validateMemoryCycle(row);
    const postQuietSha256 = await quiet(task), record = { ...row, warmup: Boolean(task.warmup), preQuietSha256, postQuietSha256 };
    (task.warmup ? report.warmups : report.cycles).push(record);
    await retain({ kind: task.warmup ? 'warmup' : 'cycle', value: record }); delete report.lastAttempt;
  };
  try {
    active(); report.artifacts = await driver.verify(manifest);
    for (const lifecycle of memoryProfilePlan().lifecycles) for (let runIndex = 0; runIndex < 3; runIndex++) {
      const owner = { lifecycle, runIndex, regime: 'persistent' };
      await quiet(owner); persistent = await open(owner); await baseline(persistent, owner);
      for (let warmupIndex = 0; warmupIndex < 3; warmupIndex++) await cycle(persistent,
        { ...owner, cycle: warmupIndex + 1, admission: warmupIndex % 2 ? 'adapters' : 'direct', warmup: true, warmupIndex });
      for (const task of memoryProfileSchedule().filter(item => item.lifecycle === lifecycle && item.runIndex === runIndex)) {
        if (task.regime === 'persistent') await cycle(persistent, task);
        else {
          await quiet(task); control = await open(task); await baseline(control, task);
          try { await cycle(control, task); } finally { await control.close(); control = undefined; }
        }
      }
      await persistent.close(); persistent = undefined;
      const summary = summarizeMemoryRun(report.cycles.filter(row => row.lifecycle === lifecycle && row.runIndex === runIndex && row.regime === 'persistent'));
      report.summaries.push(summary); await retain({ kind: 'run-summary', value: summary });
      require(summary.withinBudget, 'A memory run exceeded the frozen retained-state bounds.');
    }
    await quiet({ lifecycle: 'large-X' }); control = await open({ lifecycle: 'large-X', regime: 'fresh', runIndex: 0 });
    await baseline(control, { lifecycle: 'large-X', regime: 'fresh', runIndex: 0 });
    require(typeof control.largeX === 'function', 'Memory process lacks the separate X observation.');
    report.largeX = await control.largeX({ signal }); await retain({ kind: 'large-X-attempt', value: report.largeX });
    require(report.largeX.semanticAssertionsPassed === true && report.largeX.observation?.phase === 'mounted', 'X semantics did not pass.');
    validateMemoryObservation(report.largeX.observation, { large: true });
    require(report.largeX.disposal?.connectedFixtureNodes === 0 && report.largeX.disposal.connectedFixtureElements === 0
      && report.largeX.disposal.pendingOperations === 0 && report.largeX.disposal.sourceCharacters === 0, 'X retained application state after disposal.');
    await quiet({ lifecycle: 'large-X' }); await control.close(); control = undefined;
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
