import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { libCoverage, libReport, reports, v8ToIstanbul } from '../../../scripts/lib/coverage/libraries.mjs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPORTERS = ['json', 'json-summary', 'lcovonly', 'html', 'text'];

/** Line and statement floor for a complete run: the Node unit tests, plus the Chromium suite unless it was left out. */
export const LYRA_3D_COVERAGE_FLOOR = 100;

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function filesUnder(directory) {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true });
  return entries.filter((entry) => entry.isFile()).map((entry) => resolve(entry.parentPath, entry.name)).sort();
}

/** The verified whole-source target gates lines and their V8 statement counters. */
export function assertCoverageTarget(metadata) {
  assert.equal(metadata.complete, true, 'Incomplete test runs cannot satisfy the coverage target');
  for (const metric of ['lines', 'statements']) {
    assert.equal(metadata.fullMetricEnumeration?.[metric], true, `Incomplete ${metric} source census`);
    const counts = metadata.total?.[metric];
    assert.ok(counts && Number.isSafeInteger(counts.total) && counts.total > 0 &&
      Number.isSafeInteger(counts.covered) && counts.covered >= 0 && counts.covered <= counts.total,
    `Invalid ${metric} coverage counts`);
    const percentage = counts.covered / counts.total * 100;
    assert.ok(percentage >= LYRA_3D_COVERAGE_FLOOR,
      `${metric} coverage ${percentage.toFixed(3)}% is below ${LYRA_3D_COVERAGE_FLOOR}%`);
  }
}

/**
 * Every runtime module of the package source. The compiler decides which modules are type-only:
 * a module whose emitted JavaScript has no runtime statement cannot be measured and is listed as
 * excluded. Each included module must have a current compilation with source maps.
 */
export async function sourceInventory(base) {
  const included = [];
  const excluded = [];
  const sourceRoot = resolve(base, 'src');
  for (const source of await filesUnder(sourceRoot)) {
    if (!source.endsWith('.ts')) continue;
    const name = relative(base, source).replaceAll(sep, '/');
    if (source.endsWith('.d.ts')) { excluded.push({ source: name, reason: 'type declaration' }); continue; }
    const generated = resolve(base, 'coverage/build/dist', relative(sourceRoot, source).replace(/\.ts$/u, '.js'));
    const javascript = await readFile(generated, 'utf8');
    // An unmapped or stale module must fail rather than silently shrink the denominator.
    const sourceMap = JSON.parse(await readFile(`${generated}.map`, 'utf8'));
    assert.equal(sourceMap.sources.length, 1, `Expected one original source for ${name}`);
    assert.equal(resolve(dirname(generated), sourceMap.sources[0]), source, `Source map mismatch: ${name}`);
    assert.equal(sourceMap.sourcesContent?.[0], await readFile(source, 'utf8'), `Stale source map: ${name}`);
    const runtime = javascript.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/gu, '')
      .replace(/\bexport\s*\{\s*\}\s*;?/gu, '').trim();
    if (!runtime) { excluded.push({ source: name, reason: 'no emitted runtime code' }); continue; }
    included.push({ source, generated, javascript });
  }
  assert.ok(included.length, 'Coverage source inventory is empty');
  return { included, excluded };
}

async function convert(entry, script, eligible) {
  const emitted = await readFile(script, 'utf8');
  const source = entry.source ?? emitted;
  assert.equal(source, emitted, `Stale captured script: ${script}`);
  const sourceMap = JSON.parse(await readFile(`${script}.map`, 'utf8'));
  const canonicalSource = (file) => isAbsolute(file) ? resolve(file)
    : resolve(dirname(script), sourceMap.sourceRoot ?? '', file);
  for (const [index, file] of sourceMap.sources.entries()) {
    const original = canonicalSource(file);
    if (!eligible.has(original)) continue;
    assert.equal(sourceMap.sourcesContent?.[index], await readFile(original, 'utf8'),
      `Stale coverage source map: ${original}`);
  }
  assert.ok(Array.isArray(entry.functions) && entry.functions.length, `Missing V8 functions: ${script}`);
  for (const block of entry.functions) {
    assert.equal(typeof block.functionName, 'string', `Invalid V8 function: ${script}`);
    assert.equal(typeof block.isBlockCoverage, 'boolean', `Invalid V8 block coverage: ${script}`);
    assert.ok(Array.isArray(block.ranges) && block.ranges.length, `Missing V8 ranges: ${script}`);
    for (const range of block.ranges) {
      assert.ok(Number.isSafeInteger(range.count) && range.count >= 0, `Invalid V8 count: ${script}`);
      assert.ok(Number.isSafeInteger(range.startOffset) && Number.isSafeInteger(range.endOffset) &&
        range.startOffset >= 0 && range.endOffset >= range.startOffset && range.endOffset <= source.length,
      `Invalid V8 range: ${script}`);
    }
  }
  const converter = v8ToIstanbul(script, 0, { source }, (file) => !eligible.has(canonicalSource(file)));
  await converter.load();
  converter.applyCoverage(entry.functions);
  return converter.toIstanbul();
}

