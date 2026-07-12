import tailwindcss from '@tailwindcss/vite';

/** @type { import('@storybook/web-components-vite').StorybookConfig } */
const config = {
  stories: ['../packages/lyra-ui/src/components/**/*.stories.ts', '../.storybook/*.mdx'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  framework: {
    name: '@storybook/web-components-vite',
    options: {},
  },
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
