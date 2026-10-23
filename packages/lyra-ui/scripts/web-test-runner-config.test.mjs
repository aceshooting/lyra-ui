import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { reviewedSha256 } from './generate-shiki-wasm.mjs';
import { copyFileSync, existsSync, readdirSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { availableParallelism, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { timingReporter } from './wtr-timing-reporter.mjs';
import { failureReporter } from './wtr-failure-reporter.mjs';
import { completeJunitReporter } from './wtr-junit-reporter.mjs';
import { COVERAGE_SHARD_TOTAL } from './coverage-shard-runner.mjs';

const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const configUrl = pathToFileURL(resolve(packageDirectory, 'web-test-runner.config.js')).href;

function runConfigInspection({
  coverage = false,
  coverageReportDir,
  port,
  concurrency,
  browser,
  nativeScrollbar = false,
  headed = false,
  coverageConcurrency,
  timingReport,
  failureReport,
  parallelism,
} = {}) {
  const environment = { ...process.env };
  if (coverageConcurrency === undefined) delete environment.WTR_COVERAGE_CONCURRENCY;
  else environment.WTR_COVERAGE_CONCURRENCY = coverageConcurrency;
  if (timingReport === undefined) delete environment.WTR_TIMING_REPORT;
  else environment.WTR_TIMING_REPORT = timingReport;
  if (failureReport === undefined) delete environment.WTR_FAILURE_REPORT;
  else environment.WTR_FAILURE_REPORT = failureReport;
  if (coverage) environment.WTR_COVERAGE = '1';
  else delete environment.WTR_COVERAGE;
  if (coverageReportDir === undefined) delete environment.WTR_COVERAGE_REPORT_DIR;
  else environment.WTR_COVERAGE_REPORT_DIR = coverageReportDir;
  if (port === undefined) delete environment.WTR_PORT;
  else environment.WTR_PORT = port;
  if (concurrency === undefined) delete environment.WTR_CONCURRENCY;
  else environment.WTR_CONCURRENCY = concurrency;
  if (browser === undefined) delete environment.WTR_BROWSER;
  else environment.WTR_BROWSER = browser;
  if (nativeScrollbar) environment.WTR_NATIVE_SCROLLBAR = '1';
  else delete environment.WTR_NATIVE_SCROLLBAR;
  if (headed) environment.WTR_HEADED = '1';
  else delete environment.WTR_HEADED;

  const source = `
    import os from 'node:os';
    import { syncBuiltinESMExports } from 'node:module';
    ${parallelism === undefined ? '' : `
      os.availableParallelism = () => ${JSON.stringify(parallelism)};
      os.cpus = () => Array.from({ length: 48 }, () => ({}));
      syncBuiltinESMExports();
    `}
    const { default: config } = await import(${JSON.stringify(configUrl)});
    const launch = config.browsers[0].launchOptions ?? {};
    process.stdout.write(JSON.stringify({
      coverage: config.coverage,
      concurrency: config.concurrency ?? null,
      port: config.port ?? null,
      files: config.files,
      mediaCommand: config.plugins.some((plugin) => plugin.name === 'lyra-media-command'),
      keyCommand: config.plugins.some((plugin) => plugin.name === 'send-keys-command'),
      nativeScrollbarMarker: config.testRunnerHtml('/runner.js').includes(
        '__LYRA_WTR_NATIVE_SCROLLBAR__ = true',
      ),
      launch: {
        args: launch.args ?? null,
        ignoreDefaultArgs: launch.ignoreDefaultArgs ?? null,
        headless: launch.headless ?? null,
        firefoxUserPrefs: launch.firefoxUserPrefs ?? null,
        webkitSoftwareGl: launch.env?.LIBGL_ALWAYS_SOFTWARE ?? null,
      },
      ${timingReport === undefined && failureReport === undefined ? '' : `reporterCount: config.reporters?.length ?? null,`}
      ${coverageReportDir === undefined ? '' : `coverageDetails: {
        threshold: config.coverageConfig.threshold ?? null,
        reportDir: config.coverageConfig.reportDir,
        reporters: config.coverageConfig.reporters,
      },`}
    }));
  `;
  return spawnSync(process.execPath, ['--input-type=module', '--eval', source], {
    cwd: packageDirectory,
    env: environment,
    encoding: 'utf8',
  });
}

function inspectRetries(retries) {
  const environment = { ...process.env };
  if (retries === undefined) delete environment.WTR_RETRIES;
  else environment.WTR_RETRIES = retries;
  return spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      `import config from ${JSON.stringify(configUrl)};
       process.stdout.write(JSON.stringify(config.testFramework.config.retries));`,
    ],
    { cwd: packageDirectory, env: environment, encoding: 'utf8' },
  );
}

function inspectMouseCommandOrder(product = 'firefox', nativeScrollbar = false) {
  const source = `
    import config from ${JSON.stringify(configUrl)};
    const calls = [];
    const page = {
      async bringToFront() { calls.push('front'); },
      mouse: {
        async move(x, y) { calls.push('move:' + x + ',' + y); },
        async click(x, y) { calls.push('click:' + x + ',' + y); },
        async down() { calls.push('down'); },
        async up({ button }) { calls.push('up:' + (button ?? 'default')); },
        async wheel(deltaX, deltaY) { calls.push('wheel:' + deltaX + ',' + deltaY); },
      },
    };
    const plugin = config.plugins.find((candidate) => candidate.name === 'lyra-mouse-command');
    const session = {
      id: 'session-1',
      browser: {
        type: 'playwright',
        product: ${JSON.stringify(product)},
        getPage(id) {
          calls.push('page:' + id);
          return page;
        },
      },
    };
    await plugin.executeCommand({
      command: 'send-mouse',
      payload: { type: 'move', position: [12, 34] },
      session,
    });
    await plugin.executeCommand({
      command: 'send-mouse',
      payload: { type: 'click', position: [56, 78] },
      session,
    });
    await plugin.executeCommand({ command: 'send-mouse', payload: { type: 'down' }, session });
    await plugin.executeCommand({ command: 'send-mouse', payload: { type: 'up' }, session });
    await plugin.executeCommand({ command: 'reset-mouse', session });
    await plugin.executeCommand({
      command: 'send-wheel',
      payload: { deltaX: 12, deltaY: -34 },
      session,
    });
    process.stdout.write(JSON.stringify(calls));
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', source], {
    cwd: packageDirectory,
    env: (() => {
      const environment = { ...process.env, WTR_BROWSER: 'firefox' };
      if (nativeScrollbar) environment.WTR_NATIVE_SCROLLBAR = '1';
      else delete environment.WTR_NATIVE_SCROLLBAR;
      return environment;
    })(),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

function inspectInvalidWheelPayload() {
  const source = `
    import config from ${JSON.stringify(configUrl)};
    const plugin = config.plugins.find((candidate) => candidate.name === 'lyra-mouse-command');
    const page = {
      async bringToFront() {},
      mouse: { async wheel() {} },
    };
    const session = {
      id: 'session-1',
      browser: {
        type: 'playwright',
        product: 'chromium',
        getPage() { return page; },
      },
    };
    try {
      await plugin.executeCommand({
        command: 'send-wheel',
        payload: { deltaX: 12 },
        session,
      });
    } catch (error) {
      process.stdout.write(error.message);
    }
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', source], {
    cwd: packageDirectory,
    env: { ...process.env, WTR_BROWSER: 'chromium' },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
}

