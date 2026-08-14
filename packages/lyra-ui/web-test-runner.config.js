import { readFileSync } from 'node:fs';
import { defaultReporter } from '@web/test-runner';
import { sendKeysPlugin } from '@web/test-runner-commands/plugins';
import { playwrightLauncher } from '@web/test-runner-playwright';
import { junitReporter } from '@web/test-runner-junit-reporter';
import { esbuildPlugin } from '@web/dev-server-esbuild';

// Read rather than `import ... with { type: 'json' }`: import attributes are
// still gated behind a Node version this repo does not pin (engines: >=20).
const coverageFloors = JSON.parse(
  readFileSync(new URL('./scripts/coverage-floors.json', import.meta.url), 'utf8'),
);

/**
 * `chartjs-plugin-zoom` (an optional chart peer dependency) has a hard
 * dependency on `hammerjs`, a UMD-only package with no ESM build. The
 * browser's native ESM loader can't `import Hammer from 'hammerjs'` because
 * the file never emits an `export` statement — it just assigns
 * `window.Hammer` when it detects no CJS/AMD loader (see hammerjs's own UMD
 * footer). Real consumers bundle with Vite/webpack/esbuild-bundle, which
 * already do this kind of CJS/UMD interop automatically; `@web/test-runner`
 * serves unbundled ESM, so this tiny plugin appends a synthetic
 * `export default` once hammer.js has run and populated `window.Hammer`,
 * purely to unblock this test environment.
 */
const hammerEsmInteropPlugin = {
  name: 'hammerjs-esm-interop',
  transform(context) {
    if (context.response.is('js') && context.path.endsWith('/hammerjs/hammer.js')) {
      return `${context.body}\nexport default window.Hammer;\n`;
    }
  },
};

const papaparseEsmInteropPlugin = {
  name: 'papaparse-esm-interop',
  transform(context) {
    if (context.path.includes('/papaparse/') && context.path.includes('papaparse.js')) {
      return `${context.body.replaceAll('this, function moduleFactory()', 'window, function moduleFactory()')}\nexport default window.Papa;\n`;
    }
  },
};

/**
 * `mammoth` exposes its browser bundle as a UMD file rather than native ESM.
 * The browser test server does not add CJS/UMD interop, so export the global
 * populated by mammoth's documented browser entry point.
 */
const mammothEsmInteropPlugin = {
  name: 'mammoth-esm-interop',
  transform(context) {
    if (context.response.is('js') && context.path.endsWith('/mammoth/mammoth.browser.js')) {
      return `${context.body}\nexport default window.mammoth;\n`;
    }
  },
};

const jszipEsmInteropPlugin = {
  name: 'jszip-esm-interop',
  transform(context) {
    if (context.response.is('js') && context.path.endsWith('/jszip/lib/index.js')) {
      return "export { default } from 'jszip/dist/jszip.min.js';\n";
    }
    if (context.response.is('js') && context.path.endsWith('/jszip/dist/jszip.min.js')) {
      return `${context.body}\nexport default JSZip;\n`;
    }
    if (context.response.is('js') && context.path.endsWith('/jszip/dist/jszip.js')) {
      return `${context.body}\nexport default JSZip;\n`;
    }
  },
};

const echartsProcessInteropPlugin = {
  name: 'echarts-process-interop',
  transform(context) {
    if (context.response.is('js') && context.path.includes('/echarts/')) {
      return context.body.replaceAll('process.env.NODE_ENV', "'production'");
    }
  },
};

const mouseButtons = new Set(['left', 'middle', 'right']);
const mouseCommandTypes = new Set(['move', 'click', 'down', 'up']);

function validateMouseCommand(payload) {
  if (payload === null || typeof payload !== 'object' || !mouseCommandTypes.has(payload.type)) {
    throw new Error('The send-mouse command requires a move, click, down, or up payload.');
  }

  if (payload.type === 'move' || payload.type === 'click') {
    const position = payload.position;
    if (
      !Array.isArray(position) ||
      position.length !== 2 ||
      !position.every(Number.isInteger)
    ) {
      throw new Error('Mouse positions must be an [x, y] tuple of integers.');
    }
  }

  if (payload.button !== undefined && !mouseButtons.has(payload.button)) {
    throw new Error('Mouse buttons must be left, middle, or right.');
  }
}

