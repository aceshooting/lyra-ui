import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import { codecovVitePlugin } from '@codecov/vite-plugin';

/** @type { import('@storybook/web-components-vite').StorybookConfig } */
const config = {
  stories: ['../packages/lyra-ui/src/components/**/*.stories.ts', '../.storybook/*.mdx'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
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
  // Copies files that must exist at the site root (not under an asset-hashed path) into
  // storybook-static/ verbatim. `llms.txt`/`llms-full.txt` are the coding-assistant-facing API
  // reference this repo's own README/llms.txt point at; robots.txt/sitemap.xml are the standard
  // crawler-discoverability pair. See core-server's copyAllStaticFilesRelativeToMain: a `from`
  // that resolves to a file (not a directory) is copied to exactly the `to` path, no directory
  // nesting.
  staticDirs: [
    { from: './lyra-mark.svg', to: './lyra-mark.svg' },
    { from: '../packages/lyra-ui/src/components/viewers/pdf-viewer/fixtures/sample.pdf', to: './fixtures/sample.pdf' },
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
    viteConfig.plugins.push(tailwindcss());
    viteConfig.build = viteConfig.build ?? {};
    // Vite's default 500kB warning fires on chunks that are already correctly
    // split (one-per-language addon-docs syntax-highlighter chunks, axe-core,
    // MapLibre's own WASM+JS) — none of it ships in the published npm
    // package (see check:packed-consumer, which measures that separately).
    // Raised past the current largest known chunk (~2.8MB, Storybook's own
    // iframe runtime) so the warning stays meaningful for a genuine future
    // regression instead of firing on this site build's normal baseline.
    viteConfig.build.chunkSizeWarningLimit = 3200;
    viteConfig.build.rollupOptions = viteConfig.build.rollupOptions ?? {};
    viteConfig.build.rollupOptions.output = viteConfig.build.rollupOptions.output ?? {};
    // Split each optional-peer-heavy dependency family into its own chunk so
    // a story that never renders `lr-map`/`lr-chart`/`lr-graph` never
    // has to load MapLibre/Chart.js/d3 as part of whatever shared chunk it
    // does need.
    viteConfig.build.rollupOptions.output.manualChunks = (id) => {
      if (id.includes('maplibre-gl')) return 'vendor-maplibre';
      if (id.includes('chart.js') || id.includes('chartjs-plugin-zoom') || id.includes('@sgratzl/chartjs-chart-boxplot')) {
        return 'vendor-chartjs';
      }
      if (id.includes('/d3-force/') || id.includes('/d3-drag/') || id.includes('/d3-zoom/') || id.includes('/d3-selection/')) {
        return 'vendor-d3';
      }
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
        'Foundations',
        'Actions',
        'Forms',
        'Feedback',
        'Disclosure',
        'Overlays',
        'Layout',
        'Display',
        'Charts & Visualization',
        'Conversation & Agent UI',
        'Utilities',
      ],
      method: 'alphabetical',
    },
  },
};

export default config;
