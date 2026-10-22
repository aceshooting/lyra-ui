import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { access, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createScratchPackage } from '../scripts/scratch-package.mjs';

const preload = fileURLToPath(new URL('./build-bundler-preload.mjs', import.meta.url));
const exists = (file) => access(file).then(() => true, () => false);

/** Runs the engine build from a scratch copy with a bundler that reports `result`. */
async function build(context, result) {
  const scratch = await createScratchPackage();
  context.after(() => scratch.remove());
  const run = spawnSync(process.execPath, ['--import', preload, 'scripts/build.mjs'], {
    cwd: scratch.directory, encoding: 'utf8', env: { ...process.env, BUNDLER_RESULT: result },
  });
  return { ...run, directory: scratch.directory };
}

test('the build refuses a bundler result that contains anything but code chunks, before writing any module', async (context) => {
  const run = await build(context, 'with-asset');
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /Unexpected engine asset output\./u);
  assert.deepEqual(await readdir(join(run.directory, 'dist')), ['controls'], 'only the empty output skeleton exists');
  assert.equal(await exists(join(run.directory, 'dist/provenance.json')), false);
});

test('the build refuses a bundler result that lacks the chunk of an entry it must re-export', async (context) => {
  const withoutWorker = await build(context, 'without-worker');
  assert.notEqual(withoutWorker.status, 0);
  assert.match(withoutWorker.stderr, /Missing generated entry worker\.ts/u);
  assert.equal(await exists(join(withoutWorker.directory, 'dist/index.mjs')), true, 'the root entry was written before the worker entry was found missing');
  assert.equal(await exists(join(withoutWorker.directory, 'dist/worker.mjs')), false);
  assert.equal(await exists(join(withoutWorker.directory, 'dist/provenance.json')), false);
  const withoutIndex = await build(context, 'without-index');
  assert.notEqual(withoutIndex.status, 0);
  assert.match(withoutIndex.stderr, /Missing generated entry \0?lyra-map-entry/u);
  assert.equal(await exists(join(withoutIndex.directory, 'dist/index.mjs')), false);
});
