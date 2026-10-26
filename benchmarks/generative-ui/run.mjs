#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { cpus, tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildContext } from '../../packages/lyra-gen/scripts/measure-bundles.mjs';
import { WORKLOADS, METRIC_DEFINITIONS } from './workloads.mjs';
import { aggregate } from '../lib/results.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const hash = value => createHash('sha256').update(value).digest('hex');
export function optionsFor(args) {
  const options = { samples: 3, browser: 'chromium', workload: 'chat-form', temperature: 'cold', reservation: 'default', output: undefined };
  for (const argument of args) {
    const [key, ...rest] = argument.split('='); const value = rest.join('=');
    if (key === '--samples' && /^\d+$/.test(value)) options.samples = Number(value);
    else if (key === '--browser' && ['chromium', 'firefox', 'webkit'].includes(value)) options.browser = value;
    else if (key === '--workload' && Object.hasOwn(WORKLOADS, value)) options.workload = value;
    else if (key === '--temperature' && ['cold', 'paired'].includes(value)) options.temperature = value;
    else if (key === '--reservation' && ['default', 'none', 'both'].includes(value)) options.reservation = value;
    else if (key === '--output' && value) options.output = value;
    else throw new Error('Invalid replay argument.');
  }
  if (options.samples < 1 || options.samples > 30 || !options.output) throw new Error('Supply --output and 1–30 samples.');
  return options;
}

