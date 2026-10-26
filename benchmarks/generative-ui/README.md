# Generated UI production measurements

These tools measure the experimental Lyra Gen entry points and a local chat replay. They do not
contact model providers, record API latency, certify a memory ceiling, or produce comparative
claims about other products. Run on a quiet machine using the repository's exact `.nvmrc` version.
Keep raw reports from concurrent jobs labelled as smoke evidence rather than qualification.

## Build and check

```sh
nvm use
pnpm --filter @aceshooting/lyra-ui build
pnpm --filter @aceshooting/lyra-gen build
node --test packages/lyra-gen/scripts/measure-bundles.test.mjs benchmarks/generative-ui/run.test.mjs
```

The bundle tool resolves all Lyra library imports through their published `dist/` exports. It uses
production browser conditions, minification, ESM splitting, no source maps, and the repository's
esbuild. It measures `parser`, `runtime`, `chat`, `gen-view`, and the actual
`packages/lyra-gen/examples/chat.ts` composition with the public theme stylesheet. The application
example is compiled by esbuild; its library dependencies come from the built packages. Exported
APIs are retained so a helper entry does not disappear through tree shaking.

## Bundle report and initial budget review

```sh
node packages/lyra-gen/scripts/measure-bundles.mjs --output=bundle-report.json
```

The normal command requires `packages/lyra-gen/scripts/bundle-budgets.json` and fails when the
reviewed baseline is missing, the toolchain/package versions differ, an external import changes,
or an eager/lazy JS, CSS, or asset ceiling is exceeded. Every emitted file has its raw bytes,
independently compressed gzip bytes, phase, and content hash. Eager outputs are the entry's
transitive static import closure, including its CSS bundle. All other emitted chunks are lazy;
CSS embedded in Lit JavaScript remains counted as JavaScript. Shared chunks are counted once.

For the first measured baseline, write a new candidate file for review:

```sh
node packages/lyra-gen/scripts/measure-bundles.mjs --write-budgets --budgets=bundle-budget-candidate.json --output=bundle-report.json
```

Output files must not already exist. Candidate budgets derive exclusively from the measured
production outputs: JavaScript ceilings are `floor(measuredBytes * 1.02)`, CSS ceilings are
`floor(measuredBytes * 1.04)`, and asset ceilings equal their measured bytes. Zero stays zero. The
file retains the actual measurements and policy rationale. Review the candidate before placing
it at the default budget path. Existing ceilings are never automatically raised. No byte totals
are claimed until a real build produces the report.

Optional Lyra UI peers are externalized explicitly, listed under
`optionalPeersExcludedFromBytes`, and every reachable external import is listed per profile.
Their bytes are **excluded** from these package/composition figures. The checker refuses an eager
external import. These reports therefore do not describe the installed size of every optional
engine. The replay uses plain prose and a generated input; it must not request an external peer.

## Synthetic token-cadence replay

```sh
node benchmarks/generative-ui/run.mjs --browser=chromium --workload=chat-form --samples=5 --output=replay.json
node benchmarks/generative-ui/run.mjs --browser=firefox --workload=chat-long-prose --samples=5 --output=replay-firefox.json
node benchmarks/generative-ui/run.mjs --browser=chromium --workload=chat-recorded-cadence --samples=5 --output=recorded-replay.json
```

Chromium, Firefox, and WebKit are supported when their Playwright browsers are already installed.
A missing browser fails the run. The runner builds a minified production browser fixture, serves
only its owned bundle on loopback, blocks outside requests, opens a fresh context per sample,
and cleans up its temporary files. Reports contain generic environment fields and content hashes,
never workspace paths or host names. Reports are written only after all samples pass.

`workloads.mjs` owns deterministic text chunks and synthetic arrival offsets. Actual arrival
lateness is recorded for every chunk. Each case runs both per-chunk host updates and frame
coalescing, with one warmup per mode and alternating mode order. The per-chunk mode intentionally
waits for each render/paint opportunity; it may fall behind the scheduled cadence. This is a
host scheduling experiment, not proof that the renderer itself time-slices work. The final
controller snapshot must hash identically across both modes and all samples.

