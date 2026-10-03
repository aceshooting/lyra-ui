import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { assertCoverageTarget, reportCoverage, sourceInventory } from './report-coverage.mjs';

async function write(file, content) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, content);
}

async function fixture(context) {
  const root = await mkdtemp(resolve(tmpdir(), 'lyra-docs-coverage-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const code = 'export const value = 1;\n';
  for (const name of ['node', 'editor', 'untouched', 'types', 'view.styles', 'view.test', 'admission-fixtures']) {
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
    ['no emitted runtime code', 'test', 'test fixture']);
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

function targetMeasurement() {
  return {
    complete: true, fullMetricEnumeration: { lines: true, statements: true },
    total: { lines: { covered: 99600, total: 100000 }, statements: { covered: 99600, total: 100000 },
      branches: { covered: 0, total: 100 }, functions: { covered: 0, total: 100 } },
  };
}

test('coverage target accepts the verified line floor without imposing a branch or function target', () => {
  assert.doesNotThrow(() => assertCoverageTarget(targetMeasurement()));
});

test('coverage target checks exact counts rather than rounded or supplied percentages', () => {
  for (const metric of ['lines', 'statements']) {
    const metadata = targetMeasurement();
    metadata.total[metric].covered = 99599;
    metadata.total[metric].pct = 100;
    assert.throws(() => assertCoverageTarget(metadata), /is below 99\.6%/u);
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
