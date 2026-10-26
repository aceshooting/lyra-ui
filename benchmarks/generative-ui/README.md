# Generated UI production measurements

These tools measure Lyra Gen entry points and deterministic application compositions. They do not
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

## Saved-session memory observations

`memory.mjs` exercises bounded generated-view persistence through the existing chat controller,
snapshot helpers and browser view. It generates transport inside each mount call, edits a real
input, activates a local action, saves one presentation archive outside the browser, releases
source, disposes, restores and changes the generated default to verify dirty ownership. Restore
must preserve the synthetic data/prose/edit and emit no action; a second explicit activation proves
the restored action remains usable. Every disposal must leave zero connected fixture children.

```sh
node benchmarks/generative-ui/memory.mjs --cycles=20 --output=session-memory.json
node --test benchmarks/generative-ui/memory.test.mjs
```

The runner alternates persistent-page cycles with fresh controls. Each control launches a separate
Chromium process and has its own post-load baseline. After settlement, every phase requests one
CDP garbage collection and records main-isolate heap, renderer DOM/listener counters and separately
counted connected fixture nodes. Source strings/chunks and old controller/view references are not
kept in fixture history; only current intended presentation and one overwritten host archive remain.

These are raw series and signed changes, including decreases. Main-isolate heap excludes workers,
native/GPU allocations and OS memory. Renderer DOM/listener counters can include disconnected
objects; zero connected fixture DOM does not prove zero detached heap. Module/template caches and
JIT state can remain intentionally. No memory ceiling, heap superiority, leak verdict or confidence
interval is inferred. The fixture covers a generated view/controller with native prose, rather
than the complete chat viewport or arbitrary application storage/security. Keep measured reports
private, identify exact artifact/source hashes, and distinguish loaded smoke from a quiet cohort.

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
Gen replay cases are not enrolled in that gate. A Gen comparison requires an explicitly selected
published Gen baseline and matching compositions. `WORKLOADS` is the scenario registry for a future
built-baseline/candidate comparison. Standalone replay reports do not claim tachometer confidence
intervals or release-gate enrollment.

## Reproduce the full timing and memory profiles

`profile.mjs` covers text, recorded chat, long chat, normal/large views, live/saved dashboards,
static SSR and restoration, the owned A2UI profile, and the SDK integration. Its measurements are
semantic DOM commit followed by two animation-frame opportunities, **not physical display paint**.
Streaming readiness starts at the required input; the separate first-mount interval retains import
and replay cadence. `memory-profile.mjs` covers complete chat/dashboard lifecycles with direct and
adapter admissions, isolated fresh controls, and the large-view observation. Neither contacts a
provider. The earlier replay/session tools above remain separate experiments.

Use the pinned Node, built public UI/Gen exports, already-installed Playwright browsers, and a
frozen source/candidate archive. Keep evidence outside the checkout: reports contain machine and
process identities. All paths below are caller-supplied environment variables. Inspect the fixed
procedures without starting a browser:

```sh
node benchmarks/generative-ui/profile.mjs --plan
node benchmarks/generative-ui/memory-profile.mjs --plan
node --test benchmarks/generative-ui/profile-quiet.test.mjs
```

First write a new built-file inventory and an **unapproved** preflight draft. This reads and hashes
files/executables; it does not build bundles or launch browsers:

```sh
node --input-type=module <<'JS'
import { profileBuildInventory, preflightAuthorizationDraft } from './benchmarks/generative-ui/profile-driver.mjs';
import { writeProfileRecord } from './benchmarks/generative-ui/profile.mjs';
await writeProfileRecord(process.env.PROFILE_BUILD_MANIFEST, await profileBuildInventory());
await writeProfileRecord(process.env.PROFILE_PREFLIGHT_DRAFT, await preflightAuthorizationDraft({
  archive: process.env.PROFILE_ARCHIVE, buildManifest: process.env.PROFILE_BUILD_MANIFEST,
}));
JS
```

Review its source/candidate hashes and all three browser identities before explicitly approving a
separate copy (`authorized:true`). Capture that approved preflight into a new directory:

```sh
node --input-type=module <<'JS'
import { readFile } from 'node:fs/promises';
import { runProfilePreflight } from './benchmarks/generative-ui/profile-driver.mjs';
const controller = new AbortController();
process.once('SIGINT', () => controller.abort()); process.once('SIGTERM', () => controller.abort());
await runProfilePreflight({
  authorization: JSON.parse(await readFile(process.env.PROFILE_PREFLIGHT_APPROVED, 'utf8')),
  archive: process.env.PROFILE_ARCHIVE, buildManifest: process.env.PROFILE_BUILD_MANIFEST,
  output: process.env.PROFILE_PREFLIGHT_OUTPUT, signal: controller.signal,
});
JS
```

