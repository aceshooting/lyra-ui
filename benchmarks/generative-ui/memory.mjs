#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { cpus, tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildContext } from '../../packages/lyra-gen/scripts/measure-bundles.mjs';
import { heapDifference, spread } from '../gpu/acceptance.mjs';
import { serve } from './run.mjs';
import { MEMORY_PHASES, MAX_ARCHIVE_BYTES, expectedNote } from './memory-workload.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export function memoryOptions(args) {
  const options = { cycles: 20, output: undefined };
  for (const argument of args) {
    const [key, ...rest] = argument.split('='); const value = rest.join('=');
    if (key === '--cycles' && /^\d+$/.test(value)) options.cycles = Number(value);
    else if (key === '--output' && value) options.output = value;
    else throw new Error('Invalid memory cohort argument.');
  }
  if (!options.output || options.cycles < 1 || options.cycles > 100) throw new Error('Supply --output and 1–100 cycles.');
  return options;
}
export function checkMemoryCycle(row) {
  assert.ok(Number.isInteger(row.cycle) && row.cycle > 0);
  assert.ok(['persistent', 'fresh'].includes(row.regime));
  assert.ok(row.savedBytes > 0 && row.savedBytes <= MAX_ARCHIVE_BYTES);
  assert.ok(row.sourceCharactersBefore > 0); assert.equal(row.sourceCharactersAfter, 0);
  assert.deepEqual(Object.keys(row.assertions).sort(), ['savedData', 'retainedAfterRelease', 'controllerCleared', 'restoredData', 'restoredProse', 'restoredEdit', 'dirtySurvivedRevision', 'noActionReplay'].sort());
  assert.ok(Object.values(row.assertions).every(value => value === true), 'Every restore/release semantic assertion must pass.');
  assert.deepEqual(row.observations.map(item => item.phase), [...MEMORY_PHASES]);
  for (const item of row.observations) {
    for (const value of [item.heap.usedSize, item.heap.totalSize]) assert.ok(Number.isFinite(value) && value > 0, 'A requested post-GC heap observation is missing or invalid.');
    for (const value of [item.rendererDom.documents, item.rendererDom.nodes, item.rendererDom.jsEventListeners, item.connectedFixtureNodes, item.connectedFixtureElements]) assert.ok(Number.isSafeInteger(value) && value >= 0, 'A requested DOM/listener counter is missing or invalid.');
    assert.ok(item.heap.totalSize >= item.heap.usedSize);
    assert.equal(item.actions, item.phase === 'restored-disposed' ? 2 : 1, 'Only the two explicit native activations may request an action.');
    if (item.phase.includes('disposed')) {
      assert.equal(item.connectedFixtureElements, 0, 'Disconnected views must leave no connected fixture elements.');
      assert.equal(item.connectedFixtureNodes, 0);
    } else assert.ok(item.connectedFixtureElements > 0);
  }
}
export function summarizeMemory(rows) {
  const regimes = Object.fromEntries(['persistent', 'fresh'].flatMap(regime => {
    const selected = rows.filter(row => row.regime === regime);
    return selected.length ? [[regime, {
      cycles: selected.length,
      sourceReleaseDeltaBytes: spread(selected.map(row => heapDifference(row.observations[0].heap.usedSize, row.observations[1].heap.usedSize).retainedDeltaBytes)),
      postDisposeUsedBytes: spread(selected.map(row => row.observations.at(-1).heap.usedSize)),
    }]] : [];
  }));
  return { regimes, limitations: 'These signed observations are not a memory ceiling, heap superiority claim, leak diagnosis or confidence interval. Persistent-cycle samples are a correlated series. Main-isolate heap excludes worker/native/GPU/OS memory; renderer DOM/listener counters can include disconnected objects. Zero connected fixture elements does not prove zero detached heap.' };
}

