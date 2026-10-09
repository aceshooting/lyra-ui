export default {
  workspaces: {
    '.': {
      entry: [
        '.storybook/{main,preview,manager,story-theme}.js',
        // The upgrade script invokes this peer synchronizer directly.
        'scripts/sync-docx-engine-peer.mjs',
        // The upgrade script also invokes the Playwright container-image synchronizer directly.
        'scripts/sync-playwright-images.mjs',
        // TypeScript resolves this declaration as the authored contract for theme-contract.js.
        '.storybook/theme-contract.d.ts',
        '.storybook/**/*.mdx',
      ],
      project: ['scripts/**/*.mjs', '.storybook/**/*.{js,mdx,css}'],
      // The hosted regression helper invokes wtr in packages/lyra-ui, which declares it.
      ignoreBinaries: ['wtr'],
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
        // Storybook loads this renderer; keep it upgraded alongside its React runtime.
        'react-dom',
      ],
    },
    'packages/lyra-ui': {
      // Edge startup diagnostics probe the hosted runner's OS-installed channel executable.
      ignoreBinaries: ['microsoft-edge'],
      // The duplication checker spawns the pinned CLI from node_modules/.bin.
      ignoreDependencies: ['jscpd'],
      entry: [
        'src/**/*.test.ts',
        'src/**/*.stories.ts',
        'type-tests/**/*.ts',
        // Spawned by installed-hydration.mjs as a worker from its absolute fixture path.
        'scripts/fixtures/packed-performance/ssr-worker.mjs',
        // Maintainer CLIs invoked from shell/docs rather than a package.json script.
        'scripts/llms-gap-report.mjs',
        'scripts/scaffold-translation.mjs',
        // The published `lyra-ui` bin: build copies it to dist/cli, and init-agents.test.mjs spawns it.
        'scripts/lyra-ui.mjs',
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
    'packages/lyra-docs': {
      entry: ['src/index.ts!', 'src/docx/index.ts!', 'src/docx/editor.ts!', 'src/docx/docx-editor.class.ts!', 'src/**/*.test.ts', 'type-tests/**/*.ts'],
      project: ['src/**/*.ts!', '!src/**/*.test.ts!', '!src/**/*-fixtures.ts!', 'scripts/**/*.mjs', 'type-tests/**/*.ts', 'test/**/*.ts'],
    },
    'packages/lyra-flags': {
      project: ['scripts/**/*.mjs', '*.js'],
    },
    // Companion packages assembled from lyra-ui's build output; the peer is resolved by pnpm, never imported.
    'packages/lyra-ide': {
      project: ['scripts/**/*.mjs'],
      ignoreDependencies: ['@aceshooting/lyra-ui'],
    },
    'packages/lyra-translations': {
      project: ['scripts/**/*.mjs'],
      ignoreDependencies: ['@aceshooting/lyra-ui'],
    },
  },
};
