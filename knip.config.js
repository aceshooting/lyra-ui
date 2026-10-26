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
      // The hosted regression helper invokes wtr in packages/lyra-ui, which declares it. The
      // workflow policy test runs the docs deploy's badge steps with the runner's preinstalled jq.
      ignoreBinaries: ['wtr', 'jq'],
      ignoreDependencies: [
        // Spawned by name or referenced as string data in packed-consumer checks.
        'publint',
        '@arethetypeswrong/cli',
        // createRequire resolves these from the disposable consumer or the library workspace,
        // which declares Shiki; they are not imports from the repository-root installation.
        'shiki',
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
      // The duplication checker spawns the pinned CLI from node_modules/.bin. The 3D companion is
      // an optional peer that components import lazily once their engines exist.
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
      entry: ['src/index.ts!', 'src/docx/index.ts!', 'src/docx/editor.ts!', 'src/docx/docx-editor.class.ts!', 'src/**/*.test.ts', 'type-tests/**/*.ts',
        // Vite builds this browser entry in scripts/engine-regressions.mjs.
        'scripts/engine-regression-fixtures/refresh-regressions.mjs'],
      project: ['src/**/*.ts!', '!src/**/*.test.ts!', '!src/**/*-fixtures.ts!', 'scripts/**/*.mjs', 'type-tests/**/*.ts', 'test/**/*.ts'],
    },
    'packages/lyra-gen': {
      entry: [
        'src/index.ts!', 'src/gen-view.ts!', 'src/gen-view.class.ts!',
        'src/dashboard-binding.ts!', 'src/ssr.ts!', 'src/adapters/a2ui.ts!',
        'src/adapters/a2ui-candidate.ts!', 'src/replay.ts!', 'src/evaluation.ts!',
        'src/**/*.test.ts', 'test/**/*.{ts,mjs}', 'scripts/*.test.mjs',
        // Published examples and maintainer qualification CLIs are explicit runnable entries.
        'examples/chat.ts!', 'examples/dashboard.ts!', 'examples/saved-dashboard/{app.js,host.mjs}!',
        'scripts/{check-catalog-consumer,compare-a2ui-reference,compare-a2ui-dom,openui-experiment,report-catalog-presets}.mjs',
        '*.config.mjs',
      ],
      project: ['src/**/*.ts!', '!src/**/*.test.ts!', 'scripts/**/*.mjs', 'bin/*.mjs', 'examples/**/*.{ts,js,mjs}', 'test/**/*.{ts,mjs}', '*.config.mjs'],
      // TypeScript emits tslib helpers; the DOM comparison bundles these aliases from pinned source.
      ignoreDependencies: ['tslib', '@a2ui/web_core', '@a2ui/lit-basic', '@a2ui/lit-surface'],
    },
    'packages/lyra-map': {
      // Build inputs produce the public worker/plugin entries and declarations in dist/.
      entry: ['src/vite.mjs!', 'src/vite.d.ts!', 'types/features.d.ts!', 'test/*.test.mjs'],
      project: ['src/**/*.{mjs,ts}!', 'types/**/*.ts!', 'scripts/**/*.mjs', 'test/**/*.{mjs,ts}'],
      // Linux browser qualification uses the system font resolver and an isolated display server.
      ignoreBinaries: ['fc-match', 'Xvfb'],
    },
    'packages/lyra-3d': {
      entry: ['test/*.test.{mjs,ts}', 'test/browser/*.mjs'],
      project: ['src/**/*.ts!', 'scripts/**/*.mjs', 'test/**/*.{mjs,ts}'],
      // Linux browser qualification runs Firefox and WebKit headed on an isolated display server.
      ignoreBinaries: ['Xvfb'],
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
