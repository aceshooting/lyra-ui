import { spawnSync } from 'node:child_process';
import { mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertCoverageTarget, reportCoverage } from './report-coverage.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const coverage = resolve(root, 'coverage');

function run(command, arguments_, environment = {}) {
  const result = spawnSync(command, arguments_, {
    cwd: root, env: { ...process.env, ...environment }, stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.signal) throw new Error(`${command} terminated by ${result.signal}`);
  return result.status ?? 1;
}

await rm(coverage, { recursive: true, force: true });
await rm(resolve(root, '.coverage-output'), { recursive: true, force: true });
await mkdir(resolve(coverage, 'node-v8'), { recursive: true });
for (const arguments_ of [
  ['run', 'build'],
  ['exec', 'tsc', '--noEmit', '-p', 'tsconfig.exports.json'],
  ['exec', 'tsc', '-p', 'tsconfig.test.json', '--outDir', '.coverage-output', '--sourceMap', '--inlineSources'],
]) {
  const status = run('pnpm', arguments_);
  if (status !== 0) process.exit(status);
}
const testDirectory = resolve(root, '.coverage-output/src/docx');
const tests = (await readdir(testDirectory)).filter(name => name.endsWith('.test.js'))
  .sort().map(name => resolve(testDirectory, name));
if (!tests.length) throw new Error('Coverage cannot run without unit test files');
const unitStatus = run(process.execPath, [
  '--test', '--test-concurrency=2', ...tests, 'scripts/package.test.mjs', 'scripts/coverage.test.mjs', 'test/xml.test.mjs',
], { NODE_V8_COVERAGE: resolve(coverage, 'node-v8') });
// Always the complete suite: clear any narrowing selector left in the shell.
const browserStatus = run(process.execPath, ['scripts/browser-test.mjs'], {
  DOCX_COVERAGE: '1', DOCX_BROWSERS: 'chromium', DOCX_PERFORMANCE: '0',
  DOCX_LAYOUT_ONLY: '', DOCX_FORMATTING_ONLY: '', DOCX_INSERTION_ONLY: '', DOCX_IMAGES_ONLY: '',
});
const metadata = await reportCoverage({ root, unitStatus, browserStatus });
process.exitCode = unitStatus || browserStatus;
if (process.exitCode === 0) assertCoverageTarget(metadata);
