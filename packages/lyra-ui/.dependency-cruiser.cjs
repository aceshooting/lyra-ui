// Architecture rules for packages/lyra-ui, checked by `pnpm run check:architecture` (a lint-lane gate).
// Errors fail the gate; warnings are a worklist and never fail it. The warnings that exist today are
// frozen in .dependency-cruiser-known-violations.json, so a run reports only NEW ones: when you remove
// a violation, delete its entry (or regenerate the file with `pnpm run architecture:baseline`); never add
// one by hand to silence a new import, move the shared code to src/internal instead.
//
// dependency-cruiser parses TypeScript through the legacy compiler API, so it runs on its own
// typescript@6 (pnpm-workspace.yaml `packageExtensions`); the workspace keeps typescript@7.
// With that parser it misses a few literal `import()` calls in default-parameter initialisers, so
// it cannot prove that an optional peer is *reached* lazily; the esbuild bundle budgets
// (scripts/bundle-exclusion-claims.json) own that proof. Static edges are exact.

// Test, story and fixture modules, plus the published `src/testing` utilities.
const NOT_SHIPPED = '\\.(test|stories)\\.ts$|/fixtures/|^src/testing/';

module.exports = {
  forbidden: [
    {
      name: 'no-circular-runtime',
      comment:
        'Static and type-only import cycles, the same contract as scripts/check-import-cycles.mjs. A dynamic import() may close a loop: those are lazy by construction.',
      severity: 'error',
      from: {},
      to: { circular: true, viaOnly: { dependencyTypesNot: ['dynamic-import'] } },
    },
    {
      name: 'prod-not-to-tests',
      comment: 'Shipped modules must not import tests, stories, fixtures or the repo-level test/ harness.',
      severity: 'error',
      from: { path: '^src/', pathNot: NOT_SHIPPED },
      to: { path: '(^|/)test/|\\.test\\.ts$|\\.stories\\.ts$|/fixtures/' },
    },
    {
      name: 'prod-not-to-src-testing',
      comment: 'src/testing is a published test-utility subpath; components must not depend on it.',
      severity: 'error',
      from: { path: '^src/', pathNot: NOT_SHIPPED },
      to: { path: '^src/testing/' },
    },
    {
      name: 'optional-peers-only-lazy',
      comment:
        'Optional peers (chart.js, shiki, maplibre-gl, pdfjs-dist, ...) may only be reached through import(); a static edge would bundle them into every consumer.',
      severity: 'error',
      from: { path: '^src/', pathNot: NOT_SHIPPED },
      to: {
        dependencyTypes: ['npm-peer', 'npm-optional'],
        dependencyTypesNot: ['type-only', 'dynamic-import'],
      },
    },
    {
      name: 'internal-not-to-components',
      comment:
        'src/internal is shared infrastructure; it must not depend on a component. The generated lazy loaders are the sanctioned exception.',
      severity: 'warn',
      from: {
        path: '^src/internal/',
        pathNot: [NOT_SHIPPED, '^src/internal/(component|locale)-loaders\\.generated\\.ts$'],
      },
      to: { path: '^src/components/', dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'no-cross-component-private-imports',
      comment:
        'A component directory may import another one only through its .class, index or registration module. Shared helpers belong in src/internal.',
      severity: 'warn',
      from: { path: '^src/components/([^/]+)/([^/]+)/', pathNot: NOT_SHIPPED },
      to: {
        path: '^src/components/[^/]+/[^/]+/',
        pathNot: [
          '^src/components/$1/$2/',
          '\\.class\\.ts$',
          '/index\\.ts$',
          '^src/components/[^/]+/([^/]+)/\\1\\.ts$',
          '-register\\.ts$',
        ],
      },
    },
    {
      name: 'no-orphans',
      comment: 'A module nothing imports and no entry point owns is dead code.',
      severity: 'warn',
      from: {
        orphan: true,
        pathNot: [
          NOT_SHIPPED,
          '^src/(all|lyra|events|framework-types|ssr|hydration|svelte|vue|autoloader|autoloader-cdn|custom-elements-jsx|data-sources|locale-loader|localization|currency|countries|time-zones|units|theme)\\.ts$',
          '^src/(ssr|translations)/',
          '^src/components/lr-[^/]+\\.ts$',
          '\\.d\\.ts$',
          '\\.styles\\.ts$',
        ],
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    // Without this, `import type` edges are invisible and a type-only cycle would pass.
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.test.json' },
    moduleSystems: ['es6'],
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'module', 'default', 'types'],
      mainFields: ['module', 'main', 'types'],
    },
  },
};
