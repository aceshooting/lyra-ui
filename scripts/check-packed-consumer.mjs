import { gzipSync } from 'node:zlib';
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const uiPackage = join(root, 'packages', 'lyra-ui');
const flagsPackage = join(root, 'packages', 'lyra-flags');
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const binName = (name) => (process.platform === 'win32' ? `${name}.cmd` : name);

const uiPackageJson = JSON.parse(await readFile(join(uiPackage, 'package.json'), 'utf8'));
const optionalPeers = Object.keys(uiPackageJson.peerDependencies ?? {})
  .filter((name) => uiPackageJson.peerDependenciesMeta?.[name]?.optional === true)
  .sort();

// Keep the aggregate barrel budget as an auditable sum rather than an unexplained moving ceiling.
// The first term is the already-reviewed graph through the 8.0.0 baseline. The second is reserved
// only for the stable root expansion described on `bundleEntries.core` below.
const coreRawBudget = {
  reviewedBaselineBytes: 3_400_000,
  stableRootExpansionBytes: 200_000,
};

const bundleEntries = {
  core: {
    fixture: 'core',
    // The root barrel registers the full non-optional component set, so its raw bundle grows as
    // those implementations gain functionality even when the tag count is stable. The current
    // entry measures ~2488.8 KiB with optional peers externalized; this leaves about 10% headroom
    // while the tighter single-component gzip canary below still catches an accidental eager
    // dependency in the shared base layer.
    //
    // Raised from 2_250_000 after the 2026-07-20 review-sweep fixes: 422 component fixes across
    // 171 directories each added real code (boolean-attribute converters, fail-closed peer-error
    // branches, :hover rules, forwarded native properties), pushing the barrel ~17 KiB past the
    // old ceiling. Deliberately re-baselined rather than waived -- the `button` gzip canary below
    // stayed green through the same change, which is the signal that no foreign dependency leaked
    // into the shared eager graph; only the barrel's own aggregate implementation weight moved.
    //
    // Raised from 2_500_000 after the 2026-07-23 full-repository remediation added validated
    // behavior and accessibility contracts across the existing component set. The packed bundle
    // measured 2488.8 KiB across the same 20 output files, while the granular gzip budgets and
    // single-button canary remained green, ruling out an accidentally eager optional peer.
    //
    // Raised from 2_800_000 for 8.0.0, the first run of this check since that work landed. The
    // barrel went from 262 to 269 registration imports, and on top of those seven new components
    // every pre-existing one gained real implementation weight: a pressed state and relocated hover
    // on each interactive part, setCustomValidity plus Enter-to-submit across the form-associated
    // controls, the unified style vocabulary, and the typed global event surface. Measured 3023.0
    // KiB raw across 19 output files with optional peers externalized. Deliberately re-baselined
    // rather than waived, on the same evidence the earlier bumps used: this fixture externalizes
    // the optional peers, so none of these bytes can be a peer's, and the barrel's eager static
    // graph still reaches only `lit`, its directive subpaths and `@floating-ui/dom` -- every
    // optional peer stays behind a dynamic `import()`. Only lyra's own aggregate weight moved.
    //
    // The completion pass then made nine intentional root registrations reachable: alert,
    // data-grid, flag, native-time-input, page, pan-zoom, split-panel, video, and video-playlist.
    // Ten obsolete/duplicate registration imports left at the same time, so a tag/import-count
    // multiplier would model this change incorrectly (the root import count fell 269 -> 268).
    // A production Vite marginal build measured the added set at 157,626 B raw / 35,460 B gzip:
    // data-grid accounts for 66,946 B raw, followed by page (18,109 B), split-panel (16,625 B),
    // video-playlist plus its video dependency (16,388 B), alert (9,606 B), and
    // native-time-input (812 B); flag and pan-zoom were already retained transitively. Removing
    // the whole set puts the otherwise-stabilized graph at ~3262.2 KiB on the packed-consumer
    // scale, below the existing 3320.3 KiB ceiling. The 200,000 B named allowance rounds that
    // measured expansion up by ~27%; combined with the baseline it leaves ~2.9% total headroom
    // over the observed 3416.1 KiB bundle. The button gzip canary below remains unchanged and
    // measured 40.7 KiB against its 42,000 B ceiling, while the core static graph contains only
    // Lit and Floating UI beyond Lyra itself. This is aggregate implementation weight, not an
    // optional-peer leak.
    maxRawBytes:
      coreRawBudget.reviewedBaselineBytes + coreRawBudget.stableRootExpansionBytes,
  },
  // Single-component regression canary: catches a PR silently dragging something heavy into the
  // eager import graph (e.g. a `*-loader.ts`'s dynamic `import()` accidentally hoisted to a
  // top-level static import, pulling an optional peer like chart.js/maplibre-gl/shiki/d3-* in
  // eagerly) that the `core` budget above is too loose to notice -- `core` legitimately grows every
  // time a component is added, so it carries deliberate headroom, while `<lr-button>` alone
  // should only ever pull in Lit, LyraElement's token layer, and its own small class/styles, so its
  // footprint should stay essentially flat release over release. Gated on gzip rather than raw
  // bytes because that's what a consumer's browser actually pays for over the wire, and gzip is
  // more sensitive to a foreign dependency's low-entropy-relative-to-its-size bytes landing in an
  // otherwise tiny, highly-compressible bundle.
  //
  // Raised from 28_000 after the 2026-07-20 --lr-button-gap/--lr-button-radius cssprops (measured
  // 28,050 B gzip, just over the old ceiling) -- like the `core` re-baseline above, the added code
  // is two more custom-property reads in button's own stylesheet, not a new dependency, so this is
  // legitimate growth, not a leak. Deliberately re-baselined rather than waived; the shared
  // LyraElement/token-layer growth from the same-day review-sweep fixes also landed here since
  // `button` is built on the `core` fixture, which is why the ceiling had crept close to 28,000
  // already before this bump. Measured ~27.4 KiB gzip as of this bump; budget leaves modest
  // headroom for normal Lit/token growth while staying tight enough to catch an accidental heavy
  // import.
  //
  // Raised from 31_000 after the 2026-07-23 full-repository remediation made inherited
  // locale/direction changes reactive in LyraElement. The isolated button remained a single
  // 31_014 B-gzip (30.3 KiB) file with no optional-peer chunk; 32_000 leaves less than 1 KiB of
  // headroom while accommodating the intentional shared-base behavior.
  //
  // Raised from 32_000 for 8.0.0, alongside the `core` re-baseline above and for the same reason:
  // the growth is in the shared base layer this entry deliberately measures, not in a new
  // dependency. Measured 39.1 KiB gzip (148.3 KiB raw) as a single output file. The canary's own
  // question -- did something heavy reach the eager graph -- was answered directly rather than
  // inferred: an isolated `<lr-button>` still emits ONE file with no dynamic-import chunk, and its
  // static graph spans 14 modules whose only bare specifiers are `lit` and `lit/decorators.js`.
  // Zero optional peers, so the delta is LyraElement's token/locale/interaction layer plus button's
  // own class and styles. 44_000 keeps headroom over the current 42.1 KiB build -- still far below
  // the gzip footprint of the smallest optional peer this canary exists to catch.
  button: {
    fixture: 'core',
    maxGzipBytes: 44_000,
  },
  // Retention canaries rather than size budgets: these entries are imported only for side effects,
  // so the assertions in runBundle prove a production tree-shaker kept the shipped CSS asset and
  // locale registration module from the packed tarball.
  theme: {
    fixture: 'core',
  },
  nativeStyles: {
    fixture: 'core',
  },
  utilitiesStyles: {
    fixture: 'core',
  },
  locale: {
    fixture: 'core',
  },
  // A bare import of the manual loader is removable, while the dedicated CDN entry is retained
  // for its documented auto-start side effect. These canaries exercise the packed sideEffects
  // metadata with the same production tree-shaker consumers use.
  autoloaderTreeShaken: {
    fixture: 'core',
  },
  autoloaderCdn: {
    fixture: 'core',
  },
  flag: {
    fixture: 'optional',
    maxRawBytes: 30_000,
  },
  codeBlock: {
    fixture: 'core',
    maxRawBytes: 600_000,
  },
  chart: {
    fixture: 'optional',
    maxRawBytes: 1_000_000,
  },
  map: {
    fixture: 'optional',
    maxRawBytes: 2_500_000,
  },
  graph: {
    fixture: 'optional',
    maxRawBytes: 400_000,
  },
};