`chat-recorded-cadence` instead reads the versioned
`packages/lyra-gen/examples/recordings/chat-review.v1.json` recording. Its nine authored chunks
retain their original 0–1,800 ms offsets; `parseReplayRecording()` checks the bounded envelope
before playback. The report marks this cadence `recorded-authored-synthetic`. These offsets are
frozen synthetic fixture data, not a captured model response or observed provider timings.

The report separates:

- First useful committed prose from generated-control readiness; neither measures provider latency.
- Synchronous parser/controller/admission time from render-settling wall time, which includes frame
  waiting and is not a main-thread CPU measurement.
- Actual Lyra update calls, scoped to the fixture, from host update requests.
- Native input-to-next-frame time from initial readiness. Playwright fills the real generated input
  and verifies both its native value and the Lyra control value before disposal.
- CLS session-window maximum and long tasks. Unsupported observer types report `null`, never zero.
- Peak connected DOM nodes, including shadow trees, and nodes remaining after application disposal, before harness cleanup. A Lit comment marker
  can remain; retaining an element fails the run. These
  counts do not detect detached heap retention. Explicit host `releaseSource()` separately records
  logical source characters before/after release and verifies admitted documents and the edited
  control survive. Prose presentation length remains visible in the report; engines may share
  substring backing stores even when the logical transport-source count is zero.

Raw samples are retained. No timing, CLS, long-task or heap threshold is invented by this harness;
qualification requires reviewed budgets and adequate quiet-run evidence. Long-session persistence
and browser heap snapshots remain separate work.

### Cold/warm modules and loading-space variants

The default remains a first composition in a fresh context/page. For matched module-temperature
and loading-placeholder checks, opt in explicitly:

```sh
node benchmarks/generative-ui/run.mjs --browser=chromium --workload=chat-recorded-cadence --samples=7 --temperature=paired --reservation=both --output=replay-cells.json
```

Each scheduling/reservation pair receives a fresh page. Its **cold** composition runs after the
static entry modules have loaded; its **warm** composition repeats in that same page after full
application disposal, preserving the JavaScript module registry. HTTP caching is disabled by
request routing and `no-store` responses. These temperatures describe module reuse, not a cold
machine, navigation-cache experiment, provider prompt cache or model timing.
Delivery byte/request totals cover observed subresources, excluding the HTML document, request
headers and transport overhead; they are not a total network-wire measurement.

The reservation cells use the chat example's existing loading minimum and an explicit zero
minimum. The runner records actual rendered placeholder minima and refuses a `both` run if the
policy never reaches a loading placeholder. Both cells must produce identical final snapshots,
retain a real input edit through source release, and dispose their elements. This does not prove
that a catalog-wide minimum-size policy or an approved CLS budget has been satisfied.

Schema `2` reports preserve every sample, actual chunk arrival offsets, raw layout-shift entries
and long-task durations, initial page delivery and replay-time module requests/bytes. Chromium
also records CDP renderer task, script, layout and style duration deltas around the complete
composition call. Task duration is renderer task wall time, not hardware CPU; the component
setup window is broader than the fixture's parser/observer window. Unsupported counters remain
`null`. Script/layout/style figures overlap task time and must not be added to it. Measurement
instrumentation contributes work, and per-chunk mode deliberately awaits settlement while frame
mode coalesces; mode differences compare those host strategies rather than isolate a renderer
optimization under identical actual arrival times.
Readiness is sampled at render-settling checkpoints; sparse chunk arrivals can delay detection,
so `controlReadyMs` bounds observed readiness rather than timestamping its exact first event.

Summaries reuse the repository's descriptive `count/min/median/nearest-rank-p95/max` aggregation,
keep temperatures and reservations separate, and retain exact paired frame-minus-chunk samples.
At small sample counts, p95 is usually the maximum. No confidence interval, improvement claim,
approved threshold or field percentile is inferred. Keep quiet-machine receipts separate from
shared-load smoke runs and retain raw reports outside the public source tree.

### Matched reducer scaling

