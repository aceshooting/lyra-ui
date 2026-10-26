import { readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { packageDirectory, runCommand } from './build.mjs';

function collect(directory, suffix, excluded = new Set()) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (excluded.has(path)) return [];
    return entry.isDirectory() ? collect(path, suffix, excluded) : path.endsWith(suffix) ? [path] : [];
  });
}

/** Browser-backed host scenarios have their own explicit test:saved-dashboard invocation. */
export function collectNodeTests(directory = packageDirectory) {
  const files = [
    ...collect(join(directory, '.test-output/src'), '.test.js'),
    ...collect(join(directory, 'test'), '.test.mjs', new Set([join(directory, 'test/host')])),
    ...collect(join(directory, 'scripts'), '.test.mjs'),
  ].sort();
  if (!files.length) throw new Error('No Node tests were discovered.');
  return files;
}

/** Removed source tests cannot survive in the compiled test inventory. */
export function runNodeTests(directory = packageDirectory, run = runCommand) {
  rmSync(join(directory, '.test-output'), { recursive: true, force: true });
  run(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['exec', 'tsc', '-p', 'tsconfig.test.json'], directory);
  run(process.execPath, ['--test', ...collectNodeTests(directory)], directory);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) runNodeTests();
