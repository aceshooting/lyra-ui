import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  assertCoverageFloor, coverageGaps, enrollUnloaded, measureNodeCoverage, nodeCommands, sourceInventory,
} from './lib/node-coverage.mjs';
import { STAGED_RECORD_EXTENSION, stageScripts } from './lib/staged-script.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const engine = pathToFileURL(resolve(here, 'lib/node-coverage.mjs')).href;

const TOOL = 'export function used() { return 1; }\nexport function unused() {\n  return 2;\n}\nused();\n';
const BRANCHING = [
  'export function a() {', '  return 1;', '}', 'export function b() {', '  return 2;', '}',
  'if (process.argv[2] === \'a\') {', '  a();', '} else {', '  b();', '}', '',
].join('\n');

function scratch(context) {
  const root = mkdtempSync(join(tmpdir(), 'lyra-node-coverage-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  return realpathSync(root);
}

function write(file, content) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, typeof content === 'string' ? content : `${JSON.stringify(content)}\n`);
}

/** Stage with the coverage directory the way a process started under `NODE_V8_COVERAGE` sees it. */
function stageInto(dump, options) {
  const previous = process.env.NODE_V8_COVERAGE;
  if (dump) process.env.NODE_V8_COVERAGE = dump; else delete process.env.NODE_V8_COVERAGE;
  try { return stageScripts(options); }
  finally { if (previous === undefined) delete process.env.NODE_V8_COVERAGE; else process.env.NODE_V8_COVERAGE = previous; }
}

function runScript(script, dump, ...args) {
  const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env: { ...process.env, NODE_V8_COVERAGE: dump } });
  assert.equal(result.status, 0, result.stderr);
}

const entry = (root, name, text) => ({ name, source: join(root, name), text });
const digest = text => createHash('sha256').update(text).digest('hex');

test('staging copies the script and records nothing unless coverage is being collected', context => {
  const root = scratch(context);
  write(join(root, 'original/scripts/tool.mjs'), TOOL);
  const [staged] = stageInto(undefined, { from: join(root, 'original'), to: join(root, 'fixture'), files: ['scripts/tool.mjs'] });
  assert.equal(staged, join(root, 'fixture/scripts/tool.mjs'));
  assert.equal(readFileSync(staged, 'utf8'), TOOL);
  assert.deepEqual(readdirSync(root).sort(), ['fixture', 'original']);
});

test('staging under coverage records the original, the real staged path and the copied digest', context => {
  const root = scratch(context);
  const dump = join(root, 'dump');
  write(join(root, 'original/scripts/tool.mjs'), TOOL);
  write(join(root, 'original/scripts/other.mjs'), 'export {};\n');
  const staged = stageInto(dump, { from: join(root, 'original'), to: join(root, 'fixture'), files: ['scripts/tool.mjs', 'scripts/other.mjs'] });
  const records = readdirSync(dump).filter(name => name.endsWith(STAGED_RECORD_EXTENSION))
    .map(name => JSON.parse(readFileSync(join(dump, name), 'utf8')));
  assert.deepEqual(records.map(record => record.original).sort(),
    [join(root, 'original/scripts/other.mjs'), join(root, 'original/scripts/tool.mjs')]);
  const tool = records.find(record => record.original.endsWith('tool.mjs'));
  assert.deepEqual(tool, { original: join(root, 'original/scripts/tool.mjs'), staged: staged[0], sha256: digest(TOOL) });
});

test('a script run from a staged copy is credited to the original, line for line', async context => {
  const root = scratch(context);
  const dump = join(root, 'dump');
  write(join(root, 'original/tool.mjs'), TOOL);
  const [staged] = stageInto(dump, { from: join(root, 'original'), to: join(root, 'fixture'), files: ['tool.mjs'] });
  runScript(staged, dump);
  const included = [entry(join(root, 'original'), 'tool.mjs', TOOL)];
  const { map, modules, stagedRuns } = await measureNodeCoverage({ directory: dump, included });
  assert.equal(modules, 1);
  assert.equal(stagedRuns, 1);
  assert.deepEqual(map.files(), [join(root, 'original/tool.mjs')]);
  const gaps = coverageGaps(map, join(root, 'original'))['tool.mjs'];
  assert.deepEqual(gaps.uncoveredLines, ['3', '4'], 'only the body of the function that never ran is uncovered');
  assert.deepEqual(gaps.uncoveredFunctions.map(fn => fn.name), ['unused']);
  assert.equal(gaps.summary.lines.pct, 60);
});

