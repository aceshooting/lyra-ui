# Generative UI delivery backlog

This public capability backlog accompanies the [architecture and staged roadmap](generative-ui.md),
[evaluation and qualification strategy](generative-ui-evaluation.md), and
[website release plan](generative-ui-website.md). Implementation and focused qualification are
underway. The snapshot below links actual source and remaining limits; the detailed rows retain
their full acceptance criteria and are not a blanket completion or release claim. Experiments and
deferred capabilities remain labeled explicitly. Priority applies within the stated stage, not
as a calendar estimate.

`@aceshooting/lyra-gen` is published as the stable 1.0.0 companion in `packages/lyra-gen`. It depends on the
qualified public Lyra UI surface; `lyra-ui` never imports it. Lyra Markup is a restricted,
validated model-facing syntax, not permission to render arbitrary HTML. Stable widget-v2
contracts remain fail-closed. Any future opt-in safe-region recovery (not part of 1.0) must never override identity, security or
resource boundaries, and generated controls require independent composition-level accessibility qualification.

Stages are **0 foundations/evidence**, **1 useful chat**, **2 interoperability**,
**3 persistent dashboards**, and **4 advanced/demand-gated**. P0 blocks the stage's release,
P1 is core planned delivery, P2 follows the qualified core, and P3 needs explicit demand or
experimental evidence. Stage ranges describe staged qualification, not permission to skip an
earlier gate. A dependency names a capability prerequisite; it does not mark that prerequisite done.

The useful-chat release includes the website and replay playground. Evaluation and website
work have their own detailed entries in the linked chapters; this backlog retains the related
cross-cutting deliverables without duplicating those chapters' identifiers. Existing extension
hooks are reused before adding new APIs. A Lyra-owned A2UI processor is the selected direction;
supporting dependency selection and the Markup parser remain evidence-based decisions. Lyra Gen
takes priority over new lyra-3d and lyra-docs features while maintenance continues.

## Current implementation snapshot

This is a source inventory for the 1.0.0 release, not its acceptance checklist.
Focused Node, type, catalog and browser checks exist and have been exercised; final integrated
qualification remains pending. Test code links describe coverage, while committed experiment
reports describe only their explicitly measured scope. The [package guide](../../packages/lyra-gen/README.md)
owns current API usage and the [compatibility policy](../../packages/lyra-gen/docs/compatibility.md)
defines stable-release criteria.

| Backlog area | Current implementation and scoped evidence | Remaining boundary |
| --- | --- | --- |
| FIX-01–06, FIX-08–12 | [UI adapters](../../packages/lyra-ui/src/ai/adapters/), [message-part integration](../../packages/lyra-ui/src/components/conversation/message-parts/message-parts.test.ts), [incremental reducer tests](../../packages/lyra-ui/src/ai/runtime-incremental.property.test.ts), companion structured values and diagnostics | Stable widget-v2 defaults remain unchanged; fair scaling and final regression qualification remain separate. |
| CAT-01–07, CAT-09–12; DX-05 | [Reviewed catalog](../../packages/lyra-gen/src/catalog.ts), [144-property contract proof](../../packages/lyra-gen/scripts/check-catalog.mjs), [presets and CLI context selection](../../packages/lyra-gen/docs/catalog-presets.md), [typed catalogs](../../packages/lyra-gen/src/typed-catalog.ts), [schema profiles](../../packages/lyra-gen/src/prompts.ts) and [task examples](../../packages/lyra-gen/src/examples.ts) | Concrete generic/adapter proofs retain their declared modes. Provider schema acceptance, few-shot quality ablations and provider token results remain separate; byte reports are not token measurements. |
| FMT-01–09, FMT-12; IDEA-05 | [Restricted grammar](../rfcs/0006-lyra-markup.md), [Markup corpus](../../packages/lyra-gen/test/fixtures/markup.ts), [JSON streams and keyed templates](../../packages/lyra-gen/docs/structured-input.md), source ranges, scoped patches and safe emitter | Whole documents commit after validation; fenced islands commit independently. Raw-block detection, expression execution and guessed identities are unsupported. |
| OpenUI experiment (FMT-11) | [Pinned OpenUI experiment](../../packages/lyra-gen/docs/openui-experiment.md) with reproducible parser, classification, license, telemetry and bundle observations | Experiment completed with a no-go runtime-importer decision. Conditional importer delivery remains unimplemented. |
| RUN-01–14 | [Keyed renderer and cooperative preparation](../../packages/lyra-gen/docs/rendering.md), [runtime/state tests](../../packages/lyra-gen/src/runtime.test.ts), [form/readiness browser tests](../../packages/lyra-gen/test/browser/gen-view.test.ts), [stored-answer migrations](../../packages/lyra-gen/docs/stored-answer-migrations.md), host references/functions and native templates | Renderer readiness is not remote-data readiness. Admission and atomic commit remain synchronous. Static server snapshots use explicit client restoration, not in-place hydration. |
| CHAT-01–09 | [Controller and browser composition](../../packages/lyra-gen/docs/interactive-chat.md), [real chat workflow tests](../../packages/lyra-gen/test/browser/chat.test.ts): scroll, input/focus, interruption, suggestions, sources, provenance and panel movement | No model transport is bundled. Logical source release is implemented; retained heap measurements and human assistive-technology review are separate. |
| DASH-01–07, DASH-09–23 | [Live grid example](../../packages/lyra-gen/examples/dashboard.ts), [shared filters/drilldown/paging composition](../../packages/lyra-gen/docs/dashboard-composition.md), [grid/data/export browser cases](../../packages/lyra-gen/test/browser/dashboard.test.ts), [saved HTTP host](../../packages/lyra-gen/examples/saved-dashboard/README.md) and [multi-session host test](../../packages/lyra-gen/test/host/saved-dashboard.test.mjs) | The loopback host exercises file-backed persistence and fixture permissions, not production identity or hosting. Large-data performance and full workload qualification remain separate. |
| IOP-01, IOP-03–05 | [Owned stable A2UI profile](../../packages/lyra-gen/docs/a2ui.md), [browser lifecycle](../../packages/lyra-gen/test/browser/a2ui.test.ts), [state/model/action report](../../packages/lyra-gen/test/fixtures/a2ui/v0.9.1/reference-results.json), [73 catalog-consumer cases per stable/candidate profile](../../packages/lyra-gen/test/fixtures/a2ui/catalog-export-results.json), [18 DOM/layout comparisons](../../packages/lyra-gen/test/fixtures/a2ui/dom/results.json) and [5 pinned AG-UI/A2A SDK cases](../../packages/lyra-gen/test/a2ui-bindings.test.mjs) | Catalog ingestion, the six-role DOM projection and SDK bindings for the owned report host do not establish full catalog, styling, accessibility or protocol conformance. The state report records a normative/reference divergence. Wider bindings remain unqualified; default advertising stays empty. |
| FIX-07, IOP-06–07 | [MCP host SDK tests](../../packages/lyra-ui/src/components/agent-tools/mcp-app/mcp-app-sdk.test.ts), capability/resource/lifecycle cases, and [pinned AI SDK integration](../../packages/lyra-gen/docs/ai-sdk.md) | MCP supports a declared host profile, including inline display fallback; omitted capabilities are not full protocol conformance. The SDK integration names its tested version and paths. |
| REL-01–05 | [Structured diagnostics and bounded repair](../../packages/lyra-gen/src/repair.ts), [cancellable host repair, narrow JSON completion and local category reporting](../../packages/lyra-gen/docs/recovery-and-diagnostics.md), revision guards and visible localized fallback | Strict rejection remains the default. Completion never guesses values, enums or identities; provider-backed repair success and broader coercion are not established. |
| PERF-01–10; EVAL-01–08 | [Reducer workload](../../benchmarks/stream-runtime.mjs), [offline replay/evaluation harness](../../packages/lyra-gen/src/evaluation.ts), [production delivery tools](../../benchmarks/generative-ui/README.md), [measured bundle budgets](../../packages/lyra-gen/scripts/bundle-budgets.json) and [package ceilings](../../packages/lyra-ui/scripts/package-budgets.json) | Cadence is authored synthetic data. Provider captures, retained-heap evidence, equivalent competitor builds, model/cache/thinking/tokenizer campaigns and final release qualification remain separate. |
| A11Y-01–06; TEST-01–03 | [Populated catalog/keyboard/theme tests](../../packages/lyra-gen/test/browser/catalog.test.ts), [composed form accessibility](../../packages/lyra-gen/test/browser/form-accessibility.test.ts), [locale/RTL/fault tests](../../packages/lyra-gen/test/browser/qualification.test.ts), [numeric/date locale fixtures](../../packages/lyra-gen/test/browser/locale-formatting.test.ts), reduced motion and workflow suites | Five agent-reviewed synthetic replay baselines provide bounded visual regression coverage. They do not establish human visual or assistive-technology review; final integrated three-engine qualification remains pending. |
| SEC-01–06; GOV-01–04 | [Scoped field-purpose and URL policies](../../packages/lyra-gen/docs/security.md), [17 host-navigation cases](../../packages/lyra-gen/test/browser/navigation.test.ts), [composed threat matrix](../../packages/lyra-gen/docs/threat-matrix.md), bounded data admission, confirmations and [experimental stability criteria](../../packages/lyra-gen/docs/compatibility.md) | Generic text can still deceive. Navigation tests stub opening; redirects and native media delivery require host controls. Trusted callbacks and release artifact review retain their own obligations. |
| DX-01–04; IDEA-06 | [Server/client transport and local archive smoke](../../packages/lyra-gen/docs/server-transport.md), [preset CLI/report guide](../../packages/lyra-gen/docs/catalog-presets.md), typed examples, [recorded replay story](../../.storybook/GenerativeUI.stories.js) and [coding-agent companion guide](../../plugins/lyra-ui/skills/lyra-ui/lyra-gen.md) | Fake-provider transport and synthetic replay do not establish live-provider behavior, published-npm installation or production hosting. The demand-gated Python consumer fixture remains separate. |
| DX-07; SITE-01–20 | Library examples and local development hosts supply reusable groundwork | A recorded guided-demo page is published; hosted live generation and public comparison pages are sequenced last and remain unimplemented. |

