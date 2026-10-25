// Mutation testing for this package's own hand-written logic modules. The "Quality tools" workflow
// (.github/workflows/quality-tools.yml) runs every mutant (`--force`) on each release commit and weekly,
// and uploads the HTML report. The score gates nothing (`thresholds.break` stays null): the job fails only
// when Stryker or its report is broken, and the surviving mutants are a worklist.
//
// Out of scope on purpose: the generated engine, and the three modules that emit code
// (base-transform, complete-transform, worker-transform). Their mutants are template strings that only
// a browser run observes, so a Node-tier score would mislead; the Chromium driver
// (`pnpm test:browser`) guards them instead.
// Run from the monorepo root so the sandbox retains shared tooling and package-relative imports.
export default {
  testRunner: 'tap',
  plugins: [import.meta.resolve('@stryker-mutator/tap-runner')],
  // These unrelated directory links cannot be copied into the sandbox as ordinary files.
  ignorePatterns: ['/.agents/skills'],
  tap: {
    // The package verifier rebuilds and imports generated code in a subprocess without TAP hooks.
    // It observes no mutation targets here and runs in the complete ordinary-suite preflight instead.
    testFiles: ['packages/lyra-map/test/!(check-package).test.mjs'],
    nodeArgs: ['--test-reporter=tap'],
    forceBail: true,
  },
  mutate: [
    'packages/lyra-map/src/vite.mjs',
    'packages/lyra-map/scripts/prepared-mutations.mjs',
    'packages/lyra-map/scripts/feature-requirements.mjs',
    'packages/lyra-map/scripts/preparation-runtime.mjs',
    'packages/lyra-map/scripts/code-serialization.mjs',
    'packages/lyra-map/scripts/metadata-transform.mjs',
    'packages/lyra-map/scripts/sprite-key-transform.mjs',
  ],
  coverageAnalysis: 'perTest',
  reporters: ['clear-text', 'json', 'html'],
  jsonReporter: { fileName: 'packages/lyra-map/reports/mutation/mutation.json' },
  htmlReporter: { fileName: 'packages/lyra-map/reports/mutation/mutation.html' },
  thresholds: { high: 85, low: 65, break: null },
  timeoutMS: 30000,
  timeoutFactor: 3,
  // Preserve the monorepo layout; Stryker links root and package node_modules into matching locations.
  tempDirName: '.stryker-tmp',
  cleanTempDir: true,
  disableTypeChecks: 'packages/lyra-map/{src,scripts}/**/*.mjs',
  // Reuse earlier results so a run after a small change takes seconds (`--force` runs everything).
  incremental: true,
  incrementalFile: 'packages/lyra-map/reports/stryker-incremental.json',
};