/** Descriptive spread only; nearest-rank p95 at small n is usually the sample maximum. */
export function summarizeReplaySamples(samples) {
  const grouped = new Map();
  for (const sample of samples) {
    const key = `${sample.mode}/${sample.temperature}/${sample.reservation}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(sample);
  }
  const cells = [...grouped.values()].map(values => ({
    mode: values[0].mode, temperature: values[0].temperature, reservation: values[0].reservation,
    metrics: Object.fromEntries(Object.keys(values[0].metrics).filter(key => values.every(sample => sample.metrics[key] === null || typeof sample.metrics[key] === 'number')).map(key => {
      const numbers = values.map(sample => sample.metrics[key]);
      return [key, numbers.every(value => value === null) ? null : numbers.some(value => value === null) ? { supportedSamples: numbers.filter(value => value !== null).length, totalSamples: numbers.length } : aggregate(numbers)];
    })),
  }));
  const pairedModeDifferences = samples.filter(sample => sample.mode === 'chunk').flatMap(before => {
    const after = samples.find(sample => sample.mode === 'frame' && sample.sampleIndex === before.sampleIndex && sample.temperature === before.temperature && sample.reservation === before.reservation);
    return after ? [{ sampleIndex: before.sampleIndex, temperature: before.temperature, reservation: before.reservation,
      metrics: Object.fromEntries(Object.keys(before.metrics).filter(key => before.metrics[key] === null || typeof before.metrics[key] === 'number').map(key => [key,
        typeof before.metrics[key] === 'number' && typeof after.metrics[key] === 'number' ? after.metrics[key] - before.metrics[key] : null])),
    }] : [];
  });
  return { uncertainty: 'Raw samples and descriptive n/min/median/nearest-rank-p95/max only. Small samples do not establish a field percentile, confidence interval, causal improvement or an approved budget.', cells, pairedModeDifferences };
}

async function rendererCounters(session) {
  if (!session) return null;
  const { metrics } = await session.send('Performance.getMetrics');
  return Object.fromEntries(metrics.map(metric => [metric.name, metric.value]));
}
function rendererDurations(before, after) {
  return Object.fromEntries([['rendererTaskMs', 'TaskDuration'], ['rendererScriptMs', 'ScriptDuration'], ['rendererLayoutMs', 'LayoutDuration'], ['rendererStyleMs', 'RecalcStyleDuration']].map(([key, metric]) => {
    if (!before || !after || !Number.isFinite(before[metric]) || !Number.isFinite(after[metric])) return [key, null];
    if (after[metric] < before[metric]) throw new Error('Renderer performance counter reset during measurement.');
    return [key, (after[metric] - before[metric]) * 1000];
  }));
}

export function checkReplayMetrics(metrics) {
  for (const key of ['elapsedMs', 'firstUsefulMs', 'controlReadyMs', 'parseControllerMs', 'renderSettlingMs', 'hostUpdates', 'litUpdates', 'peakConnectedNodes', 'controlInputToFrameMs', 'connectedNodesAfterDispose', 'connectedElementsAfterDispose', 'sourceCharactersBeforeRelease', 'sourceCharactersAfterRelease', 'presentationCharactersAfterRelease']) {
    if (!Number.isFinite(metrics[key]) || metrics[key] < 0) throw new Error(`Invalid replay metric: ${key}`);
  }
  if (metrics.firstUsefulMs > metrics.elapsedMs || metrics.controlReadyMs > metrics.elapsedMs || metrics.hostUpdates < 1 || metrics.litUpdates < 1 || metrics.peakConnectedNodes < 1) throw new Error('Replay observed no meaningful rendering.');
  for (const key of ['cls', 'longTaskCount', 'maximumLongTaskMs']) if (metrics[key] !== null && (!Number.isFinite(metrics[key]) || metrics[key] < 0)) throw new Error(`Invalid optional replay metric: ${key}`);
  for (const key of ['totalLongTaskMs', 'rendererTaskMs', 'rendererScriptMs', 'rendererLayoutMs', 'rendererStyleMs']) if (Object.hasOwn(metrics, key) && metrics[key] !== null && (!Number.isFinite(metrics[key]) || metrics[key] < 0)) throw new Error(`Invalid optional replay metric: ${key}`);
}

export async function serve(directory) {
  const server = createServer(async (request, response) => {
    try {
      if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405).end(); return; }
      const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const file = resolve(directory, `.${path === '/' ? '/index.html' : path}`);
      if (!file.startsWith(`${directory}${sep}`)) { response.writeHead(403).end(); return; }
      const bytes = await readFile(file);
      response.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
      response.end(request.method === 'HEAD' ? undefined : bytes);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise((accept, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', accept); });
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
}

export async function run(options) {
  if (process.versions.node !== (await readFile(join(here, '../../.nvmrc'), 'utf8')).trim()) throw new Error('Use the pinned Node version.');
  const context = await buildContext();
  const scratch = await mkdtemp(join(tmpdir(), 'lyra-gen-replay-'));
  let browser, server;
  try {
    const build = await context.esbuild.build({
      absWorkingDir: here, entryPoints: [join(here, 'fixture/main.js')], bundle: true, splitting: true, format: 'esm', platform: 'browser', target: 'es2022',
      outdir: scratch, minify: true, sourcemap: false, metafile: true, logLevel: 'silent',
      conditions: ['browser', 'production'], define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [context.plugin], external: context.optionalPeers.flatMap(peer => [peer, `${peer}/*`]),
    });
    const externalImports = [...new Set(Object.values(build.metafile.outputs).flatMap(output => output.imports.filter(edge => edge.external).map(edge => `${edge.kind}:${edge.path}`)))].sort();
    await writeFile(join(scratch, 'index.html'), (await readFile(join(here, 'fixture/index.html'), 'utf8')).replace('</head>', '<link rel="stylesheet" href="./main.css"></head>'));
    const hosted = await serve(scratch); server = hosted.server;
    const playwright = await import('playwright');
    const playwrightVersion = JSON.parse(await readFile(createRequire(import.meta.url).resolve('playwright/package.json'), 'utf8')).version;
    const bundledFiles = await Promise.all(Object.keys(build.metafile.outputs).sort().map(file => readFile(resolve(here, file))));
    browser = await playwright[options.browser].launch({ headless: true });
    const report = {
      schemaVersion: 2, status: 'passed', measurementKind: 'synthetic-replay',
      packageVersion: context.gen.version, uiVersion: context.ui.version, fixtureHash: hash(WORKLOADS[options.workload].source), bundleHash: hash(Buffer.concat(bundledFiles)),
      harnessSha256: hash(await readFile(fileURLToPath(import.meta.url))),
      environment: { node: process.versions.node, esbuild: context.esbuild.version, playwright: playwrightVersion, os: process.platform, arch: process.arch, cpuModel: cpus()[0]?.model ?? null, logicalCpus: cpus().length, browser: options.browser, browserVersion: browser.version(), viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' },
      configuration: { workload: options.workload, samplesPerCell: options.samples, warmupsPerCell: 1, modes: ['chunk', 'frame'], cadence: WORKLOADS[options.workload].recording ? 'recorded-authored-synthetic' : 'synthetic',
        temperatures: options.temperature === 'paired' ? ['cold', 'warm'] : ['cold'], reservations: options.reservation === 'both' ? ['default', 'none'] : [options.reservation ?? 'default'],
        coldDefinition: 'First composition in a fresh browser context/page; entry modules are already loaded before replay.',
        warmDefinition: 'Second composition in that same page after full app disposal; module registry remains primed. No warm HTTP-cache claim.',
        httpCache: 'disabled by route interception and no-store responses', coldContextPerSample: true },
      externalImports, metricDefinitions: { ...METRIC_DEFINITIONS,
        controlInputToFrameMs: 'Native input event receipt until the next animation frame; excludes provider latency and automation dispatch delay.',
        rendererTaskMs: 'Chromium CDP TaskDuration delta around the whole replay call, including app setup: renderer task wall time, excluding idle/frame waits; not hardware CPU or browser-process work. Other engines null.',
        rendererScriptMs: 'Chromium CDP ScriptDuration delta in the same whole-composition window; not additive with TaskDuration.',
        rendererLayoutMs: 'Chromium CDP LayoutDuration delta in the same whole-composition window.',
        rendererStyleMs: 'Chromium CDP RecalcStyleDuration delta in the same whole-composition window.',
      },
      samples: [],
    };
    let finalSnapshotHash;
    for (let sampleIndex = -1; sampleIndex < options.samples; sampleIndex++) {
      const modes = sampleIndex % 2 === 0 ? ['chunk', 'frame'] : ['frame', 'chunk'];
      for (const mode of modes) {
        const reservations = sampleIndex % 2 === 0 ? report.configuration.reservations : [...report.configuration.reservations].reverse();
        for (const reservation of reservations) {
          const isolated = await browser.newContext({ viewport: report.environment.viewport, deviceScaleFactor: 1, reducedMotion: 'reduce', serviceWorkers: 'block', locale: 'en-US', timezoneId: 'UTC' });
          try {
            let blocked = 0, pageErrors = 0;
            await isolated.route('**/*', async route => {
              const request = route.request();
              if (new URL(request.url()).origin === hosted.origin && ['GET', 'HEAD'].includes(request.method())) await route.continue();
              else { blocked++; await route.abort(); }
            });
            await isolated.routeWebSocket(/.*/, socket => { blocked++; socket.close(); });
            const page = await isolated.newPage();
            page.on('pageerror', () => pageErrors++);
            page.setDefaultTimeout(15000);
            await page.goto(hosted.origin, { waitUntil: 'networkidle' });
            await page.waitForFunction(() => Boolean(window.__genBenchmark));
            const initialDelivery = await page.evaluate(() => {
              const navigation = performance.getEntriesByType('navigation')[0];
              const resources = performance.getEntriesByType('resource');
              return { requests: resources.length, encodedResponseBytes: resources.reduce((sum, item) => sum + item.encodedBodySize, 0), decodedResponseBytes: resources.reduce((sum, item) => sum + item.decodedBodySize, 0), domContentLoadedMs: navigation?.domContentLoadedEventEnd ?? null, loadMs: navigation?.loadEventEnd ?? null };
            });
            const session = options.browser === 'chromium' ? await isolated.newCDPSession(page) : undefined;
            if (session) await session.send('Performance.enable');
            for (const temperature of report.configuration.temperatures) {
              await page.evaluate(() => performance.clearResourceTimings());
              const before = await rendererCounters(session);
              const replay = await page.evaluate(async ({ workload, mode, reservation }) => {
                let timer;
                try { return await Promise.race([window.__genBenchmark.replay(workload, mode, reservation), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Replay timeout.')), 60000); })]); }
                finally { clearTimeout(timer); }
              }, { workload: options.workload, mode, reservation });
              const after = await rendererCounters(session);
              const delivery = await page.evaluate(() => {
                const resources = performance.getEntriesByType('resource');
                return { requests: resources.length, encodedResponseBytes: resources.reduce((sum, item) => sum + item.encodedBodySize, 0), decodedResponseBytes: resources.reduce((sum, item) => sum + item.decodedBodySize, 0) };
              });
              await page.locator('lr-gen-view lr-input input').fill('Benchmark review');
              const metrics = await page.evaluate(() => window.__genBenchmark.dispose());
              Object.assign(metrics, rendererDurations(before, after));
              checkReplayMetrics(metrics);
              if (options.reservation === 'both' && (!metrics.reservationObserved || !replay.observations.loadingReservedBlockSizesPx.every(size => reservation === 'none' ? size === 0 : size > 0))) throw new Error('Reservation variants did not reach a rendered loading placeholder.');
              if (!metrics.interactionAccepted || metrics.controlInputToFrameMs === null || metrics.connectedElementsAfterDispose !== 0 || !metrics.viewDisconnected || !metrics.controllerSnapshotCleared || metrics.sourceCharactersBeforeRelease !== metrics.sourceUtf16Units || metrics.sourceCharactersAfterRelease !== 0 || !metrics.sourceUnavailableAfterRelease || !metrics.admittedDocumentsPreserved || !metrics.controlPreservedAfterRelease || blocked || pageErrors) throw new Error('Replay interaction, disposal, or network contract failed.');
              const snapshotHash = hash(replay.finalSnapshot);
              if (finalSnapshotHash && snapshotHash !== finalSnapshotHash) throw new Error('Replay scheduling changed the final snapshot.');
              finalSnapshotHash = snapshotHash;
              if (sampleIndex >= 0) report.samples.push({ mode, temperature, reservation, sampleIndex, metrics, arrivals: replay.arrivals, observations: replay.observations, delivery, initialDelivery: temperature === 'cold' ? initialDelivery : null, finalSnapshotHash: snapshotHash });
            }
            if (session) await session.detach();
          } finally { await isolated.close(); }
        }
      }
    }
    report.summary = summarizeReplaySamples(report.samples);
    await writeFile(resolve(options.output), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
    return report;
  } finally {
    try {
      await Promise.allSettled([...(browser ? [browser.close()] : []), ...(server ? [new Promise(resolveClosed => server.close(resolveClosed))] : [])]);
    } finally { await rm(scratch, { recursive: true, force: true }); }
  }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  await run(optionsFor(process.argv.slice(2))).then(report => console.log(JSON.stringify({ status: report.status, samples: report.samples.length }))).catch(() => {
    console.error('Generated UI replay failed; inspect the built fixture and browser availability. No passing report was written.'); process.exitCode = 1;
  });
}
