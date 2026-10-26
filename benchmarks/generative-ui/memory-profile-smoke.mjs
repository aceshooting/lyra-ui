import { readFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateMemorySmokeManifest, parseMemoryOptions, createMemoryDriver } from './memory-profile-driver.mjs';
import { writeProfileRecord } from './profile.mjs';

/** Correctness only: no baselines, forced GC, heap counters, statistics or latency budgets. */
export async function runMemorySmoke(manifest, driver, { retain } = {}) {
  validateMemorySmokeManifest(manifest);
  if (typeof retain !== 'function') throw new TypeError('A smoke evidence writer is required.');
  const report = { schemaVersion: 1, kind: 'memory-functional-smoke', method: 'functional-lifecycle-only-no-forced-gc', status: 'incomplete', cases: [] };
  let process;
  try {
    report.artifacts = await driver.verify(manifest);
    const cases = manifest.lifecycles.flatMap(lifecycle => manifest.admissions.map(admission => ({ lifecycle, admission, cycle: admission === 'direct' ? 1 : 2, runIndex: 0, regime: 'fresh' })));
    if (manifest.includeX) cases.push({ lifecycle: 'large-X', regime: 'fresh', runIndex: 0 });
    for (const identity of cases) {
      let record;
      try {
        process = await driver.openProcess(identity);
        const result = identity.lifecycle === 'large-X' ? await process.largeX({}) : await process.cycle(identity);
        if (result.semanticAssertionsPassed !== true) throw new Error('Memory lifecycle semantics did not pass.');
        if (identity.lifecycle === 'large-X' && ['heap', 'gcPasses', 'rendererDom'].some(key => key in result.observation)) throw new Error('Correctness X smoke cannot carry forced-GC observations.');
        if (identity.lifecycle !== 'large-X' && (result.method !== 'memory-semantic-smoke' || result.observations.length !== 5
          || result.observations.some(value => 'heap' in value || 'gcPasses' in value || 'rendererDom' in value))) throw new Error('Correctness smoke cannot carry forced-GC observations.');
        record = { ...identity, status: 'complete', browserVersion: process.browserVersion, result };
      } catch (error) {
        record = { ...identity, status: 'failed', reason: error.message, ...(error.attempt ? { attempt: error.attempt } : {}) };
      } finally { if (process) { await process.close(); process = undefined; } }
      report.cases.push(record); await retain({ kind: 'memory-functional-outcome', value: record });
    }
    report.status = report.cases.every(value => value.status === 'complete') ? 'complete' : 'incomplete';
  } finally { try { if (process) await process.close(); } finally { await driver.close(); } }
  await retain({ kind: 'memory-functional-report', value: report }); return report;
}

export async function runMemorySmokeCli(args) {
  const options = parseMemoryOptions(args, { functional: true });
  const manifest = JSON.parse(await readFile(options.manifest, 'utf8')); validateMemorySmokeManifest(manifest);
  await mkdir(options.output, { recursive: true }); let serial = 0;
  const report = await runMemorySmoke(manifest, createMemoryDriver(options, { functional: true }), {
    retain: record => writeProfileRecord(join(options.output, `${String(serial++).padStart(4, '0')}-${record.kind}.json`), record),
  });
  if (report.status !== 'complete') process.exitCode = 1;
  return report;
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { await runMemorySmokeCli(process.argv.slice(2)); }
  catch { process.stderr.write('Memory correctness smoke stopped; no memory qualification was collected.\n'); process.exitCode = 1; }
}
