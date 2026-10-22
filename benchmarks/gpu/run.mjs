#!/usr/bin/env node
// Real-GPU frame rates of the optional WebGL renderers (lr-graph and lr-embedding-explorer with
// engine="webgl"). Each mode launches headless Chromium once: `gpu` renders on the host GPU through
// ANGLE over EGL, `software` through SwiftShader. Every result records the WebGL renderer string
// that drew it and the WebGL draw calls per frame, so an idle or software frame never passes as a
// GPU-rendered one. Build the packages first (`pnpm build`).
//   node benchmarks/gpu/run.mjs [--modes gpu,software] [--profile quick|stress|all]
//                               [--duration-ms 5000] [--warmup-ms 1000] [--output FILE]
//                               [--cpu-profile]  (unminified build; top main-thread functions per scenario)
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { cpus, totalmem } from 'node:os';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../..');
const PROFILES = {
  quick: [
    { id: 'graph-10k-nodes-30k-edges', kind: 'graph', nodes: 10_000, edges: 30_000 },
    { id: 'points-100k', kind: 'points', count: 100_000 },
  ],
  stress: [
    { id: 'graph-30k-nodes-90k-edges', kind: 'graph', nodes: 30_000, edges: 90_000 },
    { id: 'points-1m', kind: 'points', count: 1_000_000 },
  ],
};
const NVIDIA_EGL = '/usr/share/glvnd/egl_vendor.d/10_nvidia.json';
const MODES = {
  gpu: {
    args: ['--use-gl=angle', '--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist'],
    env: existsSync(NVIDIA_EGL) ? { __EGL_VENDOR_LIBRARY_FILENAMES: NVIDIA_EGL } : {},
  },
  software: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'], env: {} },
};

export function parse(argv) {
  const options = { modes: ['gpu', 'software'], profile: 'quick', durationMs: 5000, warmupMs: 1000, output: null, cpuProfile: false };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index], value = argv[index + 1];
    if (flag === '--modes') { options.modes = value.split(','); index += 1; }
    else if (flag === '--profile') { options.profile = value; index += 1; }
    else if (flag === '--duration-ms') { options.durationMs = Number(value); index += 1; }
    else if (flag === '--warmup-ms') { options.warmupMs = Number(value); index += 1; }
    else if (flag === '--output') { options.output = resolve(value); index += 1; }
    else if (flag === '--cpu-profile') options.cpuProfile = true;
    else throw new Error(`Unknown option ${flag}`);
  }
  if (!options.modes.length || options.modes.some((mode) => !MODES[mode])) throw new Error('--modes takes gpu and/or software');
  if (!['quick', 'stress', 'all'].includes(options.profile)) throw new Error('--profile takes quick, stress or all');
  for (const key of ['durationMs', 'warmupMs']) {
    if (!Number.isInteger(options[key]) || options[key] < 0 || options[key] > 60_000) throw new Error(`invalid ${key}`);
  }
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

async function measure(page, scenario, options) {
  const call = (name, argument) => page.evaluate(([method, value]) => window.__gpuBenchmark[method](value), [name, argument]);
  const mounted = await call(scenario.kind, scenario);
  let measured;
  if (scenario.kind === 'graph') {
    // A camera write per frame schedules exactly one engine frame.
    await call('frames', { durationMs: options.warmupMs, orbit: true });
    measured = await profiled(page, options, () => call('frames', { durationMs: options.durationMs, orbit: true }));
  } else {
    // The point cloud turns under a pointer drag, one step per animation frame.
    await call('frames', { durationMs: options.warmupMs, drag: true });
    measured = await profiled(page, options, () => call('frames', { durationMs: options.durationMs, drag: true }));
  }
  const summary = summarize(measured.intervals);
  return {
    mountMs: round(mounted.mountMs), ...summary,
    drawnFrameRatio: summary.frames ? round(measured.drawnFrames / summary.frames) : 0,
    drawCallsPerFrame: summary.frames ? round(measured.drawCalls / summary.frames) : 0,
    fallbacks: measured.fallbacks,
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
  const scenarios = options.profile === 'all' ? [...PROFILES.quick, ...PROFILES.stress] : PROFILES[options.profile];
  const result = {
    recordedAt: new Date().toISOString(),
    library: { lyraUi: lyra.version, lyra3d: companion.version },
    environment: {
      node: process.versions.node,
      cpuModel: cpus()[0]?.model?.trim().replace(/\s+/g, ' ') ?? 'unknown', logicalCpus: cpus().length, memoryBytes: totalmem(),
      viewport: { width: 1400, height: 900 }, headless: true,
    },
    configuration: { profile: options.profile, durationMs: options.durationMs, warmupMs: options.warmupMs },
    modes: [],
  };
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
          const measured = await measure(page, scenario, options);
          report.scenarios.push({ ...scenario, status: measured.fallbacks.length ? 'fallback' : 'measured', ...measured });
        } catch (error) {
          report.scenarios.push({ ...scenario, status: 'failed', error: String(error?.message ?? error).slice(0, 200) });
        } finally {
          await page.close();
        }
      }
      report.hardware = /swiftshader|llvmpipe|software/i.test(report.renderer?.renderer ?? '') ? 'software' : report.renderer?.webgl2 ? 'gpu' : 'none';
      await browser.close(); browser = undefined;
    }
  } finally {
    await browser?.close();
    server?.close();
    await rm(work, { recursive: true, force: true });
  }
  const output = options.output ?? join(here, 'results', `${result.recordedAt.replaceAll(':', '-').replaceAll('.', '-')}.json`);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(result, null, 2)}\n`);
  return { result, output };
}

function table({ modes }) {
  const lines = ['| Mode | Renderer | Scenario | Status | Mount ms | FPS | p50 ms | p95 ms | Max ms | >20 ms | Drawn frames | Draws/frame |', '|---|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const report of modes) {
    for (const scenario of report.scenarios) {
      lines.push(`| ${report.mode} (${report.hardware}) | ${report.renderer?.renderer ?? 'none'} | ${scenario.id} | ${scenario.status} | ${scenario.mountMs ?? ''} | ${scenario.fps ?? ''} | ${scenario.p50Ms ?? ''} | ${scenario.p95Ms ?? ''} | ${scenario.maxMs ?? ''} | ${scenario.over20Ms ?? ''} | ${scenario.drawnFrameRatio ?? ''} | ${scenario.drawCallsPerFrame ?? ''} |`);
    }
  }
  return lines.join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { result, output } = await run(parse(process.argv.slice(2)));
  process.stdout.write(`${table(result)}\n\nResults: ${output}\n`);
  for (const report of result.modes) for (const scenario of report.scenarios) {
    if (scenario.hottest) process.stdout.write(`\nHottest main-thread functions, ${report.mode} ${scenario.id}:\n${scenario.hottest.map((entry) => `  ${entry.selfMs} ms (${Math.round(entry.share * 100)}%) ${entry.name}`).join('\n')}\n`);
  }
  const failed = result.modes.some((report) => report.scenarios.some((scenario) => scenario.status !== 'measured'));
  process.exitCode = failed ? 1 : 0;
}