test('runs of the same script are merged, so each path counts once any process took it', async context => {
  const root = scratch(context);
  const dump = join(root, 'dump');
  write(join(root, 'original/branching.mjs'), BRANCHING);
  const [first] = stageInto(dump, { from: join(root, 'original'), to: join(root, 'one'), files: ['branching.mjs'] });
  const [second] = stageInto(dump, { from: join(root, 'original'), to: join(root, 'two'), files: ['branching.mjs'] });
  const included = [entry(join(root, 'original'), 'branching.mjs', BRANCHING)];

  runScript(first, dump, 'a');
  const afterOne = await measureNodeCoverage({ directory: dump, included });
  const aOnly = coverageGaps(afterOne.map, join(root, 'original'))['branching.mjs'];
  assert.ok(aOnly.uncoveredLines.includes('5') && aOnly.uncoveredLines.includes('10'), 'b() and the else branch never ran');
  assert.ok(!aOnly.uncoveredLines.includes('2'), 'a() ran');

  runScript(second, dump, 'b');
  const merged = await measureNodeCoverage({ directory: dump, included });
  assert.equal(merged.modules, 2);
  assert.equal(merged.stagedRuns, 2);
  const gaps = coverageGaps(merged.map, join(root, 'original'))['branching.mjs'];
  assert.deepEqual(gaps.uncoveredLines, []);
  assert.deepEqual(gaps.uncoveredFunctions, []);
  assert.deepEqual(gaps.uncoveredBranches, []);
});

test('the original itself may run directly and is credited without staging', async context => {
  const root = scratch(context);
  const dump = join(root, 'dump');
  write(join(root, 'original/tool.mjs'), TOOL);
  runScript(join(root, 'original/tool.mjs'), dump);
  const { map, stagedRuns } = await measureNodeCoverage({
    directory: dump, included: [entry(join(root, 'original'), 'tool.mjs', TOOL)],
  });
  assert.equal(stagedRuns, 0);
  assert.equal(map.files().length, 1);
});

test('an unrecorded copy, a script outside the census and runtime internals earn nothing', async context => {
  const root = scratch(context);
  const dump = join(root, 'dump');
  write(join(root, 'original/tool.mjs'), TOOL);
  write(join(root, 'copy/tool.mjs'), TOOL);
  write(join(root, 'stray.mjs'), 'export const stray = 1;\n');
  runScript(join(root, 'copy/tool.mjs'), dump);
  runScript(join(root, 'stray.mjs'), dump);
  const { map, modules } = await measureNodeCoverage({
    directory: dump, included: [entry(join(root, 'original'), 'tool.mjs', TOOL)],
  });
  assert.equal(modules, 0);
  assert.deepEqual(map.files(), []);
});

test('a staged record for a file outside the census is ignored', async context => {
  const root = scratch(context);
  const dump = join(root, 'dump');
  write(join(root, 'original/tool.mjs'), TOOL);
  write(join(root, 'original/helper.mjs'), TOOL);
  const [staged] = stageInto(dump, { from: join(root, 'original'), to: join(root, 'fixture'), files: ['helper.mjs'] });
  runScript(staged, dump);
  const { map, stagedRuns } = await measureNodeCoverage({
    directory: dump, included: [entry(join(root, 'original'), 'tool.mjs', TOOL)],
  });
  assert.equal(stagedRuns, 0);
  assert.deepEqual(map.files(), []);
});

