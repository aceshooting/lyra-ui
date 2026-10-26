import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as measurement from './measure-bundles.mjs';
import { builtExport, summarizeOutputs, deriveBudgets, checkBudgets } from './measure-bundles.mjs';

const bytes = text => new TextEncoder().encode(text);
test('uses published dist condition targets and rejects non-published exports', () => {
  const metadata = { name: '@example/package', exports: { './*.js': { types: './dist/*.d.ts', default: './dist/*.js' }, './theme.css': './dist/theme.css', './source': './src/index.ts' } };
  assert.equal(builtExport(metadata, '@example/package/parser.js'), './dist/parser.js');
  assert.equal(builtExport(metadata, '@example/package/theme.css'), './dist/theme.css');
  assert.throws(() => builtExport(metadata, '@example/package/source'));
  assert.throws(() => builtExport(metadata, '@example/package/missing'));
});

function versionedReport() {
  return { packageVersion: '1.0.0', uiVersion: '30.2.0', nodeVersion: '22.23.2', esbuildVersion: '0.28.2',
    profiles: [{ name: 'parser', totals: { eagerJsBytes: 1000, lazyJsBytes: 0, eagerCssBytes: 100, assetBytes: 5 }, externalImports: ['dynamic-import:optional-peer'] }] };
}

for (const versions of [
  { packageVersion: '1.0.0', uiVersion: '30.3.0' },
  { packageVersion: '1.1.0', uiVersion: '30.2.0' },
  { packageVersion: '2.0.0', uiVersion: '31.0.0' },
]) {
  test(`refreshes only reviewed package stamps to ${versions.packageVersion}/${versions.uiVersion}`, () => {
    const originalReport = versionedReport();
    const budgets = deriveBudgets(originalReport);
    const report = { ...originalReport, ...versions, profiles: [{ ...originalReport.profiles[0],
      totals: { ...originalReport.profiles[0].totals, eagerJsBytes: 1010 } }] };
    const beforeReport = structuredClone(report);
    const beforeBudgets = structuredClone(budgets);
    const refreshed = measurement.refreshBudgetVersions(report, budgets);
    assert.deepEqual(report, beforeReport);
    assert.deepEqual(budgets, beforeBudgets);
    assert.deepEqual(refreshed, { ...beforeBudgets, ...versions });
    for (const key of ['profiles', 'policy', 'nodeVersion', 'esbuildVersion']) {
      assert.equal(JSON.stringify(refreshed[key]), JSON.stringify(beforeBudgets[key]), `${key} remains byte-identical`);
    }
    assert.equal(refreshed.profiles.parser.measured.eagerJsBytes, 1000);
    assert.equal(refreshed.profiles.parser.ceilings.eagerJsBytes, 1020);
    checkBudgets(report, refreshed);
  });
}

test('version refresh is idempotent and refuses missing, unstable, malformed or regressing versions', () => {
  const report = versionedReport();
  const budgets = deriveBudgets(report);
  assert.deepEqual(measurement.refreshBudgetVersions(report, budgets), budgets);
  for (const key of ['packageVersion', 'uiVersion']) {
    for (const version of [undefined, null, '', '01.0.0', '1.0', '1.0.0-beta.1', '1.0.0+build', 1, '99999999999999999999.0.0']) {
      assert.throws(() => measurement.refreshBudgetVersions({ ...report, [key]: version }, budgets));
      assert.throws(() => measurement.refreshBudgetVersions(report, { ...budgets, [key]: version }));
      assert.throws(() => deriveBudgets({ ...report, [key]: version }));
    }
    assert.throws(() => measurement.refreshBudgetVersions({ ...report, [key]: '0.0.1' }, budgets));
  }
});

test('version refresh rejects size, toolchain, profile and external drift without changing budgets', () => {
  const report = versionedReport();
  const budgets = deriveBudgets(report);
  const unchanged = JSON.stringify(budgets);
  const advanced = { ...report, uiVersion: '30.3.0' };
  const profile = report.profiles[0];
  for (const changed of [
    { ...advanced, nodeVersion: '22.23.3' },
    { ...advanced, esbuildVersion: '0.29.0' },
    { ...advanced, profiles: [] },
    { ...advanced, profiles: [{ ...profile, name: 'different' }] },
    { ...advanced, profiles: [{ ...profile, externalImports: [] }] },
    { ...advanced, profiles: [{ ...profile, totals: { ...profile.totals, eagerJsBytes: 1021 } }] },
    { ...advanced, profiles: [{ ...profile, totals: { ...profile.totals, assetBytes: 6 } }] },
    { ...advanced, profiles: [{ ...profile, totals: { eagerJsBytes: 1000 } }] },
    { ...advanced, profiles: [{ ...profile, totals: { ...profile.totals, eagerJsBytes: -1 } }] },
  ]) {
    assert.throws(() => measurement.refreshBudgetVersions(changed, budgets));
    assert.equal(JSON.stringify(budgets), unchanged);
  }
  const loosened = structuredClone(budgets);
  loosened.profiles.parser.ceilings.eagerJsBytes = 2000;
  assert.throws(() => measurement.refreshBudgetVersions(advanced, loosened));
});

