import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { createScratchPackage } from '../scripts/scratch-package.mjs';

const exists = (file) => access(file).then(() => true, () => false);

/** Runs the browser driver from a scratch copy; `selection` receives the copy and sets the variables the driver reads. */
async function drive(selection) {
  const scratch = await createScratchPackage();
  try {
    const env = { ...process.env };
    for (const name of ['MAP_BROWSER', 'WTR_BROWSER', 'MAP_TEST_FONT']) delete env[name];
    Object.assign(env, selection(scratch.directory));
    const result = spawnSync(process.execPath, ['scripts/browser-test.mjs'], { cwd: scratch.directory, encoding: 'utf8', env, timeout: 60000 });
    return { ...result, started: await exists(join(scratch.directory, 'test-results')) };
  } finally {
    await scratch.remove();
  }
}

test('the browser driver refuses an unknown browser before doing any work', async () => {
  for (const variable of ['WTR_BROWSER', 'MAP_BROWSER']) {
    const result = await drive(() => ({ [variable]: 'netscape' }));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Unknown browser netscape/u);
    assert.equal(result.started, false, 'no results directory, archive or build is created');
  }
});

test('the browser driver refuses a font override that is not a standalone TrueType file', async () => {
  const result = await drive((directory) => ({ MAP_BROWSER: 'chromium', MAP_TEST_FONT: join(directory, 'package.json') }));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /No standalone TrueType test font found\. Set MAP_TEST_FONT to a valid \.ttf file\./u);
  assert.equal(result.started, false);
});