test('staged coverage is refused once the original no longer matches the staged bytes', async context => {
  const root = scratch(context);
  const dump = join(root, 'dump');
  write(join(root, 'original/tool.mjs'), TOOL);
  const [staged] = stageInto(dump, { from: join(root, 'original'), to: join(root, 'fixture'), files: ['tool.mjs'] });
  runScript(staged, dump);
  const edited = `${TOOL}// edited after the run\n`;
  await assert.rejects(measureNodeCoverage({ directory: dump, included: [entry(join(root, 'original'), 'tool.mjs', edited)] }),
    /Stale staged script: .*tool\.mjs/u);
});

test('one staged path claimed by two originals is ambiguous, and malformed records are refused', async context => {
  const root = scratch(context);
  const dump = join(root, 'dump');
  const included = [entry(join(root, 'original'), 'tool.mjs', TOOL)];
  const record = { original: join(root, 'original/tool.mjs'), staged: join(root, 'fixture/tool.mjs'), sha256: digest(TOOL) };
  write(join(dump, 'a.staged'), record);
  write(join(dump, 'b.staged'), record);
  await measureNodeCoverage({ directory: dump, included });
  write(join(dump, 'c.staged'), { ...record, original: join(root, 'original/other.mjs') });
  await assert.rejects(measureNodeCoverage({ directory: dump, included }), /Ambiguous staged script/u);
  rmSync(join(dump, 'c.staged'));
  for (const broken of [{ ...record, sha256: 'abc' }, { ...record, staged: 1 }, { staged: record.staged }]) {
    write(join(dump, 'd.staged'), broken);
    await assert.rejects(measureNodeCoverage({ directory: dump, included }), /Invalid staged record: d\.staged/u);
  }
});

test('refuses V8 data that is not a trustworthy measurement of the listed source', async context => {
  const root = scratch(context);
  const dump = join(root, 'dump');
  const script = join(root, 'original/tool.mjs');
  const included = [entry(join(root, 'original'), 'tool.mjs', TOOL)];
  const range = (startOffset, endOffset, count) => ({ startOffset, endOffset, count });
  const block = (overrides = {}) => ({ functionName: 'used', isBlockCoverage: true, ranges: [range(0, 10, 1)], ...overrides });
  const refusals = [
    [{}, /Invalid Node coverage/u],
    [{ result: [{ url: pathToFileURL(script).href }] }, /Missing V8 functions/u],
    [{ result: [{ url: pathToFileURL(script).href, functions: [] }] }, /Missing V8 functions/u],
    [{ result: [{ url: pathToFileURL(script).href, functions: [block({ functionName: 1 })] }] }, /Invalid V8 function/u],
    [{ result: [{ url: pathToFileURL(script).href, functions: [block({ isBlockCoverage: 'yes' })] }] }, /Invalid V8 block coverage/u],
    [{ result: [{ url: pathToFileURL(script).href, functions: [block({ ranges: [] })] }] }, /Missing V8 ranges/u],
    [{ result: [{ url: pathToFileURL(script).href, functions: [block({ ranges: [range(0, 10, -1)] })] }] }, /Invalid V8 count/u],
    [{ result: [{ url: pathToFileURL(script).href, functions: [block({ ranges: [range(0, 10, 1.5)] })] }] }, /Invalid V8 count/u],
    [{ result: [{ url: pathToFileURL(script).href, functions: [block({ ranges: [range(5, 2, 1)] })] }] }, /Invalid V8 range/u],
    [{ result: [{ url: pathToFileURL(script).href, functions: [block({ ranges: [range(0, TOOL.length + 1, 1)] })] }] }, /Invalid V8 range/u],
    [{ result: [{ url: pathToFileURL(script).href, functions: [block({ ranges: [range(-1, 2, 1)] })] }] }, /Invalid V8 range/u],
  ];
  for (const [data, message] of refusals) {
    write(join(dump, 'synthetic.json'), data);
    await assert.rejects(measureNodeCoverage({ directory: dump, included }), message, JSON.stringify(data).slice(0, 80));
  }
});

