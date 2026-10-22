import { spawnSync } from 'node:child_process';
import { mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertCoverageTarget, assertToolingTarget, reportCoverage } from './report-coverage.mjs';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Original Node tooling, measured from the same V8 dumps as the TypeScript. Tests and the browser
 * suites (which run in Chromium, not Node) are not subjects of the report; the helpers they share are
 * real code and are measured. The listed scripts execute for real during the build (`build`,
 * `build-engine`, `check-package`, `engine/source`), in the unit suites, in the browser harness
 * (`static-files`) or in the performance run (`performance`). The TypeScript engine entries under
 * `scripts/engine/entries` are compiled by the engine build rather than run by Node and so are not
 * part of this JavaScript census. Every other JavaScript file under `scripts/` must be classified,
 * so a new script cannot silently leave the report.
 */
export const TOOLING = Object.freeze({
  directories: ['scripts'],
  include: [
    'scripts/build.mjs', 'scripts/build-engine.mjs', 'scripts/check-package.mjs', 'scripts/coverage.mjs',
    'scripts/performance.mjs', 'scripts/report-coverage.mjs', 'scripts/engine/source.mjs',
    'scripts/lib/editor-tags.mjs', 'scripts/lib/engine-imports.mjs', 'scripts/lib/node-coverage.mjs',
    'scripts/lib/staged-script.mjs', 'scripts/lib/static-files.mjs',
  ],
  exclude: [
    { pattern: /\.test\.mjs$/u, reason: 'test' },
    { pattern: /(?:-browser|^scripts\/browser-test|^scripts\/lib\/harness)\.mjs$/u, reason: 'browser test suite/harness' },
  ],
});

/** Unit suites that run beside the compiled `src` suites: they need no built `dist` of their own. */
const UNIT_SUITES = [
  'scripts/package.test.mjs', 'scripts/coverage.test.mjs', 'scripts/node-coverage.test.mjs', 'scripts/source-preparation.test.mjs',
  'scripts/static-files.test.mjs', 'scripts/build-engine.test.mjs', 'scripts/engine/source.test.mjs',
  'scripts/engine/distribution.test.mjs', 'test/xml.test.mjs',
];

export function runCommand(root, command, arguments_, environment = {}) {
  const result = spawnSync(command, arguments_, {
    cwd: root, env: { ...process.env, ...environment }, stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.signal) throw new Error(`${command} terminated by ${result.signal}`);
  return result.status ?? 1;
}

/**
 * Build, run the unit suites and the Chromium suite under V8 coverage, then write the merged report.
 * Resolves to the exit code the caller should adopt. The collaborators are parameters so the order,
 * environment and gating of the run can be verified without a build. Every command keeps its scratch
 * files (the prepared engine source, fixtures, browser profiles) in `coverage/tmp` rather than the system
 * temporary directory, and the directory is removed when the run ends.
 */
export async function runCoverage({
  root = packageRoot, run = runCommand, report = reportCoverage,
  assertTarget = assertCoverageTarget, assertTooling = assertToolingTarget,
} = {}) {
  const coverage = resolve(root, 'coverage');
  const nodeV8 = resolve(coverage, 'node-v8');
  const scratch = resolve(coverage, 'tmp');
  const base = { NODE_V8_COVERAGE: nodeV8, TMPDIR: scratch, TMP: scratch, TEMP: scratch };
  await rm(coverage, { recursive: true, force: true });
  await rm(resolve(root, '.coverage-output'), { recursive: true, force: true });
  await mkdir(nodeV8, { recursive: true });
  await mkdir(scratch, { recursive: true });
  try {
    for (const [arguments_, environment] of [
      // The build ends with the package contract, so its scripts are measured while they really run.
      [['run', 'build'], base],
      [['exec', 'tsc', '--noEmit', '-p', 'tsconfig.exports.json'], { TMPDIR: scratch }],
      [['exec', 'tsc', '-p', 'tsconfig.test.json', '--outDir', '.coverage-output', '--sourceMap', '--inlineSources'], { TMPDIR: scratch }],
    ]) {
      const status = run(root, 'pnpm', arguments_, environment);
      if (status !== 0) return { exitCode: status };
    }
    const testDirectory = resolve(root, '.coverage-output/src/docx');
    const tests = (await readdir(testDirectory)).filter(name => name.endsWith('.test.js'))
      .sort().map(name => resolve(testDirectory, name));
    if (!tests.length) throw new Error('Coverage cannot run without unit test files');
    const unitStatus = run(root, process.execPath, ['--test', '--test-concurrency=2', ...tests, ...UNIT_SUITES], base);
    // Always the complete suite: clear any narrowing selector left in the shell.
    // The performance harness is exercised by its own run, so the qualification record of the suite above
    // never carries timings taken under coverage instrumentation.
    const browserStatus = run(root, process.execPath, ['scripts/browser-test.mjs'], {
      ...base, DOCX_COVERAGE: '1', DOCX_BROWSERS: 'chromium', DOCX_PERFORMANCE: '0',
      DOCX_LAYOUT_ONLY: '', DOCX_FORMATTING_ONLY: '', DOCX_INSERTION_ONLY: '', DOCX_IMAGES_ONLY: '', DOCX_DOCUMENT_TOOLS_ONLY: '',
    }) || run(root, process.execPath, ['scripts/performance-browser.mjs'], base);
    const metadata = await report({ root, unitStatus, browserStatus, tooling: TOOLING });
    const exitCode = unitStatus || browserStatus;
    if (exitCode === 0) {
      assertTarget(metadata);
      assertTooling(metadata);
    }
    return { exitCode, metadata };
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = (await runCoverage()).exitCode;
}
