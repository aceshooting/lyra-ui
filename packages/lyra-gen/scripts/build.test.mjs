import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { buildPackage } from './build.mjs';

test('build removes stale emissions before compilation and preserves authored neighboring files', () => {
  const directory = mkdtempSync(join(tmpdir(), 'lyra-gen-build-test-'));
  try {
    mkdirSync(join(directory, 'dist'), { recursive: true });
    mkdirSync(join(directory, 'src'), { recursive: true });
    writeFileSync(join(directory, 'dist/retired.js'), 'retired');
    writeFileSync(join(directory, 'src/current.ts'), 'authored');
    let checked = false;
    buildPackage(directory, {
      run(_command, args, cwd) {
        assert.equal(cwd, directory);
        assert.deepEqual(args, ['exec', 'tsc', '-p', 'tsconfig.build.json']);
        assert.equal(existsSync(join(directory, 'dist/retired.js')), false);
        mkdirSync(join(directory, 'dist'));
        writeFileSync(join(directory, 'dist/current.js'), 'fresh');
      },
      check(cwd) { assert.equal(readFileSync(join(cwd, 'dist/current.js'), 'utf8'), 'fresh'); checked = true; },
    });
    assert.equal(checked, true);
    assert.equal(readFileSync(join(directory, 'src/current.ts'), 'utf8'), 'authored');
    assert.throws(() => buildPackage(directory, { run() { throw new Error('compiler failed'); }, check() { assert.fail('Failed compilation must not pass the artifact gate.'); } }), /compiler failed/u);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