/**
 * Combines the two collectors' maps. Both count physical source lines, so their statement counters
 * share keys and add up. They compile the sources differently, so a function or branch starts at a
 * different column in each (an `export` prefix, a trailing semicolon): merging those would list every
 * function twice and report one collector's unexecuted copy as uncovered. Functions and branches
 * therefore come from the Node unit run, and from Chromium only for a module no unit test loads.
 */
function combineCollectors(libCoverage, unit, browser) {
  const combined = libCoverage.createCoverageMap({});
  const statementsOnly = (coverage) => libCoverage.createFileCoverage({
    ...structuredClone(coverage.toJSON()), fnMap: {}, f: {}, branchMap: {}, b: {},
  });
  for (const file of new Set([...unit.files(), ...browser.files()])) {
    const sources = [unit, browser].filter((collected) => collected.files().includes(file))
      .map((collected) => collected.fileCoverageFor(file));
    const statements = sources.map(statementsOnly).reduce((total, next) => { total.merge(next); return total; }).toJSON();
    combined.addFileCoverage(libCoverage.createFileCoverage({
      ...structuredClone(sources[0].toJSON()), statementMap: statements.statementMap, s: statements.s,
    }));
  }
  return combined;
}

/**
 * Merges native Node V8 ranges, and Chromium ranges when the browser pass ran, onto the original
 * TypeScript, enrolling modules no test loaded at zero so the denominator is the whole source.
 */