function inspectConfig(options) {
  const result = runConfigInspection(options);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

test('caps coverage browser sessions without changing ordinary test concurrency', () => {
  assert.deepEqual(inspectConfig({ coverage: true }), {
    coverage: true,
    concurrency: 1,
    port: null,
    files: ['src/**/*.test.ts', '!src/**/*.native-scrollbar.test.ts'],
    mediaCommand: true,
    keyCommand: true,
    nativeScrollbarMarker: false,
    launch: {
      args: ['--disable-dev-shm-usage'],
      ignoreDefaultArgs: null,
      headless: null,
      firefoxUserPrefs: null,
      webkitSoftwareGl: null,
    },
  });
  assert.deepEqual(inspectConfig(), {
    coverage: false,
    concurrency: Math.max(1, Math.floor(availableParallelism() / 2)),
    port: null,
    files: ['src/**/*.test.ts', '!src/**/*.native-scrollbar.test.ts'],
    mediaCommand: true,
    keyCommand: true,
    nativeScrollbarMarker: false,
    launch: {
      args: ['--disable-dev-shm-usage'],
      ignoreDefaultArgs: null,
      headless: null,
      firefoxUserPrefs: null,
      webkitSoftwareGl: null,
    },
  });
});

test('isolates Firefox pages and preserves the bounded WebKit default', () => {
  const expectedConcurrency = Math.max(
    1,
    Math.min(4, Math.floor(availableParallelism() / 2)),
  );
  assert.equal(inspectConfig({ browser: 'firefox' }).concurrency, 1);
  assert.equal(inspectConfig({ browser: 'webkit' }).concurrency, expectedConcurrency);
  assert.equal(inspectConfig({ browser: 'safari' }).concurrency, expectedConcurrency);
  assert.equal(inspectConfig({ browser: 'chromium' }).concurrency, Math.max(1, Math.floor(availableParallelism() / 2)));
});

test('sizes Chromium sessions from available CPUs rather than the machine CPU count', () => {
  for (const [parallelism, expected] of [[1, 1], [2, 1], [3, 1], [8, 4], [12, 6]]) {
    assert.equal(inspectConfig({ browser: 'chromium', parallelism }).concurrency, expected);
  }
  assert.equal(inspectConfig({ browser: 'chromium', parallelism: 2, concurrency: '8' }).concurrency, 8);
  assert.equal(inspectConfig({ browser: 'firefox', parallelism: 12, concurrency: '8' }).concurrency, 1);
  assert.equal(inspectConfig({ browser: 'webkit', parallelism: 12 }).concurrency, 4);
  assert.equal(inspectConfig({ browser: 'webkit', parallelism: 2 }).concurrency, 1);
  assert.equal(inspectConfig({ coverage: true, parallelism: 12, concurrency: '8' }).concurrency, 1);
});

test('enables real WebGL2 in ordinary and native-scrollbar Firefox sessions', () => {
  const ordinary = inspectConfig({ browser: 'firefox' });
  assert.deepEqual(ordinary.launch.firefoxUserPrefs, { 'webgl.force-enabled': true });
  assert.equal(ordinary.launch.headless, null);
  const native = inspectConfig({ browser: 'firefox', nativeScrollbar: true });
  assert.deepEqual(native.launch.firefoxUserPrefs, {
    'webgl.force-enabled': true,
    'widget.gtk.overlay-scrollbars.enabled': false,
  });
  assert.equal(native.launch.headless, false);
});

test('headed mode preserves ordinary browser settings and native-scrollbar isolation', () => {
  for (const browser of ['chromium', 'chrome', 'edge', 'firefox', 'webkit', 'safari']) {
    const ordinary = inspectConfig({ browser });
    const headed = inspectConfig({ browser, headed: true });
    assert.equal(headed.launch.headless, false, browser);
    assert.deepEqual(headed, {
      ...ordinary,
      launch: { ...ordinary.launch, headless: false },
    });
    assert.equal(headed.nativeScrollbarMarker, false);
  }
  assert.equal(inspectConfig({ browser: 'firefox', headed: true, concurrency: '8' }).concurrency, 1);
  assert.deepEqual(
    inspectConfig({ browser: 'firefox', nativeScrollbar: true, headed: true }),
    inspectConfig({ browser: 'firefox', nativeScrollbar: true }),
  );
});

test('keeps native-scrollbar browser setup opt-in and engine-specific', () => {
  const normalChromium = inspectConfig({ browser: 'chromium' });
  assert.deepEqual(normalChromium.launch, {
    args: ['--disable-dev-shm-usage'],
    ignoreDefaultArgs: null,
    headless: null,
    firefoxUserPrefs: null,
    webkitSoftwareGl: null,
  });
  assert.equal(normalChromium.nativeScrollbarMarker, false);

  const nativeChromium = inspectConfig({ browser: 'chromium', nativeScrollbar: true });
  assert.deepEqual(nativeChromium.launch, {
    args: ['--disable-dev-shm-usage'],
    ignoreDefaultArgs: ['--hide-scrollbars'],
    headless: null,
    firefoxUserPrefs: null,
    webkitSoftwareGl: null,
  });
  assert.equal(nativeChromium.nativeScrollbarMarker, true);

  const nativeFirefox = inspectConfig({ browser: 'firefox', nativeScrollbar: true });
  assert.deepEqual(nativeFirefox.launch, {
    args: null,
    ignoreDefaultArgs: null,
    firefoxUserPrefs: { 'webgl.force-enabled': true, 'widget.gtk.overlay-scrollbars.enabled': false },
    headless: false,
    webkitSoftwareGl: null,
  });

  const nativeWebKit = inspectConfig({ browser: 'webkit', nativeScrollbar: true });
  assert.deepEqual(nativeWebKit.launch, {
    args: null,
    ignoreDefaultArgs: null,
    headless: false,
    firefoxUserPrefs: null,
    webkitSoftwareGl: '1',
  });
});

test('writes a shard raw report without applying the full-suite threshold early', () => {
  const reportDir = 'coverage/shards/coverage-shard-2';
  assert.deepEqual(inspectConfig({ coverage: true, coverageReportDir: reportDir }).coverageDetails, {
    threshold: null,
    reportDir,
    reporters: ['lcovonly', 'json-summary', 'json'],
  });
});

test('uses a validated explicit test-server port when a parallel lane assigns one', () => {
  assert.equal(inspectConfig({ port: '18081' }).port, 18081);

  for (const port of ['0', '1023', '65536', '8001.5']) {
    const result = runConfigInspection({ port });
    assert.notEqual(result.status, 0, `WTR_PORT=${port} must be rejected`);
    assert.match(result.stderr, /WTR_PORT must be an integer from 1024 through 65535/u);
  }
});

test('coverage keeps one page unless WTR_COVERAGE_CONCURRENCY asks for more', () => {
  assert.equal(inspectConfig({ coverage: true }).concurrency, 1);
  assert.equal(inspectConfig({ coverage: true, coverageConcurrency: '2' }).concurrency, 2);
  assert.equal(inspectConfig({ coverage: true, concurrency: '8', coverageConcurrency: '2' }).concurrency, 2);
  assert.equal(inspectConfig({ coverageConcurrency: '2' }).concurrency, inspectConfig().concurrency, 'ordinary runs ignore it');
  for (const coverageConcurrency of ['0', '1.5', 'two']) {
    const result = runConfigInspection({ coverage: true, coverageConcurrency });
    assert.notEqual(result.status, 0, `WTR_COVERAGE_CONCURRENCY=${coverageConcurrency} must be rejected`);
    assert.match(result.stderr, /WTR_COVERAGE_CONCURRENCY must be a positive safe integer/u);
  }
});

test('WTR_TIMING_REPORT adds the per-file timing reporter beside the existing reporters', () => {
  const directory = mkdtempSync(join(tmpdir(), 'lyra-wtr-timing-'));
  try {
    const timingReport = join(directory, 'timing.jsonl');
    assert.equal(inspectConfig({ timingReport }).reporterCount, 2, 'default + timing');
    assert.equal(inspectConfig({ coverage: true, timingReport }).reporterCount, 3, 'default + junit + timing');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('the timing reporter records each completed file and its wall time', () => {
  const directory = mkdtempSync(join(tmpdir(), 'lyra-wtr-timing-lines-'));
  try {
    const output = join(directory, 'nested', 'timing.jsonl');
    const reporter = timingReporter(output, { cwd: directory });
    reporter.onTestRunStarted();
    reporter.reportTestFileResults({ testFile: join(directory, 'src', 'a.test.ts') });
    const line = JSON.parse(readFileSync(output, 'utf8'));
    assert.equal(line.file, 'src/a.test.ts');
    assert.ok(Number.isInteger(line.deltaMs) && line.deltaMs >= 0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('WTR_FAILURE_REPORT adds the failure reporter beside the existing reporters', () => {
  const directory = mkdtempSync(join(tmpdir(), 'lyra-wtr-failures-'));
  try {
    const failureReport = join(directory, 'failures.jsonl');
    assert.equal(inspectConfig({ failureReport }).reporterCount, 2, 'default + failures');
    assert.equal(inspectConfig({ failureReport, timingReport: join(directory, 't.jsonl') }).reporterCount, 3);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('the failure reporter records failed tests with their suite path, file-level errors and per-file totals', () => {
  const directory = mkdtempSync(join(tmpdir(), 'lyra-wtr-failure-lines-'));
  try {
    const output = join(directory, 'nested', 'failures.jsonl');
    const reporter = failureReporter(output, { cwd: directory });
    const test = (name, passed, extra = {}) => ({ name, passed, skipped: false, ...extra });
    reporter.reportTestFileResults({
      testFile: join(directory, 'src', 'a.test.ts'),
      sessionsForTestFile: [{
        errors: [{ message: 'Uncaught TypeError: x is not a function\n    at stack' }],
        testResults: {
          name: '',
          tests: [test('root passes', true)],
          suites: [{
            name: 'outer',
            tests: [test('fails', false, { error: { message: 'expected 1 to equal 2\n  + expected - actual' } })],
            suites: [{ name: 'inner', tests: [test('also fails', false), { name: 'skipped', passed: false, skipped: true }], suites: [] }],
          }],
        },
      }],
    });
    reporter.reportTestFileResults({
      testFile: join(directory, 'src', 'b.test.ts'),
      sessionsForTestFile: [{ errors: [], testResults: { name: '', tests: [test('fine', true)], suites: [] } }],
    });
    const lines = readFileSync(output, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    assert.deepEqual(lines, [
      { type: 'failure', file: 'src/a.test.ts', test: 'outer > fails', message: 'expected 1 to equal 2' },
      { type: 'failure', file: 'src/a.test.ts', test: 'outer > inner > also fails', message: '' },
      { type: 'error', file: 'src/a.test.ts', message: 'Uncaught TypeError: x is not a function' },
      { type: 'file', file: 'src/a.test.ts', tests: 3, failed: 2 },
      { type: 'file', file: 'src/b.test.ts', tests: 1, failed: 0 },
    ]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

function junitSession(directory, file, tests, suites = []) {
  const suitePassed = suite => suite.tests.every(result => result.passed || result.skipped) &&
    suite.suites.every(suitePassed);
  return {
    id: file,
    group: {},
    debug: false,
    browser: { name: 'Chromium', type: 'playwright' },
    testFile: join(directory, 'src', file),
    testRun: 0,
    status: 'finished',
    passed: tests.every(result => result.passed || result.skipped) && suites.every(suitePassed),
    errors: [],
    logs: [],
    request404s: [],
    testResults: { name: '', tests, suites },
  };
}

test('JUnit reports top-level pass, skip, and error cases with filenames and escaped XML', () => {
  const directory = mkdtempSync(join(tmpdir(), 'lyra-wtr-junit-root-'));
  try {
    const reporter = completeJunitReporter({ rootDir: directory, outputPath: 'junit.xml' });
    reporter.onTestRunFinished({ sessions: [junitSession(directory, 'root.test.ts', [
      { name: 'passes <root> & stays visible', passed: true, skipped: false, duration: 12 },
      { name: 'skips at root', passed: false, skipped: true },
      {
        name: 'fails at root',
        passed: false,
        skipped: false,
        error: { name: 'AssertionError', message: 'bad <value> & input', stack: 'AssertionError: bad value' },
      },
    ])] });
    const xml = readFileSync(join(directory, 'junit.xml'), 'utf8');
    assert.match(xml, /<testsuite[^>]* tests="3" skipped="1" errors="1" failures="1"/u);
    assert.equal((xml.match(/<testcase\b/gu) ?? []).length, 3);
    assert.equal((xml.match(/file="src\/root\.test\.ts"/gu) ?? []).length, 3);
    assert.match(xml, /passes &lt;root&gt; &amp; stays visible/u);
    assert.match(xml, /<skipped\s*\/>/u);
    assert.match(xml, /<failure[^>]*message="bad &lt;value&gt; &amp; input"/u);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('JUnit includes each root and nested case once across files without mutating runner results', () => {
  const directory = mkdtempSync(join(tmpdir(), 'lyra-wtr-junit-mixed-'));
  try {
    const sessions = [
      junitSession(directory, 'first.test.ts', [
        { name: 'first root case', passed: true, skipped: false },
      ], [{
        name: 'outer',
        tests: [
          { name: 'nested case', passed: true, skipped: false },
          { name: 'nested skip', passed: false, skipped: true },
        ],
        suites: [{ name: 'inner', tests: [
          { name: 'deep case', passed: true, skipped: false },
          {
            name: 'deep failure',
            passed: false,
            skipped: false,
            error: { name: 'AssertionError', message: 'nested mismatch', stack: 'AssertionError: nested mismatch' },
          },
        ], suites: [] }],
      }]),
      junitSession(directory, 'second.test.ts', [
        { name: 'second root case', passed: true, skipped: false },
      ]),
    ];
    const original = structuredClone(sessions);
    completeJunitReporter({ rootDir: directory, outputPath: 'junit.xml' })
      .onTestRunFinished({ sessions });
    assert.deepEqual(sessions, original);
    const xml = readFileSync(join(directory, 'junit.xml'), 'utf8');
    assert.equal((xml.match(/<testcase\b/gu) ?? []).length, 6);
    assert.equal((xml.match(/file="src\/first\.test\.ts"/gu) ?? []).length, 5);
    assert.equal((xml.match(/file="src\/second\.test\.ts"/gu) ?? []).length, 1);
    assert.match(xml, /first\.test\.ts"[^>]* tests="5" skipped="1" errors="1" failures="1"/u);
    assert.match(xml, /name="first root case"/u);
    assert.match(xml, /name="second root case"/u);
    assert.match(xml, /name="nested case"[^>]*classname="outer"/u);
    assert.match(xml, /name="nested skip"[^>]*classname="outer"/u);
    assert.match(xml, /name="deep case"[^>]*classname="outer inner"/u);
    assert.match(xml, /name="deep failure"[^>]*classname="outer inner"/u);
    assert.equal((xml.match(/<failure\b/gu) ?? []).length, 1);
    assert.equal((xml.match(/<skipped\s*\/>/gu) ?? []).length, 1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('coverage config uses the complete JUnit reporter for top-level-only files', () => {
  const directory = mkdtempSync(join(tmpdir(), 'lyra-wtr-junit-config-'));
  try {
    const session = junitSession(directory, 'configured.test.ts', [
      { name: 'configured root case', passed: true, skipped: false },
    ]);
    session.testFile = join(packageDirectory, 'src', 'configured.test.ts');
    const source = `
      import config from ${JSON.stringify(configUrl)};
      config.reporters[1].onTestRunFinished({ sessions: [${JSON.stringify(session)}] });
    `;
    const environment = { ...process.env, WTR_COVERAGE: '1', WTR_COVERAGE_REPORT_DIR: directory };
    delete environment.WTR_TIMING_REPORT;
    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', source], {
      cwd: packageDirectory,
      env: environment,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const xml = readFileSync(join(directory, 'junit.xml'), 'utf8');
    assert.match(xml, /<testsuite[^>]* tests="1" skipped="0" errors="0" failures="0"/u);
    assert.match(xml, /name="configured root case"[^>]*file="src\/configured\.test\.ts"/u);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('uses validated opt-in concurrency without weakening the coverage ceiling', () => {
  assert.equal(inspectConfig({ concurrency: '4' }).concurrency, 4);
  for (const concurrency of ['1', '2', '4', '8']) {
    assert.equal(inspectConfig({ browser: 'firefox', concurrency }).concurrency, 1);
  }
  assert.equal(inspectConfig({ browser: 'webkit', concurrency: '8' }).concurrency, 8);
  assert.equal(inspectConfig({ coverage: true, concurrency: '8' }).concurrency, 1);

  for (const concurrency of ['0', '-1', '1.5', '9007199254740992']) {
    const result = runConfigInspection({ concurrency });
    assert.notEqual(result.status, 0, `WTR_CONCURRENCY=${concurrency} must be rejected`);
    assert.match(result.stderr, /WTR_CONCURRENCY must be a positive safe integer/u);
    const firefoxResult = runConfigInspection({ browser: 'firefox', concurrency });
    assert.notEqual(firefoxResult.status, 0, 'Firefox must validate an override before applying its ceiling');
    assert.match(firefoxResult.stderr, /WTR_CONCURRENCY must be a positive safe integer/u);
  }
});

test('retries a failed test once by default and lets WTR_RETRIES switch retries off for flake hunts', () => {
  const retriesFor = (value) => {
    const result = inspectRetries(value);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return JSON.parse(result.stdout);
  };
  assert.equal(retriesFor(undefined), 1, 'CI behaviour is unchanged when the variable is unset');
  assert.equal(retriesFor('0'), 0, 'zero retries surfaces first-attempt failures');
  assert.equal(retriesFor('1'), 1);
  assert.equal(retriesFor('3'), 3);

  for (const invalid of ['', '-1', '1.5', 'many', '01', '9007199254740992']) {
    const result = inspectRetries(invalid);
    assert.notEqual(result.status, 0, `WTR_RETRIES=${JSON.stringify(invalid)} must be rejected`);
    assert.match(result.stderr, /WTR_RETRIES must be a non-negative safe integer/u);
  }
});

test('foregrounds non-WebKit pointer commands without suspending sibling WebKit pages', () => {
  const foregroundOrder = [
    'page:session-1',
    'front',
    'move:12,34',
    'page:session-1',
    'front',
    'click:56,78',
    'page:session-1',
    'front',
    'down',
    'page:session-1',
    'front',
    'up:default',
    'page:session-1',
    'front',
    'up:left',
    'up:middle',
    'up:right',
    'move:0,0',
    'page:session-1',
    'front',
    'wheel:12,-34',
  ];
  assert.deepEqual(inspectMouseCommandOrder(), foregroundOrder);
  assert.deepEqual(inspectMouseCommandOrder('chromium'), foregroundOrder);
  const webKitOrder = [
    'page:session-1',
    'move:12,34',
    'page:session-1',
    'click:56,78',
    'page:session-1',
    'down',
    'page:session-1',
    'up:default',
    'page:session-1',
    'up:left',
    'up:middle',
    'up:right',
    'move:0,0',
    'page:session-1',
    'wheel:12,-34',
  ];
  assert.deepEqual(inspectMouseCommandOrder('webkit'), webKitOrder);
  assert.deepEqual(inspectMouseCommandOrder('webkit', true), webKitOrder);
});

test('dispatches native wheel commands and rejects malformed wheel payloads', () => {
  assert.match(
    inspectInvalidWheelPayload(),
    /send-wheel command requires finite deltaX and deltaY values/iu,
  );
});

test('gives every parallel browser lane a distinct explicit test-server port', () => {
  const aggregateScript = readFileSync(resolve(packageDirectory, '../../scripts/test.sh'), 'utf8');
  const portBlock = aggregateScript.match(/declare -Ar WTR_LANE_PORTS=\((?<body>[\s\S]*?)\n\)/u);
  assert.ok(portBlock?.groups?.body, 'scripts/test.sh must declare WTR_LANE_PORTS');

  const lanePorts = Object.fromEntries(
    [...portBlock.groups.body.matchAll(/^\s*\[(chromium|firefox|webkit)\]=([1-9]\d*)\s*$/gmu)]
      .map((match) => [match[1], Number(match[2])]),
  );
  assert.deepEqual(Object.keys(lanePorts).sort(), ['chromium', 'firefox', 'webkit']);
  assert.equal(new Set(Object.values(lanePorts)).size, 3, 'parallel WTR ports must be unique');

  for (const [lane, port] of Object.entries(lanePorts)) {
    assert.ok(port >= 1024 && port <= 65535, `${lane} must use an unprivileged valid port`);
    const start = aggregateScript.indexOf(`lane_${lane}() {`);
    const end = aggregateScript.indexOf('\n}', start);
    assert.ok(start >= 0 && end > start, `scripts/test.sh must define lane_${lane}`);
    assert.match(
      aggregateScript.slice(start, end),
      new RegExp(`WTR_PORT="\\$\\{WTR_LANE_PORTS\\[${lane}\\]\\}"`, 'u'),
      `${lane} must pass its assigned port to Web Test Runner`,
    );
  }
});

test('caps aggregate-sweep browser sessions independently of the host CPU count', () => {
  const aggregateScript = readFileSync(resolve(packageDirectory, '../../scripts/test.sh'), 'utf8');
  const concurrencyBlock = aggregateScript.match(
    /declare -Ar WTR_LANE_CONCURRENCY=\((?<body>[\s\S]*?)\n\)/u,
  );
  assert.ok(
    concurrencyBlock?.groups?.body,
    'scripts/test.sh must declare WTR_LANE_CONCURRENCY',
  );

  const laneConcurrency = Object.fromEntries(
    [
      ...concurrencyBlock.groups.body.matchAll(
        /^\s*\[(chromium|firefox|webkit)\]=([1-9]\d*)\s*$/gmu,
      ),
    ].map((match) => [match[1], Number(match[2])]),
  );
  assert.deepEqual(Object.keys(laneConcurrency).sort(), ['chromium', 'firefox', 'webkit']);
  assert.equal(laneConcurrency.chromium, 1, 'coverage must remain single-session');
  assert.equal(laneConcurrency.firefox, 1, 'Firefox must isolate native pointer capture per process');
  assert.ok(laneConcurrency.webkit <= 4, 'WebKit must not consume half a high-core host');
  assert.ok(
    Object.values(laneConcurrency).reduce((sum, value) => sum + value, 0) <= 6,
    'parallel browser lanes must have a conservative aggregate session ceiling',
  );

  for (const lane of Object.keys(laneConcurrency)) {
    const start = aggregateScript.indexOf(`lane_${lane}() {`);
    const end = aggregateScript.indexOf('\n}', start);
    assert.ok(start >= 0 && end > start, `scripts/test.sh must define lane_${lane}`);
    assert.match(
      aggregateScript.slice(start, end),
      new RegExp(
        `WTR_CONCURRENCY="\\$\\{WTR_LANE_CONCURRENCY\\[${lane}\\]\\}"`,
        'u',
      ),
      `${lane} must pass its assigned concurrency to Web Test Runner`,
    );
  }
});


test('sizes engine and coverage shards from the host page budget', () => {
  const script = readFileSync(resolve(packageDirectory, '../../scripts/test.sh'), 'utf8');
  assert.match(script, new RegExp(`\\nCOVERAGE_SHARDS=${COVERAGE_SHARD_TOTAL}\\n`, 'u'));
  assert.match(script, /local-parallelism\.mjs --cores-per-worker 2 --memory-per-worker-mb 1024\)/u);
  const start = script.indexOf('if [[ -n "${TEST_SH_ENGINE_SHARDS:-}" ]]; then');
  const end = script.indexOf('\necho "page budget', start);
  assert.ok(start >= 0 && end > start, 'shard sizing must be available');
  const sizing = script.slice(start, end);
  // [page budget, TEST_SH_ENGINE_SHARDS, serial, engine shards, concurrent coverage shards]
  for (const [budget, requested, serial, shards, coverage] of [
    [1, '', 0, 1, 1], [7, '', 0, 1, 2], [29, '', 0, 4, 5], [29, '', 1, 1, 1],
    [7, '8', 0, 1, 2], [29, '8', 0, 5, 4], [39, '8', 0, 7, 4], [39, '2', 0, 2, 5], [4, '1', 0, 1, 1],
  ]) {
    const result = spawnSync('bash', ['-c', `
      PAGE_BUDGET=${budget} PER_SHARD_PAGES=5 COVERAGE_SHARDS=${COVERAGE_SHARD_TOTAL} SERIAL=${serial}
      TEST_SH_ENGINE_SHARDS='${requested}'
      ${sizing}
      printf '%s %s\n' "$ENGINE_SHARDS" "$COVERAGE_PARALLEL"
    `], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), `${shards} ${coverage}`, `budget ${budget}, requested ${requested || 'auto'}`);
  }
});

/** test.sh sizes its shards with the package's host-parallelism helper. */
function copyAggregateHelpers(directory) {
  mkdirSync(join(directory, 'packages/lyra-ui/scripts'), { recursive: true });
  for (const helper of ['local-parallelism.mjs', 'is-main-module.mjs']) {
    copyFileSync(resolve(packageDirectory, 'scripts', helper), join(directory, 'packages/lyra-ui/scripts', helper));
  }
}

function runAggregateFixture(script, serial, failure = '') {
  const directory = mkdtempSync(join(tmpdir(), 'lyra-aggregate-'));
  try {
    for (const child of ['scripts', 'bin', 'logs']) mkdirSync(join(directory, child));
    copyFileSync(
      resolve(packageDirectory, '../../scripts', script),
      join(directory, 'scripts', script),
    );
    copyAggregateHelpers(directory);
    const packageManager = JSON.parse(
      readFileSync(resolve(packageDirectory, '../../package.json'), 'utf8'),
    ).packageManager;
    writeFileSync(join(directory, 'package.json'), JSON.stringify({ packageManager }));
    writeFileSync(join(directory, 'bin/pnpm'), `#!/usr/bin/env bash
set -eu
if [[ "$*" == '--version' ]]; then
  printf '%s\\n' '${packageManager.replace(/^pnpm@/u, '')}'
  exit 0
fi
printf '%s|%s|%s\\n' "$*" "\${WTR_BROWSER:-none}" "\${WTR_SHARD_INDEX:-0}" >> "$AGGREGATE_CALLS"
if [[ -n "$AGGREGATE_FAILURE" && "$*" == *"$AGGREGATE_FAILURE"* && "\${WTR_SHARD_INDEX:-1}" == 1 ]]; then
  exit 23
fi
`, { mode: 0o755 });
    const result = spawnSync('bash', [join(directory, 'scripts', script), ...(serial ? ['--serial'] : [])], {
      cwd: directory,
      encoding: 'utf8',
      timeout: 15_000,
      env: {
        ...process.env,
        PATH: `${join(directory, 'bin')}:${dirname(process.execPath)}:${process.env.PATH}`,
        TMPDIR: join(directory, 'logs'),
        TEST_SH_SKIP_INSTALL: '1',
        TEST_SH_ENGINE_SHARDS: '1',
        TEST_ALL_BROWSERS_SKIP_INSTALL: '1',
        AGGREGATE_FAILURE: failure,
        AGGREGATE_CALLS: join(directory, 'calls'),
      },
    });
    assert.ifError(result.error);
    return {
      status: result.status,
      output: `${result.stdout}${result.stderr}`.replace(/\u001b\[[0-9;]*m/gu, ''),
      calls: readFileSync(join(directory, 'calls'), 'utf8').trim().split('\n'),
      remainingLogDirectories: readdirSync(join(directory, 'logs')).length,
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

for (const serial of [false, true]) {
  const mode = serial ? 'serial' : 'parallel';
  for (const failure of ['test:ssr', 'test:hydration', 'test:coverage']) {
    test(`the ${mode} full sweep preserves ${failure} failure before coverage floors`, () => {
      const result = runAggregateFixture('test.sh', serial, failure);
      assert.equal(result.status, 1, result.output);
    assert.ok(result.remainingLogDirectories > 0, 'failed sweep preserves lane logs');
      assert.match(result.output, /FAIL\s+chromium/u);
      assert.ok(!result.calls.some((call) => call.includes('check:coverage-floors')));
      assert.match(result.output, /PASS\s+workspace/u, 'other lanes still run');
    });
  }
  test(`the ${mode} full sweep stops a visual lane when its build fails`, () => {
    const result = runAggregateFixture('test.sh', serial, 'docs:build');
    assert.equal(result.status, 1, result.output);
    assert.ok(result.remainingLogDirectories > 0, 'failed sweep preserves lane logs');
    assert.match(result.output, /FAIL\s+visual/u);
    assert.ok(!result.calls.some((call) => call.includes('test:visual')));
  });
  test(`the ${mode} browser sweep retains a failed first shard`, () => {
    const result = runAggregateFixture('test_all_browsers.sh', serial, 'test:full-engine-shard');
    assert.equal(result.status, 1, result.output);
    assert.ok(result.remainingLogDirectories > 0, 'failed sweep preserves lane logs');
    const shardCalls = result.calls.filter((call) => call.includes('test:full-engine-shard'));
    assert.equal(shardCalls.length, 5, 'each browser stops after its failed first shard');
    assert.ok(shardCalls.every((call) => call.endsWith('|1')));
    assert.equal((result.output.match(/FAIL\s+/gu) ?? []).length, 5);
  });
  for (const script of ['test.sh', 'test_all_browsers.sh']) {
    test(`the ${mode} ${script} sweep reports success when every command succeeds`, () => {
      const result = runAggregateFixture(script, serial);
      assert.equal(result.status, 0, result.output);
      assert.equal(result.remainingLogDirectories, 0, 'successful sweep removes lane logs');
      assert.doesNotMatch(result.output, /FAIL\s+/u);
      assert.equal((result.output.match(/PASS\s+/gu) ?? []).length, 5);
    });
  }
}


async function strictConsoleHarness(strict = true) {
  const previous = process.env.WTR_STRICT_CONSOLE;
  process.env.WTR_STRICT_CONSOLE = strict ? '1' : '0';
  let configModule;
  try {
    configModule = await import(`${configUrl}?strict-console=${strict}`);
  } finally {
    if (previous === undefined) delete process.env.WTR_STRICT_CONSOLE;
    else process.env.WTR_STRICT_CONSOLE = previous;
  }
  const logs = [];
  const errorListeners = [];
  const deferredTasks = [];
  const context = {
    addEventListener(type, listener) {
      if (type === 'error') errorListeners.push(listener);
    },
    setTimeout(callback) { deferredTasks.push(callback); },
    console: {
      warn: (...args) => logs.push(['warn', ...args]),
      error: (...args) => logs.push(['error', ...args]),
    },
  };
  const runnerHtml = configModule.default.testRunnerHtml('/runner.js')
    .replace(/<\/?script/giu, (tag) => tag.toUpperCase());
  const script = runnerHtml.match(/<script>([\s\S]*?)<\/script>/iu)[1];
  runInNewContext(script, context);
  const calls = [];
  const existingError = { message: 'existing session failure' };
  const testCoverage = { fixture: true };
  const launcher = {
    getPage(id) {
      calls.push(`page:${id}`);
      return { async evaluate(callback) {
        calls.push('evaluate');
        return runInNewContext(`(${callback.toString()})()`, context);
      } };
    },
    async stopSession(id) {
      assert.equal(this, launcher, 'launcher receiver is preserved');
      calls.push(`stop:${id}`);
      return { testCoverage, errors: [existingError] };
    },
  };
  configModule.enforceStrictConsole(launcher);
  return {
    context, logs, calls, launcher, existingError, testCoverage,
    dispatchError(event) { for (const listener of errorListeners) listener(event); },
    flushDeferredTasks() { while (deferredTasks.length) deferredTasks.shift()(); },
  };
}

for (const method of ['warn', 'error']) {
  test(`retains an asynchronous console.${method} failure in the completed session`, async () => {
    const { context, logs, calls, launcher } = await strictConsoleHarness();
    await assert.rejects(Promise.resolve().then(() => context.console[method]('async violation')),
      new RegExp(`Unexpected browser console.${method}: async violation`, 'u'));
    assert.doesNotThrow(() => context.console.error('runner reports the caught exception'));
    assert.doesNotThrow(() => context.console.warn('later warning'));
    await assert.rejects(launcher.stopSession('session-1'), (error) => {
      assert.equal(error.message, `Unexpected browser console.${method}: async violation`);
      assert.equal(typeof error.stack, 'string');
      return true;
    });
    assert.deepEqual(calls, ['page:session-1', 'evaluate', 'stop:session-1']);
    assert.equal(logs.length, 3, 'the one-shot guard keeps logging without recursive throws');
  });
}

test('keeps intentional stubs and the existing Shiki advisory exemption armed for later violations', async () => {
  const { context, launcher, testCoverage, existingError } = await strictConsoleHarness();
  const originalWarn = context.console.warn;
  let captured = 0;
  context.console.warn = () => captured++;
  context.console.warn('expected warning');
  context.console.warn = originalWarn;
  context.console.warn('[Shiki] fixture count advisory');
  assert.equal(captured, 1);
  const clean = await launcher.stopSession('clean');
  assert.equal(clean.errors.length, 1, 'no strict-console failure was added');
  assert.equal(clean.errors[0], existingError);
  assert.equal(clean.testCoverage, testCoverage);
  assert.throws(() => context.console.warn('unexpected'), /Unexpected browser console.warn/u);
  await assert.rejects(launcher.stopSession('failed'), /Unexpected browser console.warn/u);
});

test('leaves ordinary browser sessions unchanged when strict mode is off', async () => {
  const { context, launcher, calls } = await strictConsoleHarness(false);
  context.console.warn('ordinary warning');
  context.console.error('ordinary error');
  assert.equal((await launcher.stopSession('ordinary')).errors.length, 1);
  assert.deepEqual(calls, ['stop:ordinary']);
});


test('closes the browser and fails closed when strict-console inspection fails', async () => {
  const { launcher, calls } = await strictConsoleHarness();
  launcher.getPage = () => ({ async evaluate() { throw new Error('page unavailable'); } });
  await assert.rejects(launcher.stopSession('unavailable'),
    /Could not inspect strict browser console: page unavailable/u);
  assert.deepEqual(calls, ['stop:unavailable']);
});


test('honors explicit cancellation of a ResizeObserver notice without exempting direct null errors', async () => {
  const { context, launcher, dispatchError, flushDeferredTasks } = await strictConsoleHarness();
  const event = {
    error: null, message: 'ResizeObserver loop completed with undelivered notifications.',
    eventPhase: 2, defaultPrevented: false,
  };
  dispatchError(event);
  context.console.error(null);
  // The file's own error listener runs after WTR's log bridge and cancels this notice.
  event.defaultPrevented = true;
  event.eventPhase = 0;
  flushDeferredTasks();
  assert.equal((await launcher.stopSession('canceled-notice')).errors.length, 1);
  assert.throws(() => context.console.error(null), /Unexpected browser console.error: null/u);
  await assert.rejects(launcher.stopSession('direct-null'), /Unexpected browser console.error: null/u);
});

test('fails an uncanceled ResizeObserver notice after dispatch finishes', async () => {
  const { context, launcher, dispatchError, flushDeferredTasks } = await strictConsoleHarness();
  const event = { error: null, message: 'ResizeObserver loop limit exceeded', eventPhase: 2, defaultPrevented: false };
  dispatchError(event);
  context.console.error(null);
  event.eventPhase = 0;
  assert.throws(flushDeferredTasks, /Unexpected browser console.error: null/u);
  await assert.rejects(launcher.stopSession('uncanceled-notice'), /Unexpected browser console.error: null/u);
});

test('does not defer null error payloads from unrelated canceled error events', async () => {
  const { context, launcher, dispatchError } = await strictConsoleHarness();
  dispatchError({ error: null, message: 'Script error.', eventPhase: 2, defaultPrevented: true });
  assert.throws(() => context.console.error(null), /Unexpected browser console.error: null/u);
  await assert.rejects(launcher.stopSession('unrelated-error'), /Unexpected browser console.error: null/u);
});

test('inspects pending notices at teardown before their deferred task runs', async () => {
  for (const canceled of [false, true]) {
    const { context, launcher, dispatchError } = await strictConsoleHarness();
    const event = { error: null, message: 'ResizeObserver loop limit exceeded', eventPhase: 2, defaultPrevented: false };
    dispatchError(event);
    context.console.error(null);
    event.defaultPrevented = canceled;
    event.eventPhase = 0;
    if (canceled) await launcher.stopSession('canceled-pending');
    else await assert.rejects(launcher.stopSession('uncanceled-pending'), /Unexpected browser console.error: null/u);
  }
});

test('does not attribute a nested unrelated error to an outer ResizeObserver notice', async () => {
  const { context, launcher, dispatchError } = await strictConsoleHarness();
  const outer = { error: null, message: 'ResizeObserver loop limit exceeded', eventPhase: 2, defaultPrevented: false };
  dispatchError(outer);
  dispatchError({ error: null, message: 'Script error.', eventPhase: 2, defaultPrevented: true });
  assert.throws(() => context.console.error(null), /Unexpected browser console.error: null/u);
  outer.defaultPrevented = true;
  outer.eventPhase = 0;
  await assert.rejects(launcher.stopSession('nested-unrelated-error'), /Unexpected browser console.error: null/u);
});

test('serves reviewed source Shiki WASM without reading build output', () => {
  const source = readFileSync(new URL('../web-test-runner.config.js', import.meta.url), 'utf8');
  const declaration = source.slice(source.indexOf('const shikiOnigWasmAssetPlugin ='),
    source.indexOf('const mouseButtons ='));
  const require = createRequire(new URL('../package.json', import.meta.url));
  const binaryPath = require.resolve('shiki/onig.wasm');
  const reads = [];
  const plugin = runInNewContext(`${declaration.replaceAll('import.meta.url', JSON.stringify(configUrl))} shikiOnigWasmAssetPlugin;`, {
    assert, createHash, reviewedSha256, require, URL,
    readFileSync(path) {
      assert.equal(path, binaryPath, 'source server must only read the installed peer asset');
      reads.push(path);
      return readFileSync(path);
    },
  });
  const context = { path: '/src/components/conversation/code-block/onig.wasm' };
  plugin.serve(context);
  assert.equal(context.status, 200);
  assert.equal(context.type, 'application/wasm');
  assert.equal(createHash('sha256').update(context.body).digest('hex'), reviewedSha256);
  assert.equal(reads.length, 1);
  const changedPlugin = runInNewContext(`${declaration.replaceAll('import.meta.url', JSON.stringify(configUrl))} shikiOnigWasmAssetPlugin;`, {
    assert, createHash, reviewedSha256, require, URL,
    readFileSync() { return Buffer.from('unreviewed binary'); },
  });
  const changed = { path: context.path };
  assert.throws(() => changedPlugin.serve(changed), /review engine compatibility and notices/);
  assert.equal(changed.status, undefined, 'unreviewed bytes must not receive a success response');
  const unrelated = { path: '/unrelated/onig.wasm' };
  plugin.serve(unrelated);
  assert.equal(unrelated.status, undefined);
  assert.equal(reads.length, 1);
});

for (const script of ['test.sh', 'test_all_browsers.sh']) {
  for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP']) {
    test(`${script} preserves original lane logs when interrupted by ${signal}`, async () => {
      const directory = mkdtempSync(join(tmpdir(), 'lyra-aggregate-signal-'));
      let child;
      let closed;
      try {
        for (const name of ['scripts', 'bin', 'logs']) mkdirSync(join(directory, name));
        copyFileSync(resolve(packageDirectory, '../../scripts', script), join(directory, 'scripts', script));
        copyAggregateHelpers(directory);
        const packageManager = JSON.parse(readFileSync(resolve(packageDirectory, '../../package.json'), 'utf8')).packageManager;
        writeFileSync(join(directory, 'package.json'), JSON.stringify({ packageManager }));
        writeFileSync(join(directory, 'bin/pnpm'), `#!/bin/bash
if [[ "$*" == --version ]]; then echo '${packageManager.replace(/^pnpm@/u, '')}'; exit; fi
if [[ "$*" == *test:* || "$*" == *check:component-quality* ]]; then
 echo ORIGINAL_LANE_DIAGNOSTIC
 sleep 300
fi
`, { mode: 0o755 });
        child = spawn('bash', [join(directory, 'scripts', script)], {
          detached: true,
          env: {
            ...process.env,
            PATH: `${join(directory, 'bin')}:${dirname(process.execPath)}:${process.env.PATH}`,
            TMPDIR: join(directory, 'logs'),
            TEST_SH_SKIP_INSTALL: '1',
            TEST_ALL_BROWSERS_SKIP_INSTALL: '1',
            TEST_SH_ENGINE_SHARDS: '1',
          },
        });
        let output = '';
        child.stdout.on('data', bytes => { output += bytes; });
        child.stderr.on('data', bytes => { output += bytes; });
        const finished = new Promise((resolveDone, reject) => {
          child.once('error', reject);
          child.once('exit', (code, receivedSignal) => resolveDone({ code, receivedSignal }));
        });
        finished.catch(() => {});
        closed = new Promise(resolveClosed => child.once('close', resolveClosed));
        const deadline = Date.now() + 5000;
        let laneDirectory;
        let diagnosticObserved = false;
        while (Date.now() < deadline) {
          const match = output.match(/lane logs: (.+)/u);
          if (match) {
            laneDirectory = match[1];
            diagnosticObserved = readdirSync(laneDirectory).some(name => readFileSync(join(laneDirectory, name), 'utf8').includes('ORIGINAL_LANE_DIAGNOSTIC'));
            if (diagnosticObserved) break;
          }
          await new Promise(resolveWait => setTimeout(resolveWait, 20));
        }
        assert.ok(diagnosticObserved, output);
        assert.ok(Number.isInteger(child.pid) && child.pid > 0);
        process.kill(-child.pid, signal);
        let timer;
        const result = await Promise.race([finished, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('aggregate signal deadline')), 5000); })]).finally(() => clearTimeout(timer));
        assert.equal(result.code, { SIGTERM: 143, SIGINT: 130, SIGHUP: 129 }[signal], output);
        assert.equal(existsSync(laneDirectory), true, output);
        assert.ok(readdirSync(laneDirectory).some(name => readFileSync(join(laneDirectory, name), 'utf8').includes('ORIGINAL_LANE_DIAGNOSTIC')));
      } finally {
        if (Number.isInteger(child?.pid) && child.pid > 0) {
          try { process.kill(-child.pid, 'SIGKILL'); }
          catch (error) { if (error.code !== 'ESRCH') throw error; }
        }
        if (closed) {
          let cleanupTimer;
          await Promise.race([
            closed,
            new Promise((_, reject) => {
              cleanupTimer = setTimeout(() => reject(new Error('aggregate cleanup deadline')), 5000);
            }),
          ]).finally(() => clearTimeout(cleanupTimer));
        }
        rmSync(directory, { recursive: true, force: true });
      }
    });
  }
}