const mouseCommandPlugin = {
  name: 'lyra-mouse-command',
  async executeCommand({ command, payload, session }) {
    if (command !== 'send-mouse' && command !== 'reset-mouse') return;
    if (session.browser.type !== 'playwright') {
      throw new Error(`Mouse commands do not support browser type ${session.browser.type}.`);
    }

    const page = session.browser.getPage(session.id);
    if (command === 'reset-mouse') {
      await page.mouse.up({ button: 'left' });
      await page.mouse.up({ button: 'middle' });
      await page.mouse.up({ button: 'right' });
      await page.mouse.move(0, 0);
      return true;
    }

    validateMouseCommand(payload);
    switch (payload.type) {
      case 'move':
        await page.mouse.move(payload.position[0], payload.position[1]);
        return true;
      case 'click':
        await page.mouse.click(payload.position[0], payload.position[1], {
          button: payload.button,
        });
        return true;
      case 'down':
        await page.mouse.down({ button: payload.button });
        return true;
      case 'up':
        await page.mouse.up({ button: payload.button });
        return true;
    }
  },
};

const reducedMotionPreferences = new Set(['reduce', 'no-preference']);
const mediaCommandPlugin = {
  name: 'lyra-media-command',
  async executeCommand({ command, payload, session }) {
    if (command !== 'set-reduced-motion') return;
    if (session.browser.type !== 'playwright') {
      throw new Error(`Media commands do not support browser type ${session.browser.type}.`);
    }
    if (!reducedMotionPreferences.has(payload)) {
      throw new Error('Reduced motion must be "reduce" or "no-preference".');
    }

    await session.browser.getPage(session.id).emulateMedia({ reducedMotion: payload });
    return true;
  },
};

const browserProduct = (process.env.WTR_BROWSER ?? 'chromium').toLowerCase();
const browserLaunchers = {
  chromium: { product: 'chromium' },
  chrome: { product: 'chromium', launchOptions: { channel: 'chrome' } },
  edge: { product: 'chromium', launchOptions: { channel: 'msedge' } },
  safari: { product: 'webkit' },
  firefox: { product: 'firefox' },
  webkit: { product: 'webkit' },
};
const launcherConfig = browserLaunchers[browserProduct];
if (!launcherConfig) {
  throw new Error(`Unsupported WTR_BROWSER value: ${browserProduct}`);
}

const strictConsole = process.env.WTR_STRICT_CONSOLE === '1';
const collectCoverage = process.env.WTR_COVERAGE === '1';
const testRunnerHtml = (testRunnerImport) => `
<!doctype html>
<html>
  <head></head>
  <body>
    <script>
      globalThis.litIssuedWarnings = new Set(['dev-mode']);
      ${strictConsole ? `
      const originalWarn = console.warn;
      console.warn = (...args) => {
        originalWarn(...args);
        throw new Error('Unexpected browser console.warn: ' + args.map(String).join(' '));
      };
      console.error = (...args) => {
        throw new Error('Unexpected browser console.error: ' + args.map(String).join(' '));
      };
      ` : ''}
    </script>
    <script type="module" src=${JSON.stringify(testRunnerImport)}></script>
  </body>
</html>`;