Conditional/deferred rows retain their original gates: composite answer blocks, constrained-decoding
grammar exports, candidate protocol delivery, Remote DOM, simultaneous collaboration, migration
guides, mobile/static/voice/document targets and optional export modes do not become supported
because a neighboring helper or prototype exists. No paid model quality campaign, superiority
result, human accessibility signoff or complete protocol-conformance claim is recorded here.

## Defects and corrections (FIX)

| ID | Stage / priority | Proposed deliverable | Acceptance evidence | Dependencies |
|---|---|---|---|---|
| FIX-01 | 1 / P0; 2 / P1 | Describe `adaptA2UiSurface` as a limited A2UI-like structural helper; consider migration only after a native replacement qualifies. | Documentation matches supported shape; unsupported native messages are explicitly distinguished from helper input. | Native A2UI qualification before any deprecation |
| FIX-02 | 1 / P0 | Fix ignored adapter state by defining and forwarding the `bindingState` contract, or explicitly rejecting unsupported state. | Bound-control fixture proves state reaches rendering; no silent discard. | Existing adapter and message-part contracts |
| FIX-03 | 1 / P0 | Use the existing `renderPart` extension; demonstrate missing hooks before adding a registry or widget registry/state forwarding. | Custom-part and bound-widget examples pass without duplicating existing extension points. | Public extension API inventory |
| FIX-04 | 1 / P0 | `lr-message-parts`: memoize widget documents per part identity | Unrelated text deltas do not re-resolve a stable widget part; changed widget documents invalidate the cache correctly. | Part identity contract and streaming replay baseline |
| FIX-05 | 1 / P0 | Make text-delta reduction incremental in retained-byte accounting and structural sharing; avoid rescanning retained payload. | Long-stream scaling measures unchanged-object identity and UTF-16/UTF-8 correctness across split surrogate pairs. | Streaming benchmark baseline |
| FIX-06 | 1 / P1 | Keep stable widget-v2 fail-closed behavior; investigate separate opt-in generated-view boundaries and explicit identity assignment. | Existing v2 rejection fixtures remain unchanged; safe-region isolation and identity conflicts have separate tests. | View-tree identity policy; no scheduled default switch |
| FIX-07 | 2 / P0 | Implement the full official MCP Apps host bridge with legacy compatibility and negotiated capabilities. | SDK-built apps exercise lifecycle, tools, resources, context, display, cancellation, errors and teardown. | Official protocol fixtures and host security review |
| FIX-08 | 1 / P1 | AG-UI adapter: map reasoning and custom/activity events; test the ignored set | Fixtures cover reasoning, custom and activity events; the deliberately ignored set is documented and tested. | Published widget and AI-part contracts |
| FIX-09 | 1 / P1 | Correct streaming terminology and publish boundaries between widgets, generated views and remote content. | Examples identify actual incremental behavior and unsupported inputs. | Architecture chapter |
| FIX-10 | 1 / P1 | Replace the string-encoded sparkline documentation workaround once validated structured props qualify. | Runnable chart example uses the qualified converter and rejects malformed data. | Structured-prop qualification |
| FIX-11 | 1 / P1 | Address the structured-prop capability gap with an explicitly validated, compatibility-reviewed registry extension. | Array/object fixtures validate shape, ceilings and prototype safety; primitive behavior stays compatible. | Registry API decision and schema policy |
| FIX-12 | 1 / P1 | Expose structured diagnostic codes, paths and safe hints in the companion; review any proposed extension to the stable widget error event against its compatibility policy. | New diagnostics have typed payloads and documented semantics; existing event listeners and event-detail contracts remain compatible. Any incompatible change follows the major-release policy. | Published widget and AI-part contracts |

