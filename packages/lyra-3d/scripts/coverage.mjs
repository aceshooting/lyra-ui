import { spawnSync } from 'node:child_process';
import { mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertCoverageTarget, reportCoverage } from './report-coverage.mjs';

// Measures the engine source with native V8 coverage: the Node unit tests run against an
// instrumented build (the shipped dist/ is never touched) and the Chromium suite runs a consumer
// bundle of the TypeScript sources. Set LYRA_3D_COVERAGE_BROWSER=0 for a unit-only report; the
// floor in report-coverage.mjs applies to whichever passes ran.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const coverage = resolve(root, 'coverage');
const browser = process.env.LYRA_3D_COVERAGE_BROWSER !== '0';

/** The child environment; scratch files stay inside the package, as /tmp may be memory backed. */
function environment(overrides = {}, removed = []) {
  const values = { ...process.env, TMPDIR: resolve(coverage, 'tmp'), ...overrides };
  for (const name of removed) delete values[name];
  return values;
}

function run(command, arguments_, env = environment()) {
  const result = spawnSync(command, arguments_, { cwd: root, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.signal) throw new Error(`${command} terminated by ${result.signal}`);
  return result.status ?? 1;
}

await rm(coverage, { recursive: true, force: true });
await mkdir(resolve(coverage, 'node-v8'), { recursive: true });
await mkdir(resolve(coverage, 'tmp'), { recursive: true });
const compileStatus = run('pnpm', ['exec', 'tsc', '-p', 'tsconfig.json', '--outDir', 'coverage/build/dist',
  '--sourceMap', '--inlineSources', '--declaration', 'false']);
if (compileStatus !== 0) process.exit(compileStatus);

const tests = (await readdir(resolve(root, 'test'))).filter((name) => name.endsWith('.test.mjs'))
  .sort().map((name) => `test/${name}`);
if (!tests.length) throw new Error('Coverage cannot run without unit test files');
const redirect = new URL('./coverage-redirect.mjs', import.meta.url).href;
const unitStatus = run(process.execPath, ['--test', '--test-concurrency=4', ...tests], environment({
  NODE_V8_COVERAGE: resolve(coverage, 'node-v8'),
  NODE_OPTIONS: [process.env.NODE_OPTIONS, `--import=${redirect}`].filter(Boolean).join(' '),
}));

let browserStatus;
if (browser) {
  // Always the complete suite on Chromium: clear any narrowing selector left in the shell. The suite
  // prints one JSON line per case; the log keeps the failing cases and the closing summary.
  const result = spawnSync(process.execPath, ['scripts/browser-test.mjs'], {
    cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['inherit', 'pipe', 'inherit'],
    env: environment({ LYRA_3D_COVERAGE: '1', LYRA_3D_BROWSER: 'chromium' }, ['LYRA_3D_TEST_CASES', 'LYRA_3D_GPU', 'WTR_BROWSER']),
  });
  if (result.error) throw result.error;
  browserStatus = result.signal ? 1 : result.status ?? 1;
  const lines = result.stdout.split('\n').filter(Boolean);
  for (const line of lines.filter((entry) => entry.includes('"passed":false'))) console.log(line);
  if (lines.length) console.log(lines.at(-1));
}
const metadata = await reportCoverage({ unitStatus, browserStatus });
const { lines, statements, functions, branches } = metadata.total;
console.log(`Coverage (${browser ? 'lines and statements from the unit tests and Chromium; functions and branches from the unit tests' : 'unit tests only'}): `
  + `lines ${lines.pct}% (${lines.covered}/${lines.total}), statements ${statements.pct}%, `
  + `functions ${functions.pct}% (${functions.covered}/${functions.total}), `
  + `branches ${branches.pct}% (${branches.covered}/${branches.total}). HTML report: coverage/index.html`);
process.exitCode = unitStatus || browserStatus || 0;
if (process.exitCode === 0) {
  try { assertCoverageTarget(metadata); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
