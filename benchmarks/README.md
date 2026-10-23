# Synthetic component benchmarks

Run repeatable table, chart and option-control workloads against Lyra UI's built package, save raw
samples, and compare later builds. Release qualification includes a quick Chromium comparison on a
stable workstation; material regressions require an explanation in the changeset. Measurements do
not run automatically in CI. See [the release procedure](../docs/agents/ci-and-gates.md#release-procedure).

## Run

Use the repository's pinned Node version and existing workspace dependencies. Build the library first:

```sh
nvm use
pnpm --filter @aceshooting/lyra-ui build
pnpm benchmark --profile quick
```

The default runs Chromium, Firefox and WebKit **sequentially**, with one page in one browser process at a time. Each scenario uses a fresh document, one untimed warmup and seven recorded samples. Chrome and Edge use installed browser channels:

```sh
node benchmarks/run.mjs --profile quick --browsers chromium,firefox,webkit,chrome,edge
node benchmarks/run.mjs --profile stress --browsers chromium --timeout-ms 90000
```

Install the appropriate Playwright browsers through the workspace's usual setup before running. A missing browser records `unavailable` and makes the run incomplete; it never becomes a passing measurement. No browser is installed automatically.

Options:

| Option | Default | Meaning |
| --- | --- | --- |
| `--profile` | `quick` | `quick` or `stress`; workload membership is in `fixtures/catalog.mjs`. |
| `--browsers` | `chromium,firefox,webkit` | Comma-separated engines or installed `chrome`/`edge` channels, executed in the supplied order. |
| `--samples` | `7` | Recorded samples per scenario; integer 3–50. |
| `--warmups` | `1` | Discarded warmups; integer 0–10. |
| `--timeout-ms` | `30000` | Per-sample deadline including fixture setup; integer 1000–120000. Fixture phase deadlines also apply. |
| `--scenarios` | All profile scenarios | Exact comma-separated IDs; unknown or out-of-profile IDs fail before browser execution. |
| `--package-dir` | `packages/lyra-ui` | Package directory containing `package.json` and built `dist/`; package name must be `@aceshooting/lyra-ui`. |
| `--output` | Timestamped file in `benchmarks/results/` | New JSON output file; an existing file is never overwritten. |
| `--headed` | Headless | Use a visible browser; this changes compatibility metadata. |
| `--software-rendering` | Off | Set `LIBGL_ALWAYS_SOFTWARE=1` and Firefox software-rendering preferences; this changes compatibility metadata. |

A standalone installed package can be selected with `--package-dir ./node_modules/@aceshooting/lyra-ui`. The package's public exports resolve to its own built files. Keep the harness dependencies fixed with a frozen lockfile. Results record Node, Playwright, Vite and Chart.js versions, plus the tested library and browser versions; they do not record every runtime dependency. In particular, verify `lit`, `lit-html`, `lit-element` and `@lit/reactive-element` resolutions manually. Package paths are never recorded in results.

Vite builds a production fixture bundle under ignored `benchmarks/.work/`, then an owned server serves only that bundle on loopback. The runner removes its temporary directory and server after the run. Browser requests to other origins and methods other than GET/HEAD are blocked. The static server never redirects or proxies; no application backend, authentication, production data or remote data is involved. Service workers and additional network transports are disabled. If a sample times out, the engine stops and its page/process is closed before another engine starts; remaining scenarios are explicitly untested.

Avoid concurrent browser workloads on the same machine. Keep power mode, rendering mode, browser versions, display conditions, fonts and machine load stable. The schema records relevant software and machine characteristics, but cannot prove that background load or thermal conditions matched.

## A/B comparison with tachometer

The harness above compares two saved runs taken at different times. For a release, the sharper question is
"is this build different from the latest published one, and by how much?". `pnpm benchmark:ab` answers it
with [tachometer](https://github.com/google/tachometer), which interleaves both builds in one browser session
and keeps sampling until the confidence interval of the difference excludes zero (or the timeout passes):

```sh
pnpm --filter @aceshooting/lyra-ui build
pnpm benchmark:ab                                   # latest published release, all three workloads
pnpm benchmark:ab --published 29.2.2 --workloads data-grid --auto-sample-conditions=-5%,+5%
```

The workloads are 1,000 `lr-button`, a 10,000-row `lr-data-grid` and a 10,000-item `lr-virtual-list`; each
asserts after the timed region that the real work happened. Tachometer ignores `package.json` `exports`
maps, so the script installs the published package with `npm`, copies the local `dist/`, bundles each
variant with the repository's esbuild from inside its own `node_modules` (the same Lit is pinned in both)
and lets tachometer compare two plain pages. Tachometer runs through `npx` at the version pinned in
`benchmarks/ab.mjs`; it is not a dependency. Use Playwright's Chromium (default) or `--browser-binary`.
On a quiet machine the interval narrows to about 1 to 2% in four to five minutes per workload; a shared
runner (the "A/B benchmark" job of the Quality tools workflow) resolves large changes only.

The command is also a gate. It exits 1 when the 95% confidence interval of a workload's slowdown (local
relative to published, as tachometer reports it) lies entirely above `--fail-above` percent (default 10), or
when a workload produced no interval; an interval that reaches past the limit but also includes smaller values
is inconclusive and only warns (`::warning`), because a shared runner cannot always tell. Every verdict is in
the summary table. A real slow-down below the limit is reported as "slower, within the limit" and still goes
through the regression rule in the release procedure. Raising `--fail-above` in `quality-tools.yml` is a
reviewed policy change, like raising a bundle budget.

## What is measured

See [fixture details](fixtures/README.md) for exact workloads and assertions. `quick` covers scheduling controls, table assignment/sorting/filtering, chart assignment and relabeling, and closed select/combobox option metadata. `stress` adds larger chart/option sets and million-record table boundary and server-pagination cases. A million-record source is **not** a claim that one million rows are rendered: each result records its input parameters, retained entries, rendered rows and semantic checks. The boundary case exercises collection limits; the paged case models a million logical records with a bounded supplied page.

Each recorded sample contains:

- Synchronous assignment wall time, component-update wait, settled-work wait, two-frame paint wait, and total elapsed time.
- The same phases for a matched no-op, plus a separate scheduling-control scenario.
- Assertion IDs and booleans proving rendered values, bounds, labels and selection behavior.
- Numeric counts relevant to that workload, including formatter calls where applicable.

Assignment time isolates synchronous setter work but is not a hardware CPU counter. Update and settlement phases include scheduling, and paint includes frame waits. Interpret them separately. Matched no-op values help identify scheduling noise; the comparer does **not** blindly subtract them from another sample. Input construction and component setup happen outside fixture timing phases, although the runner's timeout includes them. Results retain every raw sample; warmups are discarded. With seven samples, nearest-rank p95 is the maximum and is a diagnostic tail observation, not a robust field percentile.

The harness records versions for Node, Playwright, Vite, Chart.js, browser and library; OS version, architecture, CPU model, logical CPU count, memory, viewport, DPR and rendering mode; and SHA-256 fingerprints of the harness, fixtures and tested package's `dist/`. The public library commit is recorded only when the selected package is the repository package, its source is clean, and HEAD is verified against the configured public origin's main tracking reference; otherwise it is `null`. The source commit identifies the checkout, not proof that its distribution was freshly rebuilt; rebuild before measuring it. The distribution hash identifies the actual built bytes even when a source commit cannot be established.

## Compare

`pnpm benchmark:compare` is an alias for the comparison command below.

```sh
node benchmarks/compare.mjs benchmarks/baselines/baseline.json benchmarks/results/candidate.json
node benchmarks/compare.mjs benchmarks/baselines/baseline.json benchmarks/results/candidate.json --relative 0.20 --absolute-ms 2
```

A timing statistic is a regression only when its increase exceeds **both** the relative and absolute threshold. Defaults are 15% and 1 ms. The detailed JSON contains raw arrays, median, nearest-rank p95, minimum, maximum, absolute deltas and ratios for every timing phase, including controls. A zero baseline produces a `null` ratio; its absolute increase still participates in the threshold rule.

The baseline and candidate must match harness/fixture hashes, workload selection and parameters, sample/warmup counts, browser versions, and environment metadata. Library version, library distribution hash, public source commit and recording time may change. Schema version 1 does not compare a complete dependency inventory: matching recorded metadata does not prove dependency equivalence. Reuse the same frozen harness lockfile and manually verify unrecorded runtime resolutions before qualifying a comparison; a future schema would need to enforce those versions automatically. Missing, failed, unsupported or unavailable evidence never compares green. `--allow-incompatible` exposes comparisons across a mismatched environment or harness, but labels the result `incomparable-override` even when no threshold is exceeded; it never produces a normal passing comparison. It is exploratory evidence, not a regression qualification. Both files must still satisfy the current result schema and fixed workload catalog.

By default, the command prints a concise status, compatibility and threshold summary; counts of materially regressed/improved metrics; and at most 20 changes ranked by their largest absolute median/p95 delta. Each row shows browser, workload, timing phase and before/after median and p95. An observed improvement uses the same relative **and** absolute thresholds as a regression, applied to the reduction from baseline. A metric may improve at the median and regress at p95, and is counted in both groups. Changes are observed, not a causal attribution to the library.

Use `--output FILE` to save the complete comparison JSON while retaining the concise terminal summary. Use `--json` for complete JSON on stdout. Output files retain the same no-overwrite behavior. No thresholds are written back into baselines.

```sh
pnpm benchmark:compare benchmarks/baselines/baseline.json benchmarks/results/candidate.json --output benchmarks/results/comparison.json
pnpm benchmark:compare benchmarks/baselines/baseline.json benchmarks/results/candidate.json --json
```

## Save a reviewed baseline

See the [saved baseline notes](baselines/README.md) for the dated stress run and matching workload command.

Default results and temporary artifacts are ignored. To create a deliberately reviewable baseline, choose a new file under `benchmarks/baselines/`, validate it, inspect its workload/environment coverage and commit it explicitly:

```sh
node benchmarks/run.mjs --profile quick --browsers chromium,firefox,webkit,chrome,edge --output benchmarks/baselines/2026-10-12-quick.json
node benchmarks/schema.mjs --validate benchmarks/baselines/2026-10-12-quick.json
```

A baseline is measured evidence, not a promise that all engines or assertions passed. Do not replace a failed or missing measurement with zeros, fabricate samples, or copy an incompatible run into a passing baseline. Compare future results on the same machine and harness, or rerun both package versions with the updated harness.

The result schema is an allowlist: only fixed workload/assertion IDs, numeric samples/counts, known status/error codes, approved versions and anonymous environment fields are accepted. Results contain no project labels, machine names, package directories, request URLs, raw console output or error stacks. Unexpected fixture fields fail closed. Review both the JSON and the intended public diff before committing a baseline. The machine metadata contains no unique machine identifier but may still distinguish broad hardware configurations.

## Real-GPU frame rates

Headless CI renders WebGL in software, so the frame-rate targets of the optional WebGL renderers are measured
separately on a machine with a GPU. Build first, then run:

```sh
pnpm build
pnpm benchmark:gpu                         # quick profile: graph 10k nodes / 30k edges, 100k points
pnpm benchmark:gpu --profile stress        # graph 30k / 90k, 1M points
pnpm benchmark:gpu --modes gpu --cpu-profile  # adds the hottest main-thread functions per scenario
```

Each mode launches headless Chromium once: `gpu` renders on the host GPU through ANGLE over EGL (with the NVIDIA
EGL vendor file when present), `software` through SwiftShader. `lr-graph` orbits its camera every frame with pinned
positions, so the force layout is excluded; `lr-embedding-explorer` rotates under a pointer drag. Every result
records the WebGL renderer string that drew it, so a software frame never passes as a GPU one, and the share of
animation frames that issued WebGL draw calls, so an idle frame never passes as a rendered one. Results are written
to `benchmarks/gpu/results/`. `--cpu-profile` builds without minification so function names stay readable.

Add `--acceptance-observations` to collect three fresh-page repetitions for each quick workload,
including screenshots, trusted pointer input to WebGL draw submission, and main-thread JavaScript
heap before mounting and after disposal and garbage collection. The graph repetitions also observe
an unpinned worker layout and distinguish convergence from exhaustion of its iteration budget.
Results retain the raw samples and their spread; missing observations fail the command. These
measurements exclude display latency, worker heaps and GPU memory. Screenshots require visual review.

## Validate the tooling

```sh
pnpm test:benchmarks
```

`result.schema.json` is generated from the catalog and schema helper. Regenerate with `node benchmarks/schema.mjs --write` after a schema/catalog change. `schema.mjs --validate` performs additional semantic checks that JSON Schema alone cannot express, such as complete sample counts and required assertions for passing cases.

Runner exits: 0 complete/pass, 1 failed measurement, 2 incomplete/unavailable, 3 setup/options/cleanup failure. Comparison exits: 0 compatible without regression, 1 regression, 2 incomplete/incompatible/explicit override, 3 invalid input. These tools do not replace functional, accessibility, cross-browser or release qualification tests.

The quick and stress profiles include 10,000-record document-library filtering, eval-dataset row
selection, retrieval checkbox selection, and a 5,000-item ingestion progress tick. See the fixture
README for compact inputs, public interaction contracts, nested update settlement, and semantic-only
compatibility checks. These new workloads require a baseline measured with the same fixture bytes;
older result files with a different harness fingerprint are not directly comparable.
