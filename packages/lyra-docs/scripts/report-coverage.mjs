import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import v8ToIstanbul from 'v8-to-istanbul';
import libCoverage from 'istanbul-lib-coverage';
import libReport from 'istanbul-lib-report';
import reports from 'istanbul-reports';

const DOCX_LINE_COVERAGE_FLOOR = 99.6;

/** The verified whole-source target gates lines and their native V8 statement counters. */
export function assertCoverageTarget(metadata) {
  assert.equal(metadata.complete, true, 'Incomplete test runs cannot satisfy the coverage target');
  for (const metric of ['lines', 'statements']) {
    assert.equal(metadata.fullMetricEnumeration?.[metric], true, `Incomplete ${metric} source census`);
    const counts = metadata.total?.[metric];
    assert.ok(counts && Number.isSafeInteger(counts.total) && counts.total > 0 &&
      Number.isSafeInteger(counts.covered) && counts.covered >= 0 && counts.covered <= counts.total,
    `Invalid ${metric} coverage counts`);
    const percentage = counts.covered / counts.total * 100;
    assert.ok(percentage >= DOCX_LINE_COVERAGE_FLOOR,
      `${metric} coverage ${percentage.toFixed(3)}% is below ${DOCX_LINE_COVERAGE_FLOOR}%`);
  }
}

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => {
    const file = resolve(directory, entry.name);
    return entry.isDirectory() ? filesUnder(file) : [file];
  }));
  return nested.flat().sort();
}

