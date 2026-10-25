import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { libCoverage, libReport, reports, v8ToIstanbul } from '../../../scripts/lib/coverage/libraries.mjs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STAGED_RECORD_EXTENSION } from './scratch-package.mjs';

/** Line and statement floor for a complete run (unit tests, build, checks and the browser driver). */
export const LYRA_MAP_COVERAGE_FLOOR = 100;

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const REPORTERS = ['json', 'json-summary', 'lcovonly', 'html', 'text'];

/** The files that produce or enforce coverage; they are not part of the measured product. */
const HARNESS = new Set(['scripts/coverage.mjs', 'scripts/report-coverage.mjs']);

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
    assert.ok(percentage >= LYRA_MAP_COVERAGE_FLOOR,
      `${metric} coverage ${percentage.toFixed(3)}% is below ${LYRA_MAP_COVERAGE_FLOOR}%`);
  }
}

/**
 * The package's own original modules: the Vite plugin and the build, transform and check scripts.
 * The renderer in `dist` is generated from the pinned upstream source and is never part of the
 * census. Declarations and the coverage harness itself are listed as excluded.
 */
export async function sourceInventory(base) {
  const included = [];
  const excluded = [];
  for (const directory of ['src', 'scripts']) {
    for (const source of await filesUnder(resolve(base, directory))) {
      const name = relative(base, source).replaceAll(sep, '/');
      if (source.endsWith('.d.ts')) { excluded.push({ source: name, reason: 'type declaration' }); continue; }
      if (!source.endsWith('.mjs')) continue;
      if (HARNESS.has(name)) { excluded.push({ source: name, reason: 'coverage harness' }); continue; }
      included.push({ source, text: await readFile(source, 'utf8') });
    }
  }
  assert.ok(included.length, 'Coverage source inventory is empty');
  return { included, excluded };
}

/** Records of scratch copies: where each ran from, which original it copies, and the bytes copied. */
async function stagedRecords(directory) {
  const staged = new Map();
  for (const name of (await readdir(directory)).filter((file) => file.endsWith(STAGED_RECORD_EXTENSION)).sort()) {
    const record = JSON.parse(await readFile(resolve(directory, name), 'utf8'));
    assert.ok(typeof record.original === 'string' && typeof record.staged === 'string' &&
      /^[0-9a-f]{64}$/u.test(record.sha256), `Invalid staged record: ${name}`);
    staged.set(record.staged, record);
  }
  return staged;
}

/**
 * The measured module a V8 script URL stands for: the module itself, or the copy a scratch package
 * ran, credited to its original only while that original is byte-identical to the bytes copied.
 */
export function originalOf(script, texts, staged) {
  if (texts.has(script)) return script;
  const record = staged.get(script);
  if (!record || !texts.has(record.original)) return undefined;
  const digest = createHash('sha256').update(texts.get(record.original)).digest('hex');
  assert.equal(digest, record.sha256, `Stale staged script: ${record.original}`);
  return record.original;
}

async function convert(entry, original, text, eligible) {
  assert.ok(Array.isArray(entry.functions) && entry.functions.length, `Missing V8 functions: ${original}`);
  // V8's module-level range spans the whole executed source, which identifies a stale copy.
  const [moduleRange] = entry.functions[0].ranges ?? [];
  assert.ok(moduleRange && moduleRange.startOffset === 0 && moduleRange.endOffset === text.length,
    `Executed source differs from the measured module: ${original}`);
  for (const block of entry.functions) {
    assert.equal(typeof block.functionName, 'string', `Invalid V8 function: ${original}`);
    assert.equal(typeof block.isBlockCoverage, 'boolean', `Invalid V8 block coverage: ${original}`);
    assert.ok(Array.isArray(block.ranges) && block.ranges.length, `Missing V8 ranges: ${original}`);
    for (const range of block.ranges) {
      assert.ok(Number.isSafeInteger(range.count) && range.count >= 0, `Invalid V8 count: ${original}`);
      assert.ok(Number.isSafeInteger(range.startOffset) && Number.isSafeInteger(range.endOffset) &&
        range.startOffset >= 0 && range.endOffset >= range.startOffset && range.endOffset <= text.length,
      `Invalid V8 range: ${original}`);
    }
  }
  const converter = v8ToIstanbul(original, 0, { source: text }, (file) => !eligible.has(resolve(file)));
  await converter.load();
  converter.applyCoverage(entry.functions);
  return converter.toIstanbul();
}