## Catalog and prompts (CAT)

| ID | Stage / priority | Proposed deliverable | Acceptance evidence | Dependencies |
|---|---|---|---|---|
| CAT-01 | 0–1 / P0 | Overlay schema for model-usable components (props, types, required, children/slots, actions, accessible-name source, examples, use-when) | Every overlay validates against the overlay schema and against the component's published metadata (tag, members, types, slots, events); unknown or mismatched members fail generation. | Catalog overlay contract and versioned view tree |
| CAT-02 | 0–1 / P0 | Generator: compact, deterministic, cache-friendly prompt from component metadata + overlays | Identical inputs produce byte-identical prompts on supported platforms; snapshot tests cover each catalog subset; per-subset prompt token counts are recorded against a budget. | Catalog overlay contract and versioned view tree |
| CAT-03 | 1 / P0 | Qualify an initial chat-answer catalog selected by use cases, targeting roughly 25 useful components rather than an arbitrary count. | Scenario coverage proves each included component has working structured props, actions, examples and accessible naming. | Catalog overlay contract and versioned view tree |
| CAT-04 | 1 / P1 | Catalog subsets (chat, forms, data, retrieval, agent-ops) selectable per request | Each subset generates a self-contained prompt and validator; components outside the active subset are rejected during parsing; per-subset prompt sizes are reported. | Catalog overlay contract and versioned view tree |
| CAT-05 | 1–2 / P1 | JSON Schema export with provider-compatible subsets | Exported schemas accept and reject the same fixtures as the runtime validator; each targeted provider's structured-output mode accepts the schema or its documented subset, and outputs parse into equivalent trees. | Catalog overlay contract and versioned view tree |
| CAT-06 | 2 / P1 | Export separate stable v0.9.1 and candidate v1 A2UI catalogs with version-specific Lyra catalog identifiers. | Version-pinned consumers accept each export; candidate results remain separate from stable qualification. | Catalog overlay contract and versioned view tree |
| CAT-07 | 1 / P1 | Token-efficient data shapes (compact table columns/rows, series arrays) with converters | Round-trip converters preserve numeric values, nulls, column types and series labels; token measurements include converter semantics. | Catalog overlay contract and versioned view tree |
| CAT-08 | 2 / P2 · evaluation-gated | Composite "answer blocks" where evaluation shows a benefit (KPI row, comparison, steps) | Evaluation shows fewer tokens or higher validity than the equivalent primitive composition without losing accessibility or semantics; otherwise the block is not added. | Catalog overlay contract and versioned view tree |
| CAT-09 | 1 / P1 | Catalog lint (interactive components need accessible names; declared actions; ceilings) | Lint rejects missing accessible-name sources, undeclared actions, invalid references and missing resource ceilings. | Catalog overlay contract and versioned view tree |
| CAT-10 | 1 / P1 | Locale rules in prompts (raw numbers and ISO dates; Lyra formats them) | Multi-locale fixtures preserve raw numeric/ISO-date values and render locale-specific formatting without prompt-side ambiguity. | Catalog overlay contract and versioned view tree |
| CAT-11 | 1 / P1 | Catalog versioning and compatibility rules for stored answers | Stored-answer fixtures cover compatible upgrades, explicit migration and unsupported-version fallback. | Catalog overlay contract and versioned view tree |
| CAT-12 | 2 / P2 | Few-shot example library by scenario type, auto-selected | Example selection is deterministic per task type and limited to the active subset; an ablation reports the effect on validity and prompt size. | Catalog overlay contract and versioned view tree |

## Format and parsing (FMT)

| ID | Stage / priority | Proposed deliverable | Acceptance evidence | Dependencies |
|---|---|---|---|---|
| FMT-01 | 0 / P0 | Specify Lyra Markup restricted syntax, islands, references, actions, forms, streaming and trust boundaries in a public RFC. | Grammar and examples define completion, recovery, escaping, offsets and rejection unambiguously. | Architecture and threat model |
| FMT-02 | 0–1 / P0 | Build or reuse a bounded non-DOM streaming parser after a dependency and conformance spike; define syntactic completion and JSON/entity subsets. | Chunk-boundary, malformed-input and budget fixtures qualify the selected implementation. | Syntax specification and evidence-based dependency decision |
| FMT-03 | 1 / P0 fenced islands; later / P2 raw-block convenience | Integrate fenced `lyra` islands with progressive Markdown. Raw-block detection requires a separate explicit qualification decision. | Mixed prose/island fixtures handle fences, escaped delimiters and incomplete streams without changing prose semantics; a raw-block mode must separately distinguish code examples and ordinary prose from interactive content. | Restricted syntax specification and threat model |
| FMT-04 | 1 / P0 | Streaming-equals-batch invariant with fixtures | Batch and chunked fixtures produce equivalent validated trees, diagnostics and source offsets within budgets. | Restricted syntax specification and threat model |
| FMT-05 | 1 / P0 | Conformance corpus ≥ 150 fixtures | At least 150 independently meaningful fixtures cover syntax, nesting, data, actions, boundaries and rejection; every fixture has expected output. | Restricted syntax specification and threat model |
| FMT-06 | 1 / P0 | Property-based fuzzing (never throws, bounded time) | Seeded property tests establish bounded completion, no uncaught exceptions and stream/batch equivalence under arbitrary chunking. | Restricted syntax specification and threat model |
| FMT-07 | 2 / P1 | Partial-JSON front-end (tool calls, structured outputs) | Batch and chunked fixtures produce equivalent validated trees, diagnostics and source offsets within budgets. | Restricted syntax specification and threat model |
| FMT-08 | 1 / P0 | Source maps (text offsets ↔ nodes) for diagnostics and repair | Diagnostics map to exact original source offsets across Unicode, entities and partial attributes. | Restricted syntax specification and threat model |
| FMT-09 | 1 / P1 | Define small scoped replace/remove patches by explicit identity with revision preconditions; expand editing later. | Conflicting or stale patches reject atomically; unaffected node and control identities survive. | Early identity and state model |
| FMT-10 | 4 / P3 · deferred experiment | Explore grammar exports for constrained decoding only where a provider supports the required subset. | Provider-backed trial measures valid-output rate and quality against ordinary decoding. | Stable syntax and evaluation harness |
| FMT-11 | 0–1 / P1 · experiment; 4 / P3 · gated delivery | Run an early bounded OpenUI Lang import experiment; deliver an optional importer only after semantic and dependency qualification. | Representative imports report supported, lossy and rejected constructs plus bundle, license and install-time or runtime telemetry costs. | View-tree draft and pinned import fixtures |
| FMT-12 | 1 / P2 | Define safe unknown-tag handling as rejection, omission or escaped text at an independently safe boundary; never activate unknown markup. | Unknown nested tags and forbidden known tags remain inert under every policy; security violations reject their boundary. | Restricted syntax specification and threat model |

