#!/usr/bin/env node
// Real-GPU frame rates of the optional WebGL renderers (lr-graph and lr-embedding-explorer with
// engine="webgl"). Each mode launches headless Chromium once: `gpu` renders on the host GPU through
// ANGLE over EGL, `software` through SwiftShader. Every result records the WebGL renderer string
// that drew it and the WebGL draw calls per frame, so an idle or software frame never passes as a
// GPU-rendered one. Build the packages first (`pnpm build`).
//   node benchmarks/gpu/run.mjs [--modes gpu,software] [--profile quick|stress|scale|all]
//                               [--duration-ms 5000] [--warmup-ms 1000] [--output FILE]
//                               [--cpu-profile]  (unminified build; top main-thread functions per scenario)
//                               [--acceptance-observations] (three extra repetitions, heap/input/captures)
//                               [--gate]  (exit 1 when a targeted scenario fails, 2 when nothing qualified)
//                               [--observation-timeout-ms 600000] (per page; a starved page records `timeout`)
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { cpus, totalmem } from 'node:os';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectAcceptanceObservations, measurementFailed } from './acceptance.mjs';
import { gateOutcome, gateScenario } from './gate.mjs';
import { graphFixture, graphFixtureDigest } from './graph-fixture.mjs';
import { completionReason, observeGraphWorkers } from './layout-observation.mjs';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../..');
// `targetFps` marks the documented frame-rate targets; the gate judges only those scenarios.
// `layout` adds an unpinned observation of the progressive worker layout.
export const PROFILES = {
  quick: [
    { id: 'graph-10k-nodes-30k-edges', kind: 'graph', nodes: 10_000, edges: 30_000, targetFps: 60 },
    { id: 'points-100k', kind: 'points', count: 100_000, targetFps: 60 },
  ],
  stress: [
    { id: 'graph-30k-nodes-90k-edges', kind: 'graph', nodes: 30_000, edges: 90_000 },
    { id: 'points-1m', kind: 'points', count: 1_000_000 },
  ],
  scale: [
    // A software renderer can stall minutes on a 100k frame; a slow mount is recorded, not failed.
    { id: 'graph-100k-nodes-300k-edges', kind: 'graph', nodes: 100_000, edges: 300_000, targetFps: 60, layout: true, readyTimeoutMs: 600_000 },
  ],
};
const PROFILE_NAMES = [...Object.keys(PROFILES), 'all'];
const NVIDIA_EGL = '/usr/share/glvnd/egl_vendor.d/10_nvidia.json';
const MODES = {
  gpu: {
    args: ['--use-gl=angle', '--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist'],
    env: existsSync(NVIDIA_EGL) ? { __EGL_VENDOR_LIBRARY_FILENAMES: NVIDIA_EGL } : {},
  },
  software: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'], env: {} },
};

export function parse(argv) {
  const options = { modes: ['gpu', 'software'], profile: 'quick', durationMs: 5000, warmupMs: 1000, output: null, cpuProfile: false, acceptanceObservations: false, gate: false, observationTimeoutMs: 600_000 };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index], value = argv[index + 1];
    if (flag === '--modes') { options.modes = value.split(','); index += 1; }
    else if (flag === '--profile') { options.profile = value; index += 1; }
    else if (flag === '--duration-ms') { options.durationMs = Number(value); index += 1; }
    else if (flag === '--warmup-ms') { options.warmupMs = Number(value); index += 1; }
    else if (flag === '--output') { options.output = resolve(value); index += 1; }
    else if (flag === '--cpu-profile') options.cpuProfile = true;
    else if (flag === '--acceptance-observations') options.acceptanceObservations = true;
    else if (flag === '--gate') options.gate = true;
    else if (flag === '--observation-timeout-ms') { options.observationTimeoutMs = Number(value); index += 1; }
    else throw new Error(`Unknown option ${flag}`);
  }
  if (!options.modes.length || options.modes.some((mode) => !MODES[mode])) throw new Error('--modes takes gpu and/or software');
  if (!PROFILE_NAMES.includes(options.profile)) throw new Error(`--profile takes ${PROFILE_NAMES.join(', ')}`);
  for (const key of ['durationMs', 'warmupMs']) {
    if (!Number.isInteger(options[key]) || options[key] < 0 || options[key] > 60_000) throw new Error(`invalid ${key}`);
  }
  if (!Number.isInteger(options.observationTimeoutMs) || options.observationTimeoutMs < 1000 || options.observationTimeoutMs > 3_600_000) throw new Error('invalid observationTimeoutMs');
  return options;
}