export default {
  files: 'src/**/*.test.ts',
  nodeResolve: true,
  browsers: [playwrightLauncher(launcherConfig)],
  // The runner otherwise opens half the host's reported CPU count in browser pages. Coverage
  // instrumentation makes each page import most of the source graph, so high-core hosts can
  // exhaust Chromium's request/process resources before tests start. Keep ordinary and platform
  // runs on the runner default; coverage trades a little throughput for a deterministic ceiling
  // while retaining one runner process and therefore one combined report.
  ...(collectCoverage ? { concurrency: 1 } : {}),
  // Keep the complete browser-session watchdog high enough for a slow worker to report the actual
  // result while still failing resource leaks and unresolved tests within a bounded five minutes.
  testsFinishTimeout: 300000,
  // Default is 30s (@web/test-runner-core's DEFAULT_CONFIG.browserStartTimeout). Unlike
  // chromium/firefox/webkit -- which restore from the ~/.cache/ms-playwright binary cache --
  // Playwright's msedge/chrome "channel" browsers install via a real OS package manager
  // (`playwright install msedge` runs an apt-get of microsoft-edge-stable) with no equivalent
  // cache hit, so the first browser-session launch right after that install is measurably
  // slower on a loaded shared CI runner and can exceed the 30s default before the channel browser
  // is warm. Applies to every browser, not just edge, but only matters when a launch is actually
  // slow.
  browserStartTimeout: 90000,
  plugins: [
    esbuildPlugin({ ts: true, json: true, target: 'es2022', tsconfig: 'tsconfig.json' }),
    hammerEsmInteropPlugin,
    papaparseEsmInteropPlugin,
    mammothEsmInteropPlugin,
    jszipEsmInteropPlugin,
    echartsProcessInteropPlugin,
    sendKeysPlugin(),
    mouseCommandPlugin,
    mediaCommandPlugin,
  ],
  testFramework: {
    // Mocha's default 2000ms per-test timeout is shorter than the wait
    // budgets some tests already declare on purpose (e.g. lr-graph's
    // NODE_COUNT_TIMEOUT = 5000ms, for d3-force's rAF-driven tick under
    // Chromium's background-tab throttling when many test files run
    // concurrently). Raise the default so those budgets can actually work.
    config: {
      timeout: '6000',
      // Retry a failed test once before reporting it red: a red result is
      // therefore reproducible, not scheduler noise. Tests that stay flaky
      // under a retry get fixed or explicitly quarantined, never ignored.
      retries: 1,
    },
  },
  testRunnerHtml,
  coverage: collectCoverage,
  // Only swap in JUnit output during the coverage run (same WTR_COVERAGE gate
  // as everything else in this file) -- keep defaultReporter() alongside it so
  // local/CI console output during a normal `wtr` run is unaffected. Leaving
  // `reporters` unset when collectCoverage is false preserves wtr's own
  // built-in default reporter behavior exactly as today.
  reporters: collectCoverage
    ? [defaultReporter(), junitReporter({ outputPath: 'coverage/junit.xml' })]
    : undefined,
  // Chromium reports ResizeObserver loop notifications as ErrorEvents whose
  // `error` payload is null. The runner's uncaught-error bridge logs that
  // payload before the performance suite can suppress the benign notification.
  // Keep all other browser logs visible.
  filterBrowserLogs: (log) => !(log.type === 'error' && log.args.length === 1 && log.args[0] === null),
  coverageConfig: {
    // Broad glob over the real source tree, not a curated allowlist -- Codecov
    // (see codecov.yml) is the intended place to look at real numbers per
    // component family now, not this file.
    include: ['src/**/*.ts'],
    exclude: [
      '**/node_modules/**/*',
      '**/web_modules/**/*',
      'src/**/*.test.ts',
      'src/**/*.stories.ts',
      'src/**/*.d.ts',
    ],
    // Blocking gate: fails `pnpm test:coverage` (and CI's build-and-coverage
    // job with it) if overall coverage drops below these floors. Codecov's
    // pull-request delta reporting stays `informational: true` in
    // codecov.yml (a third-party service outage must not block a release), so
    // this in-repo, CI-native floor is the only thing that actually fails a
    // build on a coverage regression.
    //
    // The floors therefore live in scripts/coverage-floors.json, generated by
    // `node scripts/write-coverage-floors.mjs --write-floors` as
    // floor(measured - 1.5) after a coverage run. Generated floors stay close to the measured
    // baseline; broad hand-written thresholds can sit far below real coverage and allow large
    // regressions before the gate fires. Refreshing produces an explicit diff, and lowering a
    // floor needs an explicit `--allow-lower`.
    // Measured when the current floors were written (see that file's
    // `measured` block): statements 99.19%, branches 94.55%, functions 99.09%,
    // lines 99.19%.
    threshold: {
      statements: coverageFloors.statements,
      branches: coverageFloors.branches,
      functions: coverageFloors.functions,
      lines: coverageFloors.lines,
    },
    report: true,
    reportDir: 'coverage',
    // Codecov only consumes lcov.info. html/text were fine at 8 files;
    // at ~800 they mean writing a large multi-page report and dumping an
    // 800+ row table to stdout on every CI run for no consumer.
    // json-summary is one small totals file, and the only report carrying
    // real statement totals (lcov's DA/LF/LH records are line coverage, i.e.
    // statements collapsed onto their starting line) -- it is what
    // scripts/write-coverage-floors.mjs prefers when refreshing the floors.
    reporters: ['lcovonly', 'json-summary'],
  },
};
