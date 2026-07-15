import { playwrightLauncher } from '@web/test-runner-playwright';
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

/**
 * `maplibre-gl` (an optional peer dep of `lyra-map`) declares `"type":
 * "module"` in its package.json but its `main` (`dist/maplibre-gl.js`)
 * is actually a UMD bundle with no `export` statement — it just assigns
 * `globalThis.maplibregl` when it detects no CJS/AMD loader. Same root cause
 * as the hammerjs shim above: real consumers bundle with Vite/webpack/esbuild-
 * bundle, which do this CJS/UMD interop automatically; `@web/test-runner`
 * serves unbundled ESM, so this tiny plugin appends synthetic named exports
 * once maplibre-gl.js has run and populated `globalThis.maplibregl`.
 *
 * `Map`/`Marker`/`Popup` (lyra-map's `LyraMap`/marker/popup support all need
 * these) are exported via renamed local bindings rather than directly — an ES
 * module's top-level `const Map = ...` would lexically shadow the native
 * `Map` collection class for the *entire* module (this file's own minified
 * bundle uses `new Map()` internally), corrupting maplibre-gl's own
 * initialization. Bind every export to a private name and export-rename it,
 * for consistency, even though only `Map` actually collides.
 */
const maplibreEsmInteropPlugin = {
  name: 'maplibre-gl-esm-interop',
  transform(context) {
    if (context.response.is('js') && context.path.endsWith('/maplibre-gl/dist/maplibre-gl.js')) {
      return `${context.body}
const __lyraMaplibreMap = globalThis.maplibregl.Map;
const __lyraMaplibreMarker = globalThis.maplibregl.Marker;
const __lyraMaplibrePopup = globalThis.maplibregl.Popup;
export { __lyraMaplibreMap as Map, __lyraMaplibreMarker as Marker, __lyraMaplibrePopup as Popup };
`;
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
const strictConsoleTestRunnerHtml = strictConsole
  ? (testRunnerImport) => `
<!doctype html>
<html>
  <head></head>
  <body>
    <script>
      const allowedWarnings = [/Lit is in dev mode/, /source\\(\\) rejected/];
      const originalWarn = console.warn;
      const originalError = console.error;
      console.warn = (...args) => {
        if (!allowedWarnings.some((pattern) => pattern.test(args.map(String).join(' ')))) {
          throw new Error('Unexpected browser console.warn: ' + args.map(String).join(' '));
        }
        originalWarn(...args);
      };
      console.error = (...args) => {
        throw new Error('Unexpected browser console.error: ' + args.map(String).join(' '));
      };
    </script>
    <script type="module" src=${JSON.stringify(testRunnerImport)}></script>
  </body>
</html>`
  : undefined;

export default {
  files: 'src/**/*.test.ts',
  nodeResolve: true,
  browsers: [playwrightLauncher({ product: browserProduct })],
  plugins: [
    esbuildPlugin({ ts: true, target: 'es2022', tsconfig: 'tsconfig.json' }),
    hammerEsmInteropPlugin,
    maplibreEsmInteropPlugin,
    papaparseEsmInteropPlugin,
    mammothEsmInteropPlugin,
    jszipEsmInteropPlugin,
    echartsProcessInteropPlugin,
  ],
  testFramework: {
    // Mocha's default 2000ms per-test timeout is shorter than the wait
    // budgets some tests already declare on purpose (e.g. lyra-graph's
    // NODE_COUNT_TIMEOUT = 5000ms, for d3-force's rAF-driven tick under
    // Chromium's background-tab throttling when many test files run
    // concurrently). Raise the default so those budgets can actually work.
    config: {
      timeout: '6000',
    },
  },
  testRunnerHtml: strictConsoleTestRunnerHtml,
  coverage: collectCoverage,
  coverageConfig: {
    include: [
      'src/internal/form-associated.ts',
      'src/internal/anchored-validity.ts',
      'src/internal/lyra-element.ts',
      'src/internal/overlay-manager.ts',
      'src/components/combobox/combobox.class.ts',
      'src/components/dialog/dialog.class.ts',
      'src/components/table/table.class.ts',
      'src/components/virtual-list/virtual-list.class.ts',
    ],
    threshold: {
      statements: 75,
      branches: 65,
      functions: 65,
      lines: 75,
    },
    report: true,
    reportDir: 'coverage',
    reporters: ['text', 'lcovonly', 'html'],
  },
};
