import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(await readFile(path.join(packageDir, 'package.json'), 'utf8'));
const leakedPaths = [
  'src/ai/types.contract.ts',
  'dist/ai/types.contract.js',
  'dist/ai/types.contract.d.ts',
];

test('compile-only AI assertions have no source or emitted runtime module', async () => {
  for (const relativePath of leakedPaths) {
    assert.equal(existsSync(path.join(packageDir, relativePath)), false, `${relativePath} must not exist`);
  }
  await assert.rejects(
    import(`${packageJson.name}/ai/types.contract`),
    /Cannot find module|ERR_MODULE_NOT_FOUND|ERR_PACKAGE_PATH_NOT_EXPORTED|Package subpath.*not defined/,
  );
});

test('the dry-run package file list excludes the compile-only AI contract', async () => {
  const { stdout } = await execFileAsync(
    'npm',
    ['pack', '--dry-run', '--json', '--ignore-scripts'],
    { cwd: packageDir, maxBuffer: 16 * 1024 * 1024 },
  );
  const report = JSON.parse(stdout);
  const files = new Set(report[0]?.files?.map((entry) => entry.path));
  for (const relativePath of leakedPaths) assert.equal(files.has(relativePath), false, relativePath);
});
