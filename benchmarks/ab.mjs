#!/usr/bin/env node
// Release-time A/B comparison of the built package against a published one with tachometer.
//
//   pnpm --filter @aceshooting/lyra-ui build
//   pnpm benchmark:ab [--published latest] [--workloads button,data-grid,virtual-list] [--fail-above 10]
//
// The exit status is the release gate (the "A/B benchmark" job of the Quality tools workflow): it is 1
// when tachometer's 95% confidence interval of a workload's slowdown (local relative to published) lies
// entirely above `--fail-above` percent (default 10), or when a workload produced no interval at all.
// An interval that merely reaches past the limit is inconclusive: a warning, not a failure.
//
// Tachometer interleaves the two variants in one browser session and keeps sampling until the
// confidence interval of the difference excludes zero (or the timeout passes), which answers "is B
// different from A, and by how much" far better than two saved runs compared across time. It is a
// complement to `benchmarks/run.mjs`, not a replacement: that harness owns phases, semantic checks and
// the regression rule. Run this on a quiet machine; a shared CI runner only resolves large changes.
//
// Tachometer is NOT a dependency: it runs through `npx` at the version pinned below. It ignores
// package.json `exports`/`imports` maps, so both variants are bundled first with the repository's
// esbuild, each from inside its own `node_modules`, and tachometer only compares two plain pages.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const TACHOMETER_VERSION = '0.7.2';
/** A workload fails the gate when it is slower than the published release by more than this, with 95% confidence. */
export const DEFAULT_FAIL_ABOVE_PERCENT = 10;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const libraryDirectory = join(root, 'packages', 'lyra-ui');

const entryButton = `import '@aceshooting/lyra-ui/components/lr-button.js';
export async function run(bench) {
  await customElements.whenDefined('lr-button');
  const host = document.getElementById('host');
  const fragment = document.createDocumentFragment();
  const elements = [];
  bench.start();
  for (let index = 0; index < 1000; index++) {
    const button = document.createElement('lr-button');
    button.textContent = 'Button ' + index;
    fragment.append(button);
    elements.push(button);
  }
  host.append(fragment);
  await Promise.all(elements.map((element) => element.updateComplete));
  bench.stop();
  if (!elements.every((element) => element.shadowRoot && element.shadowRoot.querySelector('button, [part~="base"]'))) {
    throw new Error('lr-button workload did not render 1000 real buttons');
  }
}
`;
const entryDataGrid = `import '@aceshooting/lyra-ui/components/lr-data-grid.js';
export async function run(bench) {
  await customElements.whenDefined('lr-data-grid');
  const grid = document.createElement('lr-data-grid');
  grid.label = 'Benchmark grid';
  grid.setAttribute('row-key', 'id');
  grid.style.blockSize = '480px';
  grid.columns = [{ field: 'name', label: 'Name' }, { field: 'group', label: 'Group' }, { id: 'amount', label: 'Amount', value: (row) => row.amount }];
  document.getElementById('host').append(grid);
  await grid.updateComplete;
  const rows = Array.from({ length: 10000 }, (_, index) => ({ id: index, name: 'Row ' + index, group: 'g' + (index % 10), amount: (index * 37) % 1000 }));
  bench.start();
  grid.data = rows;
  await grid.updateComplete;
  bench.stop();
  const mounted = grid.shadowRoot.querySelectorAll('[part~="row"]').length;
  if (grid.data.length !== 10000 || mounted < 5) throw new Error('lr-data-grid workload did not admit 10000 rows');
}
`;
const entryVirtualList = `import { html } from 'lit';
import '@aceshooting/lyra-ui/components/lr-virtual-list.js';
export async function run(bench) {
  await customElements.whenDefined('lr-virtual-list');
  const list = document.createElement('lr-virtual-list');
  list.setAttribute('row-height', '32');
  list.style.blockSize = '480px';
  list.renderItem = (item) => html\`<div>\${item.name} - \${item.group}</div>\`;
  document.getElementById('host').append(list);
  await list.updateComplete;
  const items = Array.from({ length: 10000 }, (_, index) => ({ id: index, name: 'Row ' + index, group: 'g' + (index % 10) }));
  bench.start();
  list.items = items;
  await list.updateComplete;
  bench.stop();
  const mounted = list.shadowRoot.querySelectorAll('[role="listitem"]').length;
  if (list.items.length !== 10000 || mounted < 5) throw new Error('lr-virtual-list workload did not admit 10000 items');
}
`;

/** The timed regions: each asserts, after `bench.stop()`, that real work happened (a wrong page must fail, not look fast). */
export const WORKLOADS = Object.freeze({
  button: { title: 'create and upgrade 1,000 lr-button', entry: entryButton },
  'data-grid': { title: 'assign 10,000 rows to lr-data-grid', entry: entryDataGrid },
  'virtual-list': { title: 'assign 10,000 items to lr-virtual-list', entry: entryVirtualList },
});

