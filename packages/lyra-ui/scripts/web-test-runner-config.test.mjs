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
  nativeScrollbar = false,
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
  if (nativeScrollbar) environment.WTR_NATIVE_SCROLLBAR = '1';
  else delete environment.WTR_NATIVE_SCROLLBAR;

  const source = `
    import config from ${JSON.stringify(configUrl)};
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
    concurrency: null,
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
  assert.equal(inspectConfig({ browser: 'chromium' }).concurrency, null);
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
    firefoxUserPrefs: { 'widget.gtk.overlay-scrollbars.enabled': false },
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


test('budgets aggregate shards from both unequal engine page allocations', () => {
  const script = readFileSync(resolve(packageDirectory, '../../scripts/test.sh'), 'utf8');
  const allocation = script.match(/declare -Ar WTR_LANE_CONCURRENCY=\([\s\S]*?\n\)/u)?.[0];
  assert.ok(allocation, 'aggregate page allocations must be available');
  const start = script.indexOf('if [[ "$ENGINE_SHARDS" != "1" ]]; then');
  const end = script.indexOf('\n# One wtr process per engine shard.', start);
  assert.ok(start >= 0 && end > start, 'aggregate shard clamp must be available');
  const clamp = script.slice(start, end);
  for (const [cpus, requested, expected] of [[4, 8, 1], [16, 8, 1], [32, 8, 3], [60, 8, 6], [80, 8, 8], [4, 1, 1]]) {
    const result = spawnSync('bash', ['-c', `${allocation}
      ENGINE_SHARDS=${requested}
      nproc() { printf '%s\n' ${cpus}; }
      ${clamp}
      printf '%s\n' "$ENGINE_SHARDS"
    `], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(Number(result.stdout.trim()), expected, `${cpus} CPUs, ${requested} requested shards`);
  }
});
