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
pnpm --filter @aceshooting/lyra-docs test:performance
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

The same run also measures the package's own Node tooling in `scripts/` from the
same V8 dumps. The build and its package contract execute under coverage, the unit
suites cover the helpers they exercise, and `test:performance` runs the performance
harness once against the production bundle, asserting the shape and functional
outcomes of its record without comparing timings. The report writes these files
into the same `coverage/` reports and records them as `tooling` and `combined` in
`coverage-metadata.json`; the gated `total` stays the TypeScript runtime. Tooling has
its own lines/statements floor. Bodies of functions that a script hands to
`page.evaluate` run inside Chromium and are not visible to Node coverage. Every
JavaScript file under `scripts/` must be classified in `scripts/coverage.mjs` as
measured or as a test or browser suite, so a new script cannot silently leave the
report. Scripts that find their inputs from their own path are exercised through
`scripts/lib/staged-script.mjs`, which copies them into a fixture tree and records
the copy so the run is credited to the original file.

The browser command runs the three engines serially and writes browser evidence
under `packages/lyra-docs/.browser-output/`. To include the Chromium performance
fixture and diagnostic timing samples, run:

```sh
DOCX_BROWSERS=chromium,firefox,webkit DOCX_PERFORMANCE=1 pnpm --filter @aceshooting/lyra-docs test:browser
```

The performance report records hardware, browser, fixture size, and timing
samples. Timings include browser startup and rendering work and are not latency
guarantees.