export const workloadPage = (workload) => `<!doctype html>
<meta charset="utf-8">
<div id="host" style="inline-size:900px;block-size:480px"></div>
<script type="module">
  import * as bench from '/bench.js';
  import { run } from './${workload}.js';
  await run(bench);
</script>
`;

/** One tachometer configuration comparing the published and the local build of a workload. */
export function tachometerConfig({ workload, publishedVersion, localVersion, sampleSize, timeoutMinutes, autoSampleConditions, browserBinary }) {
  const browser = {
    name: 'chrome',
    headless: true,
    ...(browserBinary ? { binary: browserBinary } : {}),
    addArguments: ['--no-sandbox', '--disable-dev-shm-usage'],
  };
  return {
    $schema: 'https://raw.githubusercontent.com/Polymer/tachometer/master/config.schema.json',
    root: '.',
    resolveBareModules: false,
    sampleSize,
    timeout: timeoutMinutes,
    autoSampleConditions,
    benchmarks: [
      { name: `${workload} [published ${publishedVersion}]`, url: `suite/published/${workload}.html`, browser },
      { name: `${workload} [local ${localVersion}]`, url: `suite/local/${workload}.html`, browser },
    ],
  };
}

/** The difference line for the local build, from tachometer's JSON results (null when it has none). */
export function summarizeResult(results) {
  const local = results.find((result) => result.name.includes('[local'));
  const published = results.find((result) => result.name.includes('[published'));
  if (!local || !published) return null;
  // `mean` is the confidence interval of the mean; `differences` lists this build against every
  // benchmark in config order (null against itself), so the first non-null entry is local vs published.
  const mean = (result) => (result.mean ? (result.mean.low + result.mean.high) / 2 : null);
  const versus = local.differences?.find((difference) => difference) ?? null;
  return {
    published: mean(published),
    local: mean(local),
    percent: versus?.percentChange ? { low: versus.percentChange.low, high: versus.percentChange.high } : null,
    milliseconds: versus?.absolute ? { low: versus.absolute.low, high: versus.absolute.high } : null,
  };
}

/**
 * Where the local build's slowdown interval lies against the limit. `percent` is tachometer's
 * confidence interval of (local - published) / published, so positive means the local build is slower.
 */
export function judgeWorkload(summary, failAbovePercent = DEFAULT_FAIL_ABOVE_PERCENT) {
  if (!summary?.percent) return { verdict: 'no-interval' };
  const { low, high } = summary.percent;
  if (low > failAbovePercent) return { verdict: 'regression' };
  if (high > failAbovePercent) return { verdict: 'inconclusive' };
  return { verdict: low > 0 ? 'slower' : 'ok' };
}

const fixed = (value) => (value === null || value === undefined ? '-' : value.toFixed(2));

function verdictText(summary, verdict, failAbovePercent) {
  if (verdict === 'regression') return `**regression**: slower by at least ${fixed(summary.percent.low)}% (limit ${failAbovePercent}%)`;
  if (verdict === 'inconclusive') return `inconclusive: may be slower by up to ${fixed(summary.percent.high)}% (limit ${failAbovePercent}%)`;
  if (verdict === 'slower') return `slower, within the ${failAbovePercent}% limit`;
  if (verdict === 'ok') return 'no regression';
  return 'no interval: cannot judge';
}

export function renderSummary(rows, { failAbovePercent = DEFAULT_FAIL_ABOVE_PERCENT } = {}) {
  const out = [
    '## A/B benchmark (tachometer)', '',
    'Interleaved samples in one browser session; the interval is for the local build relative to the published one. An interval that includes 0 means no detectable difference at this sample size.', '',
    `The job fails when the 95% interval of a workload's slowdown lies entirely above ${failAbovePercent}%, or when a workload produced no interval; an interval that reaches past ${failAbovePercent}% but also includes smaller values is inconclusive and only warns.`, '',
    '| Workload | Published mean | Local mean | Difference (ms) | Difference (%) | Verdict |', '|---|---|---|---|---|---|',
  ];
  for (const { title, summary } of rows) {
    if (!summary) { out.push(`| ${title} | - | - | no result | no result | ${verdictText(summary, 'no-interval', failAbovePercent)} |`); continue; }
    const range = (value) => (value ? `${fixed(value.low)} to ${fixed(value.high)}` : '-');
    const { verdict } = judgeWorkload(summary, failAbovePercent);
    out.push(`| ${title} | ${fixed(summary.published)} ms | ${fixed(summary.local)} ms | ${range(summary.milliseconds)} | ${range(summary.percent)} | ${verdictText(summary, verdict, failAbovePercent)} |`);
  }
  return `${out.join('\n')}\n`;
}

