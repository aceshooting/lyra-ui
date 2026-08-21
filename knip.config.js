export default {
  workspaces: {
    '.': {
      entry: [
        'scripts/*.mjs',
        '.storybook/{main,preview,manager,story-theme}.js',
        '.storybook/**/*.mdx',
      ],
      project: ['scripts/**/*.mjs', '.storybook/**/*.{js,mdx,css}'],
      ignoreDependencies: [
        // Spawned by name or referenced as string data in packed-consumer checks.
        'publint',
        '@arethetypeswrong/cli',
        '@sgratzl/chartjs-chart-boxplot',
        'chart.js',
        'chartjs-plugin-zoom',
        'd3-drag',
        'd3-force',
        'd3-selection',
        'd3-zoom',
        '@aceshooting/lyra-ui',
        '@aceshooting/lyra-flags',
        // Loaded by identifier rather than a JavaScript import.
        'secretlint',
        '@secretlint/secretlint-rule-preset-recommend',
      ],
    },
    'packages/lyra-ui': {
      entry: [
        'src/**/*.test.ts',
        'src/**/*.stories.ts',
        'type-tests/**/*.ts',
        'scripts/*.mjs',
        'scripts/fixtures/migrate-wa/*.{svelte,vue}',
        '*.config.js',
      ],
      project: [
        'src/**/*.ts',
        'scripts/**/*.mjs',
        'scripts/fixtures/migrate-wa/*.{svelte,vue}',
        'type-tests/**/*.ts',
        '*.config.js',
      ],
      // Injected by Web Test Runner's browser harness; it is not a filesystem module.
      ignoreUnresolved: ['/__web-dev-server__web-socket.js'],
    },
    'packages/lyra-flags': {
      entry: ['scripts/*.mjs'],
      project: ['scripts/**/*.mjs', '*.js'],
    },
  },
};
