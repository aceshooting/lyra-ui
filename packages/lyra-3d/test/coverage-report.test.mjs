import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { initialize, resolve as resolveHook } from '../scripts/coverage-redirect-hooks.mjs';
import { LYRA_3D_COVERAGE_FLOOR, assertCoverageTarget, reportCoverage, sourceInventory } from '../scripts/report-coverage.mjs';

async function write(file, content) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, content);
}

// The text reporter prints its table to the test output; the artifact reporters are enough here.
const QUIET = ['json', 'json-summary', 'lcovonly', 'html'];
const CODE = 'export const value = 1;\n';
const ranges = (count, length = CODE.length) => [{ functionName: '', isBlockCoverage: true, ranges: [{ startOffset: 0, endOffset: length, count }] }];

/** A package-shaped tree: two runtime modules, one type-only module and one declaration file. */
async function fixture(t) {
  const base = await mkdtemp(resolve(tmpdir(), 'lyra-3d-coverage-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  for (const name of ['a', 'b', 'types']) {
    const content = name === 'types' ? 'export {};\n' : CODE;
    const source = resolve(base, `src/${name}.ts`);
    const generated = resolve(base, `coverage/build/dist/${name}.js`);
    await write(source, content);
    await write(generated, `${content}//# sourceMappingURL=${name}.js.map\n`);
    await write(`${generated}.map`, JSON.stringify({ version: 3, sources: [relative(dirname(generated), source)], sourcesContent: [content], names: [], mappings: 'AAAA' }));
  }
  await write(resolve(base, 'src/globals.d.ts'), 'declare const ambient: number;\n');
  await write(resolve(base, 'coverage/node-v8/a.json'), JSON.stringify({
    result: [{ url: pathToFileURL(resolve(base, 'coverage/build/dist/a.js')).href, functions: ranges(1) }, { url: 'node:internal/process', functions: [] }],
  }));
  return base;
}

/** Adds a Chromium page that executed module b. */
async function addBrowserPage(base, count = 1) {
  const script = resolve(base, 'coverage/browser-scratch/out/assets/index.js');
  await write(script, `${CODE}//# sourceMappingURL=index.js.map\n`);
  await write(`${script}.map`, JSON.stringify({ version: 3, sources: [relative(dirname(script), resolve(base, 'src/b.ts'))], sourcesContent: [CODE], names: [], mappings: 'AAAA' }));
  await write(resolve(base, 'coverage/browser-v8/page-0001.json'), JSON.stringify([
    { url: 'http://127.0.0.1:1234/assets/index.js', functions: ranges(count) },
    { url: 'http://127.0.0.1:1234/favicon.ico', functions: [] },
  ]));
  return script;
}

test('the census lists runtime modules and explains every exclusion', async (t) => {
  const base = await fixture(t);
  const inventory = await sourceInventory(base);
  assert.deepEqual(inventory.included.map(({ source }) => relative(base, source)), ['src/a.ts', 'src/b.ts']);
  assert.deepEqual(inventory.excluded, [
    { source: 'src/globals.d.ts', reason: 'type declaration' },
    { source: 'src/types.ts', reason: 'no emitted runtime code' },
  ]);
});

test('a missing, stale or unmapped compilation refuses a reduced census', async (t) => {
  const missing = await fixture(t);
  await rm(resolve(missing, 'coverage/build/dist/b.js'));
  await assert.rejects(sourceInventory(missing), { code: 'ENOENT' });
  const stale = await fixture(t);
  await write(resolve(stale, 'src/b.ts'), 'export const value = 2;\n');
  await assert.rejects(sourceInventory(stale), /Stale source map: src\/b\.ts/u);
  const staleTypes = await fixture(t);
  await write(resolve(staleTypes, 'src/types.ts'), 'export const runtime = 1;\n');
  await assert.rejects(sourceInventory(staleTypes), /Stale source map: src\/types\.ts/u);
  const misdirected = await fixture(t);
  const mapFile = resolve(misdirected, 'coverage/build/dist/a.js.map');
  const map = JSON.parse(await readFile(mapFile, 'utf8'));
  map.sources = ['../../../src/b.ts'];
  await write(mapFile, JSON.stringify(map));
  await assert.rejects(sourceInventory(misdirected), /Source map mismatch: src\/a\.ts/u);
  map.sources = ['../../../src/a.ts', '../../../src/b.ts'];
  await write(mapFile, JSON.stringify(map));
  await assert.rejects(sourceInventory(misdirected), /Expected one original source/u);
});

test('a unit-only report credits loaded modules, enrolls unloaded ones at zero and writes every artifact', async (t) => {
  const base = await fixture(t);
  const metadata = await reportCoverage({ base, reporters: QUIET });
  assert.equal(metadata.complete, true, 'a unit-only run is complete for the passes it ran');
  assert.equal(metadata.browserStatus, null);
  assert.equal(metadata.nodeModules, 1);
  assert.equal(metadata.browserModules, 0);
  assert.deepEqual(metadata.unloaded, ['src/b.ts']);
  assert.deepEqual(metadata.fullMetricEnumeration, { statements: true, lines: true, branches: false, functions: false });
  assert.ok(metadata.total.lines.covered > 0 && metadata.total.lines.covered < metadata.total.lines.total);
  const final = JSON.parse(await readFile(resolve(base, 'coverage/coverage-final.json'), 'utf8'));
  assert.deepEqual(Object.keys(final).sort(), [resolve(base, 'src/a.ts'), resolve(base, 'src/b.ts')]);
  assert.ok(Object.values(final[resolve(base, 'src/b.ts')].s).every((count) => count === 0));
  const gaps = JSON.parse(await readFile(resolve(base, 'coverage/coverage-gaps.json'), 'utf8'));
  assert.ok(gaps['src/b.ts'].uncoveredLines.length > 0);
  assert.deepEqual(gaps['src/a.ts'].uncoveredLines, []);
  for (const artifact of ['coverage-summary.json', 'coverage-metadata.json', 'lcov.info', 'index.html']) await readFile(resolve(base, 'coverage', artifact));
});

test('Chromium pages are merged onto the same sources and complete the census', async (t) => {
  const base = await fixture(t);
  await addBrowserPage(base);
  const metadata = await reportCoverage({ base, reporters: QUIET, browserStatus: 0 });
  assert.equal(metadata.complete, true);
  assert.equal(metadata.browserModules, 1);
  assert.equal(metadata.browserPages, 1);
  assert.deepEqual(metadata.unloaded, []);
  assert.deepEqual(metadata.fullMetricEnumeration, { statements: true, lines: true, branches: true, functions: true });
  assert.equal(metadata.total.lines.pct, 100);
});

test('a module both collectors ran gains line hits from Chromium but keeps the unit run\'s functions and branches', async (t) => {
  const base = await fixture(t);
  const original = 'export function value() { return 1; }\n';
  await write(resolve(base, 'src/a.ts'), original);
  // Each collector reports the one function from a different column, as a compiler's output and a
  // bundle do, so merging them by location would list the function twice.
  const functions = (count, start, functionCount) => [
    { functionName: '', isBlockCoverage: true, ranges: [{ startOffset: 0, endOffset: original.length, count }] },
    { functionName: 'value', isBlockCoverage: true, ranges: [{ startOffset: start, endOffset: 33, count: functionCount }] },
  ];
  const mappings = 'AAAA,OAAO';
  const generated = resolve(base, 'coverage/build/dist/a.js');
  await write(generated, `${original}//# sourceMappingURL=a.js.map\n`);
  await write(`${generated}.map`, JSON.stringify({ version: 3, sources: ['../../../src/a.ts'], sourcesContent: [original], names: [], mappings }));
  await write(resolve(base, 'coverage/node-v8/a.json'), JSON.stringify({ result: [{ url: pathToFileURL(generated).href, functions: functions(1, 7, 3) }] }));
  const coverageOf = async (options) => {
    const metadata = await reportCoverage({ base, reporters: QUIET, ...options });
    const final = JSON.parse(await readFile(resolve(base, 'coverage/coverage-final.json'), 'utf8'));
    return { metadata, a: final[resolve(base, 'src/a.ts')] };
  };
  const unit = await coverageOf({});
  assert.equal(unit.metadata.collectors.browser.lines.total, 0, 'no Chromium pass yet');

  const script = resolve(base, 'coverage/browser-scratch/out/assets/a-bundle.js');
  await write(script, `${original}//# sourceMappingURL=a-bundle.js.map\n`);
  await write(`${script}.map`, JSON.stringify({ version: 3, sources: [relative(dirname(script), resolve(base, 'src/a.ts'))], sourcesContent: [original], names: [], mappings }));
  await write(resolve(base, 'coverage/browser-v8/page-0002.json'), JSON.stringify([
    { url: 'http://127.0.0.1:1234/assets/a-bundle.js', functions: functions(2, 0, 5) },
  ]));
  await addBrowserPage(base);
  const both = await coverageOf({ browserStatus: 0 });
  const [hits] = Object.values(unit.a.s);
  assert.equal(Object.keys(both.a.s).length, 1, 'the line is one statement');
  assert.ok(Object.values(both.a.s)[0] > hits, 'Chromium running the line adds to the unit tests\' count');
  assert.deepEqual([both.a.fnMap, both.a.f], [unit.a.fnMap, unit.a.f], 'the function is listed once, with the unit run\'s count');
  assert.deepEqual([both.a.branchMap, both.a.b], [unit.a.branchMap, unit.a.b]);
  assert.equal(Object.values(both.a.f)[0], 3);
  const { collectors, total } = both.metadata;
  assert.equal(collectors.browser.functions.total, 1, 'Chromium alone also lists that function');
  assert.equal(total.functions.total, collectors.unit.functions.total, 'and the combined report still counts it once');
  assert.equal(total.lines.total, collectors.unit.lines.total + collectors.browser.lines.total - 1, 'a line both collectors ran is counted once');
});

test('failed test runs make the report diagnostic only', async (t) => {
  const failedUnit = await fixture(t);
  assert.equal((await reportCoverage({ reporters: QUIET, base: failedUnit, unitStatus: 1 })).complete, false);
  const failedBrowser = await fixture(t);
  await addBrowserPage(failedBrowser);
  const metadata = await reportCoverage({ reporters: QUIET, base: failedBrowser, browserStatus: 1 });
  assert.equal(metadata.complete, false);
  assert.equal(metadata.browserStatus, 1);
});

test('missing or empty measurements refuse a misleading report', async (t) => {
  const nothingMeasured = await fixture(t);
  await write(resolve(nothingMeasured, 'coverage/node-v8/a.json'), JSON.stringify({ result: [] }));
  await assert.rejects(reportCoverage({ reporters: QUIET, base: nothingMeasured }), /did not measure/u);
  const noBrowser = await fixture(t);
  await write(resolve(noBrowser, 'coverage/browser-v8/readme.txt'), 'no pages');
  await assert.rejects(reportCoverage({ reporters: QUIET, base: noBrowser, browserStatus: 0 }), /Missing Chromium/u);
  const pagesWithoutSources = await fixture(t);
  await write(resolve(pagesWithoutSources, 'coverage/browser-v8/page-0001.json'), '[]');
  await assert.rejects(reportCoverage({ reporters: QUIET, base: pagesWithoutSources, browserStatus: 0 }), /did not measure/u);
  const malformed = await fixture(t);
  await write(resolve(malformed, 'coverage/node-v8/a.json'), JSON.stringify({ result: 'none' }));
  await assert.rejects(reportCoverage({ reporters: QUIET, base: malformed }), /Invalid Node coverage/u);
  const malformedPage = await fixture(t);
  await write(resolve(malformedPage, 'coverage/browser-v8/page-0001.json'), '{}');
  await assert.rejects(reportCoverage({ reporters: QUIET, base: malformedPage, browserStatus: 0 }), /Invalid Chromium coverage/u);
});

test('implausible V8 data is refused instead of being credited', async (t) => {
  const refuse = async (change, pattern) => {
    const base = await fixture(t);
    const file = resolve(base, 'coverage/node-v8/a.json');
    const data = JSON.parse(await readFile(file, 'utf8'));
    change(data.result[0]);
    await write(file, JSON.stringify(data));
    await assert.rejects(reportCoverage({ base, reporters: QUIET }), pattern);
  };
  await refuse((entry) => { entry.functions[0].ranges[0].count = -1; }, /Invalid V8 count/u);
  await refuse((entry) => { entry.functions[0].ranges[0].count = 1.5; }, /Invalid V8 count/u);
  await refuse((entry) => { entry.functions[0].ranges[0].endOffset = CODE.length + 100; }, /Invalid V8 range/u);
  await refuse((entry) => { entry.functions[0].ranges[0].startOffset = 9; entry.functions[0].ranges[0].endOffset = 3; }, /Invalid V8 range/u);
  await refuse((entry) => { entry.functions = []; }, /Missing V8 functions/u);
  await refuse((entry) => { entry.functions[0].ranges = []; }, /Missing V8 ranges/u);
  await refuse((entry) => { entry.functions[0].functionName = 7; }, /Invalid V8 function/u);
  await refuse((entry) => { entry.functions[0].isBlockCoverage = 'yes'; }, /Invalid V8 block coverage/u);
  await refuse((entry) => { entry.source = `\n${CODE}`; }, /Stale captured script/u);
});

test('a compilation that no longer matches its source refuses coverage for different text', async (t) => {
  const base = await fixture(t);
  const mapFile = resolve(base, 'coverage/build/dist/a.js.map');
  const map = JSON.parse(await readFile(mapFile, 'utf8'));
  map.sourcesContent = ['export const value = 3;\n'];
  await write(mapFile, JSON.stringify(map));
  await assert.rejects(reportCoverage({ base, reporters: QUIET }), /Stale source map: src\/a\.ts/u);
  const chromium = await fixture(t);
  const script = await addBrowserPage(chromium);
  const browserMap = JSON.parse(await readFile(`${script}.map`, 'utf8'));
  browserMap.sourcesContent = ['export const value = 4;\n'];
  await write(`${script}.map`, JSON.stringify(browserMap));
  await assert.rejects(reportCoverage({ reporters: QUIET, base: chromium, browserStatus: 0 }), /Stale coverage source map/u);
});

const floorCount = Math.round(LYRA_3D_COVERAGE_FLOOR * 1000);
const measurement = () => ({
  complete: true, fullMetricEnumeration: { lines: true, statements: true },
  total: { lines: { covered: floorCount, total: 100000 }, statements: { covered: floorCount, total: 100000 } },
});

test('the coverage target accepts the floor itself and checks exact counts rather than supplied percentages', () => {
  assert.doesNotThrow(() => assertCoverageTarget(measurement()));
  for (const metric of ['lines', 'statements']) {
    const below = measurement();
    below.total[metric].covered = floorCount - 1;
    below.total[metric].pct = 100;
    assert.throws(() => assertCoverageTarget(below), new RegExp(`${metric} coverage .* is below ${LYRA_3D_COVERAGE_FLOOR}%`, 'u'));
  }
});

test('the coverage target refuses incomplete runs, incomplete censuses and malformed totals', () => {
  const incomplete = measurement();
  incomplete.complete = false;
  assert.throws(() => assertCoverageTarget(incomplete), /Incomplete test runs/u);
  for (const metric of ['lines', 'statements']) {
    const census = measurement();
    census.fullMetricEnumeration[metric] = false;
    assert.throws(() => assertCoverageTarget(census), /source census/u);
  }
  for (const counts of [{ total: 0, covered: 0 }, { total: 100, covered: 101 }, { total: 100, covered: Number.NaN }, { total: Infinity, covered: Infinity }, undefined]) {
    const malformed = measurement();
    malformed.total.lines = counts;
    assert.throws(() => assertCoverageTarget(malformed), /Invalid lines coverage counts/u);
  }
});

test('the redirect hooks send imports of the shipped build to the instrumented build and leave everything else alone', () => {
  initialize({ from: 'file:///package/dist/', to: 'file:///package/coverage/build/dist/' });
  const forwarded = [];
  const next = (specifier) => { forwarded.push(specifier); return { url: specifier }; };
  const parentURL = 'file:///package/test/example.test.mjs';
  assert.equal(resolveHook('../dist/core/index.js', { parentURL }, next).url, 'file:///package/coverage/build/dist/core/index.js');
  assert.equal(resolveHook('file:///package/dist/graph/engine.js', {}, next).url, 'file:///package/coverage/build/dist/graph/engine.js', 'absolute URLs need no parent');
  assert.equal(resolveHook('../src/core/contract.ts', { parentURL }, next).url, '../src/core/contract.ts');
  assert.equal(resolveHook('three', { parentURL }, next).url, 'three');
  assert.equal(resolveHook('node:fs', {}, next).url, 'node:fs');
  assert.equal(resolveHook('./helper.mjs', {}, next).url, './helper.mjs', 'a relative specifier without a parent cannot be placed');
  assert.deepEqual(forwarded.length, 6);
});