// GitHub workflow commands end at the first newline; `%` and newlines in the message are escaped.
const escapeData = (value) => String(value).replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');

/** The summary, the workflow-command annotations and the exit status for the finished workloads (no I/O). */
export function evaluateAb({ rows, failAbovePercent = DEFAULT_FAIL_ABOVE_PERCENT }) {
  const annotations = [];
  let failed = false;
  for (const { title, summary } of rows) {
    const { verdict } = judgeWorkload(summary, failAbovePercent);
    if (verdict === 'regression') {
      failed = true;
      annotations.push(`::error title=A/B benchmark regression::${escapeData(`${title} is slower than the published release by ${fixed(summary.percent.low)}% to ${fixed(summary.percent.high)}% (95% interval), above the ${failAbovePercent}% limit.`)}`);
    } else if (verdict === 'no-interval') {
      failed = true;
      annotations.push(`::error title=A/B benchmark has no interval::${escapeData(`${title} produced no confidence interval, so it cannot be judged.`)}`);
    } else if (verdict === 'inconclusive') {
      annotations.push(`::warning title=A/B benchmark inconclusive::${escapeData(`${title} may be slower than the published release by up to ${fixed(summary.percent.high)}% (limit ${failAbovePercent}%): rerun on a quieter runner or raise --timeout.`)}`);
    }
  }
  return { markdown: renderSummary(rows, { failAbovePercent }), annotations, exitCode: failed ? 1 : 0 };
}

/** Accepts `--flag value` and `--flag=value` (a value may itself start with a dash, as `-5%` does). */
export function splitFlags(argv) {
  return argv.flatMap((argument) => {
    const at = argument.indexOf('=');
    return argument.startsWith('--') && at > 0 ? [argument.slice(0, at), argument.slice(at + 1)] : [argument];
  });
}

export function parseArguments(rawArguments) {
  const argv = splitFlags(rawArguments);
  const options = {
    published: 'latest', workloads: Object.keys(WORKLOADS), sampleSize: 60, timeoutMinutes: 4,
    autoSampleConditions: ['0%'], browserBinary: undefined, failAbovePercent: DEFAULT_FAIL_ABOVE_PERCENT,
    outputDir: join(root, 'benchmarks', '.work', 'ab'), summary: process.env.GITHUB_STEP_SUMMARY,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = () => {
      const next = argv[index + 1];
      if (next === undefined) throw new Error(`${flag} needs a value.`);
      index += 1;
      return next;
    };
    if (flag === '--published') options.published = value();
    else if (flag === '--workloads') options.workloads = value().split(',').filter(Boolean);
    else if (flag === '--sample-size') options.sampleSize = Number(value());
    else if (flag === '--timeout') options.timeoutMinutes = Number(value());
    else if (flag === '--auto-sample-conditions') options.autoSampleConditions = value().split(',').filter(Boolean);
    else if (flag === '--fail-above') {
      const text = value();
      options.failAbovePercent = text.trim() === '' ? Number.NaN : Number(text);
    } else if (flag === '--browser-binary') options.browserBinary = resolve(value());
    else if (flag === '--output-dir') options.outputDir = resolve(value());
    else if (flag === '--summary') options.summary = resolve(value());
    else throw new Error(`Unknown option ${flag}.`);
  }
  for (const workload of options.workloads) if (!WORKLOADS[workload]) throw new Error(`Unknown workload ${workload}; choose from ${Object.keys(WORKLOADS).join(', ')}.`);
  if (!Number.isInteger(options.sampleSize) || options.sampleSize < 10) throw new Error('--sample-size must be an integer of at least 10.');
  if (!(options.timeoutMinutes > 0)) throw new Error('--timeout must be a positive number of minutes.');
  if (!Number.isFinite(options.failAbovePercent) || options.failAbovePercent < 0) throw new Error('--fail-above must be a non-negative percentage, for example 10.');
  return options;
}

/** The installed version of `name` as the library resolves it, even when its `exports` hide package.json. */
export function installedVersion(requireFromLibrary, name) {
  let directory = dirname(requireFromLibrary.resolve(name));
  for (;;) {
    const manifest = join(directory, 'package.json');
    if (existsSync(manifest)) {
      const parsed = JSON.parse(readFileSync(manifest, 'utf8'));
      if (parsed.name === name) return parsed.version;
    }
    const parent = dirname(directory);
    if (parent === directory) throw new Error(`Cannot find the installed version of ${name}.`);
    directory = parent;
  }
}

