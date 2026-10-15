import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import { lyraMapWorkerPlugin } from '@aceshooting/lyra-map/vite';
import remarkGfm from 'remark-gfm';
import { codecovVitePlugin } from '@codecov/vite-plugin';
import { componentImportsPlugin } from './component-imports.js';
import { createGroupedStoryIndexer } from './story-indexer.js';
import { storyTitlePlugin } from './story-title-plugin.js';
import { sourcePackageExportsPlugin } from './source-package-exports.js';
import { sourceShikiWasmPlugin } from './source-shiki-wasm.js';
import { builderModulePreload, isDeferredLocaleModule } from './docs-load-boundaries.js';
import { renderDocsManagerHead, resolveDocsPublicBase } from '../scripts/docs-public-base.mjs';

const docsPublicBase = resolveDocsPublicBase(process.env.LYRA_DOCS_BASE_URL);

/** @type { import('@storybook/web-components-vite').StorybookConfig } */
const config = {
  // `.storybook/*.stories.js` holds cross-cutting pages that belong to no one component (the
  // Theming/shadcn look comparison), so they cannot live beside a component's own stories.
  stories: [
    '../packages/lyra-ui/src/components/**/*.stories.ts',
    '../.storybook/*.stories.js',
    '../.storybook/*.mdx',
  ],
  addons: [
    {
      name: '@storybook/addon-docs',
      // MDX 2+ is CommonMark only: without GFM the guide pages' `| a | b |` tables render as
      // literal pipe-separated paragraphs.
      options: { mdxPluginOptions: { mdxCompileOptions: { remarkPlugins: [remarkGfm] } } },
    },
    '@storybook/addon-a11y',
  ],
  experimental_indexers: async (existingIndexers) => {
    const probe = '/component.stories.ts';
    const csfIndexer = existingIndexers.find((indexer) => {
      indexer.test.lastIndex = 0;
      return indexer.test.test(probe);
    });
    if (!csfIndexer) throw new Error('Storybook did not provide its default CSF indexer');
    return [
      createGroupedStoryIndexer(csfIndexer),
      ...existingIndexers.filter((indexer) => indexer !== csfIndexer),
    ];
  },
  framework: {
    name: '@storybook/web-components-vite',
    options: {},
  },
  // Overrides the single <title> interpolated into the manager's template.ejs (otherwise
  // defaults to the nearest package.json's `name`, which is how this shipped as the literal
  // `<title>storybook - Storybook</title>` before). Deliberately not done via a second <title>
  // element in manager-head.html: per the HTML living standard, `document.title` (and so the
  // browser tab / what a non-JS-executing crawler's first regex match sees) resolves to the
  // *first* `<title>` in the document, not the last — a `<title>` added there would render into
  // the <head> after this templated one and be silently ignored.
  title: 'Lyra UI — free alternative to Shoelace and Web Awesome',
  managerHead: (head) => renderDocsManagerHead(head, docsPublicBase),
  // Copies files that must exist at the site root (not under an asset-hashed path) into
  // storybook-static/ verbatim. `llms.txt`/`llms-full.txt` are the coding-assistant-facing API
  // reference this repo's own README/llms.txt point at; robots.txt/sitemap.xml are the standard
  // crawler-discoverability pair. See core-server's copyAllStaticFilesRelativeToMain: a `from`
  // that resolves to a file (not a directory) is copied to exactly the `to` path, no directory
  // nesting.
  staticDirs: [
    { from: './lyra-mark.svg', to: './lyra-mark.svg' },
    { from: './story-image.svg', to: './fixtures/story-image.svg' },
    { from: '../packages/lyra-ui/src/components/viewers/pdf-viewer/fixtures/sample.pdf', to: './fixtures/sample.pdf' },
    // A synthetic (ffmpeg testsrc, no third-party content), silent 2s h264 clip -- MediaCard's
    // Video story used to point at an external MDN-hosted URL, which the release-time
    // `docs:check-show-code` sweep flagged with `net::ERR_ABORTED` (the browser aborting the
    // in-flight fetch when the docs page's "Show code" clicks re-render the canvas). A local
    // fixture removes both the external dependency and that sweep noise.
    { from: '../packages/lyra-ui/src/components/media/media-card/fixtures/sample.mp4', to: './fixtures/sample-video.mp4' },
    { from: '../packages/lyra-ui/llms.txt', to: './llms.txt' },
    { from: '../packages/lyra-ui/llms-full.txt', to: './llms-full.txt' },
    // The split reference llms.txt links into — one file per component plus the shared/token/peer/
    // migration tables. A `from` that resolves to a directory is copied recursively under `to`.
    { from: '../packages/lyra-ui/llms', to: './llms' },
    { from: './robots.txt', to: './robots.txt' },
    { from: './sitemap.xml', to: './sitemap.xml' },
  ],
  // Tailwind styles docs/story markup (light DOM in the preview iframe) only —
  // lr-* components themselves stay shadow-DOM + --lr-* tokens.
  async viteFinal(viteConfig) {
    viteConfig.plugins = viteConfig.plugins ?? [];
    // Match the runtime CSF metadata to the grouped index while retaining each story's
    // long-standing ID. Without the explicit legacy ID, changing only the index title makes
    // autodocs unable to associate a component page with its stories.
    viteConfig.plugins.push(storyTitlePlugin());
    // Serves the tag -> registration-entry map every component Docs page prints under its title,
    // read at build time from the same `llms/components/<tag>.md` files `check:llms-artifacts`
    // resolves. See .storybook/component-imports.js.
    viteConfig.plugins.push(componentImportsPlugin());
    // Companion stories import public package routes; resolve their source targets so their
    // modules use the same graph as component stories.
    viteConfig.plugins.push(sourcePackageExportsPlugin());
    viteConfig.plugins.push(sourceShikiWasmPlugin());
    viteConfig.plugins.push(lyraMapWorkerPlugin());
    // Storybook consumes source classes. Resolve diagnostics to the matching source condition
    // while package consumers use imports.
    let sourceDiagnosticCondition = 'production';
    viteConfig.plugins.push({
      name: 'lyra-source-diagnostic-condition',
      enforce: 'pre',
      configResolved(config) {
        sourceDiagnosticCondition = config.command === 'serve' ? 'development' : 'production';
      },
      resolveId(source) {
        const module = source === '#lyra-dev-warning' ? 'dev-warning' :
          source === '#lyra-dev-attributes' ? 'dev-mode-attribute-warning' : undefined;
        if (!module) return;
        return fileURLToPath(new URL(`../packages/lyra-ui/src/internal/${module}.${sourceDiagnosticCondition}.ts`, import.meta.url));
      },
    });
    viteConfig.plugins.push(tailwindcss());
    viteConfig.build = viteConfig.build ?? {};
    const localeManifest = JSON.parse(readFileSync(new URL('../packages/lyra-ui/locales.json', import.meta.url), 'utf8'));
    const catalogNames = localeManifest.locales
      .filter(locale => typeof locale.aggregateImport === 'string' && locale.kind !== 'testing-only')
      .map(locale => locale.aggregateImport.split('/').at(-1).replace(/\.js$/, ''));
    // Worker-shared chunks cannot run document-based module-preload helpers. Disabling preloads
    // also preserves the builder/locale lazy-root boundary represented by this shared helper.
    viteConfig.build.modulePreload = builderModulePreload(false, catalogNames);
    // Keep a real size tripwire while splitting the eager library and Storybook runtime below.
    // Syntax-highlighter languages and optional peers can still form substantial lazy chunks.
    viteConfig.build.chunkSizeWarningLimit = 5100;
    // Vite 8 reads warnings from rolldownOptions; its rollupOptions name is only an alias.
    const bundlerOptions = viteConfig.build.rolldownOptions ?? viteConfig.build.rollupOptions ?? {};
    viteConfig.build.rolldownOptions = bundlerOptions;
    delete viteConfig.build.rollupOptions;
    bundlerOptions.output = bundlerOptions.output ?? {};
    // Split each optional-peer-heavy dependency family into its own chunk so
    // a story that never renders `lr-map`/`lr-chart`/`lr-graph` never
    // has to load MapLibre/Chart.js/d3 as part of whatever shared chunk it
    // does need.
    // `preview.js` imports the eager `all.js` registration entry, so separate component families
    // and shared source from Storybook's iframe runtime. Story modules remain independently lazy.
    const LYRA_SRC = '/packages/lyra-ui/src/';
    bundlerOptions.output.manualChunks = (id) => {
      // Preserve the companion's semantic feature and shared-worker chunk boundaries.
      if (id.includes('/packages/lyra-map/') || id.includes('/@aceshooting/lyra-map/') || id.startsWith('\0lyra-map')) return;
      if (id.includes(LYRA_SRC) && !id.includes('.stories.') && !id.endsWith('.mdx') && !isDeferredLocaleModule(id)) {
        const relative = id.slice(id.indexOf(LYRA_SRC) + LYRA_SRC.length);
        const family = /^components\/([^/]+)\//.exec(relative)?.[1];
        return family ? `lyra-${family}` : 'lyra-shared';
      }
      // The preview includes Storybook's framework runtime, which is large enough to make the
      // iframe itself exceed the warning limit unless its own modules have a separate chunk.
      if (/(?:\/node_modules\/(?:\.pnpm\/storybook@[^/]+\/node_modules\/)?storybook\/)/.test(id)) return 'vendor-storybook';
      if (/(?:\/node_modules\/(?:\.pnpm\/@storybook\+addon-docs@[^/]+\/node_modules\/)?@storybook\/addon-docs\/)/.test(id)) return 'vendor-storybook-docs';
      if (/(?:^|\/)maplibre-gl(?:\/|$)/.test(id)) return 'vendor-maplibre';
      if (id.includes('chart.js') || id.includes('chartjs-plugin-zoom') || id.includes('@sgratzl/chartjs-chart-boxplot')) {
        return 'vendor-chartjs';
      }
      if (id.includes('/d3-force/') || id.includes('/d3-drag/') || id.includes('/d3-zoom/') || id.includes('/d3-selection/')) {
        return 'vendor-d3';
      }
    };
    // The eager docs registry makes its imported registration targets static. The three other
    // paths below resolve statically through the same eager component graph. Their source-level
    // lazy imports remain intact for granular library consumers. Other ineffective imports still
    // warn.
    const eagerDocsPairs = [
      ['internal/announcer.ts', 'components/overlays/skeleton/skeleton.class.ts'],
      ['components/overlays/toast/toast.class.ts', 'components/overlays/toast/toaster.ts'],
      ['components/overlays/toast/toast-item.class.ts', 'components/overlays/toast/toaster.ts'],
    ];
    const defaultOnwarn = bundlerOptions.onwarn;
    bundlerOptions.onwarn = (warning, warn) => {
      const message = String(warning?.message ?? warning ?? '');
      if (warning?.code === 'INEFFECTIVE_DYNAMIC_IMPORT' &&
          (message.includes('but also statically imported by packages/lyra-ui/src/all.ts') ||
            eagerDocsPairs.some(([target, importer]) => message.includes(target) && message.includes(importer) &&
              message.includes('but also statically imported by')))) {
        return;
      }
      if (defaultOnwarn) defaultOnwarn(warning, warn);
      else warn(warning);
    };
    // Codecov bundle analysis for the *docs site* only -- this is the sole vite build in the
    // repo. The published npm package is built by esbuild and is tracked separately, under the
    // `lyra-ui-dist` bundle (see packages/lyra-ui/scripts/codecov-bundle.mjs). Pushed last on
    // purpose: Codecov's plugin reads the finished bundle, so it must sit after every other
    // plugin in the array. Without CODECOV_TOKEN (any local `pnpm dev`/`pnpm docs:build`) the
    // plugin is inert, so no one needs a token to build the docs.
    viteConfig.plugins.push(
      codecovVitePlugin({
        enableBundleAnalysis: process.env.CODECOV_TOKEN !== undefined,
        bundleName: 'lyra-ui-docs',
        uploadToken: process.env.CODECOV_TOKEN,
      }),
    );
    // The Codecov plugin also *writes* its report as `<bundleName>-<format>-stats.json` into the
    // build output, which for a site this size is a multi-MB inventory of every asset, chunk and
    // module -- and storybook-static/ is deployed verbatim to lyra-ui.com, so it would ship as a
    // public file. The upload happens in the plugin's writeBundle hook and `closeBundle` runs
    // strictly after every writeBundle, so deleting here removes the artifact without affecting
    // what Codecov received.
    viteConfig.plugins.push({
      name: 'lyra-strip-codecov-stats',
      apply: 'build',
      closeBundle() {
        // readdirSync rather than fs.globSync: the latter needs Node 22 and package.json
        // declares `engines.node: >=20`.
        const outDir = viteConfig.build?.outDir ?? 'dist';
        if (!existsSync(outDir)) return;
        for (const file of readdirSync(outDir)) {
          if (file.endsWith('-stats.json')) rmSync(join(outDir, file), { force: true });
        }
      },
    });
    return viteConfig;
  },
  // Keep the sidebar oriented around how people think about components, while allowing
  // existing story titles to migrate incrementally instead of making the whole docs tree
  // change shape in one release.
  options: {
    storySort: {
      order: [
        'Introduction',
        'Agent tools',
        'Charts',
        'Conversation',
        'Data',
        'Forms',
        'Layout',
        'Media',
        'Overlays',
        'Retrieval',
        'Utility',
        'Viewers',
      ],
      method: 'alphabetical',
    },
  },
};

export default config;