## Runtime and rendering (RUN)

| ID | Stage / priority | Proposed deliverable | Acceptance evidence | Dependencies |
|---|---|---|---|---|
| RUN-01 | 1 / P0 | View tree v1 (versioned, serializable, diagnostics, source maps) | Schema round trips preserve node identity, catalog version, diagnostic codes and source-map semantics; invalid snapshots reject. | Validated view tree, catalog and security policy |
| RUN-02 | 1 / P0 | `<lr-gen-view>` incremental keyed rendering with per-frame coalescing | Browser fixtures exercise successful, rejected, interrupted and restored states with stable unaffected identities. | Validated view tree, catalog and security policy |
| RUN-03 | 1 / P0 | Structured props with schema validation | Chart, table and option-array fixtures validate schemas and reject prototype keys, excessive data and unsupported nested shapes. | Validated view tree, catalog and security policy |
| RUN-04 | 1 / P0 | Isolate only independently safe regions; security, budget and identity breaches reject the affected boundary with a visible fallback. | Fault injection proves no invalid identity is silently renamed and no unsafe subtree is partially accepted. | Trust boundaries and identity conflict policy |
| RUN-05 | 1 / P0 | Stream-driven lazy loading of component modules; skeletons with reserved size | Network fixtures load only encountered component modules; skeleton reservations and loader failures preserve usable fallback. | Validated view tree, catalog and security policy |
| RUN-06 | 1 / P0 | Form scope with local state, native validation, submit values and optional controlled mode | Native validation, reset, disabled controls, local edits and controlled updates preserve expected form state and submit only authorized values. | Validated view tree, catalog and security policy |
| RUN-07 | 1 / P0 | Data references (`@tool:`, `@data:`) with limits and validation | Pointer resolution handles missing, stale and unauthorized data; bounds apply before materialization and no arbitrary fetch occurs. | Validated view tree, catalog and security policy |
| RUN-08 | 1–2 / P1 | Named functions (formatting, pluralize, aggregates); no expression language | Allowlisted pure functions validate arguments and locale; unknown functions and expression-like inputs reject without evaluation. | Validated view tree, catalog and security policy |
| RUN-09 | 1 / P0 | Unified `lr-gen-action` channel plus next-turn helpers | Typed action fixtures emit declared payloads once; hosts explicitly authorize effects and next-turn messages. | Validated view tree, catalog and security policy |
| RUN-10 | 1 / P0 | Approvals for `confirm` actions (`lr-confirm-bar`, `lr-tool-approval-dialog`) | Confirm-required actions cannot run before affirmative host approval; deny, cancel and superseded approvals stay inert. | Validated view tree, catalog and security policy |
| RUN-11 | 1–2 / P1 | Define validated snapshot restore without reparsing source, then qualify SSR separately. | Round trips preserve catalog version, identities and authorized local state; SSR hydration matches browser output. | Snapshot versioning and state ownership |
| RUN-12 | 1 / P0; 2 / P1 expansion | Establish surface identity, ownership, revision/conflict rules and local state early; add bounded JSON Pointer patches and protocol integration. | Stale updates, duplicate identities, deletion and concurrent user edits follow explicit rules without state loss. | View tree and action authorization |
| RUN-13 | 2 / P2 | Templates over data arrays | Repeated-item fixtures use stable explicit keys, bounded expansion and deterministic state retention on reorder/delete. | Validated view tree, catalog and security policy |
| RUN-14 | 1 / P1 | Per-instance limits within hard ceilings | Hosts may lower limits but cannot exceed hard ceilings; nested and accumulated resource accounting rejects before expensive work. | Validated view tree, catalog and security policy |

## Chat integration (CHAT)

| ID | Stage / priority | Proposed deliverable | Acceptance evidence | Dependencies |
|---|---|---|---|---|
| CHAT-01 | 1 / P1 | Integrate streamed generated content through existing part-rendering customization; add a typed `ui` part or other stable hook only if the integration demonstrates an unmet requirement. | Reducer and host-renderer fixtures preserve stable part identity and show unknown-part fallback without importing lyra-gen into lyra-ui; any new API has a documented need and compatible defaults. | Part integration contract and incremental renderer |
| CHAT-02 | 1 / P1 | Scroll anchoring while islands grow; follow mode honors reserved sizes | While islands grow or placeholders resolve, a reader scrolled away from the end keeps their position, follow mode stays at the end, and restored history renders without jumps. | Part integration contract and incremental renderer |
| CHAT-03 | 1 / P1 | Accessible streaming: busy state per island; one polite announcement per completed widget; never steal focus | Assistive-technology review confirms busy/completion announcements are bounded, localized and never move focus. | Part integration contract and incremental renderer |
| CHAT-04 | 1 / P1 | Follow-up suggestions (`lr-suggestion-chips`) wired to `ask:` | Activating a suggestion sends exactly one next-turn request with its declared context; suggestions are keyboard reachable and inert while the host disallows new turns. | Part integration contract and incremental renderer |
| CHAT-05 | 1 / P1 | Citations inside generated UI (`lr-citation-badge`, source cards) | Citations resolve only to sources available to the viewer; missing sources show a visible unresolved state; activation emits the existing citation events. | Part integration contract and incremental renderer |
| CHAT-06 | 2 / P2 | "Open in panel": move a surface into `lr-artifact-panel` or a dock | Moving a surface into a panel and back preserves identity, state and a valid focus target; the transcript shows a placeholder that leads to the panel. | Part integration contract and incremental renderer |
| CHAT-07 | 1 / P1 | Lazy part renderers in `lr-message-parts` | A transcript containing only text parts loads no tool, citation, widget or audio renderer code; each renderer loads on first use with a fallback while loading, and size budgets reflect the split. | Part integration contract and incremental renderer |
| CHAT-08 | 1 / P1 | Truncation and interruption handling for islands (resume/retry) | Truncated, cancelled and resumed streams preserve complete safe regions and mark incomplete regions with explicit retry state. | Part integration contract and incremental renderer |
| CHAT-09 | 1 / P1 | Configurable provenance marker on generated surfaces | Host-configured provenance remains distinguishable from model-authored content and survives surface movement and restore. | Part integration contract and incremental renderer |
| CHAT-10 | 4 / P3 · deferred | Export generated UI (CSV, image, Markdown) via `lr-export-button` | Exports contain only visible, permitted data; CSV and Markdown preserve displayed values; exported images respect theme and direction. | Part integration contract and incremental renderer |

## Dashboards and application screens (DASH)