async function serve(directory) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm' };
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      const file = resolve(directory, `.${pathname === '/' ? '/index.html' : pathname}`);
      if (request.method !== 'GET' || !file.startsWith(`${directory}${sep}`)) { response.writeHead(403).end(); return; }
      const bytes = await readFile(file);
      response.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
      response.end(bytes);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise((done, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', done); });
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
}

const round = (value) => Math.round(value * 100) / 100;
const started = performance.now();
/** Progress on stderr, so a long software run shows where it spends its time. */
const progress = (message) => process.stderr.write(`[${Math.round((performance.now() - started) / 1000)}s] ${message}\n`);
export function summarize(intervals) {
  const sorted = [...intervals].sort((a, b) => a - b);
  const quantile = (q) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1))] ?? 0;
  const total = intervals.reduce((sum, value) => sum + value, 0);
  return {
    frames: intervals.length,
    fps: total > 0 ? round((1000 * intervals.length) / total) : 0,
    p50Ms: round(quantile(0.5)), p95Ms: round(quantile(0.95)), maxMs: round(sorted.at(-1) ?? 0),
    over20Ms: intervals.filter((value) => value > 20).length,
  };
}

/** Self time per function from a CDP sampling profile, heaviest first. */
export function hottest(profile, limit = 15) {
  const self = new Map(), byId = new Map(profile.nodes.map((node) => [node.id, node]));
  profile.samples.forEach((id, index) => {
    const frame = byId.get(id)?.callFrame;
    if (!frame) return;
    const key = `${frame.functionName || '(anonymous)'} ${frame.url.split('/').pop()}:${frame.lineNumber + 1}`;
    self.set(key, (self.get(key) ?? 0) + (profile.timeDeltas[index] ?? 0) / 1000);
  });
  const total = [...self.values()].reduce((sum, value) => sum + value, 0);
  return [...self].sort((a, b) => b[1] - a[1]).slice(0, limit)
    .map(([name, ms]) => ({ name, selfMs: round(ms), share: round(ms / total) }));
}

/** Runs `work`, attaching the hottest main-thread functions when `--cpu-profile` is set. */
async function profiled(page, options, work) {
  if (!options.cpuProfile) return work();
  const session = await page.context().newCDPSession(page);
  await session.send('Profiler.enable'); await session.send('Profiler.setSamplingInterval', { interval: 200 }); await session.send('Profiler.start');
  const measured = await work();
  measured.hottest = hottest((await session.send('Profiler.stop')).profile);
  await session.detach();
  return measured;
}

/** A timing sample qualifies only when the measured frames actually issued WebGL draws. */
export function measurementStatus(measured) {
  if (measured.fallbacks.length) return 'fallback';
  const recorded = [measured.frames, measured.fps, measured.drawnFrameRatio, measured.drawCallsPerFrame]
    .every((value) => Number.isFinite(value) && value > 0);
  return recorded ? 'measured' : 'unqualified';
}

/** Main-isolate JavaScript heap after a forced collection; excludes workers, GPU and native memory. */
async function heapUsed(session) {
  await session.send('HeapProfiler.collectGarbage');
  return (await session.send('Runtime.getHeapUsage')).usedSize;
}

const OBSERVATION_TIMEOUT = 'OBSERVATION_TIMEOUT';

/**
 * Settles with `work`, or rejects with OBSERVATION_TIMEOUT after `timeoutMs` of Node time. Page-side
 * waits run on animation frames, which a saturated software renderer can starve for minutes.
 */
