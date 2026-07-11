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

export default {
  files: 'src/**/*.test.ts',
  nodeResolve: true,
  browsers: [playwrightLauncher({ product: 'chromium' })],
  plugins: [
    esbuildPlugin({ ts: true, target: 'es2022', tsconfig: 'tsconfig.json' }),
    hammerEsmInteropPlugin,
    maplibreEsmInteropPlugin,
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
};
