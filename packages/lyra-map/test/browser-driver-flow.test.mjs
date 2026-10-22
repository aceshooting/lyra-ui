import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { access, copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createScratchPackage } from '../scripts/scratch-package.mjs';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const preload = fileURLToPath(new URL('./browser-driver-preload.mjs', import.meta.url));
const exists = (file) => access(file).then(() => true, () => false);

/** A font with one bounded table: all the driver's font check looks at. */
function font() {
  const bytes = Buffer.alloc(32);
  bytes.writeUInt32BE(0x00010000);
  bytes.writeUInt16BE(1, 4);
  bytes.write('head', 12);
  bytes.writeUInt32BE(28, 20);
  bytes.writeUInt32BE(4, 24);
  return bytes;
}

// The browser step of the driver, reduced to recording what it was given.
const RUNTIME = `import { appendFileSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const assets = process.env.MAP_TEST_ASSETS;
appendFileSync(process.env.RUNTIME_LOG, JSON.stringify({
  argv: process.argv.slice(2), assets, font: process.env.MAP_TEST_FONT, result: process.env.MAP_TEST_RESULT,
  files: readdirSync(assets).sort(), receipt: JSON.parse(readFileSync(join(assets, 'receipt.json'), 'utf8')),
  entry: readFileSync(join(assets, 'entry-1.mjs'), 'utf8'),
}) + '\\n');
if (process.env.RUNTIME_MODE === 'killed') process.kill(process.pid, 'SIGKILL');
process.exitCode = Number(process.env.RUNTIME_STATUS ?? 0);
`;

/** A scratch copy of the package with the smallest built output the driver can pack, and the pieces a run needs. */
async function prepare(context) {
  const scratch = await createScratchPackage({ browser: true });
  context.after(() => scratch.remove());
  const { directory } = scratch;
  await mkdir(join(directory, 'dist'), { recursive: true });
  await copyFile(join(packageRoot, 'src/vite.mjs'), join(directory, 'dist/vite.mjs'));
  await writeFile(join(directory, 'dist/map.css'), '.maplibregl-map { display: block; }\n');
  await writeFile(join(directory, 'test/browser/runtime.mjs'), RUNTIME);
  await writeFile(join(directory, 'font.ttf'), font());
  await mkdir(join(directory, 'tmp'));
  return { directory, font: join(directory, 'font.ttf'), log: join(directory, 'runtime-log.jsonl'), temporary: join(directory, 'tmp') };
}

const VARIABLES = ['MAP_BROWSER', 'WTR_BROWSER', 'MAP_TEST_FONT', 'DRIVER_FAULT', 'DRIVER_BUNDLER', 'RUNTIME_MODE', 'RUNTIME_STATUS'];

/** Runs the driver from the scratch copy with the preload; `env` entries override the defaults, `null` removes one. */
function drive(scratch, env = {}) {
  const base = { ...process.env };
  for (const name of VARIABLES) delete base[name];
  const merged = {
    ...base, MAP_BROWSER: 'chromium', MAP_TEST_FONT: scratch.font, RUNTIME_LOG: scratch.log, DRIVER_BUNDLER: 'ok',
    TMPDIR: scratch.temporary, ...env,
  };
  for (const [name, value] of Object.entries(merged)) if (value === null) delete merged[name];
  return spawnSync(process.execPath, ['--import', preload, 'scripts/browser-test.mjs'], {
    cwd: scratch.directory, encoding: 'utf8', timeout: 120000, env: merged,
  });
}

/** The driver's own temporary directories left in the scratch temp directory (Node keeps a compile cache there too). */
const leftovers = async (scratch) => (await readdir(scratch.temporary)).filter((name) => name.startsWith('lyra-map-browser-'));
const runs = async (scratch) => (await exists(scratch.log) ? (await readFile(scratch.log, 'utf8')).trim().split('\n').map((line) => JSON.parse(line)) : []);