function run(command, args, { cwd, label, capture = false } = {}) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit', maxBuffer: 64 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label ?? command} failed with exit code ${result.status}.`);
  return result.stdout;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (!existsSync(join(libraryDirectory, 'dist'))) throw new Error('packages/lyra-ui/dist is missing: run `pnpm --filter @aceshooting/lyra-ui build` first.');
  const library = JSON.parse(readFileSync(join(libraryDirectory, 'package.json'), 'utf8'));
  const requireFromLibrary = createRequire(join(libraryDirectory, 'package.json'));
  const esbuild = createRequire(requireFromLibrary.resolve('@web/dev-server-esbuild'))('esbuild');
  const publishedVersion = options.published === 'latest'
    ? run('npm', ['view', '@aceshooting/lyra-ui', 'version'], { capture: true, label: 'npm view' }).trim()
    : options.published;
  // Both installs pin the dependency versions the workspace resolves, so the comparison sees the same Lit.
  const pins = Object.fromEntries(Object.keys(library.dependencies ?? {})
    .filter((name) => !String(library.dependencies[name]).startsWith('workspace:') && !name.startsWith('@types/'))
    .map((name) => [name, installedVersion(requireFromLibrary, name)]));
  pins.lit ??= installedVersion(requireFromLibrary, 'lit');

  rmSync(options.outputDir, { recursive: true, force: true });
  mkdirSync(options.outputDir, { recursive: true });
  const variants = {
    published: { '@aceshooting/lyra-ui': publishedVersion, ...pins },
    local: { ...pins },
  };
  for (const [variant, dependencies] of Object.entries(variants)) {
    const directory = join(options.outputDir, variant);
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, 'package.json'), JSON.stringify({ name: `ab-${variant}`, private: true, type: 'module', dependencies }));
    run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--loglevel=error'], { cwd: directory, label: `npm install (${variant})` });
  }
  // The local build is copied (not linked) so a concurrent rebuild cannot change the measured bytes.
  const installed = join(options.outputDir, 'local', 'node_modules', '@aceshooting', 'lyra-ui');
  mkdirSync(installed, { recursive: true });
  cpSync(join(libraryDirectory, 'dist'), join(installed, 'dist'), { recursive: true });
  const { name, version, type, imports, exports, sideEffects } = library;
  writeFileSync(join(installed, 'package.json'), JSON.stringify({ name, version, type, imports, exports, sideEffects }));

  let browserBinary = options.browserBinary;
  if (!browserBinary) {
    const { chromium } = createRequire(join(root, 'package.json'))('playwright');
    browserBinary = chromium.executablePath();
  }
  const rows = [];
  for (const workload of options.workloads) {
    for (const variant of Object.keys(variants)) {
      const directory = join(options.outputDir, variant);
      mkdirSync(join(directory, 'entries'), { recursive: true });
      writeFileSync(join(directory, 'entries', `${workload}.js`), WORKLOADS[workload].entry);
      mkdirSync(join(options.outputDir, 'suite', variant), { recursive: true });
      await esbuild.build({
        entryPoints: [join(directory, 'entries', `${workload}.js`)],
        bundle: true, format: 'esm', target: 'es2022', platform: 'browser', minify: true,
        outfile: join(options.outputDir, 'suite', variant, `${workload}.js`),
        absWorkingDir: directory, logLevel: 'warning', define: { 'process.env.NODE_ENV': '"production"' },
      });
      writeFileSync(join(options.outputDir, 'suite', variant, `${workload}.html`), workloadPage(workload));
    }
    const configPath = join(options.outputDir, `${workload}.tachometer.json`);
    const resultPath = join(options.outputDir, `${workload}.result.json`);
    writeFileSync(configPath, JSON.stringify(tachometerConfig({
      workload, publishedVersion, localVersion: version, sampleSize: options.sampleSize,
      timeoutMinutes: options.timeoutMinutes, autoSampleConditions: options.autoSampleConditions, browserBinary,
    }), null, 2));
    console.log(`\n== ${WORKLOADS[workload].title}: published ${publishedVersion} vs local ${version}`);
    run('npx', ['--yes', `tachometer@${TACHOMETER_VERSION}`, '--config', configPath, '--json-file', resultPath], { cwd: options.outputDir, label: 'tachometer' });
    const results = JSON.parse(readFileSync(resultPath, 'utf8')).benchmarks ?? [];
    rows.push({ title: WORKLOADS[workload].title, summary: summarizeResult(results) });
  }
  const { markdown, annotations, exitCode } = evaluateAb({ rows, failAbovePercent: options.failAbovePercent });
  writeFileSync(join(options.outputDir, 'summary.md'), markdown);
  if (options.summary) writeFileSync(options.summary, markdown, { flag: 'a' });
  console.log(`\n${markdown}`);
  for (const line of annotations) console.log(line);
  process.exitCode = exitCode;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
