import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, mkdir, mkdtemp, readFile, readdir, readlink, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { LYRA_MAP_COVERAGE_FLOOR, assertCoverageTarget, originalOf, reportCoverage, sourceInventory } from '../scripts/report-coverage.mjs';
import { STAGED_RECORD_EXTENSION, createScratchPackage } from '../scripts/scratch-package.mjs';

// The text reporter prints its table to the test output; the artifact reporters are enough here.
const QUIET = ['json', 'json-summary', 'lcovonly', 'html'];

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const digest = (value) => createHash('sha256').update(value).digest('hex');

const sources = {
  'src/vite.mjs': 'export const plugin = 1;\n',
  'src/vite.d.ts': 'export declare const plugin: number;\n',
  'scripts/tool.mjs': 'export function used() { return 1; }\nexport function unused() { return 2; }\n',
  'scripts/loaded-later.mjs': 'export const value = 3;\n',
  'scripts/coverage.mjs': 'export const harness = true;\n',
  'scripts/report-coverage.mjs': 'export const reporter = true;\n',
  'scripts/notes.txt': 'not a module\n',
};

async function write(file, content) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, content);
}

/** A package tree with measured modules, a V8 output directory, and helpers to fill it. */
async function fixture(context) {
  const root = await mkdtemp(join(tmpdir(), 'lyra-map-coverage-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  for (const [name, content] of Object.entries(sources)) await write(join(root, name), content);
  const v8 = join(root, 'coverage/node-v8');
  await mkdir(v8, { recursive: true });
  return {
    root, v8,
    file: (name) => join(root, name),
    dump: (name, ...result) => write(join(v8, `${name}.json`), JSON.stringify({ result })),
    stage: (name, record) => write(join(v8, `${name}${STAGED_RECORD_EXTENSION}`), JSON.stringify(record)),
  };
}

/** V8 reports a module as one function spanning its whole source, then its nested functions. */
function script(file, source, ...functions) {
  return {
    url: pathToFileURL(file).href,
    functions: [
      { functionName: '', isBlockCoverage: true, ranges: [{ startOffset: 0, endOffset: source.length, count: 1 }] },
      ...functions.map(([functionName, snippet, count]) => {
        const startOffset = source.indexOf(snippet);
        assert.notEqual(startOffset, -1, snippet);
        return { functionName, isBlockCoverage: true, ranges: [{ startOffset, endOffset: startOffset + snippet.length, count }] };
      }),
    ],
  };
}
const UNUSED = ['unused', 'export function unused() { return 2; }', 0];
const USED = ['used', 'export function used() { return 1; }', 0];

test('the census lists the original modules and says why anything else is left out', async (context) => {
  const { root } = await fixture(context);
  const { included, excluded } = await sourceInventory(root);
  assert.deepEqual(included.map((entry) => relative(root, entry.source)),
    ['src/vite.mjs', 'scripts/loaded-later.mjs', 'scripts/tool.mjs']);
  assert.equal(included[2].text, sources['scripts/tool.mjs']);
  assert.deepEqual(excluded, [
    { source: 'src/vite.d.ts', reason: 'type declaration' },
    { source: 'scripts/coverage.mjs', reason: 'coverage harness' },
    { source: 'scripts/report-coverage.mjs', reason: 'coverage harness' },
  ]);
});

test('the census of this package covers the plugin and its scripts but not the harness', async () => {
  const { included, excluded } = await sourceInventory(packageRoot);
  const names = included.map((entry) => relative(packageRoot, entry.source));
  for (const name of ['src/vite.mjs', 'scripts/build.mjs', 'scripts/check-package.mjs', 'scripts/complete-transform.mjs',
    'scripts/prepared-mutations.mjs', 'scripts/scratch-package.mjs']) assert.ok(names.includes(name), name);
  assert.ok(names.every((name) => /^(?:src|scripts)\/[\w.-]+\.mjs$/u.test(name)));
  assert.ok(!names.includes('scripts/coverage.mjs') && !names.includes('scripts/report-coverage.mjs'));
  assert.deepEqual(excluded.map((entry) => entry.source).sort(), ['scripts/coverage.mjs', 'scripts/report-coverage.mjs', 'src/vite.d.ts']);
});

test('an empty census is refused instead of reporting a vacuous total', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'lyra-map-coverage-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'src'));
  await mkdir(join(root, 'scripts'));
  await assert.rejects(sourceInventory(root), /inventory is empty/u);
});

test('script URLs map to a module directly or through a staged copy of its current bytes', () => {
  const original = '/package/scripts/tool.mjs';
  const text = 'export const value = 1;\n';
  const texts = new Map([[original, text]]);
  const staged = new Map([['/scratch/scripts/tool.mjs', { original, staged: '/scratch/scripts/tool.mjs', sha256: digest(text) }]]);
  assert.equal(originalOf(original, texts, staged), original);
  assert.equal(originalOf('/scratch/scripts/tool.mjs', texts, staged), original);
  assert.equal(originalOf('/elsewhere/tool.mjs', texts, staged), undefined);
  const orphan = new Map([['/scratch/gone.mjs', { original: '/package/scripts/gone.mjs', staged: '/scratch/gone.mjs', sha256: digest('x') }]]);
  assert.equal(originalOf('/scratch/gone.mjs', texts, orphan), undefined, 'a copy of an unmeasured file is not credited');
  texts.set(original, `${text}export const edited = true;\n`);
  assert.throws(() => originalOf('/scratch/scripts/tool.mjs', texts, staged), /Stale staged script: \/package\/scripts\/tool\.mjs/u);
});

test('merges every process, credits staged copies and enrolls unloaded modules at zero', async (context) => {
  const { root, file, dump, stage } = await fixture(context);
  const tool = sources['scripts/tool.mjs'];
  const copy = join(root, 'gone/scripts/tool.mjs');
  // One process ran only `used`; another ran a copy of the file that only called `unused`.
  await dump('direct', script(file('scripts/tool.mjs'), tool, UNUSED), script(file('src/vite.mjs'), sources['src/vite.mjs']));
  await dump('copy', script(copy, tool, USED), script(join(root, 'test/other.test.mjs'), 'ignored\n'),
    { url: 'node:internal/process/execution', functions: [] });
  await stage('copy', { original: file('scripts/tool.mjs'), staged: copy, sha256: digest(tool) });

  const metadata = await reportCoverage({ base: root, reporters: QUIET, browserStatus: 0 });
  assert.equal(metadata.complete, true);
  assert.deepEqual([metadata.unitStatus, metadata.pipelineStatus, metadata.browserStatus], [0, 0, 0]);
  assert.equal(metadata.measuredScripts, 3);
  assert.equal(metadata.coverageFloor, LYRA_MAP_COVERAGE_FLOOR);
  assert.deepEqual(metadata.included, ['src/vite.mjs', 'scripts/loaded-later.mjs', 'scripts/tool.mjs']);
  assert.deepEqual(metadata.unloaded, ['scripts/loaded-later.mjs']);
  assert.deepEqual(metadata.fullMetricEnumeration, { statements: true, lines: true, branches: false, functions: false });
  assert.equal(metadata.total.lines.total, 4);
  assert.equal(metadata.total.lines.covered, 3, 'both functions of tool.mjs and the plugin are covered; only the unloaded module is not');
  assert.equal(metadata.total.statements.covered, 3);

  const gaps = JSON.parse(await readFile(join(root, 'coverage/coverage-gaps.json'), 'utf8'));
  assert.deepEqual(Object.keys(gaps).sort(), ['scripts/loaded-later.mjs', 'scripts/tool.mjs', 'src/vite.mjs']);
  assert.deepEqual(gaps['scripts/loaded-later.mjs'].uncoveredLines, ['1']);
  assert.deepEqual(gaps['scripts/tool.mjs'].uncoveredLines, []);
  const final = JSON.parse(await readFile(join(root, 'coverage/coverage-final.json'), 'utf8'));
  assert.ok(Object.values(final[file('scripts/loaded-later.mjs')].s).every((count) => count === 0));
  assert.ok(Object.values(final[file('scripts/tool.mjs')].s).every((count) => count > 0));
  assert.deepEqual(JSON.parse(await readFile(join(root, 'coverage/coverage-metadata.json'), 'utf8')).total, metadata.total);
  for (const output of ['coverage-summary.json', 'lcov.info', 'index.html']) assert.ok((await stat(join(root, 'coverage', output))).isFile(), output);
});

test('a run is complete only when every phase that ran succeeded and the browser driver ran', async (context) => {
  const { root, file, dump } = await fixture(context);
  await dump('only', script(file('src/vite.mjs'), sources['src/vite.mjs']));
  const complete = async (statuses) => (await reportCoverage({ base: root, reporters: QUIET, ...statuses })).complete;
  assert.equal(await complete({ browserStatus: 0 }), true);
  assert.equal(await complete({}), false, 'without the browser driver the census is incomplete');
  assert.equal(await complete({ unitStatus: 1, browserStatus: 0 }), false);
  assert.equal(await complete({ pipelineStatus: 1, browserStatus: 0 }), false);
  assert.equal(await complete({ browserStatus: 1 }), false);
});

test('refuses to report when no Node coverage was recorded or none of it is about the package', async (context) => {
  const { root, file, dump } = await fixture(context);
  await assert.rejects(reportCoverage({ base: root, reporters: QUIET }), /Missing Node V8 coverage/u);
  await write(join(root, 'coverage/node-v8/broken.json'), JSON.stringify({ result: 'none' }));
  await assert.rejects(reportCoverage({ base: root, reporters: QUIET }), /Invalid Node coverage/u);
  await rm(join(root, 'coverage/node-v8/broken.json'));
  await dump('foreign', script(join(root, 'test/other.test.mjs'), 'ignored\n'), { url: 'node:fs', functions: [] });
  await assert.rejects(reportCoverage({ base: root, reporters: QUIET }), /did not measure any package module/u);
  await dump('foreign', script(file('src/vite.mjs'), sources['src/vite.mjs']));
  assert.equal((await reportCoverage({ base: root, reporters: QUIET })).measuredScripts, 1);
});

test('refuses staged records that are malformed or no longer match the original', async (context) => {
  const { root, file, dump, stage } = await fixture(context);
  const tool = sources['scripts/tool.mjs'];
  const copy = join(root, 'gone/tool.mjs');
  await dump('copy', script(copy, tool));
  await stage('record', { original: file('scripts/tool.mjs'), staged: copy, sha256: 'not a digest' });
  await assert.rejects(reportCoverage({ base: root, reporters: QUIET }), /Invalid staged record: record\.staged/u);
  await stage('record', { original: file('scripts/tool.mjs'), staged: copy, sha256: digest(`${tool}// edited\n`) });
  await assert.rejects(reportCoverage({ base: root, reporters: QUIET }), /Stale staged script/u);
  await stage('record', { original: file('scripts/tool.mjs'), staged: copy, sha256: digest(tool) });
  assert.equal((await reportCoverage({ base: root, reporters: QUIET })).measuredScripts, 1);
});

test('refuses V8 data that cannot describe the measured source', async (context) => {
  const { root, file, dump } = await fixture(context);
  const path = file('scripts/tool.mjs');
  const tool = sources['scripts/tool.mjs'];
  const mutate = (change) => {
    const entry = script(path, tool, UNUSED);
    change(entry);
    return entry;
  };
  const refusals = [
    ['no functions', (entry) => { entry.functions = []; }, /Missing V8 functions/u],
    ['a module range that is not the whole source', (entry) => { entry.functions[0].ranges[0].endOffset -= 1; }, /Executed source differs from the measured module/u],
    ['a module without ranges', (entry) => { entry.functions[0].ranges = []; }, /Executed source differs from the measured module/u],
    ['a function without a name', (entry) => { entry.functions[1].functionName = undefined; }, /Invalid V8 function/u],
    ['an unknown block coverage mode', (entry) => { entry.functions[1].isBlockCoverage = 'yes'; }, /Invalid V8 block coverage/u],
    ['a function without ranges', (entry) => { entry.functions[1].ranges = []; }, /Missing V8 ranges/u],
    ['a negative count', (entry) => { entry.functions[1].ranges[0].count = -1; }, /Invalid V8 count/u],
    ['a fractional count', (entry) => { entry.functions[1].ranges[0].count = 0.5; }, /Invalid V8 count/u],
    ['a range past the end of the source', (entry) => { entry.functions[1].ranges[0].endOffset = tool.length + 1; }, /Invalid V8 range/u],
    ['a range that ends before it starts', (entry) => { Object.assign(entry.functions[1].ranges[0], { startOffset: 9, endOffset: 3 }); }, /Invalid V8 range/u],
    ['a fractional offset', (entry) => { entry.functions[1].ranges[0].startOffset = 0.5; }, /Invalid V8 range/u],
  ];
  for (const [name, change, message] of refusals) {
    await dump('data', mutate(change));
    await assert.rejects(reportCoverage({ base: root, reporters: QUIET }), message, name);
  }
  await dump('data', mutate(() => {}));
  assert.equal((await reportCoverage({ base: root, reporters: QUIET })).measuredScripts, 1);
});

const floorCount = Math.round(LYRA_MAP_COVERAGE_FLOOR * 1000);
function measurement() {
  return {
    complete: true, fullMetricEnumeration: { lines: true, statements: true },
    total: { lines: { covered: floorCount, total: 100000 }, statements: { covered: floorCount, total: 100000 },
      branches: { covered: 0, total: 100 }, functions: { covered: 0, total: 100 } },
  };
}

test('the coverage target accepts the floor and imposes none on branches or functions', () => {
  assert.doesNotThrow(() => assertCoverageTarget(measurement()));
});

test('the coverage target checks exact counts rather than supplied percentages', () => {
  for (const metric of ['lines', 'statements']) {
    const metadata = measurement();
    metadata.total[metric].covered = floorCount - 1;
    metadata.total[metric].pct = 100;
    assert.throws(() => assertCoverageTarget(metadata), new RegExp(`${metric} coverage .*% is below ${LYRA_MAP_COVERAGE_FLOOR}%`, 'u'));
  }
});

test('the coverage target refuses incomplete runs and incomplete source censuses', () => {
  const incomplete = measurement();
  incomplete.complete = false;
  assert.throws(() => assertCoverageTarget(incomplete), /Incomplete test runs/u);
  for (const metric of ['lines', 'statements']) {
    const metadata = measurement();
    metadata.fullMetricEnumeration[metric] = false;
    assert.throws(() => assertCoverageTarget(metadata), new RegExp(`Incomplete ${metric} source census`, 'u'));
  }
});

test('the coverage target refuses empty or malformed totals', () => {
  for (const counts of [{ total: 0, covered: 0 }, { total: 100, covered: 101 }, { total: 100, covered: -1 },
    { total: 100, covered: Number.NaN }, { total: Infinity, covered: Infinity }, undefined]) {
    const metadata = measurement();
    metadata.total.lines = counts;
    assert.throws(() => assertCoverageTarget(metadata), /Invalid lines coverage counts/u);
  }
});

test('a scratch package is a copy inside the package whose dependencies are the real ones', async () => {
  const scratch = await createScratchPackage({ coverageDirectory: null });
  try {
    assert.ok(scratch.directory.startsWith(join(packageRoot, 'coverage', 'scratch')), 'bundled module paths stay workspace relative');
    for (const name of ['scripts/build.mjs', 'scripts/check-package.mjs', 'src/vite.mjs', 'types/features.d.ts', 'UPSTREAM.json', 'package.json']) {
      assert.equal(await readFile(join(scratch.directory, name), 'utf8'), await readFile(join(packageRoot, name), 'utf8'), name);
    }
    assert.equal((await lstat(join(scratch.directory, 'node_modules'))).isSymbolicLink(), true);
    assert.equal(await readlink(join(scratch.directory, 'node_modules')), join(packageRoot, 'node_modules'));
    await assert.rejects(stat(join(scratch.directory, 'test')), { code: 'ENOENT' }, 'fixtures are only copied on request');
    await assert.rejects(stat(join(scratch.directory, 'dist')), { code: 'ENOENT' }, 'the shipped build is never copied');
  } finally {
    await scratch.remove();
  }
  await assert.rejects(stat(scratch.directory), { code: 'ENOENT' });
  await scratch.remove();
});

test('a scratch package for the browser driver also carries the fixtures and archive files', async () => {
  const scratch = await createScratchPackage({ browser: true, coverageDirectory: null });
  try {
    for (const name of ['test/browser/runtime.mjs', 'test/browser/fixture.mjs', 'test/browser/tile.pbf', 'README.md', 'LICENSE']) {
      assert.ok((await stat(join(scratch.directory, name))).isFile(), name);
    }
  } finally {
    await scratch.remove();
  }
});

test('scratch copies are recorded with the digest of the bytes copied when coverage is collected', async (context) => {
  const output = await mkdtemp(join(tmpdir(), 'lyra-map-records-'));
  context.after(() => rm(output, { recursive: true, force: true }));
  const scratch = await createScratchPackage({ coverageDirectory: join(output, 'v8') });
  try {
    const records = await Promise.all((await readdir(join(output, 'v8'))).map(async (name) => {
      assert.ok(name.endsWith(STAGED_RECORD_EXTENSION), name);
      return JSON.parse(await readFile(join(output, 'v8', name), 'utf8'));
    }));
    const modules = [];
    for (const directory of ['scripts', 'src']) {
      for (const name of await readdir(join(packageRoot, directory), { recursive: true })) {
        if (name.endsWith('.mjs')) modules.push(join(packageRoot, directory, name));
      }
    }
    assert.deepEqual(records.map((record) => record.original).sort(), modules.sort());
    for (const record of records) {
      assert.deepEqual(Object.keys(record).sort(), ['original', 'sha256', 'staged']);
      assert.ok(record.staged.startsWith(scratch.directory));
      assert.equal(record.sha256, digest(await readFile(record.original)));
      assert.equal(record.sha256, digest(await readFile(record.staged)));
      assert.equal(relative(scratch.directory, record.staged), relative(packageRoot, record.original));
    }
  } finally {
    await scratch.remove();
  }
});

test('scratch records go to NODE_V8_COVERAGE by default and nowhere when coverage is off', async (context) => {
  const output = await mkdtemp(join(tmpdir(), 'lyra-map-records-'));
  context.after(() => rm(output, { recursive: true, force: true }));
  const previous = process.env.NODE_V8_COVERAGE;
  process.env.NODE_V8_COVERAGE = join(output, 'default');
  try {
    const none = await createScratchPackage({ coverageDirectory: null });
    await none.remove();
    await assert.rejects(readdir(join(output, 'default')), { code: 'ENOENT' }, 'an explicit opt-out records nothing');
    const recorded = await createScratchPackage();
    await recorded.remove();
    assert.ok((await readdir(join(output, 'default'))).length > 10, 'the environment variable is the default destination');
  } finally {
    if (previous === undefined) delete process.env.NODE_V8_COVERAGE;
    else process.env.NODE_V8_COVERAGE = previous;
  }
});