`../stream-runtime.mjs` measures only the UI package's provider-neutral text-delta reducer:

```sh
node benchmarks/stream-runtime.mjs --candidate=packages/lyra-ui/dist/ai/runtime.js --samples=7 --output=stream-current.json
node benchmarks/stream-runtime.mjs --candidate=packages/lyra-ui/dist/ai/runtime.js --baseline=baseline/dist/ai/runtime.js --samples=7 --profile=quick --output=stream-paired.json
```

An optional baseline must be an actual built runtime with its relative dependencies. The runner
bundles each supplied artifact with the same esbuild/settings in disposable storage and records
entry, bundle and dependency hashes. Labels alone do not establish a published version: retain
the source/archive receipt separately. A published UI runtime can be a reducer comparator; it
does not create a published Lyra Gen baseline or an end-to-end UI comparison.

Before timing, both artifacts must agree on split-surrogate output, UTF-16 and retained-state
limits, and rejection of a retired generation. Each timed run independently checks exact text,
unchanged initial state and preserved sibling payloads. Identity ratios are measured in separate
runs. Variant order alternates within each workload/sample, including retained fields of
different sizes; no unrelated old timing file is treated as a matched baseline. The full profile
uses 1,000/2,000/4,000 deltas and 0/65,536/262,144 retained characters per metadata/data field.
The quick profile uses 250/500/1,000 deltas and 0/65,536 retained characters. These are reducer
workloads, not browser-focus, total application memory or provider measurements. Raw samples and
descriptive spread support a narrow comparison; they do not supply a confidence interval or
approved performance budget.

## Recorded replay interaction and visual checks

`visual.mjs` bundles the same recorded-replay composition used by Storybook. It checks native
keyboard activation, editing a generated input, a rejected tail retaining the edit, interruption
at an exact chunk boundary, reset while a timer is pending, and disposal. Outside requests and
WebSockets are blocked. Screenshots cover idle, complete, edited/rejected, interrupted and reset
states with fixed viewport, locale, timezone, motion and color scheme. The screenshot comparison
uses the repository's existing PNG comparator and pixel allowance. The completed transcript
follows its scroll anchor, so its leading prose may be outside the viewport.

The retained Chromium images in `visual-baselines/chromium/` were visually inspected by an
agent and compared in their manifest's recorded environment. The manifest states that limited
review scope; it does not imply a human review or a polished product design. The fixture pins the
Arial family through root theme inputs as well as its outer shell. Chromium records the actual
platform font used by a semibold probe in the comparison identity, and the interaction check
asserts the same family/weight/size reaches generated form labels. This prevents an installed
Noto Semibold versus Noto Bold substitution from being mistaken for a component regression.

Capture into a **new** candidate directory, then visually inspect every PNG:

```sh
node benchmarks/generative-ui/visual.mjs --capture --browser=chromium --baselines=visual-candidate --output=visual-capture.json
```

Capture writes `reviewed: false` in `baseline.json` and reports `candidate-needs-review`. Only
after an actual visual review should the reviewer mark the manifest `reviewed: true` and retain
the PNGs as a baseline. The capture tool never reviews its own output. Compare separately:

```sh
node benchmarks/generative-ui/visual.mjs --browser=chromium --baselines=visual-candidate --output=visual-compare.json
node --test benchmarks/generative-ui/visual.test.mjs
```

Comparison refuses an unreviewed manifest, changed recording/environment, altered baseline image
hash or missing case. A mismatch writes current/difference PNGs beside the report path and fails
without a passing report. Existing baseline directories and output files are never overwritten.
Use a separate baseline per browser/environment. These checks cover this bounded synthetic demo;
they do not establish a general visual-quality score, provider benchmark or accessibility audit.

## Tachometer boundary

The existing `benchmarks/ab.mjs` release gate compares published Lyra UI against local Lyra UI.
Lyra Gen is unpublished and has no corresponding published baseline, so these replay cases are not
silently added to that gate. `WORKLOADS` is the reusable scenario registry for a future explicit
built-baseline/candidate comparison. Standalone replay reports do not claim tachometer confidence
intervals or release-gate enrollment.
