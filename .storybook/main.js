import tailwindcss from '@tailwindcss/vite';

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
  title: 'Lyra UI — free, open Web Awesome companion component library',
  // Copies files that must exist at the site root (not under an asset-hashed path) into
  // storybook-static/ verbatim. `llms.txt`/`llms-full.txt` are the coding-assistant-facing API
  // reference this repo's own README/llms.txt point at; robots.txt/sitemap.xml are the standard
  // crawler-discoverability pair. See core-server's copyAllStaticFilesRelativeToMain: a `from`
  // that resolves to a file (not a directory) is copied to exactly the `to` path, no directory
  // nesting.
  staticDirs: [
    { from: '../packages/lyra-ui/llms.txt', to: './llms.txt' },
    { from: '../packages/lyra-ui/llms-full.txt', to: './llms-full.txt' },
    { from: './robots.txt', to: './robots.txt' },
    { from: './sitemap.xml', to: './sitemap.xml' },
  ],
  // Tailwind styles docs/story markup (light DOM in the preview iframe) only —
  // lyra-* components themselves stay shadow-DOM + --lyra-* tokens.
  async viteFinal(viteConfig) {
    viteConfig.plugins = viteConfig.plugins ?? [];
    viteConfig.plugins.push(tailwindcss());
    viteConfig.build = viteConfig.build ?? {};
    viteConfig.build.rollupOptions = viteConfig.build.rollupOptions ?? {};
    viteConfig.build.rollupOptions.output = viteConfig.build.rollupOptions.output ?? {};
    // Split each optional-peer-heavy dependency family into its own chunk so
    // a story that never renders `lyra-map`/`lyra-chart`/`lyra-graph` never
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
    return viteConfig;
  },
};

export default config;