| ID | Stage / priority | Proposed deliverable | Acceptance evidence | Dependencies |
|---|---|---|---|---|
| DASH-01 | 3 / P1 | Persistent surfaces updated by id (interactables) | Updates addressed to a surface or component identity change only their targets; stale, unknown or unauthorized targets reject; user state in untouched panels survives. | Early identity, conflict, state and scoped-patch contracts |
| DASH-02 | 3 / P1 | Patch follow-ups that keep user state | Follow-up patches change only the targeted elements, preserve unrelated user edits, and report their tokens against full regeneration for the same request. | Early identity, conflict, state and scoped-patch contracts |
| DASH-03 | 3 / P1 | Live data via host tools/queries (refresh, cancel, stale discard) | Refresh, cancellation and out-of-order responses never present stale data as current; cancelled requests stop updating; failures keep the last valid data with its visible age. | Early identity, conflict, state and scoped-patch contracts |
| DASH-04 | 3 / P1 | Dashboard generation into `lr-dashboard-grid` (layout, pinning, persistence) | Generated layouts satisfy grid constraints and the collision policy; pinned cells survive regeneration; keyboard move and resize work on generated cells. | Early identity, conflict, state and scoped-patch contracts |
| DASH-05 | 3 / P1 | Versions, diff, undo, review before applying | Each applied change creates a revision with a readable diff; undo restores the prior revision exactly; nothing applies without confirmation when the host requires review. | Early identity, conflict, state and scoped-patch contracts |
| DASH-06 | 3 / P1 | Export a generated screen as a Lyra/Lit template ("graduate to code") | Exported templates use only public Lyra imports and documented members, render the same fixture dashboards as the generated view, and contain no credentials, private data snapshots or generated scripts. | Early identity, conflict, state and scoped-patch contracts |
| DASH-07 | 3 / P1 | Grounded numbers (citations on values) | Every value marked as grounded links to a source record available to the viewer; a value without a resolvable source shows an explicit unverified state. | Early identity, conflict, state and scoped-patch contracts |
| DASH-08 | 4 / P3 · demand-gated | Multi-agent surfaces in `lr-agent-workspace` | Each agent can update only the surfaces it owns; cross-agent updates reject; ownership is visible to users and assistive technology. | Early identity, conflict, state and scoped-patch contracts |

## Interoperability (IOP)

| ID | Stage / priority | Proposed deliverable | Acceptance evidence | Dependencies |
|---|---|---|---|---|
| IOP-01 | 0 / P1 design; 2 / P0 delivery | Build a Lyra-owned A2UI processor, then qualify stable v0.9.1 surfaces, state, templates, functions and actions without an upstream processor runtime dependency. | Pinned official fixtures and reference-renderer comparisons demonstrate protocol fidelity; record lifecycle, license, measured cost, maintenance ownership and version tracking. | Independent processor design and protocol-specific validation |
| IOP-02 | 2 / P2 · candidate experiment | Keep candidate v1 support in a separate opt-in entry point and fixture cohort. | Candidate results name exact schema revisions and never count toward stable v0.9.1 conformance. | Stable A2UI integration and candidate capability review |
| IOP-03 | 2 / P0 | Build version-specific A2UI conformance cohorts from official examples and normative cases. | Each fixture records its actual protocol revision; unsupported cases fail explicitly; candidate examples never inflate stable coverage. | Version-pinned protocol inventory |
| IOP-04 | 2 / P1 | Lyra extended A2UI catalog (charts, tables, stats, citations) | The catalog validates against the pinned A2UI catalog schema under its own Lyra identity; an agent using it renders the added components through the same lifecycle as basic-catalog components; unsupported members reject explicitly. | Protocol capability contract and validated view tree |
| IOP-05 | 2 / P1 | A2UI capability helpers (`supportedCatalogIds`) for AG-UI and A2A metadata | Capability metadata produced by the helpers is accepted by the pinned AG-UI and A2A bindings and advertises only qualified catalog identities. | Protocol capability contract and validated view tree |
| IOP-06 | 2 / P1 | MCP Apps conformance with SDK-built example apps (with FIX-07) | SDK-built example apps exercise official host bridge capabilities, version negotiation, errors, cancellation and legacy compatibility. | Protocol capability contract and validated view tree |
| IOP-07 | 2 / P1 | AI SDK `data-*` UI parts and streamed tool-call inputs → `ui` parts | Fixtures from the pinned AI SDK version map generated-UI data parts and streamed tool-call input to the qualified integration path; other parts keep their existing mapping. | Protocol capability contract and validated view tree |
| IOP-08 | 4 / P3 · gated research | Investigate Remote DOM as a separate sandboxed tier after native rendering qualifies. | Go/no-go evidence covers threat boundaries, capabilities, bundle cost, teardown and accessibility. | Remote-tier threat review and demonstrated demand |
| IOP-09 | 4 / P3 · deferred | Export view tree → A2UI JSON (Flutter and mobile renderers) | Version-pinned protocol fixtures and a real host example prove supported behavior and explicit rejection. | Protocol capability contract and validated view tree |
| IOP-10 | 4 / P3 · deferred | A2A extension metadata helpers | Version-pinned protocol fixtures and a real host example prove supported behavior and explicit rejection. | Protocol capability contract and validated view tree |

## Reliability and repair (REL)

| ID | Stage / priority | Proposed deliverable | Acceptance evidence | Dependencies |
|---|---|---|---|---|
| REL-01 | 1 / P0 | Structured diagnostics with catalog-derived hints | Fault fixtures show actionable diagnostics and visible fallback without relaxing security or identity checks. | Error boundaries, catalog validation and source maps |
| REL-02 | 1 / P0 | Repair helper: re-prompt only failing nodes and merge the fixes | Repair requests include only failing regions and their diagnostics; attempts, time and tokens stay within ceilings; a repair never overwrites newer user input; repair success rates are measured. | Error boundaries, catalog validation and source maps |
| REL-03 | 1 / P1 · revised scope | Define deterministic syntactic completion and explicitly authorized coercions; reject nearest-enum guessing and silent duplicate-ID renaming. | Repair fixtures distinguish safe completion from semantic changes; identity/security/budget failures reject their boundary. | Syntax rules, identity policy and diagnostic taxonomy |
| REL-04 | 1 / P0 | Never-blank fallback (prose or code view) | Fault fixtures show actionable diagnostics and visible fallback without relaxing security or identity checks. | Error boundaries, catalog validation and source maps |
| REL-05 | 2 / P2 | Local failure-taxonomy callback (no telemetry; host decides) | The callback receives only local diagnostic categories, performs no network access, and disabling it changes no rendering behavior. | Error boundaries, catalog validation and source maps |

## Performance and delivery (PERF)

