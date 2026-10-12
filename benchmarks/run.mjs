#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, readdir, stat, realpath, mkdtemp, rm, rename } from 'node:fs/promises';
import { cpus, totalmem, platform, arch, release } from 'node:os';
import { dirname, resolve, join, relative, extname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { parseOptions } from './lib/options.mjs';
import { HARNESS_CODES, failureSample, validateSample, validateResult } from './lib/results.mjs';
import * as catalog from './fixtures/catalog.mjs';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '..');
const exec = promisify(execFile), require = createRequire(import.meta.url);
const progress = (event, fields = {}) => process.stdout.write(`${JSON.stringify({ event, ...fields })}\n`);
const fixedCode = error => HARNESS_CODES.includes(error?.benchmarkCode) ? error.benchmarkCode : 'internal-error';
function coded(code) { const error = new Error(code); error.benchmarkCode = code; return error; }
async function deadline(promise, milliseconds, code) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(coded(code)), milliseconds); })]); }
  finally { clearTimeout(timer); }
}
async function listFiles(directory) {
  const files = [];
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(file));
    else if (entry.isFile()) files.push(file);
  }
  return files;
}
async function hashFiles(directory, files = null) {
  const hash = createHash('sha256');
  for (const file of files ?? await listFiles(directory)) {
    const bytes = await readFile(file);
    hash.update(relative(directory, file).split(sep).join('/')).update('\0').update(String(bytes.length)).update('\0').update(bytes);
  }
  return hash.digest('hex');
}
function conditionalTarget(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') for (const key of ['browser', 'import', 'default']) { const target = conditionalTarget(value[key]); if (target) return target; }
  return null;
}
export function resolveExport(metadata, specifier) {
  const key = specifier === '@aceshooting/lyra-ui' ? '.' : `.${specifier.slice('@aceshooting/lyra-ui'.length)}`;
  let target = conditionalTarget(metadata.exports?.[key]);
  if (!target) for (const [pattern, value] of Object.entries(metadata.exports ?? {})) {
    const position = pattern.indexOf('*'); if (position < 0) continue;
    const prefix = pattern.slice(0, position), suffix = pattern.slice(position + 1);
    if (key.startsWith(prefix) && key.endsWith(suffix)) {
      const resolved = conditionalTarget(value);
      if (resolved) { target = resolved.replaceAll('*', key.slice(prefix.length, suffix.length ? -suffix.length : undefined)); break; }
    }
  }
  if (!target?.startsWith('./dist/') || target.split('/').includes('..')) throw coded('package-invalid');
  return target;
}
async function versionOf(name) {
  let directory = dirname(require.resolve(name));
  for (;;) {
    try { const metadata = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8')); if (metadata.name === name) return metadata.version; } catch { /* Continue to the owning package. */ }
    const parent = dirname(directory); if (parent === directory) throw coded('setup-failed'); directory = parent;
  }
}
async function publicCommit(packageDirectory) {
  try {
    if (packageDirectory !== await realpath(join(root, 'packages/lyra-ui'))) return null;
    const { stdout: origin } = await exec('git', ['remote', 'get-url', 'origin'], { cwd: root });
    if (!['https://github.com/aceshooting/lyra-ui.git', 'https://github.com/aceshooting/lyra-ui', 'git@github.com:aceshooting/lyra-ui.git'].includes(origin.trim())) return null;
    const { stdout: dirty } = await exec('git', ['status', '--porcelain', '--', 'packages/lyra-ui'], { cwd: root }); if (dirty.trim()) return null;
    await exec('git', ['merge-base', '--is-ancestor', 'HEAD', 'refs/remotes/origin/main'], { cwd: root });
    const { stdout } = await exec('git', ['rev-parse', 'HEAD'], { cwd: root }); return /^[a-f0-9]{40}$/.test(stdout.trim()) ? stdout.trim() : null;
  } catch { return null; }
}
async function serve(directory) {
  const server = createServer(async (request, response) => {
    try {
      if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405).end(); return; }
      const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      const file = resolve(directory, `.${pathname === '/' ? '/index.html' : pathname}`);
      if (!file.startsWith(`${directory}${sep}`)) { response.writeHead(403).end(); return; }
      const bytes = await readFile(file);
      response.writeHead(200, { 'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' })[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
      response.end(request.method === 'HEAD' ? undefined : bytes);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise((resolveListening, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolveListening); });
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
}
function normalizeSample(value, scenario) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['status', 'code', 'metrics', 'assertions', 'counts'].includes(key))) throw coded('sample-schema');
  const sample = { status: value.status, code: value.code ?? null, metrics: value.metrics ?? {}, assertions: value.assertions ?? [], counts: value.counts ?? {} };
  try { return validateSample(sample, catalog, scenario); } catch { throw coded('sample-schema'); }
}
function browserStatus(browser) {
  return browser.scenarios.every(scenario => scenario.status === 'passed') ? 'passed' : browser.scenarios.some(scenario => scenario.status === 'failed') ? 'failed' : 'incomplete';
}
function resetState() {
  Object.defineProperty(window, '__benchmarkNetworkBlocks', { value: { count: 0 } });
  for (const name of ['WebSocket', 'WebTransport', 'RTCPeerConnection']) {
    if (name in window) window[name] = function () { window.__benchmarkNetworkBlocks.count++; throw new DOMException('Blocked benchmark transport', 'SecurityError'); };
  }
  window.open = () => { window.__benchmarkNetworkBlocks.count++; return null; };
}
export async function run(options) {
  const pinned = (await readFile(join(root, '.nvmrc'), 'utf8')).trim();
  if (process.versions.node !== pinned) throw coded('node-version');
  const selected = catalog.SCENARIOS.filter(scenario => scenario.profiles.includes(options.profile) && (!options.scenarioIds || options.scenarioIds.includes(scenario.id)));
  if (!selected.length || (options.scenarioIds && options.scenarioIds.some(id => !selected.some(scenario => scenario.id === id)))) throw coded('fixture-contract');
  const packageDirectory = await realpath(options.packageDir ? resolve(options.packageDir) : join(root, 'packages/lyra-ui'));
  const metadata = JSON.parse(await readFile(join(packageDirectory, 'package.json'), 'utf8'));
  if (metadata.name !== '@aceshooting/lyra-ui' || !(await stat(join(packageDirectory, 'dist'))).isDirectory()) throw coded('package-invalid');
  const [{ chromium, firefox, webkit }, { build }] = await Promise.all([import('playwright'), import('vite')]);
  const sourceFiles = [join(here, 'run.mjs'), join(here, 'compare.mjs'), join(here, 'schema.mjs'), ...await listFiles(join(here, 'lib')), ...await listFiles(join(here, 'fixtures'))].filter(file => /\.(?:mjs|js|html|css)$/.test(file)).sort();
  const model = cpus()[0]?.model?.trim().replace(/\s+/g, ' ') ?? 'Unknown';
  const result = { schemaVersion: 1, recordedAt: new Date().toISOString(), harness: { hash: await hashFiles(here, sourceFiles), fixturesHash: await hashFiles(join(here, 'fixtures')) }, library: { version: metadata.version, distHash: await hashFiles(join(packageDirectory, 'dist')), publicCommit: await publicCommit(packageDirectory) },
    environment: { node: process.versions.node, playwright: await versionOf('playwright'), vite: await versionOf('vite'), chartJs: await versionOf('chart.js'), os: platform(), osVersion: /^\d+(?:\.\d+){0,2}/.exec(release())?.[0] ?? '0', arch: arch(), cpuModel: /^[a-zA-Z0-9 ()@.+-]{1,120}$/.test(model) ? model : 'Unknown', logicalCpus: cpus().length, memoryBytes: totalmem(), dpr: 1, viewport: { width: 1280, height: 900 }, headless: options.headless, softwareRendering: options.softwareRendering },
    configuration: { profile: options.profile, samples: options.samples, warmups: options.warmups, timeoutMs: options.timeoutMs, browsers: options.browsers, scenarioIds: selected.map(scenario => scenario.id) },
    browsers: options.browsers.map(id => ({ id, version: null, status: 'incomplete', code: 'not-run', scenarios: selected.map(scenario => ({ id: scenario.id, parameters: scenario.parameters, status: 'not-run', code: 'not-run', samples: [], warmupStatus: 'not-run' })) })), status: 'incomplete' };
  const output = options.output ? resolve(options.output) : join(here, 'results', `${result.recordedAt.replaceAll(':', '-').replaceAll('.', '-')}-${options.profile}.json`);
  await mkdir(dirname(output), { recursive: true });
  validateResult(result, catalog);
  await writeFile(output, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  const save = async () => {
    result.status = result.browsers.every(browser => browser.status === 'passed') ? 'passed' : result.browsers.some(browser => browser.status === 'failed') ? 'failed' : 'incomplete';
    validateResult(result, catalog);
    await writeFile(`${output}.tmp`, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 }); await rename(`${output}.tmp`, output);
  };
  await mkdir(join(here, '.work'), { recursive: true });
  const work = await mkdtemp(join(here, '.work/run-'));
  let server;
  try {
    const destination = join(work, 'dist');
    try {
      await build({ configFile: false, root: join(here, 'fixtures'), publicDir: false, logLevel: 'silent', cacheDir: join(work, 'cache'),
        resolve: { dedupe: ['lit', 'lit-html', 'lit-element', 'chart.js'], conditions: ['browser', 'production', 'import', 'default'] },
        plugins: [{ name: 'benchmark-package', enforce: 'pre', resolveId(source) { if (source === '@aceshooting/lyra-ui' || source.startsWith('@aceshooting/lyra-ui/')) return resolve(packageDirectory, resolveExport(metadata, source)); return null; } }],
        build: { outDir: destination, emptyOutDir: true, sourcemap: false, minify: true, target: 'es2022', reportCompressedSize: false },
      });
    } catch { throw coded('build-failed'); }
    const hosted = await serve(destination); server = hosted.server;
    const types = { chromium, firefox, webkit, chrome: chromium, edge: chromium };
    for (const report of result.browsers) {
      progress('browser-start', { browser: report.id });
      let browser;
      try {
        try {
          browser = await types[report.id].launch({ headless: options.headless, timeout: 30000, ...(report.id === 'chrome' ? { channel: 'chrome' } : report.id === 'edge' ? { channel: 'msedge' } : {}),
            ...(options.softwareRendering ? { env: { ...process.env, LIBGL_ALWAYS_SOFTWARE: '1' }, ...(report.id === 'firefox' ? { firefoxUserPrefs: { 'webgl.force-enabled': true, 'gfx.webrender.software': true } } : {}) } : {}) });
        } catch { report.status = 'unavailable'; report.code = 'browser-unavailable'; report.scenarios = []; await save(); continue; }
        report.version = browser.version(); report.code = null;
        let context, page, stopEngine = false;
        try {
          context = await browser.newContext({ viewport: result.environment.viewport, deviceScaleFactor: 1, locale: 'en-US', timezoneId: 'UTC', colorScheme: 'light', reducedMotion: 'reduce', serviceWorkers: 'block', acceptDownloads: false });
          let networkBlocks = 0, pageErrors = 0;
          await context.addInitScript(resetState);
          await context.route('**/*', async route => {
            const request = route.request();
            if (new URL(request.url()).origin !== hosted.origin || !['GET', 'HEAD'].includes(request.method())) { networkBlocks++; await route.abort().catch(() => {}); }
            else await route.continue();
          });
          await context.routeWebSocket(/.*/, socket => { networkBlocks++; socket.close(); });
          page = await context.newPage();
          context.on('page', popup => { if (popup !== page) { networkBlocks++; popup.close().catch(() => {}); } });
          page.on('pageerror', () => { pageErrors++; });
          page.on('dialog', dialog => { pageErrors++; dialog.dismiss().catch(() => {}); });
          page.on('crash', () => { stopEngine = true; });
          for (let scenarioIndex = 0; scenarioIndex < selected.length; scenarioIndex++) {
            if (stopEngine) break;
            const scenario = selected[scenarioIndex], measured = report.scenarios[scenarioIndex];
            const startErrors = pageErrors, startBlocks = networkBlocks;
            progress('scenario-start', { browser: report.id, scenario: scenario.id });
            try {
              await page.goto(hosted.origin, { waitUntil: 'load', timeout: 30000 });
              await deadline(page.evaluate(async () => { if (!window.__benchmark || typeof window.__benchmark.run !== 'function') throw new Error('fixture-contract'); await window.__benchmark.ready; }), 30000, 'fixture-not-ready');
              const available = await deadline(page.evaluate(() => window.__benchmark.scenarios.map(scenario => scenario.id)), 10000, 'fixture-contract');
              if (!available.includes(scenario.id)) throw coded('fixture-contract');
              measured.warmupStatus = 'passed';
              for (let index = 0; index < options.warmups + options.samples; index++) {
                const warmup = index < options.warmups;
                let sample;
                try {
                  const raw = await deadline(page.evaluate(({ id, sampleIndex, warmup }) => window.__benchmark.run(id, { sampleIndex, warmup }), { id: scenario.id, sampleIndex: index, warmup }), options.timeoutMs, 'scenario-timeout');
                  sample = normalizeSample(raw, scenario);
                  if (sample.code === 'TIMEOUT') stopEngine = true;
                  const documentBlocks = await deadline(page.evaluate(() => window.__benchmarkNetworkBlocks.count), 5000, 'scenario-timeout');
                  if (pageErrors > startErrors) sample = failureSample('page-error');
                  else if (networkBlocks > startBlocks || documentBlocks) sample = failureSample('network-blocked');
                } catch (error) { sample = failureSample(fixedCode(error)); if (sample.code === 'scenario-timeout') stopEngine = true; }
                if (warmup) measured.warmupStatus = sample.status;
                else measured.samples.push(sample);
                if (sample.status !== 'passed') { measured.status = sample.status; measured.code = sample.code; break; }
                if (!warmup) progress('sample-complete', { browser: report.id, scenario: scenario.id, sample: index - options.warmups + 1 });
              }
              if (measured.samples.length === options.samples && measured.samples.every(sample => sample.status === 'passed') && measured.warmupStatus === 'passed') { measured.status = 'passed'; measured.code = null; }
            } catch (error) {
              measured.status = 'failed'; measured.code = fixedCode(error);
              if (['scenario-timeout', 'fixture-not-ready'].includes(measured.code)) stopEngine = true;
            }
            report.status = browserStatus(report); await save();
            progress('scenario-complete', { browser: report.id, scenario: scenario.id, status: measured.status, code: measured.code });
          }
        } catch { report.status = 'failed'; report.code = 'setup-failed'; }
        finally { if (context) { try { await deadline(context.close(), 10000, 'cleanup-failed'); } catch { report.status = 'failed'; report.code = 'cleanup-failed'; } } }
      } finally {
        if (browser) {
          try { await deadline(browser.close(), 10000, 'cleanup-failed'); }
          catch { report.status = 'failed'; report.code = 'cleanup-failed'; await save(); throw coded('cleanup-failed'); }
        }
        await save(); progress('browser-complete', { browser: report.id, status: report.status });
      }
    }
  } catch (error) {
    for (const browser of result.browsers.filter(item => item.status === 'incomplete' && item.code === 'not-run')) { browser.status = 'failed'; browser.code = fixedCode(error); }
    await save(); throw error;
  } finally {
    if (server) { server.closeAllConnections(); await new Promise(resolveClosed => server.close(resolveClosed)); }
    await rm(work, { recursive: true, force: true });
  }
  progress('complete', { status: result.status });
  return result.status === 'passed' ? 0 : result.status === 'failed' ? 1 : 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const options = parseOptions(process.argv.slice(2));
    if (options.help) process.stdout.write('Usage: node benchmarks/run.mjs [--profile quick|stress] [--browsers chromium,firefox,webkit,chrome,edge] [--samples 7] [--warmups 1] [--timeout-ms 30000] [--scenarios ID,...] [--package-dir DIR] [--output FILE] [--headed] [--software-rendering]\n');
    else process.exitCode = await run(options);
  } catch (error) { process.stderr.write(`Benchmark stopped: ${fixedCode(error)}.\n`); process.exitCode = 3; }
}