test('CLI rejects conflicting budget modes before measuring or writing output', () => {
  const result = spawnSync(process.execPath, [new URL('./measure-bundles.mjs', import.meta.url).pathname,
    '--refresh-versions', '--write-budgets'], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /cannot combine --refresh-versions with --write-budgets/);
});

test('refreshing an existing budget truncates shorter advancing version stamps and preserves failed inputs', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lyra-gen-budget-refresh-'));
  const file = join(directory, 'budgets.json');
  const missing = join(directory, 'missing.json');
  try {
    const baseline = { ...versionedReport(), packageVersion: '0.99.99', uiVersion: '1.99.99' };
    const budgets = deriveBudgets(baseline);
    const original = `${JSON.stringify(budgets, null, 2)}\n`;
    await writeFile(file, original, { flag: 'wx' });
    const advanced = { ...baseline, packageVersion: '1.0.0', uiVersion: '2.0.0' };
    const proposed = measurement.refreshBudgetVersions(advanced, budgets);
    const expected = `${JSON.stringify(proposed, null, 2)}\n`;
    assert.ok(expected.length < original.length);
    await measurement.refreshBudgetFile(advanced, file);
    const contents = await readFile(file, 'utf8');
    assert.equal(contents, expected);
    assert.deepEqual(JSON.parse(contents), proposed);
    assert.deepEqual(JSON.parse(contents).profiles, budgets.profiles);

    const oversized = { ...advanced, profiles: [{ ...advanced.profiles[0],
      totals: { ...advanced.profiles[0].totals, eagerJsBytes: 1021 } }] };
    await assert.rejects(measurement.refreshBudgetFile(oversized, file), /budget exceeded/);
    assert.equal(await readFile(file, 'utf8'), expected);
    await assert.rejects(measurement.refreshBudgetFile(advanced, missing), { code: 'ENOENT' });
    await assert.rejects(readFile(missing), { code: 'ENOENT' });
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('separates eager closure, CSS, lazy JS and every external import without double counting', () => {
  const result = {
    metafile: { outputs: {
      'out/entry.js': { entryPoint: '<stdin>', imports: [{ path: 'out/shared.js', kind: 'import-statement' }, { path: 'out/lazy.js', kind: 'dynamic-import' }], cssBundle: 'out/entry.css' },
      'out/shared.js': { imports: [] },
      'out/lazy.js': { imports: [{ path: 'out/shared.js', kind: 'import-statement' }, { path: 'optional-peer', kind: 'dynamic-import', external: true }] },
      'out/entry.css': { imports: [] },
    } },
    outputFiles: ['entry.js', 'shared.js', 'lazy.js', 'entry.css'].map(file => ({ path: `/fixture/out/${file}`, contents: bytes(file) })),
  };
  const measured = summarizeOutputs(result, '/fixture');
  assert.equal(measured.totals.eagerJsBytes, 'entry.jsshared.js'.length);
  assert.equal(measured.totals.lazyJsBytes, 'lazy.js'.length);
  assert.equal(measured.totals.eagerCssBytes, 'entry.css'.length);
  assert.deepEqual(measured.externalImports, ['dynamic-import:optional-peer']);
  assert.ok(measured.files.every(file => !file.file.includes('/')));
  assert.equal(measured.files.find(file => file.file === 'lazy.js').phase, 'lazy');
});

test('derives ceilings from measured bytes and rejects toolchain, inventory and size drift', () => {
  const report = { packageVersion: '0.1.0', uiVersion: '30.2.0', nodeVersion: '22.23.2', esbuildVersion: '1', profiles: [{ name: 'parser', totals: { eagerJsBytes: 1000, lazyJsBytes: 0 }, externalImports: [] }] };
  const budget = deriveBudgets(report);
  assert.equal(budget.profiles.parser.measured.eagerJsBytes, 1000);
  assert.equal(budget.profiles.parser.ceilings.eagerJsBytes, 1020);
  assert.equal(budget.profiles.parser.ceilings.lazyJsBytes, 0);
  checkBudgets(report, budget);
  assert.throws(() => checkBudgets({ ...report, nodeVersion: '22.0.0' }, budget));
  assert.throws(() => checkBudgets({ ...report, profiles: [{ ...report.profiles[0], totals: { eagerJsBytes: 1021, lazyJsBytes: 0 } }] }, budget));
  assert.throws(() => checkBudgets({ ...report, profiles: [{ ...report.profiles[0], externalImports: ['dynamic-import:peer'] }] }, budget));
  assert.throws(() => deriveBudgets({ ...report, profiles: [{ ...report.profiles[0], totals: { eagerJsBytes: -1 } }] }));
  const loosened = structuredClone(budget); loosened.profiles.parser.ceilings.eagerJsBytes = 2000;
  assert.throws(() => checkBudgets(report, loosened));
});