test('sources no test loaded are enrolled at zero without invented functions or branches', async context => {
  const root = scratch(context);
  const dump = join(root, 'dump');
  write(join(root, 'original/tool.mjs'), TOOL);
  write(join(root, 'original/untouched.mjs'), 'export const value = 1;\nexport function f() {}\n');
  runScript(join(root, 'original/tool.mjs'), dump);
  const included = [
    entry(join(root, 'original'), 'tool.mjs', TOOL),
    entry(join(root, 'original'), 'untouched.mjs', 'export const value = 1;\nexport function f() {}\n'),
  ];
  const { map } = await measureNodeCoverage({ directory: dump, included });
  assert.deepEqual(await enrollUnloaded(map, included), ['untouched.mjs']);
  assert.deepEqual(await enrollUnloaded(map, included), [], 'a source that is already enrolled is not enrolled twice');
  const gaps = coverageGaps(map, join(root, 'original'));
  assert.deepEqual(gaps['untouched.mjs'].uncoveredLines, ['1', '2']);
  assert.deepEqual(gaps['untouched.mjs'].uncoveredFunctions, []);
  assert.deepEqual(gaps['untouched.mjs'].uncoveredBranches, []);
  assert.equal(gaps['untouched.mjs'].summary.lines.pct, 0);
});

