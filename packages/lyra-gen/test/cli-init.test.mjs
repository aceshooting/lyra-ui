import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import test from 'node:test';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCatalog, liveDashboardCatalog } from '../dist/catalog.js';
import { validateView } from '../dist/runtime.js';
import { validateSchema } from '../dist/schema.js';
import { createMockQueryProvider, mockLiveData } from '../dist/mock-data.js';

const cli = fileURLToPath(new URL('../bin/lyra-gen.mjs', import.meta.url));
const scratchRoot = fileURLToPath(new URL('../.test-output/', import.meta.url));
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });

test('init scaffolds a static starter whose canned view validates against its own catalog and mock data', async () => {
  await mkdir(scratchRoot, { recursive: true });
  const base = await mkdtemp(join(scratchRoot, 'init-'));
  try {
    const target = join(base, 'app');
    const result = run('init', target);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.deepEqual((await readdir(target)).sort(), ['dashboard-view.json', 'index.html', 'main.js', 'queries.json']);
    const html = await readFile(join(target, 'index.html'), 'utf8');
    assert.ok(!html.includes('__LYRA_GEN_VERSION__'));
    assert.match(html, /lyra-gen@\d+\.\d+\.\d+/);
    assert.match(await readFile(join(target, 'main.js'), 'utf8'), /createMockQueryProvider/);
    const view = JSON.parse(await readFile(join(target, 'dashboard-view.json'), 'utf8'));
    const queries = JSON.parse(await readFile(join(target, 'queries.json'), 'utf8'));
    const catalog = createCatalog({ ...liveDashboardCatalog, id: view.catalog.id, version: view.catalog.version, queries });
    const checked = validateView(view, catalog);
    assert.equal(checked.ok, true, JSON.stringify(checked.diagnostics));
    const live = mockLiveData(view, catalog, { seed: 1 });
    assert.equal(validateSchema(live.trend.datasets, catalog.components['series-chart'].properties.datasets).ok, true);
    const answer = await createMockQueryProvider(catalog, { seed: 1 })({ name: 'capacity', params: {} });
    assert.equal(validateSchema(answer, queries.capacity.result).ok, true);
  } finally { await rm(base, { recursive: true, force: true }); }
});

test('init refuses to overwrite existing files and rejects extra arguments', async () => {
  await mkdir(scratchRoot, { recursive: true });
  const base = await mkdtemp(join(scratchRoot, 'init-'));
  try {
    await writeFile(join(base, 'main.js'), 'keep');
    const result = run('init', base);
    assert.notEqual(result.status, 0);
    assert.equal(JSON.parse(result.stdout).diagnostics[0].code, 'init.exists');
    assert.equal(await readFile(join(base, 'main.js'), 'utf8'), 'keep');
    assert.deepEqual(await readdir(base), ['main.js']);
    assert.notEqual(run('init', 'a', 'b').status, 0);
    assert.notEqual(run('init', '--preset', 'x').status, 0);
  } finally { await rm(base, { recursive: true, force: true }); }
});
