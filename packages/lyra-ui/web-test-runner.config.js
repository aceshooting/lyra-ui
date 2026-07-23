import { defaultReporter } from '@web/test-runner';
import { playwrightLauncher } from '@web/test-runner-playwright';
import { junitReporter } from '@web/test-runner-junit-reporter';
import { esbuildPlugin } from '@web/dev-server-esbuild';

/**
 * `chartjs-plugin-zoom` (Tier 3 chart family, optional peer dep) has a hard
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

const browserProduct = process.env.WTR_BROWSER ?? 'chromium';
if (!['chromium', 'firefox', 'webkit'].includes(browserProduct)) {
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
  browsers: [playwrightLauncher({ product: browserProduct })],
  // The full suite includes 353 files and several optional-peer integration
  // fixtures. Keep the suite-level watchdog above the normal two-minute
  // budget, including the coverage-instrumented large-graph benchmark, so a
  // slow CI worker reports the actual test result instead of turning a
  // completed browser run into an infrastructure timeout.
  testsFinishTimeout: 300000,
  plugins: [
    esbuildPlugin({ ts: true, json: true, target: 'es2022', tsconfig: 'tsconfig.json' }),
    hammerEsmInteropPlugin,
    papaparseEsmInteropPlugin,
    mammothEsmInteropPlugin,
    jszipEsmInteropPlugin,
    echartsProcessInteropPlugin,
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
    // job with it) if overall coverage drops below these floors. Restored
    // 2026-07-22 after a re-audit found commit fb700ac3 had quietly widened
    // this to a 1%-everywhere sanity check while leaving codecov.yml's own
    // status checks `informational: true` -- the net effect was that nothing
    // in CI actually failed for a real coverage regression. Codecov's
    // per-commit/per-PR delta reporting stays informational (a third-party
    // service outage should not be able to block a release), but this
    // in-repo, CI-native floor is the real enforcement mechanism. Values
    // match this repo's actual, currently-measured coverage (97%+) with
    // headroom, not an arbitrary round number.
    threshold: {
      statements: 75,
      branches: 65,
      functions: 65,
      lines: 75,
    },
    report: true,
    reportDir: 'coverage',
    // Codecov only consumes lcov.info. html/text were fine at 8 files;
    // at ~800 they mean writing a large multi-page report and dumping an
    // 800+ row table to stdout on every CI run for no consumer.
    reporters: ['lcovonly'],
  },
};