async function openPage(browser, origin) {
  const context = await browser.newContext({ viewport: { width: 900, height: 700 }, deviceScaleFactor: 1, reducedMotion: 'reduce', locale: 'en-US', timezoneId: 'UTC', serviceWorkers: 'block' });
  let blocked = 0, errors = 0;
  await context.route('**/*', async route => {
    const request = route.request();
    if (new URL(request.url()).origin === origin && ['GET', 'HEAD'].includes(request.method())) await route.continue();
    else { blocked++; await route.abort(); }
  });
  await context.routeWebSocket(/.*/, socket => { blocked++; socket.close(); });
  const page = await context.newPage(); page.on('pageerror', () => errors++); page.setDefaultTimeout(15000);
  await page.goto(origin, { waitUntil: 'networkidle' }); await page.waitForFunction(() => Boolean(window.__memoryCohort));
  const session = await context.newCDPSession(page);
  return { page, session, context, check() { assert.equal(blocked, 0); assert.equal(errors, 0); } };
}
async function observe(owner, phase) {
  await owner.page.evaluate(() => window.__memoryCohort.settle());
  const fixture = await owner.page.evaluate(() => window.__memoryCohort.metrics());
  await owner.session.send('HeapProfiler.collectGarbage');
  const usage = await owner.session.send('Runtime.getHeapUsage');
  const rendererDom = await owner.session.send('Memory.getDOMCounters');
  return { phase, ...fixture, heap: { usedSize: usage.usedSize, totalSize: usage.totalSize,
    embedderHeapUsedSize: usage.embedderHeapUsedSize ?? null, backingStorageSize: usage.backingStorageSize ?? null }, rendererDom };
}
async function runCycle(owner, cycle, regime, archiveFile) {
  const row = { cycle, regime, observations: [] };
  await owner.page.evaluate(cycle => window.__memoryCohort.mount(cycle), cycle);
  await owner.page.locator('lr-gen-view lr-input input').fill(expectedNote(cycle));
  await owner.page.getByRole('button', { name: 'Inspect locally', exact: true }).click();
  row.observations.push(await observe(owner, 'mounted'));
  const saved = await owner.page.evaluate(() => window.__memoryCohort.save());
  assert.ok(saved.bytes <= MAX_ARCHIVE_BYTES && Buffer.byteLength(saved.text) === saved.bytes);
  await writeFile(archiveFile, saved.text);
  row.savedBytes = saved.bytes; row.archiveSha256 = hash(saved.text); row.sourceCharactersBefore = saved.sourceCharacters;
  const released = await owner.page.evaluate(() => window.__memoryCohort.release());
  row.sourceCharactersAfter = released.sourceCharacters;
  row.observations.push(await observe(owner, 'released'));
  const disposed = await owner.page.evaluate(() => window.__memoryCohort.dispose());
  row.observations.push(await observe(owner, 'disposed'));
  const stored = await readFile(archiveFile, 'utf8'); assert.equal(hash(stored), row.archiveSha256);
  const restored = await owner.page.evaluate(({ text, cycle }) => window.__memoryCohort.restore(text, cycle), { text: stored, cycle });
  row.observations.push(await observe(owner, 'restored'));
  await owner.page.getByRole('button', { name: 'Inspect locally', exact: true }).click();
  await owner.page.evaluate(() => window.__memoryCohort.dispose());
  row.observations.push(await observe(owner, 'restored-disposed'));
  row.assertions = { savedData: saved.savedData, retainedAfterRelease: released.retainedAfterRelease, controllerCleared: disposed.controllerCleared,
    restoredData: restored.restoredData, restoredProse: restored.proseHash === saved.proseHash, restoredEdit: restored.restoredEdit,
    dirtySurvivedRevision: restored.dirtySurvivedRevision, noActionReplay: restored.noActionReplay };
  checkMemoryCycle(row); owner.check(); return row;
}