| ID | Stage / priority | Proposed deliverable | Acceptance evidence | Dependencies |
|---|---|---|---|---|
| PERF-01 | 0–1 / P0 | Streaming workloads in `benchmarks/` and the tachometer gate (Markdown streaming, message parts with widget, generated-UI replay) | Reproducible production workloads publish timing, memory and size measurements with environment and uncertainty. | Evaluation protocol and representative replay fixtures |
| PERF-02 | 0–1 / P0 | Record/replay harness with token timing | Reproducible production workloads publish timing, memory and size measurements with environment and uncertainty. | Evaluation protocol and representative replay fixtures |
| PERF-03 | 1 / P0 | Model evaluation harness for Opus, Astra, Sonnet and Luna, with pinned model identifiers/settings and bounded paid execution. | Per-model results record quality, timing, usage, cost and uncertainty; unavailable models are explicit exclusions; the campaign stops at its approved spending ceiling. | Evaluation protocol, exact provider identifiers, spending budget and representative replay fixtures |
| PERF-04 | 1 / P1 | Per-frame coalescing and time slicing in `<lr-gen-view>` | Replay at recorded token cadence produces identical final output with no long task above the approved budget and less total main-thread time than per-chunk rendering. | Evaluation protocol and representative replay fixtures |
| PERF-05 | 1 / P1 | Prompt-caching guidance (stable prefixes, subset ordering) | Documented prompt ordering produces cache hits on supported providers in the harness; time to first token and input cost are published with and without caching. | Evaluation protocol and representative replay fixtures |
| PERF-06 | 1 / P1 | Thinking-budget guidance per scenario type | Guidance cites measured validity, latency and cost across thinking settings for each scenario type and changes only with new measurements. | Evaluation protocol and representative replay fixtures |
| PERF-07 | 1 / P1 | Fair first-load comparison: equivalent production builds, OpenUI vs Lyra | Equivalent production builds with matched component coverage are measured with one compression tool and settings; capability differences are listed beside the results. | Evaluation protocol and representative replay fixtures |
| PERF-08 | 1 / P1 | Size budgets for the chat composition (JS, CSS, lazy chunks) | CI enforces measured JS, CSS and lazy-chunk budgets for the actual chat composition with optional peers accounted separately. | Evaluation protocol and representative replay fixtures |
| PERF-09 | 1 / P1 | Layout-shift control: catalog minimum sizes and skeletons | Replays measure layout shift during streaming; reserved sizes keep it within the approved budget without delaying the first useful view. | Evaluation protocol and representative replay fixtures |
| PERF-10 | 2 / P2 | Memory: cap retained raw stream text; release after persistence | Long-session replays show bounded retained memory; raw stream text is released after persistence while restore still reproduces the saved interface. | Evaluation protocol and representative replay fixtures |

## Accessibility, i18n, RTL and theming (A11Y)

| ID | Stage / priority | Proposed deliverable | Acceptance evidence | Dependencies |
|---|---|---|---|---|
| A11Y-01 | 1 / P0 | axe checks of every catalog component in generated contexts (populated and open states) | Each catalog component passes axe in populated/open generated contexts; composed forms, nested widgets and cross-component names receive independent review. | Catalog semantics and rendered interaction contracts |
| A11Y-02 | 1 / P0 | Locale and direction inheritance; RTL fixtures; ≥ 3 locales | At least three locales including RTL verify inherited direction, formatting, logical keyboard movement and long translated content. | Catalog semantics and rendered interaction contracts |
| A11Y-03 | 1 / P0 | Localized built-in strings for lyra-gen (fallbacks, errors, skeleton labels) | Every built-in lyra-gen string uses the shared localization API and catalogs; tests cover the unregistered-locale English fallback and an override reaching the rendered output. | Catalog semantics and rendered interaction contracts |
| A11Y-04 | 1 / P0 | Reduced motion for progressive reveal | With reduced motion preferred, progressive reveal and placeholder transitions complete without animation; tests cover both preferences. | Catalog semantics and rendered interaction contracts |
| A11Y-05 | 1 / P0 | Keyboard order and no auto-focus for generated forms | Generated forms never move focus on arrival; tab order follows reading order; submission errors are reachable by keyboard and announced once. | Catalog semantics and rendered interaction contracts |
| A11Y-06 | 2 / P2 | Theme-aware chart palettes and density in generated surfaces | Generated charts and surfaces use theme tokens in every look, mode and density; contrast checks pass in light and dark modes. | Catalog semantics and rendered interaction contracts |

## Security (SEC)

| ID | Stage / priority | Proposed deliverable | Acceptance evidence | Dependencies |
|---|---|---|---|---|
| SEC-01 | 1 / P0 | Threat model for generated UI (injection → deceptive UI, phishing, exfiltration, denial of service) | A published threat model maps injection, deceptive UI, phishing, exfiltration through URLs or media, denial of service and stale actions to mitigations and named fixtures. | Threat model and trust-boundary contract |
| SEC-02 | 1 / P0 | Injection test corpus (script/style/`on*`, `javascript:`, entities, bidi, huge JSON, deep nesting) | The corpus covers each listed vector and runs in CI; every case is rejected or rendered inert within bounded time and memory. | Threat model and trust-boundary contract |
| SEC-03 | 1 / P0 | URL and media origin policy; user-gesture navigation with a visible destination | Links, media, fetches and downloads are tested per sink: disallowed schemes and origins never load or navigate, and navigation requires a user gesture with a visible destination. | Threat model and trust-boundary contract |
| SEC-04 | 1 / P0 | Password, OTP and card fields disabled by default; host opt-in | Default catalogs refuse sensitive credential fields; host opt-in is explicit, scoped and absent from model-controlled permissions. | Threat model and trust-boundary contract |
| SEC-05 | 1 / P0 | Action allowlist; undeclared actions inert | Undeclared, misspelled or model-invented actions never reach the host dispatcher; declared actions validate payloads against their schemas. | Threat model and trust-boundary contract |
| SEC-06 | 0 / P0 | Require no telemetry and a reviewed dependency budget; choose independent parser dependencies by security, correctness, license and measured cost. | Dependency/license inventory and network checks verify documented behavior; no arbitrary zero-dependency requirement. | Package boundary and supply-chain review |
| SEC-07 | 4 / P0 · research gate | Review Remote DOM iframe/worker isolation, CSP, capability channels and message validation before any remote-tier prototype is exposed. | Adversarial host/guest cases prove origin, capability, cancellation and resource isolation. | Remote-tier threat model and host capability contract |

## Developer experience and documentation (DX)

