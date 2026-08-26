export default {
  workspaces: {
    '.': {
      entry: [
        '.storybook/{main,preview,manager,story-theme}.js',
        // TypeScript resolves this declaration as the authored contract for theme-contract.js.
        '.storybook/theme-contract.d.ts',
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
        // Maintainer CLIs invoked from shell/docs rather than a package.json script.
        'scripts/generate-chart-palette.mjs',
        'scripts/generate-palette.mjs',
        'scripts/generate-terminal-palette.mjs',
        'scripts/llms-gap-report.mjs',
        'scripts/scaffold-translation.mjs',
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
    },
    'packages/lyra-flags': {
      project: ['scripts/**/*.mjs', '*.js'],
    },
  },
};
