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
 * `maplibre-gl` (Task 1's `lyra-map`, optional peer dep) declares
 * `"type": "module"` in its package.json but its `main` (`dist/maplibre-gl.js`)
 * is actually a UMD bundle with no `export` statement — it just assigns
 * `globalThis.maplibregl` when it detects no CJS/AMD loader. Same root cause
 * as the hammerjs shim above: real consumers bundle with Vite/webpack/esbuild-
 * bundle, which do this CJS/UMD interop automatically; `@web/test-runner`
 * serves unbundled ESM, so this tiny plugin appends a synthetic named export
 * once maplibre-gl.js has run and populated `globalThis.maplibregl`.
 */
const maplibreEsmInteropPlugin = {
  name: 'maplibre-gl-esm-interop',
  transform(context) {
    if (context.response.is('js') && context.path.endsWith('/maplibre-gl/dist/maplibre-gl.js')) {
      return `${context.body}\nexport const Map = globalThis.maplibregl.Map;\n`;
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
};
