import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, dirname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import { TOOLING, runCommand, runCoverage } from './coverage.mjs';
import { sourceInventory as scriptInventory } from './lib/node-coverage.mjs';
import { stageScripts } from './lib/staged-script.mjs';
import {
  DOCX_LINE_COVERAGE_FLOOR, DOCX_TOOLING_COVERAGE_FLOOR, assertCoverageTarget, assertToolingTarget, reportCoverage, sourceInventory,
} from './report-coverage.mjs';

async function write(file, content) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, content);
}

async function fixture(context) {
  const root = await mkdtemp(resolve(tmpdir(), 'lyra-docs-coverage-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const code = 'export const value = 1;\n';
  for (const name of ['node', 'editor', 'untouched', 'types', 'view.styles', 'view.test']) {
    const source = resolve(root, `src/${name}.ts`);
    const generated = resolve(root, `.coverage-output/src/${name}.js`);
    const emitted = name === 'types' ? 'export {};\n' : code;
    await write(source, emitted);
    await write(generated, `${emitted}//# sourceMappingURL=${name}.js.map\n`);
    await write(`${generated}.map`, JSON.stringify({
      version: 3, sources: [relative(dirname(generated), source)], sourcesContent: [emitted], names: [], mappings: 'AAAA',
    }));
  }
  const nodeScript = resolve(root, '.coverage-output/src/node.js');
  const raw = count => [{ functionName: '', isBlockCoverage: true,
    ranges: [{ startOffset: 0, endOffset: code.length, count }] }];
  await write(resolve(root, 'coverage/node-v8/node.json'), JSON.stringify({
    result: [{ url: pathToFileURL(nodeScript).href, functions: raw(1) }],
  }));
  const browserScript = resolve(root, '.browser-output/assets/editor.js');
  const browserCode = `${code}//# sourceMappingURL=editor.js.map\n`;
  await write(browserScript, browserCode);
  await write(`${browserScript}.map`, JSON.stringify({
    version: 3, sources: ['../../src/editor.ts'], sourcesContent: [code], names: [], mappings: 'AAAA',
  }));
  await write(resolve(root, 'coverage/browser-v8.json'), JSON.stringify([
    { url: 'http://127.0.0.1:1234/assets/editor.js', source: browserCode, functions: raw(1) },
  ]));
  return root;
}

test('source census includes every runtime file and explains standard exclusions', async context => {
  const root = await fixture(context);
  const inventory = await sourceInventory(root);
  assert.deepEqual(inventory.included.map(entry => relative(root, entry.source)),
    ['src/editor.ts', 'src/node.ts', 'src/untouched.ts', 'src/view.styles.ts']);
  assert.deepEqual(inventory.excluded.map(entry => entry.reason).sort(),
    ['no emitted runtime code', 'test']);
});

test('merged report measures browser editor and retains untouched source at zero', async context => {
  const root = await fixture(context);
  const metadata = await reportCoverage({ root });
  assert.equal(metadata.complete, true);
  assert.deepEqual(metadata.unloaded, ['src/untouched.ts', 'src/view.styles.ts']);
  assert.equal(metadata.fullMetricEnumeration.functions, false);
  assert.equal(metadata.fullMetricEnumeration.branches, false);
  const final = JSON.parse(await readFile(resolve(root, 'coverage/coverage-final.json'), 'utf8'));
  assert.equal(Object.keys(final).length, 4);
  assert.ok(Object.values(final[resolve(root, 'src/editor.ts')].s).some(count => count > 0));
  assert.ok(Object.values(final[resolve(root, 'src/untouched.ts')].s).every(count => count === 0));
  assert.ok(metadata.total.lines.pct < 100);
});

test('multi-source browser remapping counts executed and unexecuted ranges truthfully', async context => {
  const root = await fixture(context);
  const source = 'export function value() { return 1; }\n';
  await write(resolve(root, 'src/editor.ts'), source);
  const generated = resolve(root, '.coverage-output/src/editor.js');
  const sourceMap = JSON.parse(await readFile(`${generated}.map`, 'utf8'));
  sourceMap.sourcesContent = [source];
  await write(`${generated}.map`, JSON.stringify(sourceMap));
  const browserScript = resolve(root, '.browser-output/assets/editor.js');
  await write(browserScript, `${source}//# sourceMappingURL=editor.js.map\n`);
  await write(`${browserScript}.map`, JSON.stringify({
    version: 3, sources: ['../../src/editor.ts', '../../vendor.js'], sourcesContent: [source, ''],
    names: [], mappings: `AAAA${',CAAC'.repeat(source.indexOf('\n'))};AACA`,
  }));
  await write(resolve(root, 'coverage/browser-v8.json'), JSON.stringify([{
    url: 'http://127.0.0.1:1234/assets/editor.js',
    functions: [{ functionName: 'value', isBlockCoverage: true,
      ranges: [{ startOffset: 0, endOffset: source.length, count: 0 }] }],
  }]));
  const metadata = await reportCoverage({ root });
  const final = JSON.parse(await readFile(resolve(root, 'coverage/coverage-final.json'), 'utf8'));
  assert.equal(metadata.browserModules, 1);
  assert.ok(Object.values(final[resolve(root, 'src/editor.ts')].s).every(count => count === 0));
  assert.ok(Object.values(final[resolve(root, 'src/editor.ts')].f).every(count => count === 0));
});

test('missing Node coverage refuses a partial report', async context => {
  const root = await fixture(context);
  await write(resolve(root, 'coverage/node-v8/node.json'), JSON.stringify({ result: [] }));
  await assert.rejects(reportCoverage({ root }), /Node coverage did not measure/u);
});

test('missing browser coverage refuses a unit-only headline', async context => {
  const root = await fixture(context);
  await write(resolve(root, 'coverage/browser-v8.json'), '[]');
  await assert.rejects(reportCoverage({ root }), /Missing Chromium/u);
});

test('missing source compilation refuses a reduced inventory', async context => {
  const root = await fixture(context);
  await rm(resolve(root, '.coverage-output/src/untouched.js'));
  await assert.rejects(sourceInventory(root), { code: 'ENOENT' });
});

test('stale source compilation refuses coverage for different source', async context => {
  const root = await fixture(context);
  await write(resolve(root, 'src/untouched.ts'), 'export const untested = 2;\n');
  await assert.rejects(sourceInventory(root), /Stale source map/u);
});

test('stale type-only compilation cannot silently exclude new runtime code', async context => {
  const root = await fixture(context);
  await write(resolve(root, 'src/types.ts'), 'export const runtime = 2;\n');
  await assert.rejects(sourceInventory(root), /Stale source map/u);
});

test('invalid native coverage counts refuse a misleading report', async context => {
  const root = await fixture(context);
  const file = resolve(root, 'coverage/browser-v8.json');
  const entries = JSON.parse(await readFile(file, 'utf8'));
  entries[0].functions[0].ranges[0].count = -1;
  await write(file, JSON.stringify(entries));
  await assert.rejects(reportCoverage({ root }), /Invalid V8 count/u);
});

test('stale browser bundle refuses coverage for different source', async context => {
  const root = await fixture(context);
  const file = resolve(root, '.browser-output/assets/editor.js.map');
  const map = JSON.parse(await readFile(file, 'utf8'));
  map.sourcesContent[0] = 'export const stale = 0;\n';
  await write(file, JSON.stringify(map));
  await assert.rejects(reportCoverage({ root }), /Stale coverage source map/u);
});

test('stale captured browser script refuses coverage with different emitted offsets', async context => {
  const root = await fixture(context);
  const file = resolve(root, 'coverage/browser-v8.json');
  const entries = JSON.parse(await readFile(file, 'utf8'));
  entries[0].source = `\n${entries[0].source}`;
  await write(file, JSON.stringify(entries));
  await assert.rejects(reportCoverage({ root }), /Stale captured browser script/u);
});

test('generated Vite helpers have no companion source and do not change the census', async context => {
  const root = await fixture(context);
  const file = resolve(root, 'coverage/browser-v8.json');
  const entries = JSON.parse(await readFile(file, 'utf8'));
  for (const name of ['preload-helper', 'rolldown-runtime']) entries.push({
    url: `http://127.0.0.1:1234/assets/${name}-123.js`, source: 'export const helper = 1;', functions: [],
  });
  await write(file, JSON.stringify(entries));
  const metadata = await reportCoverage({ root });
  assert.deepEqual(metadata.generatedBrowserHelpers, ['/assets/preload-helper-123.js', '/assets/rolldown-runtime-123.js']);
  assert.equal(metadata.included.length, 4);
  assert.deepEqual(metadata.unloaded, ['src/untouched.ts', 'src/view.styles.ts']);
});

test('unmapped generated export facade is accounted for without hiding its original source module', async context => {
  const root = await fixture(context);
  const file = resolve(root, 'coverage/browser-v8.json');
  const entries = JSON.parse(await readFile(file, 'utf8'));
  const source = 'import{value as v}from"./editor.js";export{v as value};';
  await write(resolve(root, '.browser-output/assets/facade.js'), source);
  entries.push({ url: 'http://127.0.0.1:1234/assets/facade.js', source, functions: [] });
  await write(file, JSON.stringify(entries));
  const metadata = await reportCoverage({ root });
  assert.deepEqual(metadata.generatedBrowserFacades, ['/assets/facade.js']);
  assert.equal(metadata.included.length, 4);
  assert.equal(metadata.browserModules, 1);
});

test('unmapped local re-export facade preserves original source coverage and the complete census', async context => {
  const root = await fixture(context);
  const file = resolve(root, 'coverage/browser-v8.json');
  const entries = JSON.parse(await readFile(file, 'utf8'));
  const source = 'export{value as createSession}from"./editor.js";';
  await write(resolve(root, '.browser-output/assets/create-session.js'), source);
  entries.push({ url: 'http://127.0.0.1:1234/assets/create-session.js', source, functions: [] });
  await write(file, JSON.stringify(entries));
  const metadata = await reportCoverage({ root });
  assert.deepEqual(metadata.generatedBrowserFacades, ['/assets/create-session.js']);
  assert.equal(metadata.included.length, 4);
  assert.equal(metadata.browserModules, 1);
  assert.deepEqual(metadata.unloaded, ['src/untouched.ts', 'src/view.styles.ts']);
  const final = JSON.parse(await readFile(resolve(root, 'coverage/coverage-final.json'), 'utf8'));
  assert.ok(Object.values(final[resolve(root, 'src/editor.ts')].s).some(count => count > 0));
});

test('unmapped re-exports cannot hide runtime statements or nonlocal modules', async context => {
  const root = await fixture(context);
  const file = resolve(root, 'coverage/browser-v8.json');
  const entries = JSON.parse(await readFile(file, 'utf8'));
  for (const source of [
    'export{value}from"./editor.js";globalThis.hidden = 1;',
    'export{value}from"./editor.js";import("./hidden.js");',
    'export{value}from"./editor.js";import "./hidden.js";',
    'export{value}from"https://example.test/editor.js";',
  ]) {
    await write(resolve(root, '.browser-output/assets/facade.js'), source);
    await write(file, JSON.stringify([...entries,
      { url: 'http://127.0.0.1:1234/assets/facade.js', source, functions: [] },
    ]));
    await assert.rejects(reportCoverage({ root }), /Executable browser chunk lacks source map/u);
  }
});

test('unmapped browser code with actual runtime statements fails closed', async context => {
  const root = await fixture(context);
  const file = resolve(root, 'coverage/browser-v8.json');
  const entries = JSON.parse(await readFile(file, 'utf8'));
  const source = 'export const hidden = () => 1;';
  await write(resolve(root, '.browser-output/assets/hidden.js'), source);
  entries.push({ url: 'http://127.0.0.1:1234/assets/hidden.js', source, functions: [] });
  await write(file, JSON.stringify(entries));
  await assert.rejects(reportCoverage({ root }), /Executable browser chunk lacks source map/u);
});

test('test failures mark diagnostic coverage as incomplete', async context => {
  const root = await fixture(context);
  const metadata = await reportCoverage({ root, browserStatus: 1 });
  assert.equal(metadata.complete, false);
  assert.equal(metadata.browserStatus, 1);
});

test('only TypeScript is classified: declarations are excluded and other files are not sources', async context => {
  const root = await fixture(context);
  await write(resolve(root, 'src/ambient.d.ts'), 'declare const ambient: number;\n');
  await write(resolve(root, 'src/theme.css'), ':host { color: red; }\n');
  const inventory = await sourceInventory(root);
  assert.deepEqual(inventory.included.map(entry => relative(root, entry.source)),
    ['src/editor.ts', 'src/node.ts', 'src/untouched.ts', 'src/view.styles.ts']);
  assert.deepEqual(inventory.excluded.filter(entry => entry.reason === 'type declaration'),
    [{ source: 'src/ambient.d.ts', reason: 'type declaration' }]);
  assert.equal(inventory.excluded.some(entry => entry.source === 'src/theme.css'), false, 'a stylesheet is neither measured nor excluded');
});

test('Node dumps of built-in modules and of compiled tests do not enter the census', async context => {
  const plain = await reportCoverage({ root: await fixture(context) });
  const root = await fixture(context);
  const dumps = resolve(root, 'coverage/node-v8/node.json');
  const dump = JSON.parse(await readFile(dumps, 'utf8'));
  const unused = [{ functionName: '', isBlockCoverage: true, ranges: [{ startOffset: 0, endOffset: 1, count: 1 }] }];
  dump.result.push(
    { url: 'node:internal/process/execution', functions: unused },
    { url: pathToFileURL(resolve(root, '.coverage-output/src/view.test.js')).href, functions: unused },
  );
  await write(dumps, JSON.stringify(dump));
  const metadata = await reportCoverage({ root });
  assert.equal(metadata.nodeModules, 1, 'only the compiled runtime module was measured');
  assert.deepEqual(metadata.total, plain.total);
});

test('browser entries that are not scripts served by the test server are ignored', async context => {
  const root = await fixture(context);
  const file = resolve(root, 'coverage/browser-v8.json');
  const entries = JSON.parse(await readFile(file, 'utf8'));
  const unused = [{ functionName: '', isBlockCoverage: true, ranges: [{ startOffset: 0, endOffset: 1, count: 1 }] }];
  await write(file, JSON.stringify([...entries,
    { url: 'about:blank', functions: unused },
    { url: 'chrome-extension://abcdef/inject.js', functions: unused },
    { url: 'http://127.0.0.1:1234/test/browser.html', functions: unused },
  ]));
  const metadata = await reportCoverage({ root });
  assert.equal(metadata.browserModules, 1);
  assert.deepEqual(metadata.generatedBrowserHelpers, []);
  assert.deepEqual(metadata.generatedBrowserFacades, []);
});

test('a source map that exists but cannot be read is an error, not an unmapped chunk', async context => {
  const root = await fixture(context);
  const map = resolve(root, '.browser-output/assets/editor.js.map');
  await rm(map);
  await mkdir(map);
  await assert.rejects(reportCoverage({ root }), { code: 'EISDIR' });
});

test('a mapped browser chunk whose sources are all outside the census contributes nothing', async context => {
  const root = await fixture(context);
  const file = resolve(root, 'coverage/browser-v8.json');
  const entries = JSON.parse(await readFile(file, 'utf8'));
  const vendor = 'export const vendor = 1;\n';
  const script = resolve(root, '.browser-output/assets/vendor.js');
  await write(script, `${vendor}//# sourceMappingURL=vendor.js.map\n`);
  await write(`${script}.map`, JSON.stringify({
    version: 3, sources: ['../../node_modules/vendor/index.js'], sourcesContent: [vendor], names: [], mappings: 'AAAA',
  }));
  await write(file, JSON.stringify([...entries, { url: 'http://127.0.0.1:1234/assets/vendor.js',
    functions: [{ functionName: '', isBlockCoverage: true, ranges: [{ startOffset: 0, endOffset: vendor.length, count: 1 }] }] }]));
  const plain = await reportCoverage({ root: await fixture(context) });
  const metadata = await reportCoverage({ root });
  assert.equal(metadata.browserModules, 1, 'the vendor chunk is not counted as a measured companion module');
  assert.deepEqual(metadata.total, plain.total);
});

const floorCount = Math.round(DOCX_LINE_COVERAGE_FLOOR * 1000);
function targetMeasurement() {
  return {
    complete: true, fullMetricEnumeration: { lines: true, statements: true },
    total: { lines: { covered: floorCount, total: 100000 }, statements: { covered: floorCount, total: 100000 },
      branches: { covered: 0, total: 100 }, functions: { covered: 0, total: 100 } },
  };
}

test('coverage target accepts the verified line floor without imposing a branch or function target', () => {
  assert.doesNotThrow(() => assertCoverageTarget(targetMeasurement()));
});

test('coverage target checks exact counts rather than rounded or supplied percentages', () => {
  for (const metric of ['lines', 'statements']) {
    const metadata = targetMeasurement();
    metadata.total[metric].covered = floorCount - 1;
    metadata.total[metric].pct = 100;
    assert.throws(() => assertCoverageTarget(metadata), new RegExp(`is below ${DOCX_LINE_COVERAGE_FLOOR}%`, 'u'));
  }
});

test('coverage target refuses incomplete test runs even when their counters pass', () => {
  const metadata = targetMeasurement();
  metadata.complete = false;
  assert.throws(() => assertCoverageTarget(metadata), /Incomplete test runs/u);
});

test('coverage target refuses incomplete source enumerations', () => {
  for (const metric of ['lines', 'statements']) {
    const metadata = targetMeasurement();
    metadata.fullMetricEnumeration[metric] = false;
    assert.throws(() => assertCoverageTarget(metadata), /source census/u);
  }
});

test('coverage target refuses empty or malformed totals', () => {
  for (const counts of [{ total: 0, covered: 0 }, { total: 100, covered: 101 },
    { total: 100, covered: Number.NaN }, { total: Infinity, covered: Infinity }]) {
    const metadata = targetMeasurement();
    metadata.total.lines = counts;
    assert.throws(() => assertCoverageTarget(metadata), /Invalid lines coverage counts/u);
  }
});

const TOOL = 'export function used() {\n  return 1;\n}\nused();\n';

/** Original Node tooling beside the TypeScript, with one script the Node dumps cover and one nothing loads. */
async function addTooling(root, { executed = true } = {}) {
  const tool = resolve(root, 'scripts/tool.mjs');
  await write(tool, TOOL);
  await write(resolve(root, 'scripts/untouched.mjs'), 'export const never = 1;\n');
  await write(resolve(root, 'scripts/tool.test.mjs'), 'export {};\n');
  if (executed) {
    const dumps = resolve(root, 'coverage/node-v8/node.json');
    const dump = JSON.parse(await readFile(dumps, 'utf8'));
    dump.result.push({ url: pathToFileURL(tool).href, functions: [{ functionName: '', isBlockCoverage: true,
      ranges: [{ startOffset: 0, endOffset: TOOL.length, count: 1 }] }] });
    await write(dumps, JSON.stringify(dump));
  }
  return { directories: ['scripts'], include: ['scripts/tool.mjs', 'scripts/untouched.mjs'],
    exclude: [{ pattern: /\.test\.mjs$/u, reason: 'test' }] };
}

test('tooling is measured from the same Node dumps and joins the reports without changing the gated total', async context => {
  const plain = await reportCoverage({ root: await fixture(context) });
  const root = await fixture(context);
  const tooling = await addTooling(root);
  const metadata = await reportCoverage({ root, tooling });
  assert.deepEqual(metadata.total, plain.total, 'the coverage target keeps gating the TypeScript runtime alone');
  assert.deepEqual(metadata.tooling.included, ['scripts/tool.mjs', 'scripts/untouched.mjs']);
  assert.deepEqual(metadata.tooling.excluded.map(({ reason, count }) => ({ reason, count })), [{ reason: 'test', count: 1 }]);
  assert.deepEqual(metadata.tooling.unloaded, ['scripts/untouched.mjs']);
  assert.equal(metadata.tooling.modules, 1);
  assert.equal(metadata.tooling.stagedRuns, 0);
  assert.deepEqual(metadata.tooling.fullMetricEnumeration, { statements: true, lines: true, branches: false, functions: false });
  assert.deepEqual({ covered: metadata.tooling.total.lines.covered, total: metadata.tooling.total.lines.total }, { covered: 4, total: 5 });
  assert.equal(metadata.combined.lines.total, plain.total.lines.total + 5);
  assert.equal(metadata.combined.lines.covered, plain.total.lines.covered + 4);

  const final = JSON.parse(await readFile(resolve(root, 'coverage/coverage-final.json'), 'utf8'));
  assert.equal(Object.keys(final).length, 6);
  assert.ok(Object.values(final[resolve(root, 'scripts/tool.mjs')].s).every(count => count > 0));
  assert.ok(Object.values(final[resolve(root, 'scripts/untouched.mjs')].s).every(count => count === 0));
  const gaps = JSON.parse(await readFile(resolve(root, 'coverage/coverage-gaps.json'), 'utf8'));
  assert.deepEqual(gaps['scripts/untouched.mjs'].uncoveredLines, ['1']);
  assert.deepEqual(gaps['scripts/tool.mjs'].uncoveredLines, []);
});

test('tooling that no Node process executed refuses a report that only looks complete', async context => {
  const root = await fixture(context);
  const tooling = await addTooling(root, { executed: false });
  await assert.rejects(reportCoverage({ root, tooling }), /did not measure any tooling modules/u);
});

test('a script nobody classified refuses the tooling census', async context => {
  const root = await fixture(context);
  const tooling = await addTooling(root);
  await write(resolve(root, 'scripts/new.mjs'), 'export {};\n');
  await assert.rejects(reportCoverage({ root, tooling }), /Unclassified JavaScript source: scripts\/new\.mjs/u);
});

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, '..');

test('every script of the package is either measured or excluded for a stated reason', async () => {
  const { included, excluded } = await scriptInventory({ root: packageRoot, ...TOOLING });
  assert.deepEqual(included.map(entry => entry.name), [...TOOLING.include].sort());
  assert.deepEqual(excluded.map(group => group.reason).sort(), ['browser test suite/harness', 'test']);
  assert.ok(excluded.find(group => group.reason === 'browser test suite/harness').count >= 14);
});

/** A package root plus doubles for the run's collaborators; `statuses[n]` is the exit status of command n. */
async function recordedRun(context, { statuses = {}, compiledTests = ['b.test.js', 'a.test.js', 'helper.js'] } = {}) {
  const root = await mkdtemp(resolve(tmpdir(), 'lyra-docs-run-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  await write(resolve(root, 'coverage/stale.txt'), 'from an earlier run');
  await write(resolve(root, '.coverage-output/stale.txt'), 'from an earlier run');
  const calls = [];
  const reported = [];
  const targets = [];
  const toolingTargets = [];
  const emitSync = file => {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, 'export {};\n');
  };
  const run = (cwd, command, args, environment) => {
    calls.push({ cwd, command, args, environment, scratchExisted: existsSync(resolve(root, 'coverage/tmp')) });
    if (args.includes('tsconfig.test.json')) {
      for (const name of compiledTests) emitSync(resolve(root, '.coverage-output/src/docx', name));
    }
    return statuses[calls.length - 1] ?? 0;
  };
  const metadata = { fake: true };
  return {
    root, calls, reported, targets, toolingTargets, metadata,
    options: {
      root, run,
      report: async options => { reported.push(options); return metadata; },
      assertTarget: measurement => { targets.push(measurement); },
      assertTooling: measurement => { toolingTargets.push(measurement); },
    },
  };
}

test('a coverage run clears earlier output, builds under coverage, runs both suites and gates the result', async context => {
  const { root, calls, reported, targets, toolingTargets, metadata, options } = await recordedRun(context);
  const nodeV8 = resolve(root, 'coverage/node-v8');
  const scratch = resolve(root, 'coverage/tmp');
  const base = { NODE_V8_COVERAGE: nodeV8, TMPDIR: scratch, TMP: scratch, TEMP: scratch };
  assert.deepEqual(await runCoverage(options), { exitCode: 0, metadata });
  assert.equal(existsSync(scratch), false, 'the scratch directory does not outlive the run');
  assert.deepEqual(calls.map(call => call.scratchExisted), [true, true, true, true, true, true], 'every command ran with its scratch directory in place');
  assert.equal(existsSync(resolve(root, 'coverage/stale.txt')), false);
  assert.equal(existsSync(resolve(root, '.coverage-output/stale.txt')), false);
  assert.equal(existsSync(nodeV8), true);
  assert.deepEqual(calls.map(call => [call.command, ...call.args]).slice(0, 3), [
    ['pnpm', 'run', 'build'],
    ['pnpm', 'exec', 'tsc', '--noEmit', '-p', 'tsconfig.exports.json'],
    ['pnpm', 'exec', 'tsc', '-p', 'tsconfig.test.json', '--outDir', '.coverage-output', '--sourceMap', '--inlineSources'],
  ]);
  assert.ok(calls.every(call => call.cwd === root), 'every command runs in the package');
  assert.deepEqual(calls[0].environment, base, 'the build and its package contract are measured');
  assert.deepEqual(calls[1].environment, { TMPDIR: scratch });
  assert.deepEqual(calls[2].environment, { TMPDIR: scratch });

  const unit = calls[3];
  assert.equal(unit.command, process.execPath);
  assert.deepEqual(unit.args.slice(0, 4), ['--test', '--test-concurrency=2',
    resolve(root, '.coverage-output/src/docx/a.test.js'), resolve(root, '.coverage-output/src/docx/b.test.js')]);
  assert.equal(unit.args.includes(resolve(root, '.coverage-output/src/docx/helper.js')), false, 'only test files run');
  assert.deepEqual(unit.environment, base);
  for (const suite of unit.args.slice(4)) {
    assert.equal(existsSync(resolve(packageRoot, suite)), true, `${suite} must exist in the package`);
  }
  for (const suite of ['scripts/package.test.mjs', 'scripts/check-package.test.mjs', 'scripts/coverage.test.mjs', 'scripts/node-coverage.test.mjs', 'scripts/performance.test.mjs', 'scripts/engine/source.test.mjs', 'test/xml.test.mjs']) {
    assert.ok(unit.args.includes(suite), `${suite} runs under coverage`);
  }

  const browser = calls[4];
  assert.deepEqual([browser.command, ...browser.args], [process.execPath, 'scripts/browser-test.mjs']);
  assert.deepEqual(browser.environment, {
    ...base, DOCX_COVERAGE: '1', DOCX_BROWSERS: 'chromium', DOCX_PERFORMANCE: '0',
    DOCX_LAYOUT_ONLY: '', DOCX_FORMATTING_ONLY: '', DOCX_INSERTION_ONLY: '', DOCX_IMAGES_ONLY: '', DOCX_DOCUMENT_TOOLS_ONLY: '',
  });
  const performance = calls[5];
  assert.deepEqual([performance.command, ...performance.args], [process.execPath, 'scripts/performance-browser.mjs']);
  assert.deepEqual(performance.environment, base, 'the performance harness is measured, never timed under the suite');
  assert.equal(calls.length, 6);
  assert.deepEqual(reported, [{ root, unitStatus: 0, browserStatus: 0, tooling: TOOLING }]);
  assert.deepEqual(targets, [metadata]);
  assert.deepEqual(toolingTargets, [metadata]);
});

test('a failing build step ends the run with its status before anything else executes', async context => {
  for (const step of [0, 1, 2]) {
    const { root, calls, reported, targets, options } = await recordedRun(context, { statuses: { [step]: 3 + step } });
    assert.deepEqual(await runCoverage(options), { exitCode: 3 + step });
    assert.equal(calls.length, step + 1);
    assert.deepEqual([reported, targets], [[], []]);
    assert.equal(existsSync(resolve(root, 'coverage/tmp')), false, 'an early exit still removes the scratch directory');
  }
});

test('failed suites still produce a diagnostic report but never reach the coverage target', async context => {
  // [statuses by command index, exit code, commands run, browser-side status reported]
  const cases = [
    [{ 3: 2 }, 2, 6, 0],
    [{ 4: 5 }, 5, 5, 5],
    [{ 3: 2, 4: 5 }, 2, 5, 5],
    [{ 5: 6 }, 6, 6, 6],
    [{ 3: 2, 5: 6 }, 2, 6, 6],
  ];
  for (const [statuses, exitCode, commands, browserStatus] of cases) {
    const { calls, reported, targets, toolingTargets, metadata, options } = await recordedRun(context, { statuses });
    assert.deepEqual(await runCoverage(options), { exitCode, metadata }, JSON.stringify(statuses));
    assert.equal(calls.length, commands, `${JSON.stringify(statuses)}: the browser suite runs after a unit failure; the performance run only after a passing suite`);
    assert.deepEqual(reported.map(entry => [entry.unitStatus, entry.browserStatus]), [[statuses[3] ?? 0, browserStatus]]);
    assert.deepEqual([targets, toolingTargets], [[], []]);
  }
});

test('a run without compiled unit tests is refused instead of measuring nothing', async context => {
  const { root, calls, reported, options } = await recordedRun(context, { compiledTests: ['helper.js'] });
  await assert.rejects(runCoverage(options), /Coverage cannot run without unit test files/u);
  assert.equal(calls.length, 3);
  assert.deepEqual(reported, []);
  assert.equal(existsSync(resolve(root, 'coverage/tmp')), false, 'a refused run still removes the scratch directory');
});

test('a missed coverage target fails the run, for the source and for the tooling alike', async context => {
  const { options } = await recordedRun(context);
  await assert.rejects(runCoverage({ ...options, assertTarget: () => { throw new Error('lines coverage 90% is below 99.6%'); } }),
    /lines coverage 90% is below 99\.6%/u);
  await assert.rejects(runCoverage({ ...options, assertTooling: () => { throw new Error('lines coverage 70% is below 80%'); } }),
    /lines coverage 70% is below 80%/u);
});

const toolingMeasurement = (covered, total = 1000) => ({
  complete: true,
  total: { lines: { covered: 1, total: 1 }, statements: { covered: 1, total: 1 } },
  tooling: { fullMetricEnumeration: { lines: true, statements: true }, total: { lines: { covered, total }, statements: { covered, total } } },
});

test('the tooling floor gates the tooling counters alone, with the same exact arithmetic', () => {
  const floor = DOCX_TOOLING_COVERAGE_FLOOR * 10;
  assert.doesNotThrow(() => assertToolingTarget(toolingMeasurement(floor)));
  const justBelow = (DOCX_TOOLING_COVERAGE_FLOOR - 0.1).toFixed(3);
  assert.throws(() => assertToolingTarget(toolingMeasurement(floor - 1)), new RegExp(`lines coverage ${justBelow.replace('.', '\\.')}% is below ${DOCX_TOOLING_COVERAGE_FLOOR}%`, 'u'));
  // A perfect TypeScript runtime cannot compensate for weak tooling.
  assert.throws(() => assertToolingTarget(toolingMeasurement(0)), new RegExp(`below ${DOCX_TOOLING_COVERAGE_FLOOR}%`, 'u'));
});

test('the tooling floor needs measured tooling and a complete run', () => {
  assert.throws(() => assertToolingTarget({ complete: true, total: {} }), /Tooling coverage was not measured/u);
  assert.throws(() => assertToolingTarget({ ...toolingMeasurement(1000), complete: false }), /Incomplete test runs/u);
  const partial = toolingMeasurement(1000);
  partial.tooling.fullMetricEnumeration.lines = false;
  assert.throws(() => assertToolingTarget(partial), /Incomplete lines source census/u);
});

test('an explicit floor overrides the source default', () => {
  const measurement = { complete: true, fullMetricEnumeration: { lines: true, statements: true },
    total: { lines: { covered: 900, total: 1000 }, statements: { covered: 900, total: 1000 } } };
  assert.doesNotThrow(() => assertCoverageTarget(measurement, 90));
  assert.throws(() => assertCoverageTarget(measurement), new RegExp(`is below ${DOCX_LINE_COVERAGE_FLOOR}%`, 'u'));
});

test('commands run in the package with the extra environment and report their exit status', async context => {
  const root = await mkdtemp(resolve(tmpdir(), 'lyra-docs-command-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const node = (...args) => runCommand(root, process.execPath, args);
  assert.equal(node('-e', 'process.exit(0)'), 0);
  assert.equal(node('-e', 'process.exit(7)'), 7);
  assert.equal(runCommand(root, process.execPath, ['-e', 'process.exit(process.env.RUN_COMMAND_FLAG === "yes" ? 0 : 9)'], { RUN_COMMAND_FLAG: 'yes' }), 0);
  assert.equal(runCommand(root, process.execPath, ['-e', 'process.exit(process.cwd() === process.argv[1] ? 0 : 4)', root]), 0);
  assert.throws(() => node('-e', 'process.kill(process.pid, "SIGKILL")'), /terminated by SIGKILL/u);
  assert.throws(() => runCommand(root, 'lyra-docs-no-such-command', []), { code: 'ENOENT' });
});

test('started as a script, the entry point adopts the exit status of the run and leaves nothing behind', async context => {
  const root = realpathSync(await mkdtemp(resolve(tmpdir(), 'lyra-docs-entry-')));
  context.after(() => rm(root, { recursive: true, force: true }));
  const [entry] = stageScripts({ from: packageRoot, to: root, files: [
    'scripts/coverage.mjs', 'scripts/report-coverage.mjs', 'scripts/lib/node-coverage.mjs',
    'scripts/lib/static-files.mjs', 'scripts/lib/staged-script.mjs',
  ] });
  await symlink(resolve(packageRoot, 'node_modules'), resolve(root, 'node_modules'));
  // A stand-in package manager: it records its arguments and fails the first build step.
  const log = resolve(root, 'pnpm.log');
  const pnpm = resolve(root, 'bin/pnpm');
  await write(pnpm, `#!/bin/sh\necho "$@" >> '${log}'\nexit 7\n`);
  chmodSync(pnpm, 0o755);
  await write(resolve(root, 'coverage/stale.txt'), 'from an earlier run');
  const result = spawnSync(process.execPath, [entry], {
    cwd: root, encoding: 'utf8', env: { ...process.env, PATH: `${resolve(root, 'bin')}${delimiter}${process.env.PATH}` },
  });
  assert.equal(result.status, 7, result.stderr);
  assert.equal(await readFile(log, 'utf8'), 'run build\n', 'the run stopped at the failing build step');
  assert.equal(existsSync(resolve(root, 'coverage/stale.txt')), false, 'earlier output was cleared');
  assert.equal(existsSync(resolve(root, 'coverage/tmp')), false, 'the scratch directory was removed');
});
