import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import libCoverage from 'istanbul-lib-coverage';
import libReport from 'istanbul-lib-report';
import reports from 'istanbul-reports';
import v8ToIstanbul from 'v8-to-istanbul';
import { STAGED_RECORD_EXTENSION } from './staged-script.mjs';

/**
 * Native V8 coverage for plain JavaScript run by Node, converted with v8-to-istanbul. Statements are
 * V8 physical-line counters; branches and functions are V8 observed ranges, not Istanbul AST
 * instrumentation. Companion packages with tooling-only sources (no bundler, no source maps) use this
 * through `runNodeCoverage`; the document companion merges the same measurement into its TypeScript
 * report.
 */

const JAVASCRIPT = /\.[cm]?js$/u;
const IGNORED_DIRECTORIES = new Set(['node_modules', 'coverage', '.git']);
const REPORTERS = ['json', 'json-summary', 'lcovonly', 'html', 'text'];
const METHOD = 'Node native V8 coverage converted to original JavaScript with v8-to-istanbul. Statements are V8 line counters; branches and functions are V8 observed ranges, not Istanbul AST instrumentation.';
const MISSING_MODULE_NOTE = 'Unloaded modules contribute zero statements and lines. V8 cannot enumerate their function or branch ranges before execution.';

const digest = text => createHash('sha256').update(text).digest('hex');
const posix = (root, file) => relative(root, file).split(sep).join('/');

async function javascriptFiles(directory) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!IGNORED_DIRECTORIES.has(entry.name)) found.push(...await javascriptFiles(resolve(directory, entry.name)));
    } else if (entry.isFile() && JAVASCRIPT.test(entry.name)) found.push(resolve(directory, entry.name));
  }
  return found.sort();
}

/**
 * Classify every JavaScript file under `directories` (default: all of `root`). `include` lists the
 * original sources by relative path; every other file must match an `exclude` rule
 * `{ pattern, reason, verify? }`, so a new file can neither join the report nor leave it unnoticed.
 * `verify(name, text)` may throw to refuse a rule's claim about a file, for example a missing
 * generated-file banner.
 */
export async function sourceInventory({ root, include, exclude = [], directories = ['.'] }) {
  root = resolve(root);
  const wanted = new Set(include);
  const included = [];
  const groups = new Map();
  const files = (await Promise.all(directories.map(directory => javascriptFiles(resolve(root, directory))))).flat().sort();
  for (const file of files) {
    const name = posix(root, file);
    const text = await readFile(file, 'utf8');
    if (wanted.delete(name)) { included.push({ name, source: file, text }); continue; }
    const rule = exclude.find(candidate => candidate.pattern.test(name));
    assert.ok(rule, `Unclassified JavaScript source: ${name}. List it as original source or give it an exclusion rule with a reason.`);
    rule.verify?.(name, text);
    const group = groups.get(rule) ?? { reason: rule.reason, pattern: String(rule.pattern), count: 0, sample: [] };
    group.count++;
    if (group.sample.length < 5) group.sample.push(name);
    groups.set(rule, group);
  }
  assert.deepEqual([...wanted], [], 'Listed source files are missing');
  assert.ok(included.length > 0, 'Coverage source inventory is empty');
  return { included, excluded: [...groups.values()] };
}

async function stagedOriginals(directory) {
  const staged = new Map();
  for (const name of (await readdir(directory)).filter(candidate => candidate.endsWith(STAGED_RECORD_EXTENSION)).sort()) {
    const record = JSON.parse(await readFile(resolve(directory, name), 'utf8'));
    assert.ok(typeof record.original === 'string' && typeof record.staged === 'string' &&
      /^[0-9a-f]{64}$/u.test(record.sha256), `Invalid staged record: ${name}`);
    const known = staged.get(record.staged);
    assert.ok(!known || (known.original === record.original && known.sha256 === record.sha256),
      `Ambiguous staged script: ${record.staged}`);
    staged.set(record.staged, record);
  }
  return staged;
}