test('the driver packs the package, bundles a consumer, hands the browser step its assets and removes them afterwards', async (context) => {
  const scratch = await prepare(context);
  const result = drive(scratch, { MAP_BROWSER: 'edge' });
  assert.equal(result.status, 0, result.stderr);
  const [run, ...others] = await runs(scratch);
  assert.deepEqual(others, [], 'the browser step ran once');
  assert.deepEqual(run.argv, ['msedge'], 'the edge alias selects the msedge channel');
  assert.equal(run.font, scratch.font);
  assert.equal(run.result, join(scratch.directory, 'test-results/msedge.json'));
  for (const file of ['data.json', 'dem.png', 'entry-1.mjs', 'fixture.mjs', 'map.css', 'raster.png', 'receipt.json', 'tile.pbf']) {
    assert.ok(run.files.includes(file), `${file} is among the assets handed to the browser step`);
  }
  assert.deepEqual(run.receipt, { entries: [{ file: 'entry-1.mjs', facade: '\0modular-entry' }] });
  assert.equal(run.entry, 'export const marker = 1;');
  assert.equal(await exists(run.assets), false, 'the assets directory does not outlive the run');
  assert.deepEqual(await leftovers(scratch), [], 'no temporary directory is left behind');
  const build = JSON.parse(await readFile(join(scratch.directory, 'test-results/msedge-build.json'), 'utf8'));
  assert.deepEqual(build.font, { file: 'font.ttf', bytes: 32, sha256: build.font.sha256 });
  assert.match(build.archiveSha256, /^[0-9a-f]{64}$/u);
  assert.deepEqual(build.chunks.map((chunk) => [chunk.file, chunk.bytes]), [['entry-1.mjs', 'export const marker = 1;'.length]]);
});

test('without a browser selection the driver runs the browser step for Chromium, and either variable selects another', async (context) => {
  const scratch = await prepare(context);
  assert.equal(drive(scratch, { MAP_BROWSER: null }).status, 0);
  assert.equal(drive(scratch, { MAP_BROWSER: 'firefox' }).status, 0);
  assert.equal(drive(scratch, { MAP_BROWSER: 'chromium', WTR_BROWSER: 'webkit' }).status, 0);
  assert.deepEqual((await runs(scratch)).map((run) => run.argv), [['chromium'], ['firefox'], ['webkit']],
    'WTR_BROWSER takes precedence over MAP_BROWSER');
});

test('the driver exits with the status of the browser step, and with failure when that step is killed', async (context) => {
  const scratch = await prepare(context);
  assert.equal(drive(scratch, { RUNTIME_STATUS: '7' }).status, 7);
  const killed = drive(scratch, { RUNTIME_MODE: 'killed' });
  assert.equal(killed.status, 1, 'a step ended by a signal has no status and counts as a failure');
  assert.equal((await runs(scratch)).length, 2, 'both runs reached the browser step');
});

test('a bundler warning in the consumer build fails the run before the browser step', async (context) => {
  const scratch = await prepare(context);
  const result = drive(scratch, { DRIVER_BUNDLER: 'warning' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Consumer build warning UNRESOLVED_IMPORT: Could not resolve missing/u);
  assert.deepEqual(await runs(scratch), []);
  assert.deepEqual(await leftovers(scratch), [], 'the assets directory is removed after a failure too');
});

test('a consumer bundle without its entry chunk fails the run', async (context) => {
  const scratch = await prepare(context);
  const result = drive(scratch, { DRIVER_BUNDLER: 'no-entry' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing browser fixture entry/u);
  assert.deepEqual(await runs(scratch), []);
});

test('a step that cannot be started, or that fails, is reported with its own message', async (context) => {
  const scratch = await prepare(context);
  const cases = [
    ['an archiver that cannot be started', { DRIVER_FAULT: 'npm-unavailable' }, /spawnSync npm ENOENT/u],
    ['an archiver that fails and reports on stdout', { DRIVER_FAULT: 'npm-fails-quietly' }, /npm failed: npm reported on stdout/u],
    ['an extraction that fails', { DRIVER_FAULT: 'tar-fails' }, /tar failed: tar: unexpected end of archive/u],
    ['a browser step that cannot be started', { DRIVER_FAULT: 'runtime-unavailable' }, /spawnSync node EPERM/u],
  ];
  for (const [name, env, message] of cases) {
    const result = drive(scratch, env);
    assert.notEqual(result.status, 0, name);
    assert.match(result.stderr, message, name);
    assert.deepEqual(await leftovers(scratch), [], `${name}: nothing is left behind`);
  }
  assert.deepEqual(await runs(scratch), [], 'no failed run reached the browser step');
});

test('without fontconfig and without an override the driver cannot pick a font and stops before doing any work', async (context) => {
  const scratch = await prepare(context);
  const empty = join(scratch.directory, 'empty-path');
  await mkdir(empty);
  const result = drive(scratch, { PATH: empty, MAP_TEST_FONT: null });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /No standalone TrueType test font found\. Set MAP_TEST_FONT to a valid \.ttf file\./u);
  assert.equal(await exists(join(scratch.directory, 'test-results')), false);
});