| ID | Stage / priority | Proposed deliverable | Acceptance evidence | Dependencies |
|---|---|---|---|---|
| DX-01 | 1 / P1 | Guide: "Interactive answers in chat" (server prompt + client render) with AI SDK and AG-UI examples | Runnable examples and command smoke checks use published granular imports and documented failures. | Qualified public package APIs and sample catalog |
| DX-02 | 1 / P1 | Provide CLI commands for prompt generation, validation, stream replay and benchmarking through the published package. | Each command has runnable fixtures, deterministic output where applicable and nonzero exit status for invalid inputs. | Qualified public package APIs and sample catalog |
| DX-03 | 1 / P1 | Storybook stream-replay stories per scenario | Each scenario story replays a recorded stream at its original cadence, shows diagnostics, and is covered by interaction and visual tests. | Qualified public package APIs and sample catalog |
| DX-04 | 1 / P1 | Coding-agent skill update (plugins/lyra-ui) for lyra-gen | The bundled skill covers catalog setup, prompt generation, rendering and action handling; skill-bundle generation and its freshness checks pass. | Qualified public package APIs and sample catalog |
| DX-05 | 2 / P2 | TypeScript types for catalogs and actions (typed payloads) | Catalog definitions produce typed action payloads and state; type tests fail on undeclared actions or mismatched payloads. | Qualified public package APIs and sample catalog |
| DX-06 | 4 / P3 · deferred | Developer inspector overlay (tree, diagnostics, timings, tokens) | Runnable examples and command smoke checks use published granular imports and documented failures. | Qualified public package APIs and sample catalog |
| DX-07 | 1 / P0 | Deliver a public website playground with paste, validation and stream replay, requiring no API key. | Accessible responsive deployed examples reproduce published fixtures and handle malformed input safely. | Website release chapter and qualified core examples |
| DX-08 | 4 / P3 · demand-gated | Migration guides from OpenUI, A2UI renderers, json-render | Runnable examples and command smoke checks use published granular imports and documented failures. | Qualified public package APIs and sample catalog |

## Testing and evaluation (TEST)

| ID | Stage / priority | Proposed deliverable | Acceptance evidence | Dependencies |
|---|---|---|---|---|
| TEST-01 | 1 / P0 | Three-engine tests for streaming render, forms and focus | Streaming render, form and focus suites pass in Chromium, Firefox and WebKit on the release candidate; engine-specific exclusions are documented. | Evaluation methodology and representative composed surfaces |
| TEST-02 | 1 / P0 | Fault-injection corpus for safe-region isolation, rejection and visible fallback | Versioned fixtures preserve independently safe content and reject the affected boundary on security, budget or ambiguous-identity failures; a useful fallback never fabricates valid UI. | Evaluation methodology and representative composed surfaces |
| TEST-03 | 2 / P2 | Visual regression of scenario outputs across looks and modes | Baselines cover each scenario in every supported look and mode, left-to-right and right-to-left, with recorded human review for baseline changes. | Evaluation methodology and representative composed surfaces |
| TEST-04 | 1 / P0; every release | Evaluation campaign per lyra-gen release across the selected Opus, Astra, Sonnet and Luna lineup | Versioned fixtures, exact model settings, results and budget accounting are reproducible against the release candidate; availability gaps remain disclosed. | Evaluation methodology, spending ceiling and representative composed surfaces |
| TEST-05 | 1 / P0 | Cross-check token counts with each provider's tokenizer where available | Local tokenizer counts are compared with provider-reported usage per model; differences are published and provider totals remain authoritative. | Evaluation methodology and representative composed surfaces |

## Governance and packaging (GOV)

| ID | Stage / priority | Proposed deliverable | Acceptance evidence | Dependencies |
|---|---|---|---|---|
| GOV-01 | 0 / P0 | Create independently versioned 0.x `@aceshooting/lyra-gen` in `packages/lyra-gen`, with Lyra UI as a peer. | Dependency tests prove `lyra-ui` never imports `lyra-gen`; granular exports preserve optional loading. | Package ownership and compatibility policy |
| GOV-02 | 0 / P0 | Apply the selected priority: Lyra Gen foundations/chat before new lyra-3d and lyra-docs features, with maintenance retained | Delivery capacity and milestone ordering reflect that priority; deferred companion features remain visible and are rescheduled after the qualified chat milestone. | Approved product direction and existing repository release rules |
| GOV-03 | 0 / P0 | Link the staged generative UI roadmap and its qualification chapters from the main public roadmap. | Navigation and scope descriptions agree across the roadmap chapters; links pass repository checks. | Approved architecture and existing repository release rules |
| GOV-04 | 0 / P0 | Experimental-API policy for lyra-gen 0.x; criteria for 1.0 and promotion | A published policy states what may change in 0.x releases, how stored documents migrate, and the measurable criteria for 1.0 and for any promotion into Lyra UI. | Approved architecture and existing repository release rules |
| GOV-05 | 2 / P1 · conditional | Record deprecations only after replacement qualification, with `since: unreleased` under repository rules; preserve widget-v2 fail-closed defaults. | Migration fixtures prove replacement coverage and legacy compatibility; no precommitted major-version default switch. | Qualified replacements and established deprecation policy |
| GOV-06 | 1 / P0; ongoing | Gate website claims and release examples on measured, scoped evidence. | Every comparative claim links reproducible methodology and results; website ships with the useful-chat release. | Evaluation and website release chapters |
| GOV-07 | 0 / P0 | Publish evaluation methodology and raw data (first-party disclosure) | Each comparative claim links a methodology page, per-case raw results and a reproduction command; artifacts are checked for secrets and private data before publication. | Approved architecture and existing repository release rules |

## Beyond both (IDEA)

| ID | Stage / priority | Proposed deliverable | Acceptance evidence | Dependencies |
|---|---|---|---|---|
| IDEA-01 | 4 / P3 · deferred | Voice + generated UI in realtime sessions (`lr-realtime-session`) | A bounded prototype demonstrates demand, safety and value before a delivery commitment. | Qualified core and an explicit demand-based decision |
| IDEA-02 | 4 / P3 · deferred | Generated widgets inside `lyra-docs` documents | A bounded prototype demonstrates demand, safety and value before a delivery commitment. | Qualified core and an explicit demand-based decision |
| IDEA-03 | 4 / P3 · deferred | Static snapshot rendering for email/PDF/history | A bounded prototype demonstrates demand, safety and value before a delivery commitment. | Qualified core and an explicit demand-based decision |
| IDEA-04 | 2 / P2 | Cost and latency meter per answer (`lr-generation-metrics`) | Per-answer usage and timing come from provider-reported data where available; estimates are labeled; the meter adds no network requests. | Qualified core and an explicit demand-based decision |
| IDEA-05 | 2 / P2 | Agent-side TypeScript helper to emit Lyra Markup from structured data | Helper output passes the Lyra Markup validator for every catalog fixture, with correct escaping of text and attribute values. | Qualified core and an explicit demand-based decision |
| IDEA-06 | 2 / P2 | Generated JSON artifacts (prompt, schema, catalog) consumable by Python agents | Versioned prompt, schema and catalog files are consumable without JavaScript; a Python fixture loads them and validates sample outputs. | Qualified core and an explicit demand-based decision |

## Dashboard expansion

These additional capabilities qualify persistent application behavior beyond initial layout
creation. They depend on the early runtime identity and state contract rather than postponing
those fundamentals until dashboard delivery.