test('the census classifies every JavaScript file and never lets one pass unnoticed', async context => {
  const root = scratch(context);
  for (const file of ['index.js', 'scripts/tool.mjs', 'scripts/tool.test.mjs', 'flags/a.js', 'flags/nested/b.js', 'scripts/skip.cjs']) {
    write(join(root, file), file.startsWith('flags') ? '// GENERATED\n' : 'export {};\n');
  }
  for (const ignored of ['node_modules/pkg/index.js', 'coverage/report.js', '.git/hook.js', 'notes.md', 'data.json']) {
    write(join(root, ignored), 'ignored');
  }
  const exclude = [
    { pattern: /\.test\.mjs$/u, reason: 'test' },
    { pattern: /^scripts\/skip\.cjs$/u, reason: 'skipped' },
    { pattern: /^flags\//u, reason: 'generated', verify: (name, text) => assert.ok(text.startsWith('// GENERATED'), name) },
  ];
  const inventory = await sourceInventory({ root, include: ['index.js', 'scripts/tool.mjs'], exclude });
  assert.deepEqual(inventory.included.map(source => source.name), ['index.js', 'scripts/tool.mjs']);
  assert.equal(inventory.included[0].source, join(root, 'index.js'));
  assert.equal(inventory.included[0].text, 'export {};\n');
  assert.deepEqual(inventory.excluded.map(({ reason, count, sample }) => ({ reason, count, sample })), [
    { reason: 'generated', count: 2, sample: ['flags/a.js', 'flags/nested/b.js'] },
    { reason: 'skipped', count: 1, sample: ['scripts/skip.cjs'] },
    { reason: 'test', count: 1, sample: ['scripts/tool.test.mjs'] },
  ]);

  const narrowed = await sourceInventory({ root, directories: ['scripts'], include: ['scripts/tool.mjs'], exclude: exclude.slice(0, 2) });
  assert.deepEqual(narrowed.included.map(source => source.name), ['scripts/tool.mjs']);
  assert.equal(narrowed.excluded.reduce((total, group) => total + group.count, 0), 2);
});

test('the census samples at most five files per exclusion and groups them by rule', async context => {
  const root = scratch(context);
  write(join(root, 'index.js'), 'export {};\n');
  for (let index = 0; index < 8; index++) write(join(root, `generated/${index}.js`), '// GENERATED\n');
  const { excluded } = await sourceInventory({
    root, include: ['index.js'], exclude: [{ pattern: /^generated\//u, reason: 'generated' }],
  });
  assert.equal(excluded.length, 1);
  assert.equal(excluded[0].count, 8);
  assert.deepEqual(excluded[0].sample, ['generated/0.js', 'generated/1.js', 'generated/2.js', 'generated/3.js', 'generated/4.js']);
  assert.equal(excluded[0].pattern, String(/^generated\//u));
});

test('the census refuses unclassified files, false claims, missing listings and an empty list', async context => {
  const root = scratch(context);
  write(join(root, 'index.js'), 'export {};\n');
  write(join(root, 'scripts/new.mjs'), 'export {};\n');
  await assert.rejects(sourceInventory({ root, include: ['index.js'] }), /Unclassified JavaScript source: scripts\/new\.mjs/u);
  await assert.rejects(sourceInventory({
    root, include: ['index.js'],
    exclude: [{ pattern: /^scripts\//u, reason: 'generated', verify: name => { throw new Error(`${name} lacks the generator banner`); } }],
  }), /scripts\/new\.mjs lacks the generator banner/u);
  await assert.rejects(sourceInventory({ root, include: ['index.js', 'gone.mjs'], exclude: [{ pattern: /^scripts\//u, reason: 'x' }] }),
    /Listed source files are missing/u);
  await assert.rejects(sourceInventory({ root, include: [], exclude: [{ pattern: /./u, reason: 'everything' }] }),
    /Coverage source inventory is empty/u);
});

test('commands come from plain node scripts only', () => {
  assert.deepEqual(nodeCommands('node scripts/test.mjs'), [['scripts/test.mjs']]);
  assert.deepEqual(nodeCommands('node scripts/test.mjs && node --test scripts/a.test.mjs scripts/b.test.mjs'),
    [['scripts/test.mjs'], ['--test', 'scripts/a.test.mjs', 'scripts/b.test.mjs']]);
  assert.deepEqual(nodeCommands('node --test --test-concurrency=2 test/x.test.mjs'), [['--test', '--test-concurrency=2', 'test/x.test.mjs']]);
  assert.throws(() => nodeCommands('pnpm build && node scripts/test.mjs'), /Only plain node commands can run under coverage: pnpm build/u);
  for (const script of ['node scripts/test.mjs | cat', 'node "scripts/test.mjs"', 'node scripts/test.mjs; node x.mjs', 'node $HOME/x.mjs']) {
    assert.throws(() => nodeCommands(script), /Unsupported shell syntax/u, script);
  }
});

const floorMeasurement = (covered, total = 1000) => ({
  complete: true, fullMetricEnumeration: { lines: true, statements: true },
  total: { lines: { covered, total }, statements: { covered, total } },
});

test('the floor gates exact line and statement counts', () => {
  assert.doesNotThrow(() => assertCoverageFloor(floorMeasurement(950), 95));
  assert.throws(() => assertCoverageFloor(floorMeasurement(949), 95), /lines coverage 94\.900% is below 95%/u);
  const statements = floorMeasurement(950);
  statements.total.statements.covered = 949;
  statements.total.lines.pct = 100;
  assert.throws(() => assertCoverageFloor(statements, 95), /statements coverage 94\.900% is below 95%/u);
});

test('the floor refuses diagnostic runs, partial censuses and malformed counts', () => {
  assert.throws(() => assertCoverageFloor({ ...floorMeasurement(1000), complete: false }, 95), /Incomplete test runs/u);
  for (const metric of ['lines', 'statements']) {
    const partial = floorMeasurement(1000);
    partial.fullMetricEnumeration[metric] = false;
    assert.throws(() => assertCoverageFloor(partial, 95), new RegExp(`Incomplete ${metric} source census`, 'u'));
  }
  for (const counts of [{ covered: 0, total: 0 }, { covered: 11, total: 10 }, { covered: -1, total: 10 }, { covered: Number.NaN, total: 10 }, { covered: 1, total: Infinity }]) {
    const malformed = floorMeasurement(1000);
    malformed.total.lines = counts;
    assert.throws(() => assertCoverageFloor(malformed, 95), /Invalid lines coverage counts/u);
  }
  const missing = floorMeasurement(1000);
  delete missing.total.lines;
  assert.throws(() => assertCoverageFloor(missing, 95), /Invalid lines coverage counts/u);
});

/** Run `runNodeCoverage` for a throw-away package in a child process, so its output stays out of the report. */
function measurePackage(root, options) {
  const source = `import * as engine from ${JSON.stringify(engine)};
    const options = ${JSON.stringify(options)};
    options.exclude = (options.exclude ?? []).map(rule => ({ ...rule, pattern: new RegExp(rule.pattern, 'u') }));
    try {
      const outcome = await engine.runNodeCoverage({ root: ${JSON.stringify(root)}, ...options });
      console.log('OUTCOME ' + JSON.stringify({ exitCode: outcome.exitCode, metadata: outcome.metadata }));
    } catch (error) { console.log('REJECTED ' + error.message); }`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', source], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const line = result.stdout.split('\n').find(candidate => /^(?:OUTCOME|REJECTED) /u.test(candidate));
  assert.ok(line, `the child reported nothing:\n${result.stdout}\n${result.stderr}`);
  return line.startsWith('REJECTED ')
    ? { rejected: line.slice('REJECTED '.length), stderr: result.stderr }
    : { ...JSON.parse(line.slice('OUTCOME '.length)), stderr: result.stderr };
}

function fixturePackage(context, { test = 'node --test tool.test.mjs', testSource, files = {} } = {}) {
  const root = scratch(context);
  write(join(root, 'package.json'), { name: 'fixture', scripts: test === null ? {} : { test } });
  write(join(root, 'tool.mjs'), 'export function used() { return 1; }\nexport function unused() {\n  return 2;\n}\n');
  write(join(root, 'tool.test.mjs'), testSource ?? `import assert from 'node:assert/strict';\nimport test from 'node:test';\nimport { used } from './tool.mjs';\ntest('used', () => assert.equal(used(), 1));\n`);
  for (const [file, content] of Object.entries(files)) write(join(root, file), content);
  return root;
}

const OPTIONS = {
  label: 'fixture', floor: 50, include: ['tool.mjs'],
  exclude: [{ pattern: '\\.test\\.mjs$', reason: 'test' }],
};

test('a package run measures its own tests, writes the reports and enforces the floor', context => {
  const root = fixturePackage(context);
  const outcome = measurePackage(root, OPTIONS);
  assert.equal(outcome.exitCode, 0, outcome.stderr);
  const { metadata } = outcome;
  assert.equal(metadata.complete, true);
  assert.deepEqual(metadata.statuses, [0]);
  assert.deepEqual(metadata.included, ['tool.mjs']);
  assert.deepEqual(metadata.excluded.map(({ reason, count }) => ({ reason, count })), [{ reason: 'test', count: 1 }]);
  assert.deepEqual(metadata.unloaded, []);
  assert.equal(metadata.fullMetricEnumeration.functions, true);
  assert.deepEqual({ covered: metadata.total.lines.covered, total: metadata.total.lines.total }, { covered: 2, total: 4 });
  for (const file of ['coverage-final.json', 'coverage-summary.json', 'lcov.info', 'index.html', 'coverage-metadata.json', 'coverage-gaps.json']) {
    assert.equal(readdirSync(join(root, 'coverage')).includes(file), true, file);
  }
  assert.equal(JSON.parse(readFileSync(join(root, 'coverage/coverage-gaps.json'), 'utf8'))['tool.mjs'].uncoveredLines.length, 2);
  assert.equal(readdirSync(join(root, 'coverage')).includes('tmp'), false, 'scratch files never outlive the measurement');
  assert.equal(readdirSync(join(root, 'coverage/node-v8')).some(name => name.endsWith('.json')), true);
});

test('tests run with their scratch space inside the package, not the system temp directory', context => {
  const root = fixturePackage(context, {
    testSource: `import assert from 'node:assert/strict';\nimport { writeFileSync } from 'node:fs';\nimport { tmpdir } from 'node:os';\nimport test from 'node:test';\nimport { used } from './tool.mjs';\ntest('scratch', () => { used(); writeFileSync('scratch-dir.txt', tmpdir()); assert.ok(true); });\n`,
  });
  const outcome = measurePackage(root, OPTIONS);
  assert.equal(outcome.exitCode, 0, outcome.stderr);
  assert.equal(readFileSync(join(root, 'scratch-dir.txt'), 'utf8'), join(root, 'coverage', 'tmp'));
});

test('failing tests make the measurement diagnostic and the run fail', context => {
  const root = fixturePackage(context, {
    testSource: `import assert from 'node:assert/strict';\nimport test from 'node:test';\nimport { used } from './tool.mjs';\ntest('fails', () => assert.equal(used(), 2));\n`,
  });
  const outcome = measurePackage(root, OPTIONS);
  assert.equal(outcome.exitCode, 1);
  assert.equal(outcome.metadata.complete, false);
  assert.deepEqual(outcome.metadata.statuses, [1]);
  assert.match(outcome.stderr, /fixture: tests failed, so this coverage is diagnostic only/u);
});

test('a missed floor fails the run and says which counter missed it', context => {
  const root = fixturePackage(context);
  const outcome = measurePackage(root, { ...OPTIONS, floor: 99 });
  assert.equal(outcome.exitCode, 1);
  assert.equal(outcome.metadata.complete, true);
  assert.match(outcome.stderr, /lines coverage 50\.000% is below 99%/u);
});

test('a source that no test loads is counted at zero and reported', context => {
  const root = fixturePackage(context, { files: { 'untouched.mjs': 'export const never = 1;\n' } });
  const outcome = measurePackage(root, { ...OPTIONS, include: ['tool.mjs', 'untouched.mjs'], floor: 10 });
  assert.equal(outcome.exitCode, 0, outcome.stderr);
  assert.deepEqual(outcome.metadata.unloaded, ['untouched.mjs']);
  assert.equal(outcome.metadata.fullMetricEnumeration.lines, true);
  assert.equal(outcome.metadata.fullMetricEnumeration.functions, false);
  assert.equal(outcome.metadata.fullMetricEnumeration.branches, false);
  assert.match(outcome.stderr, /fixture: 1 source\(s\) never loaded, counted at zero: untouched\.mjs/u);
});

test('tests that execute none of the listed sources cannot produce a measurement', context => {
  const root = fixturePackage(context, {
    testSource: `import test from 'node:test';\ntest('unrelated', () => {});\n`,
  });
  assert.match(measurePackage(root, OPTIONS).rejected, /fixture tests did not execute any original source/u);
});

test('a package without the named script, or with a shell script, is refused before anything runs', context => {
  assert.match(measurePackage(fixturePackage(context, { test: null }), OPTIONS).rejected, /fixture has no test script to measure/u);
  assert.match(measurePackage(fixturePackage(context, { test: 'pnpm build && node tool.test.mjs' }), OPTIONS).rejected,
    /Only plain node commands can run under coverage/u);
});

test('the measured script can be chosen and extra environment reaches the tests', context => {
  const root = fixturePackage(context, {
    testSource: `import assert from 'node:assert/strict';\nimport test from 'node:test';\nimport { used } from './tool.mjs';\ntest('environment', () => { used(); assert.equal(process.env.FIXTURE_FLAG, '1'); });\n`,
    files: {
      'package.json': { name: 'fixture', scripts: { test: 'node never-runs.mjs', verify: 'node --test tool.test.mjs' } },
    },
  });
  const outcome = measurePackage(root, { ...OPTIONS, script: 'verify', environment: { FIXTURE_FLAG: '1' } });
  assert.equal(outcome.exitCode, 0, outcome.stderr);
  assert.deepEqual(outcome.metadata.statuses, [0]);
});

test('a test command killed by a signal counts as failed, and later commands still run', context => {
  const root = fixturePackage(context, {
    test: 'node --test tool.test.mjs && node abort.mjs && node --test tool.test.mjs',
    files: { 'abort.mjs': `process.kill(process.pid, 'SIGKILL');\n` },
  });
  const outcome = measurePackage(root, { ...OPTIONS, exclude: [{ pattern: '\\.test\\.mjs$|^abort\\.mjs$', reason: 'test' }] });
  assert.equal(outcome.exitCode, 1);
  assert.deepEqual(outcome.metadata.statuses, [0, 1, 0]);
  assert.equal(outcome.metadata.complete, false);
});
