// Mutation testing for this package's own hand-written logic modules. The "Quality tools" workflow
// (.github/workflows/quality-tools.yml) runs every mutant (`--force`) on each release commit and weekly,
// and uploads the HTML report. The score gates nothing (`thresholds.break` stays null): the job fails only
// when Stryker or its report is broken, and the surviving mutants are a worklist.
//
// Out of scope on purpose: the generated engine, and the three modules that emit code
// (base-transform, complete-transform, worker-transform). Their mutants are template strings that only
// a browser run observes, so a Node-tier score would mislead; the Chromium driver
// (`pnpm test:browser`) guards them instead.
export default {
  testRunner: 'tap',
  plugins: ['@stryker-mutator/tap-runner'],
  tap: {
    testFiles: ['test/*.test.mjs'],
    nodeArgs: ['--test-reporter=tap'],
    forceBail: true,
  },
  mutate: [
    'src/vite.mjs',
    'scripts/prepared-mutations.mjs',
    'scripts/feature-requirements.mjs',
    'scripts/preparation-runtime.mjs',
    'scripts/code-serialization.mjs',
    'scripts/metadata-transform.mjs',
    'scripts/sprite-key-transform.mjs',
  ],
  coverageAnalysis: 'perTest',
  reporters: ['clear-text', 'json', 'html'],
  jsonReporter: { fileName: 'reports/mutation/mutation.json' },
  htmlReporter: { fileName: 'reports/mutation/mutation.html' },
  thresholds: { high: 85, low: 65, break: null },
  timeoutMS: 30000,
  timeoutFactor: 3,
  // Stryker copies the package into this directory; keeping it inside the package lets the sandbox
  // resolve the workspace's node_modules by walking up.
  tempDirName: '.stryker-tmp',
  cleanTempDir: true,
  disableTypeChecks: '{src,scripts}/**/*.mjs',
  // Reuse earlier results so a run after a small change takes seconds (`--force` runs everything).
  incremental: true,
  incrementalFile: 'reports/stryker-incremental.json',
};
