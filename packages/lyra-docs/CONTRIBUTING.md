# Contributing to @aceshooting/lyra-docs

## Development checks

Run builds, tests, and browser checks on the repository's test host with its
pinned toolchain (`.nvmrc` and the root `packageManager`), after
`pnpm exec playwright install chromium firefox webkit`. From the repository root, build
Lyra UI before the companion package:

```sh
pnpm --filter @aceshooting/lyra-ui build
pnpm --filter @aceshooting/lyra-docs build
pnpm --filter @aceshooting/lyra-docs lint
pnpm --filter @aceshooting/lyra-docs test
DOCX_BROWSERS=chromium,firefox,webkit pnpm --filter @aceshooting/lyra-docs test:browser
pnpm --filter @aceshooting/lyra-docs test:coverage
```

The coverage command combines Node and Chromium native V8 ranges, remaps them
to TypeScript, and inventories all emitted executable source files, including
files that were not loaded (those receive zero line coverage). It writes
`coverage/coverage-summary.json`, `coverage/coverage-metadata.json`,
`coverage/coverage-gaps.json`, `coverage/lcov.info`, and `coverage/index.html`.
The metadata marks coverage complete only when both the unit and browser suites
pass; an incomplete run cannot qualify a coverage result. V8 cannot enumerate
functions or branches in unloaded modules, and the report flags those metrics
as incomplete. Its statement count is based on V8 line counters, so statements
and lines share that denominator. Every emitted runtime module, including
styles, belongs to the coverage inventory. The generated reports record the
executed suite counts and measured coverage for that run. CI enforces a
lines/statements floor; branch coverage is reported separately and has no floor.

The browser command runs the three engines serially and writes browser evidence
under `packages/lyra-docs/.browser-output/`. To include the Chromium performance
fixture and diagnostic timing samples, run:

```sh
DOCX_BROWSERS=chromium,firefox,webkit DOCX_PERFORMANCE=1 pnpm --filter @aceshooting/lyra-docs test:browser
```

The performance report records hardware, browser, fixture size, and timing
samples. Timings include browser startup and rendering work and are not latency
guarantees.
