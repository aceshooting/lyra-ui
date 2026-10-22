import { spawnSync } from 'node:child_process';
import { mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertCoverageTarget, reportCoverage } from './report-coverage.mjs';
import { createScratchPackage } from './scratch-package.mjs';

// Measures the package's own modules with native V8 coverage. The unit tests run in place; the
// build, the package checks and the Chromium driver run from a scratch copy, so the shipped dist
// is never touched. Set LYRA_MAP_COVERAGE_BROWSER=0 to leave the browser driver out.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const coverage = resolve(root, 'coverage');
const browser = process.env.LYRA_MAP_COVERAGE_BROWSER !== '0';
const v8Output = resolve(coverage, 'node-v8');

await rm(coverage, { recursive: true, force: true });
await mkdir(v8Output, { recursive: true });
await mkdir(resolve(coverage, 'tmp'), { recursive: true });
// Scratch files stay inside the package: the system temporary directory may be memory backed.
process.env.TMPDIR = resolve(coverage, 'tmp');


function run(command, arguments_, { cwd = root } = {}) {
  const env = { ...process.env, NODE_V8_COVERAGE: v8Output };
  const result = spawnSync(command, arguments_, { cwd, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.signal) throw new Error(`${command} terminated by ${result.signal}`);
  return result.status ?? 1;
}

const tests = (await readdir(resolve(root, 'test'))).filter((name) => name.endsWith('.test.mjs'))
  .sort().map((name) => `test/${name}`);
if (!tests.length) throw new Error('Coverage cannot run without unit test files');
const unitStatus = run(process.execPath, ['--test', '--test-concurrency=4', ...tests]);

let pipelineStatus = 0;
let browserStatus;
const scratch = await createScratchPackage({ browser, coverageDirectory: v8Output });
try {
  for (const script of ['build', 'check-package']) {
    pipelineStatus = run(process.execPath, [`scripts/${script}.mjs`], { cwd: scratch.directory });
    if (pipelineStatus !== 0) break;
  }
  if (browser && pipelineStatus === 0) {
    // Always the complete suite on Chromium, whatever browser the shell selects for other runs.
    // The driver prints one JSON line per case; the log keeps the failing cases and a summary.
    const env = { ...process.env, NODE_V8_COVERAGE: v8Output };
    for (const name of ['WTR_BROWSER', 'MAP_BROWSER']) delete env[name];
    const result = spawnSync(process.execPath, ['scripts/browser-test.mjs'], {
      cwd: scratch.directory, env, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['inherit', 'pipe', 'inherit'],
    });
    if (result.error) throw result.error;
    browserStatus = result.signal ? 1 : result.status ?? 1;
    const lines = result.stdout.split('\n').filter(Boolean);
    for (const line of lines.filter((entry) => entry.includes('"passed":false'))) console.log(line);
    const receipt = lines.filter((entry) => entry.startsWith('{"channel"')).at(-1);
    if (receipt) {
      const { channel, results } = JSON.parse(receipt);
      console.log(`${channel}: ${results.filter((entry) => entry.passed).length} of ${results.length} browser cases passed`);
    }
  }
} finally {
  await scratch.remove();
}
const metadata = await reportCoverage({ unitStatus, pipelineStatus, browserStatus });
const { lines, statements, functions, branches } = metadata.total;
console.log(`Coverage (${browser ? 'unit + build + checks + Chromium driver' : 'unit + build + checks'}): lines ${lines.pct}% (${lines.covered}/${lines.total}), `
  + `statements ${statements.pct}%, functions ${functions.pct}% (${functions.covered}/${functions.total}), `
  + `branches ${branches.pct}% (${branches.covered}/${branches.total}). HTML report: coverage/index.html`);
process.exitCode = unitStatus || pipelineStatus || browserStatus || 0;
if (process.exitCode === 0 && browser) {
  try { assertCoverageTarget(metadata); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