function run(command, args, cwd, label) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, CI: 'true' },
      stdio: 'inherit',
    });
    child.once('error', rejectRun);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolveRun();
      } else {
        rejectRun(new Error(`${label} failed${signal ? ` (${signal})` : ` with exit code ${code}`}`));
      }
    });
  });
}

async function pack(packageDir, destination) {
  const before = new Set((await readdir(destination)).filter((entry) => entry.endsWith('.tgz')));
  await run(pnpm, ['pack', '--pack-destination', destination], packageDir, `packing ${packageDir}`);
  const packed = (await readdir(destination)).filter(
    (entry) => entry.endsWith('.tgz') && !before.has(entry),
  );
  if (packed.length !== 1) {
    throw new Error(`Expected one new package tarball from ${packageDir}, found ${packed.join(', ') || 'none'}`);
  }
  return join(destination, packed[0]);
}

async function writeFixture(
  fixtureDir,
  packageTarball,
  flagsTarball,
  withOptionalPeers,
  maplibreVersion = '^6.0.0',
) {
  const dependencies = {
    '@aceshooting/lyra-ui': `file:${relative(fixtureDir, packageTarball)}`,
  };
  if (withOptionalPeers) dependencies['@aceshooting/lyra-flags'] = `file:${relative(fixtureDir, flagsTarball)}`;

  const devDependencies = {
    // These fixtures intentionally use npm as well as pnpm. Floating either edge can make npm
    // resolve a newly-published, mutually-incompatible Vite/TypeScript pair before any Lyra
    // declaration or bundle assertion runs, turning this contract test into an upstream
    // resolver lottery. Pin the exact toolchain already exercised by this repository's lockfile.
    typescript: '7.0.2',
    vite: '8.1.5',
  };
  if (withOptionalPeers) {
    Object.assign(devDependencies, {
      '@sgratzl/chartjs-chart-boxplot': '^4.4.5',
      'chart.js': '^4.5.1',
      'chartjs-plugin-zoom': '^2.2.0',
      'd3-drag': '^3.0.0',
      'd3-force': '^3.0.0',
      'd3-selection': '^3.0.0',
      'd3-zoom': '^3.0.0',
      dompurify: '^3.4.12',
      'maplibre-gl': maplibreVersion,
      marked: '^18.0.6',
      shiki: '^4.3.1',
    });
  }

  await writeFile(
    join(fixtureDir, 'package.json'),
    `${JSON.stringify(
      {
        name: withOptionalPeers
          ? `lr-packed-consumer-with-maplibre-${maplibreVersion.startsWith('^5') ? 'v5' : 'v6'}`
          : 'lr-packed-consumer-core',
        private: true,
        type: 'module',
        dependencies,
        devDependencies,
        // Rolldown's optional WASI binding currently permits @napi-rs/wasm-runtime ^1.1.6, but
        // 1.2 switched its @emnapi peers to the incompatible 2.x alpha line while the binding
        // still installs @emnapi 1.11.1. npm --strict-peer-deps rejects that optional fallback
        // before reaching any Lyra assertion, even on platforms that use a native binding.
        overrides: {
          '@napi-rs/wasm-runtime': '1.1.6',
        },
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(join(fixtureDir, '.npmrc'), 'auto-install-peers=false\n');

  await writeFile(
    join(fixtureDir, 'src', 'node-imports.mjs'),
    `if (typeof document !== 'undefined') {
  throw new Error('plain Node unexpectedly exposes a document before the package import');
}
const root = await import('@aceshooting/lyra-ui');
const ssrLoader = await import('@aceshooting/lyra-ui/ssr-loader.js');
const granularClass = await import('@aceshooting/lyra-ui/components/overlays/empty/empty.class.js');
await import('@aceshooting/lyra-ui/components/conversation/code-block/code-loader.js');
await import('@aceshooting/lyra-ui/components/media/map/map-loader.js');
await import('@aceshooting/lyra-ui/components/conversation/markdown/markdown-loader.js');
await import('@aceshooting/lyra-ui/components/retrieval/graph/graph-loader.js');
await import('@aceshooting/lyra-ui/components/overlays/empty/empty.js');
await import('@aceshooting/lyra-ui/components/charts/chart/chart.js');
await import('@aceshooting/lyra-ui/components/conversation/code-block/code-block.js');
await import('@aceshooting/lyra-ui/components/retrieval/graph/graph.js');
await import('@aceshooting/lyra-ui/components/media/map/map.js');
// The curated './utilities/*' subpath, not './internal/*': 'internal/' is deliberately absent
// from the package's "exports" map (only 'utilities/' is semver-covered), so importing it here
// would assert a contract the package does not offer -- and Node fails it with
// ERR_PACKAGE_PATH_NOT_EXPORTED.
const prefix = await import('@aceshooting/lyra-ui/utilities/prefix.js');

if (typeof root.LyraEmpty !== 'function' || typeof granularClass.LyraEmpty !== 'function') {
  throw new Error('root and granular class imports did not expose LyraEmpty');
}
if (prefix.tag('empty') !== 'lr-empty' || customElements.get('lr-empty') !== root.LyraEmpty) {
  throw new Error('registration and prefix helper imports did not expose the expected contract');
}
if (typeof document !== 'undefined') {
  throw new Error('the package imports created a browser document in plain Node');
}
if (
  typeof ssrLoader.LyraSsrFallbackRenderer !== 'function' ||
  typeof ssrLoader.lyraSsrElementRenderers !== 'function' ||
  typeof ssrLoader.getLyraSsrMode !== 'function' ||
  typeof ssrLoader.diagnoseLyraHydration !== 'function' ||
  ssrLoader.LYRA_SSR_SUPPORT_MATRIX.imports.root !== 'server-safe' ||
  ssrLoader.getLyraSsrMode('lr-page') !== 'render-and-hydrate'
) {
  throw new Error('the SSR loader did not expose its packed runtime contract');
}
if ((await ssrLoader.diagnoseLyraHydration()).length !== 0) {
  throw new Error('SSR diagnostics should be an empty result without browser globals');
}
console.log('Node ESM package imports passed.');
`,
  );
  await writeFile(
    join(fixtureDir, 'src', 'node-localization-import.mjs'),
    `const localization = await import('@aceshooting/lyra-ui/localization.js');
if (typeof document !== 'undefined') {
  throw new Error('plain Node unexpectedly exposes a document before the localization import');
}
if (
  typeof localization.registerLyraLocale !== 'function' ||
  typeof localization.setLyraLocale !== 'function' ||
  typeof localization.resolveLyraString !== 'function' ||
  'LyraElement' in localization
) {
  throw new Error('the side-effect-free localization entry exposed the wrong surface');
}
localization.registerLyraLocale('packed-consumer', { close: 'Close packed consumer' });
if (!localization.getRegisteredLyraLocales().includes('packed-consumer')) {
  throw new Error('the public localization registry did not retain a registered locale');
}
console.log('Side-effect-free localization import passed.');
`,
  );

  await writeFile(
    join(fixtureDir, 'src', 'node-autoloader-import.mjs'),
    `const hadDocument = typeof document !== 'undefined';
const hadRegistry = typeof customElements !== 'undefined';
const autoloader = await import('@aceshooting/lyra-ui/autoloader.js');
const defined = await import('@aceshooting/lyra-ui/utilities/defined.js');
if (hadDocument || hadRegistry || typeof document !== 'undefined' || typeof customElements !== 'undefined') {
  throw new Error('the side-effect-free autoloader entries created browser globals in plain Node');
}
if (
  typeof autoloader.discover !== 'function' ||
  typeof autoloader.start !== 'function' ||
  typeof autoloader.stop !== 'function' ||
  typeof defined.allDefined !== 'function'
) {
  throw new Error('the packed autoloader entries did not expose their public functions');
}
if ((await autoloader.discover()).length !== 0 || (await autoloader.start()).length !== 0) {
  throw new Error('browser-guarded autoloader functions must resolve inertly in plain Node');
}
autoloader.stop();
await defined.allDefined();
console.log('Server-safe autoloader package imports passed.');
`,
  );

  await writeFile(
    join(fixtureDir, 'src', 'node-gemstones-data-import.mjs'),
    `const palette = await import('@aceshooting/lyra-ui/theme/gemstones-data.js');
if (typeof document !== 'undefined') {
  throw new Error('plain Node unexpectedly exposes a document before the palette import');
}
if (palette.DEFAULT_GEMSTONE !== 'emerald' || palette.GEMSTONE_KEYS.length !== 9) {
  throw new Error('the Lit-free gemstone data entry did not expose the expected palette');
}
console.log('Lit-free gemstone data import passed.');
`,
  );

  await writeFile(
    join(fixtureDir, 'src', 'typecheck.ts'),
    `import {
  LyraDialog,
  LyraEmpty,
  LyraTable,
  defineElement,
  tag,
} from '@aceshooting/lyra-ui';
import { LyraEmpty as GranularLyraEmpty } from '@aceshooting/lyra-ui/components/overlays/empty/empty.class.js';
import { loadChartAndZoom } from '@aceshooting/lyra-ui/components/charts/chart/chart-loader.js';
import { loadMaplibre } from '@aceshooting/lyra-ui/components/media/map/map-loader.js';
import { loadMarkdownAndSanitizer } from '@aceshooting/lyra-ui/components/conversation/markdown/markdown-loader.js';
import { loadShikiHighlighter } from '@aceshooting/lyra-ui/components/conversation/code-block/code-loader.js';
import { loadD3 } from '@aceshooting/lyra-ui/components/retrieval/graph/graph-loader.js';
import { seriesPalette } from '@aceshooting/lyra-ui/components/charts/chart/chart.class.js';
import { createLyraThemeBootstrap } from '@aceshooting/lyra-ui/theme.js';
import {
  getRegisteredLyraLocales,
  registerLyraLocale,
  type LyraLocaleStrings,
  type LyraMessageKey,
} from '@aceshooting/lyra-ui/localization.js';
import {
  DEFAULT_GEMSTONE,
  GEMSTONE_KEYS,
  GEMSTONES,
} from '@aceshooting/lyra-ui/theme/gemstones-data.js';
import {
  LYRA_SSR_CLIENT_RENDER_TAGS,
  LYRA_SSR_RENDER_AND_HYDRATE_TAGS,
  LYRA_SSR_SUPPORT_MATRIX,
  LyraSsrFallbackRenderer,
  diagnoseLyraHydration,
  getLyraSsrMode,
  lyraSsrElementRenderers,
  type LyraHydrationDiagnostic,
  type LyraSsrMode,
} from '@aceshooting/lyra-ui/ssr-loader.js';
import {
  AUTOLOADER_PENDING_ATTRIBUTE,
  discover,
  start,
  stop,
  type AutoloadableTagName,
  type AutoloaderErrorEventDetail,
  type AutoloaderEventDetail,
  type AutoloaderEventMap,
  type AutoloaderOptions,
} from '@aceshooting/lyra-ui/autoloader.js';
import { allDefined } from '@aceshooting/lyra-ui/utilities/defined.js';
import type {
  LyraChartEventMap,
  LyraGraphEventMap,
  LyraMapEventMap,
} from '@aceshooting/lyra-ui';

const name: string = tag('empty');
const Empty = GranularLyraEmpty satisfies typeof LyraEmpty;
const dialog = new LyraDialog();
const table = new LyraTable();
const events: [LyraChartEventMap, LyraGraphEventMap, LyraMapEventMap] | undefined = undefined;
const localeStrings: LyraLocaleStrings = { close: 'Close' };
const localeKey: LyraMessageKey = 'close';
registerLyraLocale('packed-typecheck', localeStrings);
defineElement('consumer-empty', Empty);

class PackedLitElementRenderer {
  static matchesClass(
    _constructor: CustomElementConstructor,
    _tagName: string,
    _attributes: Map<string, string>,
  ): boolean {
    return true;
  }

  constructor(_tagName: string) {}
}

const ssrRenderers = lyraSsrElementRenderers(PackedLitElementRenderer);
const fallbackRenderer: typeof LyraSsrFallbackRenderer = ssrRenderers[0];
const ssrMode: LyraSsrMode | undefined = getLyraSsrMode('lr-page');
const hydrationDiagnostics: Promise<readonly LyraHydrationDiagnostic[]> = diagnoseLyraHydration();
const ssrImports: 'server-safe' = LYRA_SSR_SUPPORT_MATRIX.imports.root;
const ssrHydratedTag: string | undefined = LYRA_SSR_RENDER_AND_HYDRATE_TAGS[0];
const ssrFallbackTag: string | undefined = LYRA_SSR_CLIENT_RENDER_TAGS[0];
const autoloaderOptions: AutoloaderOptions = { optionalPeers: ['dompurify'], events: true };
const autoloadedTags: Promise<readonly AutoloadableTagName[]> = discover(document, autoloaderOptions);
const autoloaderStarted: Promise<readonly AutoloadableTagName[]> = start(document);
const allDefinitions: Promise<void> = allDefined(document);
const autoloaderDetail: AutoloaderEventDetail = { tag: 'lr-button', optionalPeers: [] };
const autoloaderErrorDetail: AutoloaderErrorEventDetail = {
  ...autoloaderDetail,
  error: new Error('packed type fixture'),
};
const autoloaderErrorEvent: AutoloaderEventMap['lr-autoload-error'] = new CustomEvent(
  'lr-autoload-error',
  { detail: autoloaderErrorDetail },
);
const autoloaderMarker: string = AUTOLOADER_PENDING_ATTRIBUTE;
stop();
void [
  name,
  dialog,
  table,
  events,
  loadChartAndZoom,
  loadMaplibre,
  loadMarkdownAndSanitizer,
  loadShikiHighlighter,
  loadD3,
  seriesPalette,
  createLyraThemeBootstrap,
  getRegisteredLyraLocales,
  localeKey,
  DEFAULT_GEMSTONE,
  GEMSTONE_KEYS,
  GEMSTONES,
  fallbackRenderer,
  ssrMode,
  hydrationDiagnostics,
  ssrImports,
  ssrHydratedTag,
  ssrFallbackTag,
  autoloadedTags,
  autoloaderStarted,
  allDefinitions,
  autoloaderDetail,
  autoloaderErrorDetail,
  autoloaderErrorEvent,
  autoloaderMarker,
];
`,
  );
  await writeFile(
    join(fixtureDir, 'tsconfig.json'),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'Bundler',
          lib: ['ES2022', 'DOM'],
          strict: true,
          skipLibCheck: false,
          noEmit: true,
        },
        include: ['src/typecheck.ts'],
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    join(fixtureDir, 'vite.config.mjs'),
    `import { defineConfig } from 'vite';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const optionalPeers = ${JSON.stringify(optionalPeers)};
const noOptionalPeers = process.env.LYRA_NO_OPTIONAL_PEERS === '1';
const entry = process.env.LYRA_BUNDLE_ENTRY;

export default defineConfig({
  plugins: [
    {
      // Write diagnostics beside (not inside) the measured output. Module edges distinguish an
      // allowed lazy peer import from an eager one; emitted chunk modules independently catch a
      // peer that bypassed externalization and was physically bundled.
      name: 'packed-consumer-graph',
      writeBundle(_options, bundle) {
        const chunks = Object.values(bundle)
          .filter((output) => output.type === 'chunk')
          .map((chunk) => ({
            fileName: chunk.fileName,
            isEntry: chunk.isEntry,
            imports: chunk.imports,
            dynamicImports: chunk.dynamicImports,
            modules: Object.keys(chunk.modules),
          }));
        const modules = [...this.getModuleIds()].map((id) => {
          const info = this.getModuleInfo(id);
          return {
            id,
            isEntry: info?.isEntry === true,
            importedIds: info?.importedIds ?? [],
            dynamicallyImportedIds: info?.dynamicallyImportedIds ?? [],
          };
        });
        writeFileSync(
          resolve(process.cwd(), \`.packed-consumer-\${entry}-graph.json\`),
          JSON.stringify({ chunks, modules }),
        );
      },
    },
  ],
  build: {
    outDir: resolve(process.cwd(), 'bundle', entry),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(process.cwd(), 'src', \`bundle-\${entry}.ts\`),
      external: noOptionalPeers
        ? (id) => optionalPeers.some((peer) => id === peer || id.startsWith(\`\${peer}/\`))
        : [],
      output: {
        entryFileNames: 'index.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
`,
  );

  const bundleSources = {
    core: `import '@aceshooting/lyra-ui';\nexport const loaded = true;\n`,
    button: `import '@aceshooting/lyra-ui/components/forms/button/button.js';\nexport const loaded = true;\n`,
    theme: `import '@aceshooting/lyra-ui/theme.css';\nexport const loaded = true;\n`,
    nativeStyles: `import '@aceshooting/lyra-ui/native.css';\nexport const loaded = true;\n`,
    utilitiesStyles: `import '@aceshooting/lyra-ui/utilities.css';\nexport const loaded = true;\n`,
    locale: `import '@aceshooting/lyra-ui/translations/fa.js';
import '@aceshooting/lyra-ui/translations/fr.js';
import '@aceshooting/lyra-ui/translations/he.js';
import { getRegisteredLyraLocales } from '@aceshooting/lyra-ui/localization.js';
const registered = getRegisteredLyraLocales();
for (const locale of ['fa', 'fr', 'he']) {
  if (!registered.includes(locale)) {
    throw new Error(\`the packed \${locale} locale side effect was tree-shaken\`);
  }
}
export const loaded = true;
`,
    autoloaderTreeShaken: `import '@aceshooting/lyra-ui/autoloader.js';
export const loaded = true;
`,
    autoloaderCdn: `import '@aceshooting/lyra-ui/autoloader-cdn.js';
export const loaded = true;
`,
    flag: `import flagUrl from '@aceshooting/lyra-flags/flags/fr.svg';\nexport { flagUrl };\n`,
    codeBlock: `import '@aceshooting/lyra-ui/components/conversation/code-block/code-block.js';\nexport const loaded = true;\n`,
    chart: `import '@aceshooting/lyra-ui/components/charts/chart/chart.js';\nexport const loaded = true;\n`,
    map: maplibreVersion.startsWith('^5')
      ? `import '@aceshooting/lyra-ui/components/media/map/map.js';
import 'maplibre-gl/dist/maplibre-gl.css';
export const loaded = true;
`
      : `import '@aceshooting/lyra-ui/components/media/map/map.js';
import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
setWorkerUrl(workerUrl);
export const loaded = true;
`,
    graph: `import '@aceshooting/lyra-ui/components/retrieval/graph/graph.js';\nexport const loaded = true;\n`,
  };
  await Promise.all(
    Object.entries(bundleSources).map(([name, source]) => writeFile(join(fixtureDir, 'src', `bundle-${name}.ts`), source)),
  );
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(path)));
    else files.push(path);
  }
  return files;
}

async function bundleSize(directory) {
  const files = await collectFiles(directory);
  const rawBytes = (await Promise.all(files.map(async (file) => (await stat(file)).size))).reduce(
    (total, size) => total + size,
    0,
  );
  const gzipBytes = (await Promise.all(files.map(async (file) => gzipSync(await readFile(file)).byteLength))).reduce(
    (total, size) => total + size,
    0,
  );
  return { rawBytes, gzipBytes, files };
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function matchesOptionalPeer(specifier, peer) {
  return specifier === peer || specifier.startsWith(`${peer}/`);
}

function optionalPeerForModuleId(moduleId) {
  const normalizedId = moduleId.replaceAll('\\', '/');
  return optionalPeers.find(
    (peer) => matchesOptionalPeer(moduleId, peer) || normalizedId.includes(`/node_modules/${peer}/`),
  );
}

function inspectOptionalPeerGraph(graph) {
  const modules = new Map(graph.modules.map((module) => [module.id, module]));
  const pending = graph.modules.filter((module) => module.isEntry).map((module) => module.id);
  const staticallyReachableModules = new Set();
  const eagerPeers = new Set();

  while (pending.length > 0) {
    const moduleId = pending.pop();
    if (staticallyReachableModules.has(moduleId)) continue;
    staticallyReachableModules.add(moduleId);
    const module = modules.get(moduleId);
    if (module == null) continue;
    for (const imported of module.importedIds) {
      const peer = optionalPeerForModuleId(imported);
      if (peer != null) {
        eagerPeers.add(peer);
      } else if (modules.has(imported)) {
        pending.push(imported);
      }
    }
  }

  const bundledPeers = new Set();
  const lazyPeers = new Set();
  for (const module of graph.modules) {
    for (const imported of module.dynamicallyImportedIds) {
      const peer = optionalPeerForModuleId(imported);
      if (peer != null) lazyPeers.add(peer);
    }
  }
  for (const chunk of graph.chunks) {
    for (const moduleId of chunk.modules) {
      const peer = optionalPeerForModuleId(moduleId);
      if (peer != null) bundledPeers.add(peer);
    }
  }

  return {
    bundledPeers: [...bundledPeers].sort(),
    eagerPeers: [...eagerPeers].sort(),
    lazyPeers: [...lazyPeers].sort(),
    staticallyReachableModuleCount: staticallyReachableModules.size,
  };
}

async function runBundle(fixtureDir, entry, config, noOptionalPeers, maplibreMajor = 6) {
  const env = {
    ...process.env,
    CI: 'true',
    LYRA_BUNDLE_ENTRY: entry,
    LYRA_NO_OPTIONAL_PEERS: noOptionalPeers ? '1' : '0',
  };
  await new Promise((resolveRun, rejectRun) => {
    const child = spawn(join(fixtureDir, 'node_modules', '.bin', binName('vite')), ['build', '--config', 'vite.config.mjs'], {
      cwd: fixtureDir,
      env,
      stdio: 'inherit',
    });
    child.once('error', rejectRun);
    child.once('exit', (code, signal) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`Vite ${entry} bundle failed${signal ? ` (${signal})` : ` with exit code ${code}`}`));
    });
  });
  const output = await bundleSize(join(fixtureDir, 'bundle', entry));
  const graph = JSON.parse(
    await readFile(join(fixtureDir, `.packed-consumer-${entry}-graph.json`), 'utf8'),
  );
  const peerGraph = inspectOptionalPeerGraph(graph);
  const violations = [];
  const javascriptFiles = output.files.filter((file) => file.endsWith('.js'));
  const javascript = (await Promise.all(javascriptFiles.map((file) => readFile(file, 'utf8')))).join('\n');
  if (entry === 'autoloaderTreeShaken') {
    if (javascriptFiles.length !== 1 || javascript.includes('data-lr-autoload-pending')) {
      violations.push('the side-effect-free manual autoloader import was not tree-shaken');
    }
  }
  if (entry === 'autoloaderCdn' && !javascript.includes('data-lr-autoload-pending')) {
    violations.push('the bare CDN autoloader import lost its auto-start implementation');
  }
  if (entry === 'button' && javascript.includes('data-lr-autoload-pending')) {
    violations.push('a granular component import unexpectedly pulled in the optional autoloader');
  }
  if (entry === 'theme') {
    const cssFiles = output.files.filter((file) => file.endsWith('.css'));
    const css = (await Promise.all(cssFiles.map((file) => readFile(file, 'utf8')))).join('\n');
    if (cssFiles.length === 0 || !css.includes('--lr-theme-color-brand-fill-loud')) {
      violations.push('the bare theme.css import emitted no retained Lyra theme asset');
    }
  }
  if (entry === 'nativeStyles' || entry === 'utilitiesStyles') {
    const cssFiles = output.files.filter((file) => file.endsWith('.css'));
    const css = (await Promise.all(cssFiles.map((file) => readFile(file, 'utf8')))).join('\n');
    const expected =
      entry === 'nativeStyles'
        ? ['.lr-native', '--lr-native-control-min-block-size']
        : ['.lr-stack', '--lr-layout-gap'];
    if (cssFiles.length === 0 || expected.some((marker) => !css.includes(marker))) {
      violations.push(
        `the bare ${entry === 'nativeStyles' ? 'native.css' : 'utilities.css'} import emitted no retained Lyra styles`,
      );
    }
  }
  if (config.maxRawBytes != null && output.rawBytes > config.maxRawBytes) {
    violations.push(`raw ${formatBytes(output.rawBytes)} exceeds budget ${formatBytes(config.maxRawBytes)}`);
  }
  if (config.maxGzipBytes != null && output.gzipBytes > config.maxGzipBytes) {
    violations.push(`gzip ${formatBytes(output.gzipBytes)} exceeds budget ${formatBytes(config.maxGzipBytes)}`);
  }
  if (peerGraph.staticallyReachableModuleCount === 0) {
    violations.push('the Vite graph diagnostic recorded no entry module');
  }
  if (noOptionalPeers && peerGraph.eagerPeers.length > 0) {
    violations.push(`optional peer(s) are statically reachable: ${peerGraph.eagerPeers.join(', ')}`);
  }
  if (noOptionalPeers && peerGraph.bundledPeers.length > 0) {
    violations.push(`optional peer(s) were physically bundled: ${peerGraph.bundledPeers.join(', ')}`);
  }
  if (
    entry === 'map' &&
    maplibreMajor === 6 &&
    !output.files.some((file) => /maplibre-gl-worker/.test(file))
  ) {
    violations.push('the Vite consumer did not emit MapLibre v6’s module worker');
  }
  if (violations.length > 0) {
    throw new Error(
      `${entry} bundle is out of budget across ${output.files.length} files: ${violations.join('; ')}`,
    );
  }
  if (entry === 'locale') {
    await run(
      process.execPath,
      [join(fixtureDir, 'bundle', entry, 'index.js')],
      fixtureDir,
      'packed locale side-effect execution check',
    );
  }
  console.log(
    `${entry} bundle: ${formatBytes(output.rawBytes)} raw, ${formatBytes(output.gzipBytes)} gzip ` +
      `(${output.files.length} files; ${peerGraph.staticallyReachableModuleCount} eager modules; ` +
      `${peerGraph.eagerPeers.length} eager/${peerGraph.lazyPeers.length} lazy/` +
      `${peerGraph.bundledPeers.length} bundled optional peers)`,
  );
}

async function main() {
  const workspace = await mkdtemp(join(tmpdir(), 'lr-packed-consumer-'));
  try {
    const tarballDir = join(workspace, 'packages');
    const coreFixture = join(workspace, 'core');
    const optionalFixture = join(workspace, 'optional');
    const maplibreV5Fixture = join(workspace, 'maplibre-v5');
    await Promise.all([
      writeFile(join(workspace, '.keep'), ''),
      mkdir(tarballDir, { recursive: true }),
      mkdir(join(coreFixture, 'src'), { recursive: true }),
      mkdir(join(optionalFixture, 'src'), { recursive: true }),
      mkdir(join(maplibreV5Fixture, 'src'), { recursive: true }),
    ]);

    const uiTarball = await pack(uiPackage, tarballDir);
    const flagsTarball = await pack(flagsPackage, tarballDir);

    await run(
      pnpm,
      ['exec', 'publint', 'run', '--strict', '--pack=false', uiTarball],
      root,
      'publint package check',
    );
    await run(
      pnpm,
      [
        'exec',
        'attw',
        '--profile',
        'esm-only',
        '--exclude-entrypoints',
        './theme.css',
        './native.css',
        './utilities.css',
        '--format',
        'table',
        '--summary',
        uiTarball,
      ],
      root,
      'Are The Types Wrong package check',
    );

    await writeFixture(coreFixture, uiTarball, flagsTarball, false);
    await writeFixture(optionalFixture, uiTarball, flagsTarball, true);
    await writeFixture(maplibreV5Fixture, uiTarball, flagsTarball, true, '^5.24.0');
    await run(pnpm, ['install', '--ignore-scripts', '--config.auto-install-peers=false'], coreFixture, 'core fixture install');
    await run(
      pnpm,
      ['install', '--ignore-scripts', '--config.auto-install-peers=false'],
      optionalFixture,
      'optional-peer fixture install',
    );
    await run(
      npm,
      ['install', '--ignore-scripts', '--strict-peer-deps'],
      maplibreV5Fixture,
      'MapLibre v5 npm fixture install',
    );
    await run(
      npm,
      ['ls', 'maplibre-gl', '--all'],
      maplibreV5Fixture,
      'MapLibre v5 peer tree check',
    );

    await run(
      process.execPath,
      ['src/node-autoloader-import.mjs'],
      coreFixture,
      'server-safe autoloader import check',
    );
    await run(
      process.execPath,
      ['src/node-localization-import.mjs'],
      coreFixture,
      'side-effect-free localization import check',
    );
    await run(
      process.execPath,
      ['src/node-gemstones-data-import.mjs'],
      coreFixture,
      'Lit-free gemstone data import check',
    );
    await run(process.execPath, ['src/node-imports.mjs'], coreFixture, 'Node ESM import check');
    await run(
      join(coreFixture, 'node_modules', '.bin', binName('tsc')),
      ['--noEmit', '--skipLibCheck', 'false', '-p', 'tsconfig.json'],
      coreFixture,
      'consumer declaration check',
    );
    await run(
      join(maplibreV5Fixture, 'node_modules', '.bin', binName('tsc')),
      ['--noEmit', '--skipLibCheck', 'false', '-p', 'tsconfig.json'],
      maplibreV5Fixture,
      'MapLibre v5 consumer declaration check',
    );

    for (const [entry, config] of Object.entries(bundleEntries)) {
      await runBundle(
        config.fixture === 'core' ? coreFixture : optionalFixture,
        entry,
        config,
        config.fixture === 'core',
      );
    }
    await runBundle(maplibreV5Fixture, 'map', bundleEntries.map, false, 5);

    console.log('Packed-consumer checks passed.');
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