| ID | Stage / priority | Proposed deliverable | Acceptance evidence | Dependencies |
|---|---|---|---|---|
| DASH-09 | 3 / P1 | Linked filters and selection with typed shared state, explicit scope and loop prevention. | Table/chart fixtures propagate selection once, retain independent filters and clear dangling selections after data changes. | Typed data model, scoped patches and action authorization |
| DASH-10 | 3 / P1 | Drilldown, breadcrumbs and return navigation that preserve parent context and user edits. | Nested views return to the prior filter, scroll and selection state; inaccessible destinations reject safely. | Surface identity, navigation policy and snapshot restore |
| DASH-11 | 3 / P0 | Streaming data with bounded queues, backpressure, batching and explicit overflow policy. | Burst, slow-consumer and reconnect fixtures stay within memory/frame budgets and disclose dropped or superseded data. | Incremental scheduler, host cancellation and revision checks |
| DASH-12 | 3 / P1 | Scalable tables and charts using host-side queries, pagination, windowing and aggregation with explicit limits. | Large-data benchmarks report interaction latency and retained memory; visible summaries disclose sampling or aggregation. | Data-reference budgets, query capability contract and performance harness |
| DASH-13 | 3 / P0 | Data provenance, freshness timestamps, stale/loading/partial states and value-level lineage. | Refresh and partial-failure fixtures show source and age accurately without presenting stale results as current. | Host query results, citation contract and localized state descriptions |
| DASH-14 | 3 / P0 | Host-owned authorization, query capabilities, cancellation and credential boundaries for every dashboard action. | Unauthorized, expired, cancelled and late responses cannot mutate surfaces; no credentials enter generated markup or snapshots. | Action allowlist, capability lifecycle and trust model |
| DASH-15 | 3 / P1 | Responsive layouts, panel lifecycle and accessible alternatives for rearrangement and resizing. | Keyboard-only, RTL, narrow-allocation and restored-layout fixtures retain logical focus and announce meaningful changes. | Qualified dashboard grid, composition accessibility and layout persistence |
| DASH-16 | 3 / P1 | Shareable dashboard snapshots with explicit permissions, data redaction, schema migration and reproducible restore. | Cross-version fixtures reject unauthorized references and preserve the permitted presentation and state without replaying actions. | Versioned snapshots, catalog compatibility and host authorization |

## Saved dashboards in applications

Saved, shareable dashboards are committed stage 3 scope. The stage 0–1 schema and privacy
contracts must anticipate this lifecycle so a useful chat surface can become an application
screen without regeneration. The host application owns storage, navigation, identity and
authorization; a generated document cannot grant itself access. Basic multiuser viewing,
editing and publication do not depend on simultaneous collaborative editing.

| ID | Stage / priority | Proposed deliverable | Acceptance evidence | Dependencies |
|---|---|---|---|---|
| DASH-17 | 0–1 / P0 contract; 3 / P0 delivery | Define a portable versioned dashboard document and separately saved instance, including stable identities, schema/catalog references, permitted local state and migration rules. | A saved dashboard reopens without a model call; round trips preserve permitted layout/state; missing catalog or unsupported migration yields a localized safe fallback. | Versioned view tree, catalog compatibility, state ownership and snapshot privacy |
| DASH-18 | 0–1 / P1 contract; 3 / P0 delivery | Provide a host persistence adapter for create, read, update, delete and list, with conditional writes, revision identifiers and explicit storage failures. | Integration fixtures save and reload across sessions; stale revisions conflict instead of overwriting; failed writes retain recoverable drafts; list/delete obey host permissions. | Portable dashboard document and host authorization contract |
| DASH-19 | 3 / P0 | Provide an application integration SDK for embedding saved dashboards and registering host-controlled routes, navigation entries and instance lifecycle. | A generated dashboard is saved, added to application navigation and reopened directly by an authorized user without regeneration; deleted or unauthorized routes show safe fallback. | Persistence adapter, host routing interface and authorized document loading |
| DASH-20 | 3 / P0 | Separate mutable drafts from published versions, with stable consumer references, validated publication and explicit update/rollback behavior. | An editor changes a draft while viewers retain the published version; publication atomically advances the intended reference; invalid drafts cannot replace a usable published screen. | Versioned documents, conditional writes and independent composition qualification |
| DASH-21 | 0–1 / P0 authority contract; 3 / P0 delivery | Integrate host-owned owner, workspace and tenant permissions for view, edit, publish and fork; reauthorize live bindings per viewer using semantic data-source references resolved through a host registry. | A viewer cannot edit or publish; an editor can update a permitted draft and publish only with permission; revocation and cross-tenant requests fail; creator credentials and raw tool data never transfer implicitly. | Host identity/capability registry, action authorization and privacy contract |
| DASH-22 | 3 / P1 | Add permission-aware sharing links, application galleries and clone/remix flows with explicit treatment of data bindings and optional snapshot permissions. | An author shares a published dashboard with another user; permitted clones get new identities and reauthorized bindings; links confer no access beyond host policy; snapshots require explicit data permission and arbitrary fetched URLs remain forbidden. | Published versions, host ACLs, provenance and semantic data-source registry |
| DASH-23 | 3 / P0 | Add revision history, meaningful diffs, undo and optimistic concurrency/conflict handling across saved edits and publications. | Two editors cannot silently overwrite each other; stale conditional writes return a reviewable conflict; undo creates an authorized revision; history and restore preserve tenant boundaries and published consumers. | Persistence revisions, draft/publication model and identity-preserving patches |
| DASH-24 | 4 / P3 · research | Investigate simultaneous collaborative editing only after basic saved multiuser workflows qualify. | A bounded prototype evaluates ordering, presence privacy, offline conflicts, authorization revocation and operational cost before any delivery commitment. | Qualified sharing/editing lifecycle, conflict rules and demonstrated demand |

Stage 3 end-to-end qualification covers an author generating and saving a dashboard, sharing
it with a viewer who cannot edit, and a separately authorized editor updating a draft and
publishing it. Reopening must require no model call. The same suite exercises revoked access,
tenant isolation, stale-revision conflicts, missing catalogs and document migrations. Every
viewer's live bindings resolve through the host registry and authorization policy; saved
presentation never silently carries the creator's credentials or unrestricted tool results.

## Completion and scope decisions

An entry is complete only when its stated evidence and dependencies are qualified for the
claimed scope. Public release notes distinguish measured support, experimental entry points
and rejected inputs. A partial implementation remains planned for its remaining scope. No
comparison result, conformance percentage or performance target is implied by inclusion here.

The parser and incremental reducer target avoiding repeated scans of retained payload and
preserving untouched identity. Measurements must include UTF-16 text boundaries and UTF-8
byte accounting; this roadmap does not promise strict asymptotic delta-only work across all
validation, scheduling and rendering operations. Stable A2UI v0.9.1 and candidate v1 fixtures
remain separate. Any third-party processor or parser must pass the same lifecycle, security,
compatibility and bundle qualification as an independent implementation.
