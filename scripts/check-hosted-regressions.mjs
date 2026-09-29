import { spawn } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
  createWriteStream,
} from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const root = process.cwd();
const packageRoot = path.join(root, 'packages/lyra-ui');
const outputRoot = process.env.HOSTED_REGRESSION_OUTPUT;
const reportRoot = outputRoot && path.resolve(outputRoot);
const sourcePattern = /^packages\/lyra-ui\/src\/(?:[a-z0-9._-]+\/)*[a-z0-9._-]+\.class\.ts$/i;
const testPattern = /^packages\/lyra-ui\/src\/(?:[a-z0-9._-]+\/)*[a-z0-9._-]+\.test\.ts$/i;
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

function parseJsonArray(name) {
  let value;
  try {
    value = JSON.parse(process.env[name] ?? '');
  } catch {
    throw new Error(`${name} must be a JSON array of repository paths.`);
  }
  requireValue(Array.isArray(value) && value.length > 0, `${name} must be a non-empty JSON array.`);
  requireValue(value.every((entry) => typeof entry === 'string'), `${name} entries must be strings.`);
  return value;
}

function runGit(args, encoding = 'utf8') {
  const child = spawn('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  const stdout = [];
  const stderr = [];
  child.stdout.on('data', (chunk) => stdout.push(chunk));
  child.stderr.on('data', (chunk) => stderr.push(chunk));
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => {
      if (code !== 0) {
        reject(new Error(`git ${args[0]} failed: ${Buffer.concat(stderr).toString('utf8').trim()}`));
        return;
      }
      const bytes = Buffer.concat(stdout);
      resolve(encoding === null ? bytes : bytes.toString(encoding));
    });
  });
}

function makeWtrConfig(configPath, testFiles, grep) {
  const identities = {};
  const entries = testFiles.map((file, index) => {
    const entry = path.join(path.dirname(configPath), `selected-${index}.test.mjs`);
    identities[entry] = path.join(packageRoot, file);
    // The Mocha adapter collects the entire suite tree, including cases excluded by grep.
    // Select before mocha.run(), keeping the real test modules and every selected hook intact.
    writeFileSync(entry, `import ${JSON.stringify(`../${file}`)};
const pattern = new RegExp(${JSON.stringify(grep)});
function select(suite) {
  suite.tests = suite.tests.filter(test => pattern.test(test.fullTitle()));
  suite.suites = suite.suites.filter(child => select(child));
  return suite.tests.length > 0 || suite.suites.length > 0;
}
select(globalThis.mocha.suite);
`, { flag: 'wx' });
    return entry;
  });
  const config = `
import base from '../web-test-runner.config.js';
import { writeFileSync } from 'node:fs';
import { defaultReporter } from '@web/test-runner';

const files = JSON.parse(process.env.HOSTED_REGRESSION_TEST_FILES);
const identities = JSON.parse(process.env.HOSTED_REGRESSION_FILE_IDENTITIES);
const reportPath = process.env.HOSTED_REGRESSION_REPORT;
const report = {
  onTestRunFinished({ sessions }) {
    const tests = sessions.flatMap((session) => flatten(session.testResults ? [session.testResults] : [], identities[session.testFile]));
    const results = sessions.map((session) => ({
      file: identities[session.testFile],
      status: session.status,
      hasResults: Boolean(session.testResults),
      errors: session.errors,
      request404s: session.request404s,
    }));
    writeFileSync(reportPath, JSON.stringify({ tests, sessions: results }, null, 2));
  },
};
function flatten(suites, file, parent = '') {
  return suites.flatMap((suite) => {
    const suiteName = [parent, suite.name].filter(Boolean).join(' ');
    const tests = (suite.tests ?? []).map((test) => ({
      file,
      suite: suiteName,
      name: test.name,
      passed: test.passed === true,
      skipped: test.skipped === true,
      failed: test.passed !== true && Boolean(test.error),
      error: test.error,
    }));
    return [...tests, ...flatten(suite.suites ?? [], file, suiteName)];
  });
}

export default {
  ...base,
  files,
  reporters: [defaultReporter(), report],
  testFramework: {
    ...base.testFramework,
    config: { ...base.testFramework?.config, forbidOnly: true },
  },
};
`;
  writeFileSync(configPath, config, { flag: 'wx' });
  return { entries, identities };
}

