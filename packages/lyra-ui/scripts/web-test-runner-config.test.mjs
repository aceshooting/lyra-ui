import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const configUrl = pathToFileURL(resolve(packageDirectory, 'web-test-runner.config.js')).href;

function runConfigInspection({
  coverage = false,
  coverageReportDir,
  port,
  concurrency,
  browser,
} = {}) {
  const environment = { ...process.env };
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

  const source = `
    import config from ${JSON.stringify(configUrl)};
    process.stdout.write(JSON.stringify({
      coverage: config.coverage,
      concurrency: config.concurrency ?? null,
      port: config.port ?? null,
      mediaCommand: config.plugins.some((plugin) => plugin.name === 'lyra-media-command'),
      keyCommand: config.plugins.some((plugin) => plugin.name === 'send-keys-command'),
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

function inspectMouseCommandOrder() {
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
      },
    };
    const plugin = config.plugins.find((candidate) => candidate.name === 'lyra-mouse-command');
    const session = {
      id: 'session-1',
      browser: {
        type: 'playwright',
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
    process.stdout.write(JSON.stringify(calls));
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', source], {
    cwd: packageDirectory,
    env: { ...process.env, WTR_BROWSER: 'firefox' },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
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
    mediaCommand: true,
    keyCommand: true,
  });
  assert.deepEqual(inspectConfig(), {
    coverage: false,
    concurrency: null,
    port: null,
    mediaCommand: true,
    keyCommand: true,
  });
});

test('caps pointer-sensitive browser concurrency without increasing the low-core default', () => {
  const expectedConcurrency = Math.max(
    1,
    Math.min(4, Math.floor(availableParallelism() / 2)),
  );
  assert.equal(inspectConfig({ browser: 'firefox' }).concurrency, expectedConcurrency);
  assert.equal(inspectConfig({ browser: 'webkit' }).concurrency, expectedConcurrency);
  assert.equal(inspectConfig({ browser: 'safari' }).concurrency, expectedConcurrency);
  assert.equal(inspectConfig({ browser: 'chromium' }).concurrency, null);
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

test('uses validated opt-in concurrency without weakening the coverage ceiling', () => {
  assert.equal(inspectConfig({ concurrency: '4' }).concurrency, 4);
  assert.equal(inspectConfig({ browser: 'firefox', concurrency: '2' }).concurrency, 2);
  assert.equal(inspectConfig({ browser: 'webkit', concurrency: '8' }).concurrency, 8);
  assert.equal(inspectConfig({ coverage: true, concurrency: '8' }).concurrency, 1);

  for (const concurrency of ['0', '-1', '1.5', '9007199254740992']) {
    const result = runConfigInspection({ concurrency });
    assert.notEqual(result.status, 0, `WTR_CONCURRENCY=${concurrency} must be rejected`);
    assert.match(result.stderr, /WTR_CONCURRENCY must be a positive safe integer/u);
  }
});

test('foregrounds the requesting page before every real pointer command', () => {
  assert.deepEqual(inspectMouseCommandOrder(), [
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
  ]);
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
  assert.ok(laneConcurrency.firefox <= 4, 'Firefox must not consume half a high-core host');
  assert.ok(laneConcurrency.webkit <= 4, 'WebKit must not consume half a high-core host');
  assert.ok(
    Object.values(laneConcurrency).reduce((sum, value) => sum + value, 0) <= 9,
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
