# Generative UI evaluation and performance

Status: **tooling and focused qualification implemented; full campaigns pending**. This remains
the qualification plan for the [generative UI delivery sequence](generative-ui.md#delivery-sequence),
not evidence that `@aceshooting/lyra-gen` has shipped or outperforms another framework. The
[delivery backlog](generative-ui-backlog.md) owns implementation scope; the
[website plan](generative-ui-website.md) owns public examples and presentation of results.

Evaluation must answer two different questions: how reliably and economically a system produces a
useful interface, and how efficiently that interface renders and responds after generation. A good
result on one does not establish a good result on the other. Product claims identify the exact
workload, implementation, version, configuration and uncertainty.

## Current implementation and evidence

The experimental implementation now has bounded parsers, runtime/catalog checks, browser workflow
fixtures and a provider-neutral evaluation harness. The inventory below distinguishes these from
the remaining campaign. Final integrated release qualification is pending; no paid model campaign
or human assistive-technology review is claimed.

| Scope | Reproducible source or recorded result | What it does not establish |
| --- | --- | --- |
| Restricted input and semantic correctness | [Markup corpus](../../packages/lyra-gen/test/fixtures/markup.ts), [JSON chunk properties](../../packages/lyra-gen/src/json-stream.property.test.ts), [typed converters](../../packages/lyra-gen/src/converters.property.test.ts), [CLI/semantic oracle fixtures](../../packages/lyra-gen/test/cli.test.mjs) | A fixture pass does not measure model generation quality, provider tokens or browser performance. |
| Composed browser behavior | [Catalog scenarios](../../packages/lyra-gen/test/browser/catalog.test.ts), [composed form accessibility](../../packages/lyra-gen/test/browser/form-accessibility.test.ts), [17 host-navigation cases](../../packages/lyra-gen/test/browser/navigation.test.ts), [chat](../../packages/lyra-gen/test/browser/chat.test.ts), [dashboard](../../packages/lyra-gen/test/browser/dashboard.test.ts) and [saved host workflow](../../packages/lyra-gen/test/host/saved-dashboard.test.mjs) | Focused coverage is not human visual/assistive-technology review or production hosting qualification. Navigation tests stub new-window opening; they do not qualify remote destinations. |
| Stream reduction and offline replay | [Reducer scaling workload](../../benchmarks/stream-runtime.mjs), [bounded recording/replay envelope](../../packages/lyra-gen/src/replay.ts), [production browser replay and visual harness](../../benchmarks/generative-ui/README.md), [bounded evaluation callbacks](../../packages/lyra-gen/src/evaluation.ts) | The retained cadence is explicitly authored synthetic data, not an observed provider response. Fake providers and parse/validate timings are not model latency or cost measurements. |
| Recorded visual states | [Five reviewed Chromium baselines](../../benchmarks/generative-ui/visual-baselines/chromium/baseline.json) and [interaction/comparison harness](../../benchmarks/generative-ui/visual.mjs) | Agent visual review and exact-environment pixel comparison cover this synthetic composition only. They do not establish human design or assistive-technology approval. |
| Catalog and examples | [144-property contract proof](../../packages/lyra-gen/scripts/check-catalog.mjs), [schema profiles](../../packages/lyra-gen/src/prompts.ts), [preset prompt/schema byte report](../../packages/lyra-gen/scripts/fixtures/catalog-preset-prompts.json) and [paired example configuration](../../packages/lyra-gen/src/examples.ts) | Profiles retain explicit unsupported cases. Content bytes are not provider tokens; provider acceptance and task-quality ablations remain unmeasured. |
| Server transport and request context | [Bounded server/client walkthrough](../../packages/lyra-gen/docs/server-transport.md), [executable refusal/cancellation fixtures](../../packages/lyra-gen/test/server-transport.test.mjs) and [preset CLI round trips](../../packages/lyra-gen/test/cli.test.mjs) | The provider is explicitly fake. Local archive smoke does not establish live-provider behavior, published-npm installation or hosting. |
| A2UI reference scope | [State/model/action report](../../packages/lyra-gen/test/fixtures/a2ui/v0.9.1/reference-results.json), [73 catalog-consumer cases per stable/candidate profile](../../packages/lyra-gen/test/fixtures/a2ui/catalog-export-results.json), [18 reference DOM/layout cases](../../packages/lyra-gen/test/fixtures/a2ui/dom/results.json), [5 pinned AG-UI/A2A SDK cases](../../packages/lyra-gen/test/a2ui-bindings.test.mjs) and [reproduction scope](../../packages/lyra-gen/docs/a2ui.md) | Catalog ingestion, DOM comparisons of three examples through six roles and SDK bindings for the owned report host are separate bounded cohorts, not full catalog, pixel, styling, accessibility or protocol conformance. Default advertising stays empty; the state report retains its normative/reference null-update difference. |
| OpenUI importer decision | [Completed pinned experiment](../../packages/lyra-gen/docs/openui-experiment.md), [fixture manifest](../../packages/lyra-gen/scripts/fixtures/openui-experiment.json) and [actual report](../../packages/lyra-gen/scripts/fixtures/openui-experiment-report.json) | Ten classified parser fixtures and one bundle/telemetry setup support a no-go runtime-importer decision, not general import parity or a competitive generation result. |
| Delivery measurement tooling | [Production bundle tool](../../packages/lyra-gen/scripts/measure-bundles.mjs), [versioned measured bundle budgets](../../packages/lyra-gen/scripts/bundle-budgets.json) and [package ceilings](../../packages/lyra-ui/scripts/package-budgets.json) | These byte ceilings do not qualify equivalent competitor builds, browser timing/heap/CLS distributions or a release. Raw campaign evidence remains separate. |

EVAL-01–10 below retain their full acceptance criteria. Outstanding nonconditional measurements
include pinned comparator enrollment, captured delivery schedules, full model/provider identifiers
and approved spending, semantic held-out tasks, cache/thinking settings, provider tokenizer checks,
repair outcomes, browser memory/interaction/CLS distributions and versioned raw evidence bundles.
Unknown measurements remain unavailable; source size and logical retained character counts must
not be relabeled as heap, provider usage or billing savings. The public website consumes the
qualified results in the final workstream.

## Historical exploratory evidence

The following observations motivate experiments. They do not qualify a release or establish a
competitive advantage. Publicly reproducible fixtures and runnable comparisons remain deliverables
below; historical exploratory counts cannot substitute for that evidence.

| Observation | Evidence and boundary | Consequence for the plan |
| --- | --- | --- |
| Compact encodings narrow the token gap. | Counting the seven [OpenUI benchmark samples at the inspected revision](https://github.com/thesysdev/openui/tree/9d73d17d2bbac565672a85e78f6eb7740cb0d9ca/benchmarks) with `o200k_base` gives 4,800 tokens for OpenUI Lang and 5,461 for minified C1 JSON. Synthetic HTML-style projections give 5,314 with self-closing leaves or 5,825 with closing tags; an A2UI-style adjacency-list projection gives 7,261. These are projections of trees, not independently generated or validated runnable interfaces. | Compare syntax separately from component vocabulary, inferred defaults and model behavior. A synthetic A2UI-style projection is not an official protocol benchmark. |
| Three hand-authored proposed Lyra Markup examples use 1,087 compact or 1,185 indented tokens against 1,668 in the corresponding OpenUI samples: about 29–35% fewer. | The examples are proposed catalog encodings, not model outputs. They use compact table/chart adapters, high-level statistics components and inferred types, and omit some explicit chart/style choices. The dashboard accounts for 1,226 of the 1,668 baseline tokens. | Treat the difference as a hypothesis to reproduce using executable, capability-matched catalogs. Publish the adapter/default choices and include per-scenario results. No shipped token advantage is established. |
| Data-bearing lines account for 490 of the OpenUI dashboard's 1,226 tokens. | The [dashboard sample](https://github.com/thesysdev/openui/blob/9d73d17d2bbac565672a85e78f6eb7740cb0d9ca/benchmarks/samples/dashboard.oui) includes binding syntax as well as literal values in those lines. Removing literals cannot recover all 490 tokens for free. | Test references to already available data, including reference identifiers, tool traffic and any necessary prompt context. Compare competitors' query/binding paths as well as literal-data paths. |
| Thinking settings can outweigh serialization differences. | [A2UI format-optimizer baselines](https://github.com/a2ui-project/a2ui/tree/409ded29ccac3eebc541979ae5320771703248e8/eval/iterative_format_optimizer/baselines) cover 51 unique cases on one model; the unbounded-thinking runs have five epochs, or 255 executions per format. Direct JSON has the lowest zero-thinking median latency and higher zero-thinking quality than Elemental; Elemental has the highest observed quality under unbounded thinking. | Preserve thinking settings, validity and quality alongside token/latency results. These observations neither generalize to all models nor isolate the cause of elapsed time. |
| OpenUI's prebuilt browser bundle is substantially larger than individual Lyra imports. | `@openuidev/browser-bundle` 0.2.1 measures 3,230,025 raw JS bytes and 894,449 gzip bytes, plus 38,701 gzip CSS bytes using gzip level 9. Its [bundle package](https://github.com/thesysdev/openui/tree/9d73d17d2bbac565672a85e78f6eb7740cb0d9ca/packages/browser-bundle) includes a broad runtime/component surface. Lyra's [integration measurements](../component-integration.md) list 107.8 KiB for `lr-widget-renderer`, 197 KiB for `lr-message-parts` and 70.4 KiB for `lr-markdown` at 30.2.0, with optional peers external. Shared code makes these sizes non-additive. | Measure equivalent production applications, including exercised optional peers, CSS, assets and lazy chunks. Do not infer a first-load winner from these unequal artifacts or from npm unpacked sizes. |
| The structural A2UI-like helper does not accept native protocol payloads. | Each of the 43 official v1.0 basic-catalog examples at the [inspected A2UI revision](https://github.com/a2ui-project/a2ui/tree/409ded29ccac3eebc541979ae5320771703248e8/catalogs/basic/v1/examples) yields no document from `adaptA2UiSurface`, which expects `type`/`props` records rather than the protocol's `component` discriminator with inline properties. v0.9.1 inputs were not tested. | Keep the helper's documented scope explicit and qualify a versioned processor with its own conformance cohorts instead of extending the structural helper. |
| The existing reducer revisits accumulated message content on each text delta. | In the [30.2.0 reducer](https://github.com/aceshooting/lyra-ui/blob/7e47b23e71a8c8382aa614004ffc579c4f79487a/packages/lyra-ui/src/ai/runtime.ts), `message-part-delta` calls `ownedMessage`; the [snapshot helper](https://github.com/aceshooting/lyra-ui/blob/7e47b23e71a8c8382aa614004ffc579c4f79487a/packages/lyra-ui/src/ai/snapshot.ts) recursively copies collections and UTF-8-encodes strings. Constant-sized deltas therefore cause quadratic cumulative rescanning of growing text, within configured limits. Unchanged parts also receive new object identities. | Establish representative scaling and browser baselines, then remove retained-payload rescanning while preserving ownership, resource accounting and replay contracts. The real user-visible cost is not yet measured. |

## Two comparison cohorts

### Generation pipelines

Compare a complete, named configuration rather than a brand, protocol or syntax alone. Before the
first campaign, each comparator gets an executable adapter, a pinned commit and package versions,
the official prompt-generation path where available, its component catalog, and a documented
capability matrix. An unavailable or incompatible comparator is recorded as excluded with a reason;
it is never assigned zero latency, zero quality or an invented failure rate.

| Comparator | Exact comparison surface to qualify | Boundary to disclose |
| --- | --- | --- |
| OpenUI | OpenUI Lang parser, prompt generator, one named renderer and a specified catalog. Begin from the [inspected source revision](https://github.com/thesysdev/openui/tree/9d73d17d2bbac565672a85e78f6eb7740cb0d9ca); record the actual production packages used by the campaign. | Separate the default component-library product from a capability-matched custom catalog. Include supported `Query`, state and edit paths for corresponding scenarios, not only full literal regeneration. |
| A2UI reference renderer | A named agent/generator plus the official web renderer, exact protocol version and catalog from the [inspected A2UI revision](https://github.com/a2ui-project/a2ui/tree/409ded29ccac3eebc541979ae5320771703248e8). | A2UI is a protocol, not a single inference engine. Qualify stable v0.9.1 separately from v1.0 work; a schema or candidate specification alone does not establish renderer support. Keep reference-renderer and Lyra-renderer results distinct. |
| json-render | A pinned [`@json-render/core` and named web renderer](https://github.com/vercel-labs/json-render), official catalog/prompt construction, chosen stream format and registered components. | A mechanical JSON-Patch projection in someone else's benchmark does not evaluate json-render's own generation pipeline. Record built-in versus custom component choices. |
| Tambo | A pinned [self-hostable Tambo backend and React SDK](https://github.com/tambo-ai/tambo), registered components, model/provider configuration and conversation execution path. | Count backend orchestration and network costs. Verify deployment availability before enrollment; do not make qualification depend on continued availability of a hosted service. |
| Hashbrown | Pinned [core, one React or Angular integration, provider adapter and registered component kit](https://github.com/liveloveapp/hashbrown). | Report the chosen framework and schema/streaming mode. Generated-code execution is a separate trust/capability tier and cannot silently replace constrained composition. |
| CopilotKit | A pinned [CopilotKit frontend and specified agent/runtime](https://github.com/CopilotKit/CopilotKit), using one declared generative UI path. | Distinguish fixed tool-rendered UI, declarative composition and open-ended generation. AG-UI transport alone is not a competing generation format. If the path uses A2UI, identify the shared protocol/backend rather than presenting it as an independent format result. |

Run two catalog conditions where supported: common primitives with matched semantics, and each
system's best supported higher-level components. Report them separately. Map required labels,
validation, chart semantics, data types, defaults, layout behavior, actions and editable state before
comparing outputs. Do not compensate for unsupported behavior with hidden application code; disclose
adapters and count their bytes and runtime cost. Give every implementation comparable prompt-tuning
effort and worked examples, and preserve its actual prompt rather than forcing one system's grammar
instructions onto another.

### Dashboard rendering and interaction

Use capability-matched production baselines for dashboards independently of model generation. The
baseline can be a hand-authored Lyra application, a qualified competing renderer with the same
scene, or a named specialist table/chart/layout implementation. Select and pin the actual packages
after the capability review; a generic framework name is insufficient. A hand-authored baseline
measures generative-runtime overhead and must not be presented as a competing generation product.

All paired runs use identical data, visible rows/series/points, filtering and aggregation semantics,
update cadence, responsive allocation, accessibility obligations and caching policy. Match
virtualization, animation and chart rendering settings or disclose why they cannot match. Include:

- Initial mount and resize of small, representative and stress dashboards.
- Table sort/filter/page/selection and chart hover/selection, including synchronized cross-filtering.
- Form edits, validation, submit and cancellation while updates continue.
- Live data replacement and append, bursts, stale/out-of-order results and reconnect/resume.
- Layout changes, panel removal, follow-up patches, undo and persistence round trips when supported.
- Saved dashboards reopened inside a host application without a model call; draft, published and
  shared versions exercised by distinct viewers and editors.
- Long sessions with bounded history, disposal and repeated mount/unmount cycles.

Unsupported advanced capabilities remain outside that paired comparison, with explicit exclusions.
They may have separate product-quality tests; dropping their cost from only one side invalidates a
comparative claim.

For saved/shared dashboards, retain a host-integration fixture with at least two users, viewer and
editor roles, and separate tenants. Verify read, edit, publish, share and remix authorization at the
host boundary, including denied operations and permission revocation. UI affordances do not prove
access control. Persist the document/version and allowed references without embedding credentials
or another user's tool results; refresh data under the viewing user's authorization. Reopening must
restore the saved interface without regeneration, and its measured cost must include validation,
migration, module loading and any authorized data refresh.

Exercise stale-revision rejection and an explicit recovery path under optimistic concurrency.
An intervening edit or live update must not silently overwrite another user's work or turn a
published revision into a moving draft. Test cross-version stored-document migrations, unsupported
versions, missing components and rollback/fallback behavior. Concurrent interaction/update tests
cover focus, unsaved local edits, selection, visible revision identity and correct refreshed values.
Real-time collaborative editing is optional later work with separate convergence, conflict and
resource tests; ordinary save/share qualification does not establish it.

## Scenarios and correctness oracle

Start with the seven public OpenUI scenarios and a reviewed selection of official A2UI examples,
then add original synthetic chat tasks: mostly prose with one widget, grounded tool-result tables
and charts, a validated form, follow-up edits, interruptions, localized numbers and dates, and
multiturn state. Dashboard scenes extend the same data fixtures. Hold out scenarios from prompt
tuning and report familiar versus held-out results separately.

Each scenario defines required facts, units, ordering, permitted approximations, actions, state
transitions and useful partial states. A parse or schema pass is insufficient: a beautifully rendered
chart with wrong numbers fails semantic correctness. Use deterministic checks for data and actions,
and a documented rubric for usability and presentation. Human review of a representative blinded
sample calibrates any model judge; record judge version, disagreements and adjudication. Do not let
an average quality score conceal a harmful action or incorrect grounded value.

Exercise composition accessibility, not just individual component axe results: accessible names
and relationships, keyboard order, focus and selection preservation, form errors, announcements,
screen-reader reading order, contrast, zoom/reflow, narrow allocation, RTL and reduced motion.
Streaming and repair must not steal focus, discard user edits, repeatedly announce unchanged content
or make a previously usable control inert without an explained state transition.

The failure corpus includes malformed/truncated tokens, duplicate or dangling IDs, unsupported tags,
invalid types/enums, oversized/nested payloads, Unicode boundary splits, failed component/peer loads,
stale async completions, malformed tool data, transport loss and cancellation. Preserve valid,
independent content where the failure can be safely isolated; reject an unsafe subtree or whole
document when the contract requires it. A wholly invalid input needs a localized actionable fallback,
not fabricated UI. Report partial preservation, blank/error states and retained prior state separately.

## Measurement contract

Use request submission as the end-to-end clock origin and a shared monotonic clock for client events.
Record server/provider timing separately when clocks cannot be synchronized. Define instrumentation
before collecting results; screenshots alone cannot prove when controls became usable.

| Metric group | Required measurements and interpretation |
| --- | --- |
| First response and useful view | Time to first model token, first visible paint and **first useful view**. The scenario oracle defines useful content; a skeleton, spinner or empty shell does not qualify. Record token arrival, parse availability, module readiness, render commit and paint boundaries. |
| Usable interface | **Time to usable UI** means the required controls and data for the scenario are painted, enabled and pass an interaction probe. Record final completion separately so progressive usefulness is visible. Include repair time in end-to-end results. |
| Tokens | Input tokens separated into cached/uncached portions where the provider exposes them; UI-generation tokens, other visible output tokens, reasoning tokens and all repair/follow-up/tool turns. Retain provider totals and tokenizer estimates separately, with tokenizer/version and unavailable counters marked unknown. Do not double-count reasoning tokens already included in a provider total. |
| Cost | Cost per attempted task and per semantically successful task, including failed attempts, retries, repair, tool/backend charges where applicable, and cache discounts. Pin price date, currency and pricing inputs; disclose excluded hosting or service costs. |
| Reliability and quality | First-pass schema and semantic validity, final semantic success, blank/error rates, useful partial-render rate, repair frequency/attempts/tokens/latency and preserved state. Report unsupported cases, cancellations, timeouts and refusals separately and retain the denominator. |
| Client CPU and responsiveness | Parse, validate, resolve, reconcile/render and event-handler time; total main-thread CPU; long-task count, maximum and duration distribution; interaction-to-paint latency during streaming and live updates. Report layout/paint separately where measurable. Browser limitations in attribution remain visible. |
| Memory and retention | Peak and retained memory, raw stream/persistence buffers, retained UI nodes and disposal behavior. State whether measurements cover JS heap, workers, GPU or whole process; a main-realm heap sample is not total memory. |
| Delivery and payload | Raw and compressed JS/CSS, exercised peers and assets, initial critical requests, lazy chunks, parse/execute cost, wire bytes for model/tool/UI updates and cache behavior. Use one compression tool/version/settings for pairs and include both cold and warm loads. |
| Visual and interactive stability | Layout shift, focus/selection/scroll continuity, edited form values, local interaction latency, live-update freshness and follow-up patch cost. Check correctness after every measured transition. |

Report per-scenario and per-model distributions, not only an overall weighted total. Include actual
sample counts, failures, median and tail measures with uncertainty. A five-run pilot may diagnose
instrumentation, but cannot justify precise per-scenario p95 estimates or a one-percentage-point
validity claim. Choose campaign size from pilot variance, the intended effect size and uncertainty
tolerance; predeclare confidence intervals, success denominators, timeout handling and stopping
rules. Resample/compare at the independent run and scenario level as appropriate, accounting for
repeated cases. Do not obtain a favorable result by retrying failures or discarding slow runs.

Randomize or interleave paired run order to limit provider-load and thermal effects. Separate
generation randomness from repeated browser replay. Pin supported model revisions, provider,
region, temperature, thinking/output limits and tool configuration; unsupported settings are
explicit mismatches. Evaluate the selected Opus, Astra, Sonnet and Luna lineup for the first
production chat claim, with exact identifiers and explicit availability exclusions as defined
below. Distinct selected models do not imply distinct model families. Model drift triggers a new
campaign, not silent replacement of a historical model name.

## Replay, reproducibility and publication

Three modes have different purposes and separate results:

1. **End-to-end generation:** each system receives the same task and data access under its own
   qualified prompt/catalog. Capture its actual output, timestamps and provider usage.
2. **Format-specific controlled replay:** replay semantically equivalent traces in each format
   with declared schedules, chunk boundaries and bandwidth limits. The literal bytes cannot be
   identical across incompatible languages. Preserve natural recorded schedules as one condition
   and normalized timing/chunk conditions as another; do not hide an advantageous ordering.
3. **Render-only scenes:** feed a shared normalized scene/data/interaction specification through
   disclosed adapters to each renderer, excluding generation and parsing where intended. This
   isolates rendering but does not measure an entire generation product.

Retain a manifest with source revisions, lockfiles/package integrity, build flags and production
mode, catalog/schema/prompt hashes, model configuration, fixtures/seeds, raw streams and usage,
browser/OS versions, hardware, viewport/device scale, locale/direction/theme, network/cache state,
CPU throttling and instrumentation versions. Record real constrained-device results separately
from desktop CPU-throttle simulations. Run Chromium, Firefox and WebKit; label engine-specific
observability gaps rather than filling them with another engine's numbers.

Published evidence includes the runnable harness, licenses/provenance, synthetic datasets,
prompts, configuration, aggregate and per-case results, failures and a clear reproduction command.
Review artifacts for secrets, credentials, personal/customer data, private endpoints and hidden
provider metadata before publication. Use publishable synthetic inputs from the outset; do not
publish private production conversations as benchmark examples. Observability is opt-in and local
by default, with explicit export and retention controls. No automatic installation/runtime telemetry
or background uploads are needed for the benchmark. Recorded replay and live paid-model execution
must be distinct commands with explicit budget limits.

## Selected models and spending control

The selected evaluation lineup is **Opus, Astra, Sonnet and Luna**. These are planning names, not
assumed provider API identifiers or immutable versions. Before a campaign, resolve each to an
available provider/model identifier and record the exact version, endpoint, reasoning settings,
sampling parameters, output limits, pricing date and cache behavior. If access is unavailable,
record the exclusion instead of silently substituting another model. Compare each implementation
within each model configuration; publish per-model results rather than hiding differences in one
aggregate. This evaluation lineup does not automatically select the public demo's provider.

The monetary budget is **not yet set**. Prepare a costed pilot before paid execution, with a total
ceiling, per-model allocation, scenario/repetition counts, repair allowance and stop conditions.
Estimate cost from the pinned current prices and expected input/output/reasoning usage; include
retries and failed generations in actual spending. Enforce request, token and cost caps in the
harness, stop before exceeding the ceiling, and retain usage receipts without credentials. Use
the pilot's variance and error rates to size the full campaign within a separately agreed ceiling.
Recorded replay and browser-only qualification can proceed independently of paid model runs.

## Optimization order and preserved contracts

Baseline first, then change one mechanism at a time. Use the existing
[benchmark directory](../../benchmarks/) and the authoritative
[quality/release gates](../agents/ci-and-gates.md) for library regressions, with companion-specific
qualification added to the companion. A prototype result does not replace exact-release evidence.

1. **Retained-message work.** Measure the [reducer](../../packages/lyra-ui/src/ai/runtime.ts),
   [snapshot accounting](../../packages/lyra-ui/src/ai/snapshot.ts) and
   [message-parts rendering](../../packages/lyra-ui/src/components/conversation/message-parts/message-parts.class.ts)
   across growing text, sibling widgets, history sizes and chunk sizes. Target removal of repeated
   retained-payload traversal and stable identities for unchanged parts. Strict O(delta) for the
   whole reducer is not established by encoding only the delta: map/array copying, lookup,
   immutable string materialization and consumers can still scale with retained state.
2. **Ownership and accounting.** Preserve input snapshot isolation, rejection of accessors/cycles,
   resource ceilings, generation/cursor replay and cancellation semantics. Define immutable-state
   ownership before trusting cached identities or byte counts. UTF-8 accounting must handle a
   surrogate pair split across deltas: separately encoded halves count six bytes while the joined
   pair counts four. Test boundary accounting and snapshot/restore equivalence, including failures.
3. **Data and prompt economy.** Measure tool-result references, generated catalog subsets, stable
   cacheable prompt prefixes, higher-level components and thinking budgets. Compare against
   competitors' cached queries and data bindings with the same permissions and availability.
   References must not gain an apparent token win by omitting required grounding or authorization.
4. **Progressive work and loading.** Evaluate frame coalescing, bounded work slices, lazy component
   loading and reserved layout space. Measure the tradeoff between first useful view, total work,
   input latency and layout shift. Do not mark a task complete merely because its work was deferred
   beyond the measurement window.
5. **Session retention and advanced execution.** Bound retained streams and dispose resources after
   persistence/removal under a documented restore contract. Consider worker or WebAssembly parsing
   only if profiling identifies a meaningful bottleneck and includes transfer/startup overhead.
   Another parser's microbenchmark cannot settle this decision for Lyra's full pipeline.

## Deliverables and milestone gates

Every item below is open. EVAL identifiers own evaluation deliverables; PERF/TEST references map to
the [implementation backlog](generative-ui-backlog.md) without creating a second implementation
inventory. Stages follow foundations (0), chat (1), interoperability (2), dashboards (3) and advanced
capabilities (4).

| ID | Stage | Deliverable and acceptance evidence | Backlog alignment |
| --- | --- | --- | --- |
| EVAL-01 | 0 | Reviewed scenario/capability matrix, public synthetic fixtures, semantic oracle and explicit comparator enrollment/exclusion records. Pin the initial versions and define useful/usable UI before running a pilot. | PERF-03, TEST-02 |
| EVAL-02 | 0–1 | Capture and deterministic replay harness with token/timing metadata, format-specific schedules and normalized render-only scenes. A replay reproduces final data/actions and failure classifications; timing provenance is retained. | PERF-01, PERF-02 |
| EVAL-03 | 0–1 | Baseline streaming and reducer scaling, including sibling widgets, Unicode boundaries, cancellation, retained limits and stable focus. Optimization is accepted only with equivalent semantics and measured improvement on the targeted workload; other regressions remain disclosed. | PERF-01, PERF-04, TEST-01 |
| EVAL-04 | 1 | Opus, Astra, Sonnet and Luna campaign with pinned available identifiers and a defined spending ceiling, covering matched and higher-level catalogs, held-out scenarios, provider token cross-checks, prompt caches and thinking settings. Publish per-model semantic quality, repair and cost with adequate sample sizes and uncertainty; disclose exclusions. | PERF-03, PERF-05, PERF-06, TEST-04, TEST-05 |
| EVAL-05 | 1 | Equivalent production-build delivery measurements and versioned composition budgets for initial and lazy JS/CSS/peers/assets; cold/warm replay with reserved layout-space checks. | PERF-07, PERF-08, PERF-09 |
| EVAL-06 | 1–2 | Three-engine composition/accessibility and fault-injection corpus, including partial-content preservation, safe rejection, form/state continuity, locales/RTL and visual states. Per-state artifacts support the semantic checks. | TEST-01, TEST-02, TEST-03 |
| EVAL-07 | 2 | Protocol/version-specific conformance traces and reconnect/state round trips, with official reference-renderer results separated from Lyra adapter results. Long-session retention and disposal are measured. | PERF-02, PERF-10, TEST-01, TEST-02 |
| EVAL-08 | 3 | Dashboard cohort with matched data and operations, hand-authored overhead baseline, live updates, interaction latency, memory and follow-up/undo correctness. Saved/shared host fixtures cover viewer/editor and tenant boundaries, publish/remix, stale-revision conflicts, viewer-authorized refresh, version migrations and reopening without generation. Publish capability exclusions and scale limits. | PERF-01, PERF-02, PERF-08, PERF-10, TEST-01, TEST-02, TEST-03 |
| EVAL-09 | 4 | Separate qualification for remote execution, optional format imports and advanced app workflows: trust boundaries, lifecycle/resource limits, export/persistence fidelity and any additional measured overhead. | TEST-01, TEST-02, TEST-04 |
| EVAL-10 | 1–4 | Versioned evidence bundle and public claims review for every release; website replays link to exact results and mark live versus recorded behavior. Changed models, catalogs, parsers or runtime paths trigger the affected campaign. | PERF-03, TEST-04, TEST-05 |

**Stage 0 go/no-go:** a vertical slice must demonstrate real model output, deterministic replay,
semantic checks and reproducible instrumentation. Revisit the grammar/catalog if errors repeatedly
require ambiguous interpretation, insecure repair or hidden application-specific logic. Complete
the pilot before committing to production estimates or comparative targets.

**Stage 1 go/no-go:** the chat contract must pass semantic, safety, accessibility and three-engine
qualification with bounded failures and retained useful content where safe. Approve absolute budgets
for representative configurations after measuring the pilot: first useful/usable UI, responsiveness,
retained memory, payload size and cost per successful task. Record the numerical limits, device and
workload before the qualifying campaign. Baseline-relative regression limits supplement those
budgets. An arbitrary target such as half a competitor's CPU or 40% of its bundle size is an
exploratory aspiration, not a release gate or promised win.

**Stage 2 go/no-go:** each claimed protocol/version has conformance and lifecycle evidence. A working
schema adapter alone does not qualify the session, actions, state synchronization or reconnect path.
An unqualified candidate protocol remains experimental and does not inherit the stable version's
result.

**Stage 3 go/no-go:** live updates and local interaction remain correct and within approved budgets
under the published scale envelope. Focus, user edits and prior valid data survive recoverable
failures. Persistent growth, wrong results or responsiveness outside the budget block the relevant
claim even if initial rendering is fast.
Saved/shared delivery additionally requires authorized host persistence, tenant isolation and
revision-conflict evidence. No-generation reopening and viewer-authorized refresh must pass without
relying on the original creator's session or credentials.

**Stage 4 go/no-go:** advanced features require their own threat model, executable contracts and
qualification. Success of constrained chat composition does not qualify code execution or exports.

No stage needs to beat every comparator to be useful. Publication distinguishes a product release,
a regression pass and a statistically supported comparative claim. Report mixed outcomes and
unresolved limitations; do not turn an average into a universal speed or quality multiplier.

## Effort and re-estimation

The initial broad implementation sizing spans approximately **65–100 conventional engineer-weeks**,
including package/runtime work, chat integration, interoperability, dashboards, advanced features,
docs and qualification. The underlying broad workstream totals are 4.5 + 19–30 + 16.5–25 +
25.5–36.5 = **65.5–96 engineer-weeks**; rounding expresses planning uncertainty, not a schedule.
The last original scope block includes work now separated between dashboard stage 3 and advanced
stage 4, so those numbers are not allocations for the current five-stage sequence.

This is not the minimum chat MVP estimate, an evaluation-only estimate or a release deadline.
Scope the vertical slice first; after the pilot, re-estimate the critical path and each accepted
capability using actual integration, review, model-campaign and cross-engine costs. Re-estimate when
protocols, security boundaries or product requirements change. No fixed two-engineer multiplier or
AI throughput multiplier is assumed. Reviewer availability, paid evaluation budgets and model
iteration remain separate constraints.
Persistent storage, access control, tenant integration and sharing policies belong to the host;
their effort varies with the existing backend. The broad range does not silently include an
unlimited hosted sharing service or real-time collaborative editing. Scope and estimate those
integrations separately while including their browser-facing contracts in dashboard qualification.

The [website workstream](generative-ui-website.md) has a separate provisional **3–5 engineer-week**
allowance for its initial scope; it is not included in the 65–100 range and must be re-estimated
against its own deliverables. Shared fixtures, documentation and evidence publishing need an owner
to prevent counting the same work twice.