This builds the production fixture and captures actual environment/browser versions, one observer
positive control per engine, all ten fixture definitions and prepared input identities. It runs no
workload operation, timing sample or GC. `preflight.json` contains `manifestDraft`; `controls/`
contains the exact content-addressed positive-control receipts. Unsupported observers remain
unsupported, with null raw observations. The collection draft deliberately leaves authorization
false and collection ID, reviewed design digest and quiet receipt unset.

### Linux quiet receipt

`profile-quiet.mjs` observes `/proc` only when explicitly run. Supply an ownership JSON object with
`schemaVersion:1`, the campaign `collectionId`, `monitorOwned:true`, and `roots` containing actual
`{pid,startTimeTicks,role}` entries. Read each dedicated launcher's PID and field 22 start ticks from
`/proc/<pid>/stat` (the exported `parseProcessStat` handles command names containing parentheses).
Do not declare a shared shell/daemon or PID 1 as campaign-owned. Each root must remain alive;
observed descendants are bound to boot/PID/start identity so PID reuse cannot inherit ownership.

```sh
node benchmarks/generative-ui/profile-quiet.mjs --run \
  --collection="$PROFILE_COLLECTION_ID" --ownership="$PROFILE_OWNERSHIP" \
  --review="$PROFILE_QUIET_REVIEW" --output="$PROFILE_QUIET_OUTPUT"
```

The new output directory receives compact per-second samples and an immutable, initially
uninspected `precheck.json`. Review its first 60 intervals and source/ownership identities before
creating the watched review file. That JSON must contain `schemaVersion:1`,
`kind:"quiet-precheck-review"`, the matching `collectionId`, `inspected:true`, `decision:"approved"`,
a real `reviewedAt` timestamp in milliseconds since epoch, and exact `precheckSha256` and
`ownershipSha256` digests. The helper never writes its own approval; a malformed/pending review file
fails, so keep drafts away from the watched path.

The 60 scheduled intervals must span 60–61 actual seconds; jitter outside that bound fails.
Total-host mean CPU must stay below 5%, normalized one-minute load below 0.1, unrelated process
CPU below 0.1 of one core, with no swap I/O or observed unrelated build/browser/provider work.
Owned work remains in total-host CPU/load. Receipts contain fresh rolling observations and a
separate historical reviewed-precheck digest; the driver rejects receipts older than five seconds.
Missing process observations, changed PID identities/review, contamination or interruption stops the
observer and invalidates its receipt. It never kills other processes. Sampling cannot prove the
absence of a short-lived process entirely between polls, and process-name classification cannot
identify every provider task. Atomic receipt replacement is not a crash-durability guarantee.

For a host with a reviewed resident service, the separate `reviewed-idle-service-v1` profile can
admit **zero observed CPU ticks** for that exact process and distinguish kernel-thread coverage
gaps from userspace gaps. Strict mode remains the default. This profile retains the original strict
failures and contamination fields; its separate admission result does not establish a strict pass.
Whole-host CPU, load and swap limits remain unchanged, including service, kernel and owned work.
The per-process limit covers all unrelated userspace processes, including the reviewed service.

Create a configuration outside the checkout using actual observed identities:

```json
{
  "schemaVersion": 1,
  "kind": "quiet-observer-config",
  "profile": "reviewed-idle-service-v1",
  "collectionId": "<collection-id>",
  "bootId": "<actual-boot-id>",
  "scope": {
    "processCpu": "all-unrelated-userspace",
    "kernelCpu": "whole-host-aggregate",
    "coverage": "sampled-userspace-with-explicit-kernel-gaps"
  },
  "idleServices": [
    { "pid": 123, "startTimeTicks": "<actual-start-ticks>", "comm": "<actual-comm>", "cmdlineSha256": "<raw-cmdline-sha256>" }
  ]
}
```

Replace every illustrative identity before use. Read the boot ID from
`/proc/sys/kernel/random/boot_id`, process identity through `parseProcessStat`, and hash the raw
`/proc/<pid>/cmdline` bytes without splitting or reserializing arguments. Review the process and
configuration, then add `--observer-config="$PROFILE_OBSERVER_CONFIG"` to the observer command.
Its exact file SHA-256 becomes `configSha256` in
`quietObserver:{profile,configSha256,scope}`, included in both collection manifests and the manual
precheck review. Use review kind `reviewed-idle-service-precheck-review` with the same collection,
timestamp, approval and precheck/ownership digest fields described above, plus the precheck's
`admissionSha256` for the shared admission module. Retained receipts include the exact UTF-8
configuration text as `admission.configSource`; validation checks its byte digest and parsed
configuration. Configuration creation does not approve the precheck or authorize collection.