async function convert(entry, original, source) {
  assert.ok(Array.isArray(entry.functions) && entry.functions.length, `Missing V8 functions: ${original}`);
  for (const block of entry.functions) {
    assert.equal(typeof block.functionName, 'string', `Invalid V8 function: ${original}`);
    assert.equal(typeof block.isBlockCoverage, 'boolean', `Invalid V8 block coverage: ${original}`);
    assert.ok(Array.isArray(block.ranges) && block.ranges.length, `Missing V8 ranges: ${original}`);
    for (const range of block.ranges) {
      assert.ok(Number.isSafeInteger(range.count) && range.count >= 0, `Invalid V8 count: ${original}`);
      assert.ok(Number.isSafeInteger(range.startOffset) && Number.isSafeInteger(range.endOffset) &&
        range.startOffset >= 0 && range.endOffset >= range.startOffset && range.endOffset <= source.length,
      `Invalid V8 range: ${original}`);
    }
  }
  const converter = v8ToIstanbul(original, 0, { source });
  await converter.load();
  converter.applyCoverage(entry.functions);
  return converter.toIstanbul();
}

/**
 * Merge every V8 dump in `directory` onto the `included` originals. A script that tests ran from a
 * staged copy (see `stageScripts`) is credited to its original only while that original is still
 * byte-identical to what was staged, because V8 offsets are meaningless against any other text.
 */
export async function measureNodeCoverage({ directory, included }) {
  const sources = new Map(included.map(entry => [entry.source, entry.text]));
  const staged = await stagedOriginals(directory);
  const map = libCoverage.createCoverageMap({});
  let modules = 0;
  let stagedRuns = 0;
  for (const name of (await readdir(directory)).filter(candidate => candidate.endsWith('.json')).sort()) {
    const data = JSON.parse(await readFile(resolve(directory, name), 'utf8'));
    assert.ok(Array.isArray(data.result), `Invalid Node coverage: ${name}`);
    for (const entry of data.result) {
      if (!entry.url.startsWith('file:')) continue;
      const script = fileURLToPath(entry.url);
      let original = script;
      if (!sources.has(script)) {
        const record = staged.get(script);
        if (!record || !sources.has(record.original)) continue;
        assert.equal(digest(sources.get(record.original)), record.sha256, `Stale staged script: ${record.original}`);
        original = record.original;
        stagedRuns++;
      }
      map.merge(await convert(entry, original, sources.get(original)));
      modules++;
    }
  }
  return { map, modules, stagedRuns };
}

/** Enroll sources no test loaded at zero. V8 cannot list their functions or branches before execution. */
export async function enrollUnloaded(map, included) {
  const loaded = new Set(map.files());
  const unloaded = [];
  for (const entry of included) {
    if (loaded.has(entry.source)) continue;
    unloaded.push(entry.name);
    const converter = v8ToIstanbul(entry.source, 0, { source: entry.text });
    await converter.load();
    converter.applyCoverage([{
      functionName: '(empty-report)', isBlockCoverage: false,
      ranges: [{ startOffset: 0, endOffset: entry.text.length, count: 0 }],
    }]);
    const empty = converter.toIstanbul();
    // The synthetic sentinel is neither a source function nor a source branch.
    for (const coverage of Object.values(empty)) {
      coverage.fnMap = {}; coverage.f = {}; coverage.branchMap = {}; coverage.b = {};
    }
    map.merge(empty);
  }
  return unloaded;
}

/** Per-file summaries plus the exact uncovered lines, functions and branch arms. */
export function coverageGaps(map, root) {
  return Object.fromEntries(map.files().map(file => {
    const coverage = map.fileCoverageFor(file);
    return [posix(root, file), {
      summary: coverage.toSummary().toJSON(), uncoveredLines: coverage.getUncoveredLines(),
      uncoveredFunctions: Object.entries(coverage.data.f).filter(([, count]) => count === 0)
        .map(([id]) => coverage.data.fnMap[id]),
      uncoveredBranches: Object.entries(coverage.data.b).flatMap(([id, counts]) => counts
        .map((count, arm) => count === 0 ? { ...coverage.data.branchMap[id], arm } : null).filter(Boolean)),
    }];
  }));
}

function writeReports(map, directory) {
  const context = libReport.createContext({ dir: directory, coverageMap: map });
  for (const reporter of REPORTERS) reports.create(reporter).execute(context);
}

/** The coverage floor gates exact line and statement counts, never rounded or supplied percentages. */
export function assertCoverageFloor(metadata, floor) {
  assert.equal(metadata.complete, true, 'Incomplete test runs cannot satisfy the coverage floor');
  for (const metric of ['lines', 'statements']) {
    assert.equal(metadata.fullMetricEnumeration?.[metric], true, `Incomplete ${metric} source census`);
    const counts = metadata.total?.[metric];
    assert.ok(counts && Number.isSafeInteger(counts.total) && counts.total > 0 &&
      Number.isSafeInteger(counts.covered) && counts.covered >= 0 && counts.covered <= counts.total,
    `Invalid ${metric} coverage counts`);
    const percentage = counts.covered / counts.total * 100;
    assert.ok(percentage >= floor, `${metric} coverage ${percentage.toFixed(3)}% is below ${floor}%`);
  }
}