export async function withDeadline(work, timeoutMs) {
  let timer;
  work.catch(() => {});
  const deadline = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(OBSERVATION_TIMEOUT)), timeoutMs); });
  try { return await Promise.race([work, deadline]); } finally { clearTimeout(timer); }
}
/** A starved renderer can delay closing; the browser close that follows ends it regardless. */
const closePage = (page) => withDeadline(page.close(), 30_000).catch(() => {});
const failureStatus = (error) => (error?.message === OBSERVATION_TIMEOUT ? 'timeout' : 'failed');

const call = (page, name, argument) => page.evaluate(([method, value]) => window.__gpuBenchmark[method](value), [name, argument]);

/** A layout observation qualifies when the frames drew and the worker delivered positions. */
export function layoutStatus(observed) {
  if (observed.fallbacks.length) return 'fallback';
  const drew = [observed.frames, observed.fps, observed.drawnFrameRatio].every((value) => Number.isFinite(value) && value > 0);
  return drew && Number.isFinite(observed.firstOutputMs) && observed.outputs > 0 ? 'measured' : 'unqualified';
}

/**
 * Mounts the graph without positions on a fresh page and orbits the camera while the worker layout
 * streams positions in: frame times during progressive layout, time to the first applied layout
 * output, and how far the layout got. Completion is reported, never required.
 */
async function measureLayout(browser, origin, scenario, options, viewport) {
  const page = await browser.newPage({ viewport });
  const observe = async () => {
    await page.addInitScript(observeGraphWorkers);
    await page.goto(origin, { waitUntil: 'load' });
    await page.waitForFunction(() => !!window.__gpuBenchmark);
    await page.evaluate(() => window.__layoutObservation.reset());
    progress(`${scenario.id}: mounting without positions for the progressive layout`);
    const mounted = await call(page, 'graph', { ...scenario, unpinned: true });
    progress(`${scenario.id}: unpinned mount in ${round(mounted.mountMs)} ms; recording frames during layout`);
    const measured = await call(page, 'frames', { durationMs: options.durationMs, orbit: true });
    // A short smoke window may end before the first iteration; the first output is still recorded.
    await page.waitForFunction(() => (window.__layoutObservation.read()?.samples.length ?? 0) > 0, null, { timeout: 120_000 }).catch(() => {});
    const record = await page.evaluate(() => window.__layoutObservation.read());
    const summary = summarize(measured.intervals);
    const observed = {
      unpinnedMountMs: round(mounted.mountMs), ...summary,
      drawnFrameRatio: summary.frames ? round(measured.drawnFrames / summary.frames) : 0,
      firstOutputMs: record?.samples.length ? round(record.samples[0].elapsedMs) : null,
      outputs: record?.samples.length ?? 0,
      iteration: record?.iteration ?? 0,
      lastOutputMs: record?.samples.length ? round(record.samples.at(-1).elapsedMs) : null,
      completion: record ? (record.done ? completionReason(record) : 'progressing') : 'no-worker-observed',
      fallbacks: await page.evaluate(() => window.__gpuBenchmark.readFallbacks()),
    };
    return { status: layoutStatus(observed), ...observed };
  };
  try {
    return await withDeadline(observe(), options.observationTimeoutMs);
  } catch (error) {
    return { status: failureStatus(error), error: String(error?.message ?? error).slice(0, 200) };
  } finally {
    await closePage(page);
  }
}

async function measure(page, scenario, options) {
  const session = await page.context().newCDPSession(page);
  const beforeMountBytes = await heapUsed(session);
  const mounted = await call(page, scenario.kind, scenario);
  progress(`${scenario.id}: mounted in ${round(mounted.mountMs)} ms`);
  const mountedBytes = await heapUsed(session);
  await session.detach();
  let measured;
  if (scenario.kind === 'graph') {
    // A camera write per frame schedules exactly one engine frame.
    await call(page, 'frames', { durationMs: options.warmupMs, orbit: true });
    measured = await profiled(page, options, () => call(page, 'frames', { durationMs: options.durationMs, orbit: true }));
  } else {
    // The point cloud turns under a pointer drag, one step per animation frame.
    await call(page, 'frames', { durationMs: options.warmupMs, drag: true });
    measured = await profiled(page, options, () => call(page, 'frames', { durationMs: options.durationMs, drag: true }));
  }
  const summary = summarize(measured.intervals);
  return {
    mountMs: round(mounted.mountMs), ...summary,
    drawnFrameRatio: summary.frames ? round(measured.drawnFrames / summary.frames) : 0,
    drawCallsPerFrame: summary.frames ? round(measured.drawCalls / summary.frames) : 0,
    fallbacks: measured.fallbacks,
    heap: { beforeMountBytes, mountedBytes, mountedDeltaBytes: mountedBytes - beforeMountBytes },
    ...(measured.hottest ? { hottest: measured.hottest } : {}),
  };
}