The observer rechecks every allowed process at both interval endpoints. Any observed CPU tick,
identity/command change, missing process or overlap with owned work fails admission; descendants
receive no allowance. Kernel classification uses the observed `PF_KTHREAD` flag, never a process
name. Kernel exit gaps remain recorded, and an unknown or userspace coverage gap still fails.
The resulting `reviewed-idle-service-live-receipt` keeps top-level `inspected:false` and exposes
the separately reviewed `admission.inspected` and `admission.accepted` fields. Timing and memory
records retain complete receipts at their existing admission checks, alongside the raw strict
contamination result. Each retained `receiptSource` preserves the original UTF-8 bytes for digest
and parsed-body validation, including refused observations. Strict and reviewed-service manifests
cannot accept each other's receipts.
Zero observed ticks is sampling-resolution evidence, not proof of no GPU, I/O or sub-tick work;
between-scan process changes remain unobservable. Report this scope explicitly with the results.

For disclosed shared-host measurements, select `shared-host-observed-v1` and set
`scope.processCpu` to `all-unrelated-userspace-observational` in the configuration and manifest.
Use review kind `shared-host-observed-precheck-review`; its corresponding precheck and live receipt
kinds are `shared-host-observed-precheck` and `shared-host-observed-live-receipt`. All other
configuration, identity and review steps above apply. This profile records the unrelated userspace
CPU maximum without imposing a per-process ceiling. Whole-host CPU/load/swap limits, zero observed
ticks for the exact reviewed service, other-workload refusal and userspace coverage still apply.
All workload timing, memory, long-task and layout-shift budgets remain unchanged.

Label these results **shared-host observations**, not strict-quiet or reviewed-idle qualification.
The profile can admit background CPU from any otherwise admissible unrelated userspace process;
it is not an exception for one named service. Preserve raw strict failures and all observed load.
The busiest-five diagnostics are not an exhaustive per-process history. Aggregate load and periodic
sampling cannot rule out scheduling, cache, GPU or I/O interference. Profiles cannot be pooled.

After reviewing the preflight, complete the timing manifest with the collection ID, digest of the
reviewed measurement design, and reviewed quiet receipt for the selected profile, then explicitly
authorize collection.
Keep the observer running, and pass its live `receipt.json` and the preflight's `controls` directory:

```sh
node benchmarks/generative-ui/profile.mjs --manifest="$PROFILE_MANIFEST" \
  --quiet="$PROFILE_QUIET_RECEIPT" --controls="$PROFILE_CONTROLS" \
  --archive="$PROFILE_ARCHIVE" --build-manifest="$PROFILE_BUILD_MANIFEST" --output="$PROFILE_OUTPUT"
```

### Separate memory authorization and collection

Create a memory draft through the exported helper below. Unlike the timing preflight draft, this
step builds the memory fixture to bind its actual bundle; it launches no browser or GC. The design
and composition digests identify caller-reviewed specifications. The code independently verifies
the fixed `memoryProfilePlan()`, actual source/build identities and semantic fixture oracles; it does
not verify the contents of a separate composition specification file.

```sh
node --input-type=module <<'JS'
import { memoryAuthorizationDraft } from './benchmarks/generative-ui/memory-profile-driver.mjs';
import { writeProfileRecord } from './benchmarks/generative-ui/profile.mjs';
await writeProfileRecord(process.env.MEMORY_DRAFT, await memoryAuthorizationDraft({
  archive: process.env.PROFILE_ARCHIVE, 'build-manifest': process.env.PROFILE_BUILD_MANIFEST,
  compositionSha256: process.env.MEMORY_COMPOSITION_SHA256,
  collectionId: process.env.PROFILE_COLLECTION_ID, designSha256: process.env.MEMORY_DESIGN_SHA256,
}));
JS
```

After separate review and explicit authorization, run against a matching live quiet receipt:

```sh
node benchmarks/generative-ui/memory-profile.mjs --manifest="$MEMORY_MANIFEST" \
  --quiet="$PROFILE_QUIET_RECEIPT" --archive="$PROFILE_ARCHIVE" \
  --build-manifest="$PROFILE_BUILD_MANIFEST" --output="$MEMORY_OUTPUT"
```

Memory collection uses separate Chromium processes/stores, one bounded external archive and two
GC requests separated by a task for each observation. Main-isolate heap excludes worker, native,
GPU and OS memory; renderer DOM counters can include disconnected nodes. Statistical summaries
and `collected-needs-review` status are scoped observations, not release qualification.

For correctness only, `smokeAuthorizationDraft()` plus `profile-smoke.mjs` exercise the timing
workloads. `memoryAuthorizationDraft(options,{functional:true})` plus
`memory-profile-smoke.mjs` exercise memory lifecycle semantics with a distinct approved smoke
manifest. Both smoke CLIs accept `--manifest`, `--archive`, `--build-manifest` and `--output`;
neither accepts `--quiet` or authorizes numerical collection. Timing smoke discards operation
clocks; memory smoke makes no CDP/GC/heap observations. A passing smoke is not quiet-run evidence,
a budget result or a memory bound. No runner automatically retries failed attempts or approves
its own results.