/**
 * Merges the native V8 ranges of every Node process the run started onto the original modules,
 * enrolling modules nothing loaded at zero so the denominator is the whole census.
 */
export async function reportCoverage({ base = root, unitStatus = 0, pipelineStatus = 0, browserStatus, reporters = REPORTERS } = {}) {
  base = resolve(base);
  const output = resolve(base, 'coverage');
  const inventory = await sourceInventory(base);
  const eligible = new Set(inventory.included.map((entry) => entry.source));
  const texts = new Map(inventory.included.map((entry) => [entry.source, entry.text]));
  const map = libCoverage.createCoverageMap({});

  const staged = await stagedRecords(resolve(output, 'node-v8'));
  const nodeFiles = (await filesUnder(resolve(output, 'node-v8'))).filter((file) => file.endsWith('.json'));
  assert.ok(nodeFiles.length, 'Missing Node V8 coverage');
  let measuredScripts = 0;
  for (const file of nodeFiles) {
    const data = JSON.parse(await readFile(file, 'utf8'));
    assert.ok(Array.isArray(data.result), `Invalid Node coverage: ${file}`);
    for (const entry of data.result) {
      if (!entry.url.startsWith('file:')) continue;
      const original = originalOf(fileURLToPath(entry.url), texts, staged);
      if (!original) continue;
      map.merge(await convert(entry, original, texts.get(original), eligible));
      measuredScripts += 1;
    }
  }
  assert.ok(measuredScripts, 'Node coverage did not measure any package module');

  const unloaded = [];
  for (const entry of inventory.included) {
    if (map.files().includes(entry.source)) continue;
    unloaded.push(relative(base, entry.source).replaceAll(sep, '/'));
    const converter = v8ToIstanbul(entry.source, 0, { source: entry.text }, (file) => !eligible.has(resolve(file)));
    await converter.load();
    converter.applyCoverage([{
      functionName: '(empty-report)', isBlockCoverage: false,
      ranges: [{ startOffset: 0, endOffset: entry.text.length, count: 0 }],
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
    complete: unitStatus === 0 && pipelineStatus === 0 && browserStatus === 0,
    coverageFloor: LYRA_MAP_COVERAGE_FLOOR,
    unitStatus, pipelineStatus, browserStatus: browserStatus ?? null, measuredScripts,
    method: 'Native V8 coverage of every Node process the unit tests, the build, the package checks and the browser driver start, merged with v8-to-istanbul. Statements are V8 line counters; branches and functions are V8 observed ranges, not Istanbul AST instrumentation.',
    scope: 'The generated renderer in dist is built from the pinned upstream source and is not measured; the census is the Vite plugin and the build, transform and check scripts.',
    missingModuleNote: 'Unloaded modules contribute zero statements and lines. V8 cannot enumerate their function or branch ranges before execution.',
    included: inventory.included.map((entry) => relative(base, entry.source).replaceAll(sep, '/')),
    excluded: inventory.excluded, unloaded,
    fullMetricEnumeration: { statements: true, lines: true, branches: unloaded.length === 0, functions: unloaded.length === 0 },
    total: map.getCoverageSummary().toJSON(),
  };
  if (unloaded.length) console.error(`Coverage includes ${unloaded.length} unloaded module(s) at zero lines. Function and branch percentages describe loaded modules only; consult coverage-metadata.json.`);
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