export async function run(options) {
  const [{ chromium }, { build }] = await Promise.all([import('playwright'), import('vite')]);
  const lyra = JSON.parse(await readFile(join(root, 'packages/lyra-ui/package.json'), 'utf8'));
  const companion = JSON.parse(await readFile(join(root, 'packages/lyra-3d/package.json'), 'utf8'));
  for (const directory of ['packages/lyra-ui/dist', 'packages/lyra-3d/dist']) {
    if (!existsSync(join(root, directory))) throw new Error(`${directory} is missing; run pnpm build first`);
  }
  await mkdir(join(root, 'benchmarks/.work'), { recursive: true });
  const work = await mkdtemp(join(root, 'benchmarks/.work/gpu-'));
  const scenarios = options.profile === 'all' ? Object.values(PROFILES).flat() : PROFILES[options.profile];
  // Fingerprints of the generated graphs, so results are compared only for identical scenes.
  const fixtures = Object.fromEntries(scenarios.filter((scenario) => scenario.kind === 'graph')
    .map((scenario) => [scenario.id, graphFixtureDigest(graphFixture(scenario))]));
  const result = {
    recordedAt: new Date().toISOString(),
    library: { lyraUi: lyra.version, lyra3d: companion.version },
    environment: {
      node: process.versions.node,
      cpuModel: cpus()[0]?.model?.trim().replace(/\s+/g, ' ') ?? 'unknown', logicalCpus: cpus().length, memoryBytes: totalmem(),
      viewport: { width: 1400, height: 900 }, headless: true,
    },
    configuration: { profile: options.profile, durationMs: options.durationMs, warmupMs: options.warmupMs, observationTimeoutMs: options.observationTimeoutMs, fixtures },
    modes: [],
  };
  const output = options.output ?? join(here, 'results', `${result.recordedAt.replaceAll(':', '-').replaceAll('.', '-')}.json`);
  await mkdir(dirname(output), { recursive: true });
  let server, browser;
  try {
    const outDir = join(work, 'dist');
    await build({
      configFile: false, root: join(here, 'fixture'), publicDir: false, logLevel: 'silent', cacheDir: join(work, 'cache'),
      resolve: { dedupe: ['lit', 'lit-html', 'lit-element', 'three'], conditions: ['browser', 'production', 'import', 'default'] },
      build: { outDir, emptyOutDir: true, sourcemap: false, minify: !options.cpuProfile, target: 'es2022', reportCompressedSize: false },
    });
    const hosted = await serve(outDir); server = hosted.server;
    for (const mode of options.modes) {
      browser = await chromium.launch({ headless: true, args: MODES[mode].args, env: { ...process.env, ...MODES[mode].env } });
      const report = { mode, browserVersion: browser.version(), renderer: null, scenarios: [] };
      result.modes.push(report);
      for (const scenario of scenarios) {
        const page = await browser.newPage({ viewport: result.environment.viewport });
        try {
          await page.goto(hosted.origin, { waitUntil: 'load' });
          await page.waitForFunction(() => !!window.__gpuBenchmark);
          report.renderer ??= await page.evaluate(() => window.__gpuBenchmark.renderer());
          progress(`${mode} ${scenario.id}: measuring`);
          const measured = await withDeadline(measure(page, scenario, options), options.observationTimeoutMs);
          report.scenarios.push({ ...scenario, status: measurementStatus(measured), ...measured });
          if (scenario.layout) report.scenarios.at(-1).layout = await measureLayout(browser, hosted.origin, scenario, options, result.environment.viewport);
        } catch (error) {
          report.scenarios.push({ ...scenario, status: failureStatus(error), error: String(error?.message ?? error).slice(0, 200) });
        } finally {
          await closePage(page);
        }
      }
      if (options.acceptanceObservations) {
        report.acceptance = await collectAcceptanceObservations(browser, hosted.origin, PROFILES.quick,
          result.environment.viewport, `${output}.captures/${mode}`);
      }
      report.hardware = /swiftshader|llvmpipe|software/i.test(report.renderer?.renderer ?? '') ? 'software' : report.renderer?.webgl2 ? 'gpu' : 'none';
      for (const scenario of report.scenarios) scenario.gate = gateScenario(scenario, report.hardware);
      progress(`${mode}: closing the browser`);
      await browser.close(); browser = undefined;
    }
  } finally {
    await browser?.close();
    server?.close();
    await rm(work, { recursive: true, force: true });
  }
  result.gate = gateOutcome(result);
  await writeFile(output, `${JSON.stringify(result, null, 2)}\n`);
  return { result, output };
}

