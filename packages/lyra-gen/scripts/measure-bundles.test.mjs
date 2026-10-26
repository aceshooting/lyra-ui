import test from 'node:test';
import assert from 'node:assert/strict';
import { builtExport, summarizeOutputs, deriveBudgets, checkBudgets } from './measure-bundles.mjs';

const bytes = text => new TextEncoder().encode(text);
test('uses published dist condition targets and rejects non-published exports', () => {
  const metadata = { name: '@example/package', exports: { './*.js': { types: './dist/*.d.ts', default: './dist/*.js' }, './theme.css': './dist/theme.css', './source': './src/index.ts' } };
  assert.equal(builtExport(metadata, '@example/package/parser.js'), './dist/parser.js');
  assert.equal(builtExport(metadata, '@example/package/theme.css'), './dist/theme.css');
  assert.throws(() => builtExport(metadata, '@example/package/source'));
  assert.throws(() => builtExport(metadata, '@example/package/missing'));
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
  const report = { packageVersion: '0.1.0', nodeVersion: '22.23.2', esbuildVersion: '1', profiles: [{ name: 'parser', totals: { eagerJsBytes: 1000, lazyJsBytes: 0 }, externalImports: [] }] };
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
