import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import test from 'node:test';
import { collectNodeTests, runNodeTests } from './run-tests.mjs';

test('Node test discovery excludes the browser host subtree without losing other nested or tooling tests', () => {
  const directory = mkdtempSync(join(tmpdir(), 'lyra-gen-node-tests-'));
  const write = file => { mkdirSync(join(directory, file, '..'), { recursive: true }); writeFileSync(join(directory, file), ''); };
  try {
    for (const file of ['.test-output/src/runtime.test.js', 'test/cli.test.mjs', 'test/host/saved-dashboard.test.mjs', 'test/host/nested/browser.test.mjs', 'test/nested/data.test.mjs', 'scripts/build.test.mjs']) write(file);
    assert.deepEqual(collectNodeTests(directory).map(file => relative(directory, file)), [
      '.test-output/src/runtime.test.js', 'scripts/build.test.mjs', 'test/cli.test.mjs', 'test/nested/data.test.mjs',
    ]);
    let compiled = false;
    runNodeTests(directory, (_command, args, cwd) => {
      assert.equal(cwd, directory);
      if (args[0] === 'exec') {
        assert.equal(existsSync(join(directory, '.test-output/src/runtime.test.js')), false);
        assert.deepEqual(args, ['exec', 'tsc', '-p', 'tsconfig.test.json']);
        write('.test-output/src/current.test.js'); compiled = true;
      } else {
        assert.equal(compiled, true);
        assert.equal(args[0], '--test');
        assert.ok(args.some(file => file.endsWith('current.test.js')));
        assert.ok(!args.some(file => file.includes('/host/') || file.endsWith('runtime.test.js')));
      }
    });
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