const mib = (bytes) => (Number.isFinite(bytes) ? round(bytes / 1048576) : '');

function table({ modes, gate }) {
  const lines = ['| Mode | Renderer | Scenario | Status | Mount ms | FPS | p50 ms | p95 ms | Max ms | >20 ms | Drawn frames | Draws/frame | Heap delta MiB | Gate |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
  const layouts = ['| Mode | Scenario | Status | Unpinned mount ms | FPS during layout | p95 ms | First output ms | Outputs | Iteration | Completion |', '|---|---|---|---|---|---|---|---|---|---|'];
  for (const report of modes) {
    for (const scenario of report.scenarios) {
      const verdict = scenario.gate?.verdict === 'untargeted' ? '' : `${scenario.gate?.verdict ?? ''}${scenario.gate?.targetFps ? ` (${scenario.gate.drawnFps ?? '-'}/${scenario.gate.targetFps})` : ''}`;
      lines.push(`| ${report.mode} (${report.hardware}) | ${report.renderer?.renderer ?? 'none'} | ${scenario.id} | ${scenario.status} | ${scenario.mountMs ?? ''} | ${scenario.fps ?? ''} | ${scenario.p50Ms ?? ''} | ${scenario.p95Ms ?? ''} | ${scenario.maxMs ?? ''} | ${scenario.over20Ms ?? ''} | ${scenario.drawnFrameRatio ?? ''} | ${scenario.drawCallsPerFrame ?? ''} | ${mib(scenario.heap?.mountedDeltaBytes)} | ${verdict} |`);
      const layout = scenario.layout;
      if (layout) layouts.push(`| ${report.mode} (${report.hardware}) | ${scenario.id} | ${layout.status} | ${layout.unpinnedMountMs ?? ''} | ${layout.fps ?? ''} | ${layout.p95Ms ?? ''} | ${layout.firstOutputMs ?? ''} | ${layout.outputs ?? ''} | ${layout.iteration ?? ''} | ${layout.completion ?? layout.error ?? ''} |`);
    }
  }
  return [lines.join('\n'), ...(layouts.length > 2 ? ['', 'Progressive layout (unpinned):', layouts.join('\n')] : []), '', `Gate: ${gate}`].join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = parse(process.argv.slice(2));
  const { result, output } = await run(options);
  progress('run complete');
  process.stdout.write(`${table(result)}\n\nResults: ${output}\n`);
  for (const report of result.modes) for (const scenario of report.scenarios) {
    if (scenario.hottest) process.stdout.write(`\nHottest main-thread functions, ${report.mode} ${scenario.id}:\n${scenario.hottest.map((entry) => `  ${entry.selfMs} ms (${Math.round(entry.share * 100)}%) ${entry.name}`).join('\n')}\n`);
  }
  const failed = measurementFailed(result, options.acceptanceObservations);
  process.exitCode = failed || (options.gate && result.gate === 'fail') ? 1 : options.gate && result.gate === 'advisory' ? 2 : 0;
}