function runWtr({ label, configPath, testFiles, identities, reportPath, logPath }) {
  const env = { ...process.env };
  for (const key of ['WTR_SHARD_INDEX', 'WTR_SHARD_TOTAL']) delete env[key];
  Object.assign(env, {
    WTR_BROWSER: 'chromium',
    WTR_CONCURRENCY: '1',
    WTR_COVERAGE: '0',
    WTR_STRICT_CONSOLE: '1',
    HOSTED_REGRESSION_TEST_FILES: JSON.stringify(testFiles),
    HOSTED_REGRESSION_FILE_IDENTITIES: JSON.stringify(identities),
    HOSTED_REGRESSION_REPORT: reportPath,
  });

  return new Promise((resolve, reject) => {
    const log = createWriteStream(logPath);
    const child = spawn('pnpm', ['exec', 'wtr', '--config', configPath], {
      cwd: packageRoot,
      env,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let timedOut = false;
    let settled = false;
    let killTimer;
    const killGroup = (signal) => {
      if (!child.pid) return;
      try { process.kill(-child.pid, signal); }
      catch (error) { if (error.code !== 'ESRCH') child.kill(signal); }
    };
    const timer = setTimeout(() => {
      timedOut = true;
      killGroup('SIGTERM');
      killTimer = setTimeout(() => killGroup('SIGKILL'), 5000);
    }, 8 * 60 * 1000);
    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (timedOut) killGroup('SIGKILL');
      clearTimeout(killTimer);
      log.end(() => error ? reject(error) : resolve(result));
    };
    child.once('error', (error) => finish(error));
    child.once('close', (code, signal) => {
      finish(null, { label, code, signal, timedOut, logPath, reportPath });
    });
  });
}

function readReport(run) {
  requireValue(existsSync(run.reportPath), `${run.label} did not produce a test report.`);
  let report;
  try {
    report = JSON.parse(readFileSync(run.reportPath, 'utf8'));
  } catch {
    throw new Error(`${run.label} produced an invalid test report.`);
  }
  requireValue(Array.isArray(report.tests), `${run.label} report has no test list.`);
  requireValue(Array.isArray(report.sessions), `${run.label} report has no session list.`);
  return report;
}

function validateRun(run, report, expectedFiles, expectedCount, expectedState) {
  const { tests, sessions } = report;
  requireValue(!run.timedOut, `${run.label} exceeded its eight-minute timeout.`);
  requireValue(Number.isInteger(run.code), `${run.label} did not start or exit cleanly.`);
  requireValue(run.signal === null, `${run.label} was terminated by a signal.`);
  const actualFiles = sessions.map((session) => session.file).sort();
  requireValue(JSON.stringify(actualFiles) === JSON.stringify([...expectedFiles].sort()),
    `${run.label} did not run exactly the selected file sessions.`);
  requireValue(sessions.every((session) => session.status === 'FINISHED' && session.hasResults &&
    Array.isArray(session.errors) && session.errors.length === 0 &&
    Array.isArray(session.request404s) && session.request404s.length === 0),
  `${run.label} has missing, unfinished, or infrastructure-failed sessions.`);
  requireValue(tests.length === expectedCount, `${run.label} ran ${tests.length} tests; expected ${expectedCount}.`);
  requireValue(new Set(tests.map(({ file, suite, name }) => `${file}\u0000${suite}\u0000${name}`)).size === tests.length,
    `${run.label} contains duplicate testcase identities.`);
  requireValue(tests.every((test) => typeof test.file === 'string' && typeof test.suite === 'string' && typeof test.name === 'string'),
    `${run.label} has a testcase with incomplete identity data.`);
  requireValue(tests.every((test) => expectedFiles.includes(test.file)), `${run.label} contains an unexpected test file.`);
  requireValue(tests.every((test) => !test.skipped), `${run.label} unexpectedly skipped a selected test.`);
  if (expectedState === 'passed') {
    requireValue(run.code === 0, `${run.label} exited ${run.code} (${run.signal ?? 'no signal'}).`);
    requireValue(tests.every((test) => test.passed && !test.failed), `${run.label} had a failed or incomplete testcase.`);
  } else {
    requireValue(run.code === 1, `${run.label} did not exit with the expected test-failure status.`);
    requireValue(tests.every((test) => test.failed && !test.passed), `${run.label} did not fail every selected test.`);
  }
}

function assertAllowedFiles(sources, tests) {
  requireValue(sources.length === tests.length, 'Each source path must have exactly one colocated test path.');
  requireValue(sources.length <= 4, 'At most four source/test pairs may be selected.');
  requireValue(new Set(sources).size === sources.length && new Set(tests).size === tests.length, 'Paths must be unique.');
  for (let index = 0; index < sources.length; index += 1) {
    const source = sources[index];
    const test = tests[index];
    requireValue(sourcePattern.test(source), `Disallowed source path: ${source}`);
    requireValue(testPattern.test(test), `Disallowed test path: ${test}`);
    requireValue(path.dirname(source) === path.dirname(test), `Test must be colocated with source: ${source}`);
    requireValue(path.basename(test) === path.basename(source).replace(/\.class\.ts$/i, '.test.ts'),
      `Test must be the matching colocated test file for ${source}.`);
    for (const relative of [source, test]) {
      requireValue(!relative.split('/').some((segment) => segment === '.' || segment === '..'), `Disallowed path segment: ${relative}`);
      const absolute = path.join(root, relative);
      requireValue(absolute.startsWith(`${root}${path.sep}`), `Path escapes repository: ${relative}`);
      requireValue(lstatSync(absolute).isFile(), `Path is not a regular file: ${relative}`);
      requireValue(realpathSync(absolute) === path.join(realpathSync(root), relative), `Symlinked source path: ${relative}`);
    }
  }
}

async function main() {
  requireValue(process.env.GITHUB_ACTIONS === 'true', 'Use the hosted regression workflow.');
  requireValue(process.env.GITHUB_REF === 'refs/heads/main', 'This workflow is restricted to refs/heads/main.');
  requireValue(reportRoot && path.isAbsolute(reportRoot), 'HOSTED_REGRESSION_OUTPUT must be an absolute path.');
  const runnerTemp = process.env.RUNNER_TEMP && path.resolve(process.env.RUNNER_TEMP);
  requireValue(runnerTemp && reportRoot.startsWith(`${runnerTemp}${path.sep}`),
    'HOSTED_REGRESSION_OUTPUT must be inside RUNNER_TEMP.');
  const baseline = process.env.BASELINE_COMMIT ?? '';
  requireValue(/^[a-f0-9]{40}$/i.test(baseline), 'baseline_commit must be exactly 40 hexadecimal characters.');
  const sourcePaths = parseJsonArray('SOURCE_PATHS');
  const testPaths = parseJsonArray('TEST_PATHS');
  assertAllowedFiles(sourcePaths, testPaths);
  const grep = process.env.MOCHA_GREP ?? '';
  requireValue(grep.length > 0 && grep.length <= 240 && !/[\r\n\0]/.test(grep), 'grep must be a non-empty, single-line pattern no longer than 240 characters.');
  try {
    new RegExp(grep);
  } catch {
    throw new Error('grep must be a valid regular expression.');
  }
  const expectedCount = Number(process.env.EXPECTED_TEST_COUNT);
  requireValue(Number.isSafeInteger(expectedCount) && expectedCount > 0 && expectedCount <= 50,
    'expected_test_count must be a positive integer no greater than 50.');

  const currentCommit = (await runGit(['rev-parse', 'HEAD'])).trim();
  requireValue(currentCommit === process.env.GITHUB_SHA, 'Checkout HEAD differs from the workflow commit.');
  for (const relative of [...sourcePaths, ...testPaths]) {
    await runGit(['ls-files', '--error-unmatch', '--', relative]);
    const committed = await runGit(['show', `${currentCommit}:${relative}`], null);
    requireValue(committed.equals(readFileSync(path.join(root, relative))), `Selected file differs from HEAD: ${relative}`);
  }

  await runGit(['cat-file', '-e', `${baseline}^{commit}`]);
  const ancestor = spawn('git', ['merge-base', '--is-ancestor', baseline, 'HEAD'], { cwd: root, stdio: 'ignore' });
  const isAncestor = await new Promise((resolve, reject) => {
    ancestor.once('error', reject);
    ancestor.once('close', (code) => resolve(code === 0));
  });
  requireValue(isAncestor, 'baseline_commit must be an ancestor of the checked-out main commit.');
  const clean = spawn('git', ['diff-index', '--quiet', 'HEAD', '--', ...sourcePaths, ...testPaths], { cwd: root, stdio: 'ignore' });
  const isClean = await new Promise((resolve, reject) => {
    clean.once('error', reject);
    clean.once('close', (code) => resolve(code === 0));
  });
  requireValue(isClean, 'Selected source and test files must be committed before this workflow runs.');

  rmSync(reportRoot, { recursive: true, force: true });
  mkdirSync(reportRoot, { recursive: true });
  const reports = path.join(reportRoot, 'reports');
  mkdirSync(reports, { recursive: true });
  const relativeTestFiles = testPaths.map((file) => path.relative(packageRoot, path.join(root, file)).split(path.sep).join('/'));
  const expectedFiles = testPaths.map((file) => path.join(root, file));
  const savedSources = new Map();
  const savedTests = new Map();
  const baselineSources = new Map();
  const hashes = new Map();
  for (const source of sourcePaths) {
    const absolute = path.join(root, source);
    const bytes = readFileSync(absolute);
    savedSources.set(source, bytes);
    hashes.set(source, sha256(bytes));
    const original = await runGit(['show', `${baseline}:${source}`], null);
    requireValue(!original.equals(bytes), `Baseline does not change selected source: ${source}`);
    baselineSources.set(source, original);
  }
  for (const test of testPaths) {
    const bytes = readFileSync(path.join(root, test));
    savedTests.set(test, bytes);
    hashes.set(test, sha256(bytes));
  }
  const tempRoot = mkdtempSync(path.join(packageRoot, '.hosted-regression-'));
  const configPath = path.join(tempRoot, 'wtr.config.mjs');
  const runs = [];
  const restoreErrors = [];
  try {
    const selected = makeWtrConfig(configPath, relativeTestFiles, grep);
    const current = await runWtr({
      label: 'current source',
      configPath,
      testFiles: selected.entries,
      identities: selected.identities,
      reportPath: path.join(reports, 'current.json'),
      logPath: path.join(reportRoot, 'current.log'),
    });
    runs.push(current);
    validateRun(current, readReport(current), expectedFiles, expectedCount, 'passed');

    for (const [source, bytes] of [...savedSources, ...savedTests]) {
      requireValue(sha256(readFileSync(path.join(root, source))) === hashes.get(source),
        `Current WTR run changed a selected source or test file: ${source}`);
    }
    for (const source of sourcePaths) writeFileSync(path.join(root, source), baselineSources.get(source));
    const baselineRun = await runWtr({
      label: 'baseline source',
      configPath,
      testFiles: selected.entries,
      identities: selected.identities,
      reportPath: path.join(reports, 'baseline.json'),
      logPath: path.join(reportRoot, 'baseline.log'),
    });
    runs.push(baselineRun);
    for (const [source, bytes] of baselineSources) {
      requireValue(readFileSync(path.join(root, source)).equals(bytes), `Baseline run changed source: ${source}`);
    }
  } finally {
    for (const [source, bytes] of [...savedSources, ...savedTests]) {
      try {
        const file = path.join(root, source);
        if (savedTests.has(source) && (!existsSync(file) || !readFileSync(file).equals(bytes))) {
          restoreErrors.push(`${source}: test file changed during qualification`);
        }
        if (existsSync(file)) requireValue(lstatSync(file).isFile(), `Cannot restore non-regular path: ${source}`);
        writeFileSync(file, bytes);
        requireValue(readFileSync(file).equals(bytes), `Restored bytes disagree: ${source}`);
      } catch (error) {
        restoreErrors.push(`${source}: ${error.message}`);
      }
    }
    rmSync(tempRoot, { recursive: true, force: true });
    writeFileSync(path.join(reportRoot, 'restoration.json'), JSON.stringify({
      sourceSha256: Object.fromEntries([...savedSources].map(([file, bytes]) => [file, sha256(bytes)])),
      testSha256: Object.fromEntries([...savedTests].map(([file, bytes]) => [file, sha256(bytes)])),
      errors: restoreErrors,
    }, null, 2));
    requireValue(restoreErrors.length === 0, `Source/test restoration failed: ${restoreErrors.join('; ')}`);
  }

  for (const [relative, bytes] of [...savedSources, ...savedTests]) {
    requireValue(sha256(readFileSync(path.join(root, relative))) === hashes.get(relative), `File bytes changed unexpectedly: ${relative}`);
  }
  requireValue(runs.length === 2, 'Both WTR passes must complete.');
  const currentReport = readReport(runs[0]);
  const baselineReport = readReport(runs[1]);
  validateRun(runs[0], currentReport, expectedFiles, expectedCount, 'passed');
  validateRun(runs[1], baselineReport, expectedFiles, expectedCount, 'failed');
  const currentTests = currentReport.tests;
  const baselineTests = baselineReport.tests;
  const identities = (tests) => tests.map(({ file, suite, name }) => `${file}\u0000${suite}\u0000${name}`).sort();
  requireValue(JSON.stringify(identities(currentTests)) === JSON.stringify(identities(baselineTests)),
    'Current and baseline runs did not execute the same testcase identities.');
  writeFileSync(path.join(reportRoot, 'summary.json'), JSON.stringify({
    baselineCommit: baseline,
    currentCommit,
    sourcePaths,
    testPaths,
    grep,
    expectedTestCount: expectedCount,
    current: { status: 'passed', tests: identities(currentTests) },
    baseline: { status: 'failed', tests: identities(baselineTests) },
    restoredSourceSha256: Object.fromEntries([...savedSources].map(([file, bytes]) => [file, sha256(bytes)])),
  }, null, 2));
  console.log(`Hosted regression discrimination passed: ${expectedCount} selected tests pass currently and fail against ${baseline}.`);
}

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