/** Split a plain `node ... && node ...` package script into argument vectors for this Node. */
export function nodeCommands(script) {
  return script.split('&&').map(part => {
    const words = part.trim().split(/\s+/u);
    assert.equal(words[0], 'node', `Only plain node commands can run under coverage: ${part.trim()}`);
    assert.ok(words.every(word => /^[\w./:=@-]+$/u.test(word)), `Unsupported shell syntax in: ${part.trim()}`);
    return words.slice(1);
  });
}

const percent = counts => counts.pct === 'Unknown' ? 'n/a' : `${counts.pct}%`;

/**
 * Run a package's own `test` script under V8 coverage and report its original sources.
 * `include`/`exclude` follow `sourceInventory`; `floor` gates lines and statements. Resolves to the
 * measurement and the exit code the calling script should adopt (non-zero for failed tests or a
 * missed floor).
 */
export async function runNodeCoverage({ root, label, include, exclude, floor, script = 'test', environment = {} }) {
  root = resolve(root);
  const output = resolve(root, 'coverage');
  const raw = resolve(output, 'node-v8');
  const scratch = resolve(output, 'tmp');
  await rm(output, { recursive: true, force: true });
  await mkdir(raw, { recursive: true });
  await mkdir(scratch, { recursive: true });
  const manifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  assert.equal(typeof manifest.scripts?.[script], 'string', `${label} has no ${script} script to measure`);
  const statuses = [];
  // A measured run is a top-level run, never a subtest of the Node test runner that happens to be calling us.
  const inherited = { ...process.env };
  delete inherited.NODE_TEST_CONTEXT;
  for (const args of nodeCommands(manifest.scripts[script])) {
    const result = spawnSync(process.execPath, args, {
      cwd: root, stdio: 'inherit',
      env: { ...inherited, ...environment, NODE_V8_COVERAGE: raw, TMPDIR: scratch, TMP: scratch, TEMP: scratch },
    });
    if (result.error) throw result.error;
    statuses.push(result.signal ? 1 : result.status ?? 1);
  }
  // Fixtures stay inside the package while tests run and never outlive the measurement.
  await rm(scratch, { recursive: true, force: true });
  const inventory = await sourceInventory({ root, include, exclude });
  const { map, modules, stagedRuns } = await measureNodeCoverage({ directory: raw, included: inventory.included });
  assert.ok(modules > 0, `${label} tests did not execute any original source`);
  const unloaded = await enrollUnloaded(map, inventory.included);
  writeReports(map, output);
  const metadata = {
    generatedAt: new Date().toISOString(), package: label, complete: statuses.every(status => status === 0),
    coverageFloor: floor, statuses, modules, stagedRuns, method: METHOD, missingModuleNote: MISSING_MODULE_NOTE,
    included: inventory.included.map(entry => entry.name), excluded: inventory.excluded, unloaded,
    fullMetricEnumeration: { statements: true, lines: true, branches: unloaded.length === 0, functions: unloaded.length === 0 },
    total: map.getCoverageSummary().toJSON(),
  };
  await writeFile(resolve(output, 'coverage-metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`);
  await writeFile(resolve(output, 'coverage-gaps.json'), `${JSON.stringify(coverageGaps(map, root), null, 2)}\n`);
  if (unloaded.length) console.error(`${label}: ${unloaded.length} source(s) never loaded, counted at zero: ${unloaded.join(', ')}`);
  const { lines, statements, functions, branches } = metadata.total;
  console.log(`${label} coverage - lines ${percent(lines)} (${lines.covered}/${lines.total}), statements ${percent(statements)}, functions ${percent(functions)}, branches ${percent(branches)}`);
  const failed = statuses.some(status => status !== 0);
  if (failed) console.error(`${label}: tests failed, so this coverage is diagnostic only`);
  let exitCode = failed ? 1 : 0;
  if (!failed) {
    try { assertCoverageFloor(metadata, floor); }
    catch (error) { console.error(error.message); exitCode = 1; }
  }
  return { metadata, exitCode };
}