/** Count every emitted runtime module; the compiler decides which source is type-only. */
export async function sourceInventory(root) {
  const included = [];
  const excluded = [];
  for (const source of await filesUnder(resolve(root, 'src'))) {
    if (!source.endsWith('.ts')) continue;
    const name = relative(root, source).replaceAll(sep, '/');
    const reason = source.endsWith('.d.ts') ? 'type declaration'
      : source.endsWith('.test.ts') ? 'test'
        : source.endsWith('-fixtures.ts') ? 'test fixture' : null;
    if (reason) { excluded.push({ source: name, reason }); continue; }
    const generated = resolve(root, '.coverage-output', name.replace(/\.ts$/u, '.js'));
    const javascript = await readFile(generated, 'utf8');
    // An unmapped module must fail rather than silently shrink the denominator.
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
  assert.equal(source, emitted, `Stale captured browser script: ${script}`);
  const sourceMap = JSON.parse(await readFile(`${script}.map`, 'utf8'));
  const canonicalSource = file => isAbsolute(file) ? resolve(file)
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
  const converter = v8ToIstanbul(script, 0, { source },
    file => !eligible.has(canonicalSource(file)));
  await converter.load();
  converter.applyCoverage(entry.functions);
  return converter.toIstanbul();
}

/** Merge native Node and Chromium ranges onto original TypeScript, including untouched files. */
export async function reportCoverage({ root, unitStatus = 0, browserStatus = 0 }) {
  root = resolve(root);
  const output = resolve(root, 'coverage');
  const inventory = await sourceInventory(root);
  const eligible = new Set(inventory.included.map(entry => entry.source));
  const map = libCoverage.createCoverageMap({});
  const nodeFiles = (await filesUnder(resolve(output, 'node-v8'))).filter(file => file.endsWith('.json'));
  assert.ok(nodeFiles.length, 'Missing Node V8 coverage');
  let nodeModules = 0;
  let browserModules = 0;
  const generatedBrowserHelpers = [];
  const generatedBrowserFacades = [];
  for (const file of nodeFiles) {
    const data = JSON.parse(await readFile(file, 'utf8'));
    assert.ok(Array.isArray(data.result), `Invalid Node coverage: ${file}`);
    for (const entry of data.result) {
      if (!entry.url.startsWith('file:')) continue;
      const script = fileURLToPath(entry.url);
      if (!script.startsWith(`${resolve(root, '.coverage-output/src')}${sep}`) || !script.endsWith('.js')) continue;
      const original = resolve(root, 'src', relative(resolve(root, '.coverage-output/src'), script).replace(/\.js$/u, '.ts'));
      if (!eligible.has(original)) continue;
      map.merge(await convert(entry, script, eligible));
      nodeModules++;
    }
  }
  assert.ok(nodeModules, 'Node coverage did not measure any companion modules');
  const browserEntries = JSON.parse(await readFile(resolve(output, 'browser-v8.json'), 'utf8'));
  assert.ok(Array.isArray(browserEntries) && browserEntries.length, 'Missing Chromium V8 coverage');
  for (const entry of browserEntries) {
    if (!entry.url.startsWith('http:')) continue;
    const pathname = decodeURIComponent(new URL(entry.url).pathname);
    const script = resolve(root, '.browser-output', `.${pathname}`);
    assert.ok(script.startsWith(`${resolve(root, '.browser-output')}${sep}`), 'Browser script escapes test output');
    if (!script.endsWith('.js')) continue;
    // Vite emits its preload and bundler runtime helpers without original-source maps.
    if (/[/\\](?:preload-helper|rolldown-runtime)-[\w-]+\.js$/u.test(script)) {
      generatedBrowserHelpers.push(pathname);
      continue;
    }
    try { await readFile(`${script}.map`, 'utf8'); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const source = await readFile(script, 'utf8');
      // The bundler also emits import/export-only facades for shared dynamic entries.
      const remainder = source
        .replace(/\bimport\s*\{[^{}]*\}\s*from\s*(['"])\.\/[^'"\n]+\1\s*;?/gu, '')
        .replace(/\bexport\s*\{[^{}]*\}\s*;?/gu, '').trim();
      assert.equal(remainder, '', `Executable browser chunk lacks source map: ${script}`);
      assert.ok(source.includes('export'), `Unmapped browser chunk is not an export facade: ${script}`);
      generatedBrowserFacades.push(pathname);
      continue;
    }
    const converted = await convert(entry, script, eligible);
    if (!Object.keys(converted).length) continue;
    map.merge(converted);
    browserModules++;
  }
  assert.ok(browserModules, 'Chromium coverage did not measure any companion modules');
  const unloaded = [];
  for (const entry of inventory.included) {
    if (map.files().includes(entry.source)) continue;
    unloaded.push(relative(root, entry.source).replaceAll(sep, '/'));
    const converter = v8ToIstanbul(entry.generated, 0, undefined, file => !eligible.has(resolve(file)));
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
  for (const reporter of ['json', 'json-summary', 'lcovonly', 'html', 'text']) {
    reports.create(reporter).execute(context);
  }
  const metadata = {
    generatedAt: new Date().toISOString(), complete: unitStatus === 0 && browserStatus === 0,
    lineCoverageFloor: DOCX_LINE_COVERAGE_FLOOR,
    unitStatus, browserStatus, nodeModules, browserModules, generatedBrowserHelpers, generatedBrowserFacades,
    method: 'Node + Chromium native V8 coverage remapped to original TypeScript with v8-to-istanbul. Statements are V8 line counters; branches and functions are V8 observed ranges, not Istanbul AST instrumentation.',
    missingModuleNote: 'Unloaded runtime modules contribute zero statements and lines. V8 cannot enumerate their function or branch ranges before execution.',
    included: inventory.included.map(entry => relative(root, entry.source).replaceAll(sep, '/')),
    excluded: inventory.excluded, unloaded,
    fullMetricEnumeration: { statements: true, lines: true, branches: unloaded.length === 0, functions: unloaded.length === 0 },
    total: map.getCoverageSummary().toJSON(),
  };
  if (unloaded.length) console.error(`Coverage includes ${unloaded.length} unloaded runtime module(s) at zero lines. Function and branch percentages describe loaded modules only; consult coverage-metadata.json.`);
  await writeFile(resolve(output, 'coverage-metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`);
  await writeFile(resolve(output, 'coverage-gaps.json'), `${JSON.stringify(Object.fromEntries(map.files().map(file => {
    const coverage = map.fileCoverageFor(file);
    return [relative(root, file).replaceAll(sep, '/'), {
      summary: coverage.toSummary().toJSON(), uncoveredLines: coverage.getUncoveredLines(),
      uncoveredFunctions: Object.entries(coverage.data.f).filter(([, count]) => count === 0)
        .map(([id]) => coverage.data.fnMap[id]),
      uncoveredBranches: Object.entries(coverage.data.b).flatMap(([id, counts]) => counts
        .map((count, arm) => count === 0 ? { ...coverage.data.branchMap[id], arm } : null).filter(Boolean)),
    }];
  })), null, 2)}\n`);
  return metadata;
}