export async function runMemory(options) {
  assert.equal(process.versions.node, (await readFile(join(here, '../../.nvmrc'), 'utf8')).trim(), 'Use the pinned Node version.');
  const context = await buildContext();
  const scratch = await mkdtemp(join(tmpdir(), 'lyra-memory-cohort-'));
  const assets = join(scratch, 'assets'); await mkdir(assets);
  let browser, server;
  try {
    const built = await context.esbuild.build({ absWorkingDir: here, entryPoints: [join(here, 'memory-fixture/main.js')], bundle: true, splitting: true, format: 'esm', platform: 'browser', target: 'es2022', outdir: assets, minify: true, sourcemap: false, metafile: true, logLevel: 'silent', conditions: ['browser', 'production'], define: { 'process.env.NODE_ENV': '"production"' }, plugins: [context.plugin], external: context.optionalPeers.flatMap(peer => [peer, `${peer}/*`]) });
    const html = await readFile(join(here, 'memory-fixture/index.html'), 'utf8');
    await writeFile(join(assets, 'index.html'), html.replace('</head>', '<link rel="stylesheet" href="./main.css"></head>'));
    const hosted = await serve(assets); server = hosted.server;
    const { chromium } = await import('playwright'); browser = await chromium.launch({ headless: true });
    const report = { schemaVersion: 1, status: 'passed', measurementKind: 'synthetic-save-release-restore-memory', packageVersion: context.gen.version, uiVersion: context.ui.version,
      environment: { node: process.versions.node, esbuild: context.esbuild.version, playwright: JSON.parse(await readFile(createRequire(import.meta.url).resolve('playwright/package.json'), 'utf8')).version, chromium: browser.version(), os: process.platform, arch: process.arch, cpuModel: cpus()[0]?.model ?? null, logicalCpus: cpus().length },
      configuration: { cyclesPerRegime: options.cycles, regimes: ['persistent', 'fresh'], control: 'Separate browser process per fresh control cycle, each with a post-load baseline; alternating regime order by cycle.', storage: 'One overwritten host file outside the browser and served assets. No archive history retained in page.', gcPassesPerObservation: 1 },
      hashes: { harness: hash(await readFile(fileURLToPath(import.meta.url))), workload: hash(await readFile(join(here, 'memory-workload.mjs'))), fixture: hash(await readFile(join(here, 'memory-fixture/main.js'))), html: hash(html), bundle: hash(Buffer.concat(await Promise.all(Object.keys(built.metafile.outputs).sort().map(file => readFile(resolve(here, file)))))) },
      externalImports: [...new Set(Object.values(built.metafile.outputs).flatMap(output => output.imports.filter(edge => edge.external).map(edge => edge.path)))].sort(), baselines: [], cycles: [] };
    const persistent = await openPage(browser, hosted.origin);
    try {
      report.baselines.push({ id: 'persistent', observation: await observe(persistent, 'baseline') });
      for (let cycle = 1; cycle <= options.cycles; cycle++) {
        for (const regime of cycle % 2 ? ['persistent', 'fresh'] : ['fresh', 'persistent']) {
          if (regime === 'persistent') report.cycles.push({ ...await runCycle(persistent, cycle, regime, join(scratch, 'saved.json')), baselineId: 'persistent' });
          else {
            const freshBrowser = await chromium.launch({ headless: true });
            try {
              const fresh = await openPage(freshBrowser, hosted.origin);
              const baselineId = `fresh-${cycle}`;
              report.baselines.push({ id: baselineId, observation: await observe(fresh, 'baseline') });
              report.cycles.push({ ...await runCycle(fresh, cycle, regime, join(scratch, 'saved.json')), baselineId });
            } finally { await freshBrowser.close(); }
          }
        }
      }
      persistent.check();
    } finally { await persistent.context.close(); }
    report.summary = summarizeMemory(report.cycles);
    await writeFile(resolve(options.output), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
    return report;
  } finally {
    await Promise.allSettled([...(browser ? [browser.close()] : []), ...(server ? [new Promise(resolveClosed => server.close(resolveClosed))] : [])]);
    await rm(scratch, { recursive: true, force: true });
  }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  await runMemory(memoryOptions(process.argv.slice(2))).then(report => console.log(JSON.stringify({ status: report.status, cycles: report.cycles.length }))).catch(error => { console.error(`Generated-session memory cohort failed: ${error.message}`); process.exitCode = 1; });
}
