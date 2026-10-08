# RFC 0002 evidence

Disposable evidence for [RFC 0002](../0002-tokens-once-per-document.md) under the RFC process. Nothing
here is part of a package, and nothing here is maintained after the decision. Full result tables are
in [`results.md`](results.md).

## Variants

`build.mjs` copies a built `packages/lyra-ui/dist/` into a scratch directory and derives:

| Variant | What it is |
|---|---|
| A | The package as built: every host declares the shared layer. |
| B | First prototype: every custom property of the two shared sheets moves to one adopted document sheet, `:host` selectors mapped to `:root`, `.lr-light`, `.lr-dark` and `[data-lr-theme]`. |
| C | Only the 56 literal-only properties move (the ramp and the mask constant). |
| D | B, with the three host-local properties kept on the host (the first draft of the RFC). |
| E | The proposal: D, plus the two inherited mode switches instead of per-route dark rules, the preference arms kept on every host with their derived outputs, the closed scope list (including `.light` and `.dark`), specialist palettes on the switches, and on-demand adoption into the shadow root of a host that is not a registered library component. |
| I | The 27.0.0 implementation exactly as built (`--candidate <dist>`), compared with A taken from the published 26.0.0 tarball (`LYRA_BASELINE_DIST`). Release gate only. |

The prototypes rewrite the built stylesheets; the implementation would generate the layer from
`tokens/canonical-tokens.json`. The checkout is never written to.

## Files

| File | Purpose |
|---|---|
| `build.mjs` | Builds variants A–E and the benchmark and parity bundles; prints sheet and bundle sizes. |
| `server.mjs` | Static server with cross-origin isolation, for fine `performance.now()` resolution. |
| `server.test.mjs` | URL validation and response-header checks; run with `node --test server.test.mjs`. |
| `web/bench.html`, `run.mjs` | Benchmark page and runner: render, re-theme, memory; scopes, per-row scopes, application shadow roots. |
| `report.mjs` | Turns a results file into the tables in `results.md`. |
| `structure.mjs` | Per-host declaration counts and adopted-sheet structure. |
| `web/parity.html`, `parity.mjs` | First-prototype parity (11 forms, 6 modes, A against B, C or D). |
| `web/parity-e.html`, `parity-e.mjs` | Parity for the proposal (30 forms, 15 page modes, A against E). |
| `parity-modes.mjs` | The mode each parity form renders in, against the nearest mode scope. |
| `late-adopt.mjs` | Cost of the first adoption on a page with a large application DOM. |
| `analyze-inputs.mjs` | Which inputs the layer consumes and which component sheets read directly; shared names declared in component sheets. |
| `probe-ssr.mjs` | Server-rendered size per element, raw and compressed. |
| `probe-forced.mjs` | Forced style recalculations per component type during first render (Chromium). |
| `run-revised.sh` | The sequence that produced the proposal's runs. |

## Running

1. In a checkout of the source commit, run `pnpm install` and `pnpm build`.
2. Copy this directory outside the checkout.
3. `LYRA_CHECKOUT=<checkout> node build.mjs --refresh` copies `dist/`, links the package's
   `node_modules` for module resolution, and builds every variant (`--only e` builds one).
4. Benchmarks: `node run.mjs --variants a,e --runs 5 --sizes 1000,3000 --engines chromium,firefox,webkit`,
   plus `--mix nocard`, `--render incremental`, `--scopes 50`, `--row-scopes`, `--roots`,
   `--foreign-always` or `--host-scope` for the other scenarios. Each results file records the source commit, the bundle
   hashes, the page parameters and the load average.
5. `node report.mjs out/results-<…>.json`, `node parity-e.mjs`, `node parity-modes.mjs`,
   `node structure.mjs a,e`, `node late-adopt.mjs`, `node probe-ssr.mjs e`, `node analyze-inputs.mjs`.
   `run-revised.sh` runs the proposal's sequence.

**Release gate (27.0.0).** Unpack the published 26.0.0 tarball next to a built 27 checkout and run
`LYRA_CHECKOUT=<checkout> LYRA_BASELINE_DIST=<unpacked>/package/dist node build.mjs --refresh --only a
--candidate <checkout>/packages/lyra-ui/dist`, then `run.mjs --variants a,i` for each scenario,
`parity-e.mjs --variants a,i`, `parity-modes.mjs --variants a,i` and `late-adopt.mjs --variants a,i`
with and without `--link`. Each variant loads its own `theme.css`.

Measure on an otherwise idle machine. The runs in `results.md` were not: each records its load
average, and single-digit percentage differences are noise unless the interquartile ranges separate.