export async function reportCoverage({ base = root, unitStatus = 0, browserStatus, reporters = REPORTERS } = {}) {
  base = resolve(base);
  const output = resolve(base, 'coverage');
  const inventory = await sourceInventory(base);
  const eligible = new Set(inventory.included.map((entry) => entry.source));
  const unitMap = libCoverage.createCoverageMap({});
  const browserMap = libCoverage.createCoverageMap({});

  const nodeBuild = resolve(base, 'coverage/build/dist');
  const nodeFiles = (await filesUnder(resolve(output, 'node-v8'))).filter((file) => file.endsWith('.json'));
  assert.ok(nodeFiles.length, 'Missing Node V8 coverage');
  let nodeModules = 0;
  for (const file of nodeFiles) {
    const data = JSON.parse(await readFile(file, 'utf8'));
    assert.ok(Array.isArray(data.result), `Invalid Node coverage: ${file}`);
    for (const entry of data.result) {
      if (!entry.url.startsWith('file:')) continue;
      const script = fileURLToPath(entry.url);
      if (!script.startsWith(`${nodeBuild}${sep}`) || !script.endsWith('.js')) continue;
      const original = resolve(base, 'src', relative(nodeBuild, script).replace(/\.js$/u, '.ts'));
      if (!eligible.has(original)) continue;
      unitMap.merge(await convert(entry, script, eligible));
      nodeModules += 1;
    }
  }
  assert.ok(nodeModules, 'Node coverage did not measure any engine modules');

  let browserModules = 0;
  const browserPages = [];
  if (browserStatus !== undefined) {
    const directory = resolve(output, 'browser-v8');
    const pages = (await filesUnder(directory)).filter((file) => file.endsWith('.json'));
    assert.ok(pages.length, 'Missing Chromium V8 coverage');
    const assets = resolve(base, 'coverage/browser-scratch/out');
    for (const file of pages) {
      const entries = JSON.parse(await readFile(file, 'utf8'));
      assert.ok(Array.isArray(entries), `Invalid Chromium coverage: ${file}`);
      browserPages.push(relative(output, file).replaceAll(sep, '/'));
      for (const entry of entries) {
        if (!entry.url.startsWith('http:')) continue;
        const pathname = decodeURIComponent(new URL(entry.url).pathname);
        const script = resolve(assets, `.${pathname}`);
        assert.ok(script.startsWith(`${assets}${sep}`), 'Browser script escapes test output');
        if (!script.endsWith('.js')) continue;
        const converted = await convert(entry, script, eligible);
        if (!Object.keys(converted).length) continue;
        browserMap.merge(converted);
        browserModules += 1;
      }
    }
    assert.ok(browserModules, 'Chromium coverage did not measure any engine modules');
  }

  const map = combineCollectors(libCoverage, unitMap, browserMap);
  const unloaded = [];
  for (const entry of inventory.included) {
    if (map.files().includes(entry.source)) continue;
    unloaded.push(relative(base, entry.source).replaceAll(sep, '/'));
    const converter = v8ToIstanbul(entry.generated, 0, undefined, (file) => !eligible.has(resolve(file)));
    await converter.load();
    converter.applyCoverage([{
      functionName: '(empty-report)', isBlockCoverage: false,
      ranges: [{ startOffset: 0, endOffset: entry.javascript.length, count: 0 }],
    }]);
    const empty = converter.toIstanbul();
    // The synthetic sentinel is not a source function or a source branch.
    for (const coverage of Object.values(empty)) {
      coverage.fnMap = {}; coverage.f = {}; coverage.branchMap = {}; coverage.b = {};
    }
    map.merge(empty);
  }
  assert.deepEqual(map.files().sort(), [...eligible].sort(), 'Coverage omits or adds source modules');

  await mkdir(output, { recursive: true });
  const context = libReport.createContext({ dir: output, coverageMap: map });
  for (const reporter of reporters) reports.create(reporter).execute(context);
  const metadata = {
    generatedAt: new Date().toISOString(),
    // Complete means every pass this run included succeeded; a unit-only run states that in browserStatus.
    complete: unitStatus === 0 && (browserStatus === undefined || browserStatus === 0),
    coverageFloor: LYRA_3D_COVERAGE_FLOOR,
    unitStatus, browserStatus: browserStatus ?? null, nodeModules, browserModules,
    browserPages: browserPages.length,
    method: 'Node and Chromium native V8 coverage remapped to the original TypeScript with v8-to-istanbul. Statements are V8 line counters, summed across both collectors; branches and functions are V8 observed ranges, not Istanbul AST instrumentation, and come from the Node unit run (Chromium supplies a module only when no unit test loads it).',
    missingModuleNote: 'Unloaded runtime modules contribute zero statements and lines. V8 cannot enumerate their function or branch ranges before execution.',
    included: inventory.included.map((entry) => relative(base, entry.source).replaceAll(sep, '/')),
    excluded: inventory.excluded, unloaded,
    fullMetricEnumeration: { statements: true, lines: true, branches: unloaded.length === 0, functions: unloaded.length === 0 },
    total: map.getCoverageSummary().toJSON(),
    // The collectors alone, so a gate or a reader can tell what the unit tests prove by themselves.
    collectors: { unit: unitMap.getCoverageSummary().toJSON(), browser: browserMap.getCoverageSummary().toJSON() },
  };
  if (unloaded.length) console.error(`Coverage includes ${unloaded.length} unloaded runtime module(s) at zero lines. Function and branch percentages describe loaded modules only; consult coverage-metadata.json.`);
  await writeFile(resolve(output, 'coverage-metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`);
  await writeFile(resolve(output, 'coverage-gaps.json'), `${JSON.stringify(Object.fromEntries(map.files().map((file) => {
    const coverage = map.fileCoverageFor(file);
    return [relative(base, file).replaceAll(sep, '/'), {
      summary: coverage.toSummary().toJSON(), uncoveredLines: coverage.getUncoveredLines(),
      uncoveredFunctions: Object.entries(coverage.data.f).filter(([, count]) => count === 0)
        .map(([id]) => coverage.data.fnMap[id]),
      uncoveredBranches: Object.entries(coverage.data.b).flatMap(([id, counts]) => counts
        .map((count, arm) => count === 0 ? { ...coverage.data.branchMap[id], arm } : null).filter(Boolean)),
    }];
  })), null, 2)}\n`);
  return metadata;
}
