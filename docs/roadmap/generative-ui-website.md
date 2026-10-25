# Generative UI website and demonstrations

Status: **planned**. This roadmap defines product and qualification work; it does not announce an
implemented generative UI service or a release date. The website workstream is separate from the
library runtime and depends on its qualified public contracts.

Related roadmaps: [runtime and product direction](generative-ui.md),
[implementation backlog](generative-ui-backlog.md), and
[evaluation and methodology](generative-ui-evaluation.md). Developer documentation, governance and
performance evidence referenced by those roadmaps must be available from the website without
turning an exploratory result into a general product claim.

## Product outcome and current foundation

A visitor should understand what Lyra generates, try an interactive answer, inspect its source and
supported component catalog, and reproduce the demonstrated integration. A developer should be able
to distinguish a live provider response, a recorded response, fixture data and a simulated action.
A comparison should explain its measurement boundary before presenting a percentage.

The current website already has localized feature routes, a searchable component gallery, authored
component previews, granular published-package imports, theme controls, generated component/API
references and read-only documentation discovery. Its locale build and browser qualification provide
useful foundations. These facilities do **not** establish a model-generation endpoint, an untrusted
output execution boundary, provider usage accounting or a benchmark service. Existing authored
previews must not be treated as safe containers for arbitrary model-produced scripts or properties.

Public design references are OpenUI's [showcase](https://www.openui.com/demos),
[GitHub dashboard demo](https://www.openui.com/demo/github),
[comparison experience](https://www.openui.com/compare), and
[source/preview playground](https://www.openui.com/openui-vs-json). These inform interaction patterns,
not implementation reuse or evidence that Lyra performs better.

## Delivery stages and tracked work

Every item below has status **planned**. Completion requires its acceptance criteria and the relevant
runtime/evaluation dependencies; a screenshot or static mockup alone does not complete a live feature.

### Stage 0 — foundation and truthful boundaries

| ID | Deliverable | Dependencies | Acceptance criteria |
| --- | --- | --- | --- |
| SITE-01 | Published integration and supported catalog | Qualified runtime schema, renderer and catalog contracts | Pin reviewed published package versions; show schema/catalog version and import examples. Derive supported members from the actual runtime catalog, including required properties and unsupported capabilities. Never equate gallery inventory with generation support. |
| SITE-02 | Hosted bounded streaming service | Provider adapter contract; hosting and operating budget decision | Keep provider credentials server-side; expose an allowlisted model/provider selection, bounded prompt/output sizes, timeouts, request and concurrency limits, spend admission and a global disable switch. No visitor provider-key entry is required. Exhaustion and unavailable service return explicit actionable states. |
| SITE-03 | Stream lifecycle and isolated rendering | SITE-01, SITE-02; runtime validation and action policies | Preserve partial SSE frames across network reads, decode split Unicode correctly and handle terminal/error frames. Cancel reaches the server and upstream provider where supported; stale requests cannot update a newer view. Validate before rendering; prohibit arbitrary scripts and unapproved network/navigation/actions. Exercise truncation, malformed output, disconnect and superseded-run cases. |
| SITE-04 | Privacy, deployment and delivery policy | SITE-02, SITE-03 | Default to no retained raw prompts or generated user content; disclose provider processing and actual operational retention. Redact logs/errors and exclude credentials from browser storage, bundles and downloadable traces. Define bounded operational metrics, cache behavior, CSP and preview isolation. Private live results must not enter shared caches. Keep this service separate from Admin and its credentials. |
| SITE-05 | Evidence and fixture envelope | Evaluation methodology; SITE-01 | Each recorded example carries its prompt, model/version, capture date, package/catalog versions, data origin and result status. Separate playback speed from measured generation latency. Define a versioned downloadable artifact with bounded, sanitized metadata and no secrets. |

SITE-03's default is the validated declarative renderer with explicit action dispatch. If an optional
arbitrary-code mode is later approved, qualify it separately using a dedicated isolated preview
origin or equivalently reviewed sandbox, restrictive CSP, network/capability limits and resource
bounds. A same-origin authored component stage is not that boundary. Static versioned assets may
use immutable caching; provider responses require an explicit private caching policy. Cancelled
requests may still incur provider charges, so admission limits cannot rely on browser cancellation.

### Stage 1 — interactive chat and product launch

| ID | Deliverable | Dependencies | Acceptance criteria |
| --- | --- | --- | --- |
| SITE-06 | Generative UI feature page and homepage CTA | SITE-01, SITE-05; qualified Stage 1 demo | Extend existing feature-route and homepage patterns. Explain the supported generation/rendering model, boundaries, installation and integration. Link documentation, supported catalog, demos and methodology. Claims name their task set and measurement scope; no blanket superiority, zero-cost or universal compatibility claims. |
| SITE-07 | Live chat with interactive answers | SITE-02–SITE-05; runtime state/action contracts | Offer useful starter prompts and free-form input; stream structured answers that combine readable prose and working controls. Expose generating, validating, rendering, complete, cancelled and failed states; preserve the last valid answer when appropriate. A form/filter action visibly updates the answer through the documented action contract. Label simulated actions and fixture data. Keyboard users can submit, cancel and inspect output without focus loss. |
| SITE-08 | Showcase hub and recorded fallback | SITE-05–SITE-07 | Provide a discoverable demos hub with outcome cards, concise purpose, prerequisites and mode labels. Ship at least three curated examples across chat, settings/pricing and data-oriented tasks. Recorded playback is explicitly selected or explicitly announced when live service is unavailable; never silently substitute it for live generation. Each example exposes provenance and source. |
| SITE-09 | Source and preview playground | SITE-01–SITE-05 | Provide prompt presets, a custom prompt, rendered preview and separate raw wire/validated document views. Copy/download reproduces the integration using granular published imports. Display validation errors and unsupported catalog members without executing arbitrary code. Cancellation, retry and reset are coherent; source labels stay meaningful while streaming and at narrow widths. |
| SITE-10 | Catalog inspector and usage metrics | SITE-01, SITE-05, SITE-09 | Inspect supported groups, components, required/optional properties and documentation links from the pinned runtime catalog. Show first token, first valid render and completion as distinct measurements; use provider-reported usage where available. Label tokenizer estimates and price estimates with method/date; unknown values remain unavailable. Representation-size ratios are never presented as independently measured provider savings. |
| SITE-11 | Localization and inclusive launch qualification | SITE-06–SITE-10 | Complete all 71 public site locale packs for shell copy, statuses, errors, metadata and navigation; do not deploy draft locale packs. Distinguish shell locale from generated-content language. Qualify RTL, keyboard/screen-reader flow, narrow allocation, theme contrast and reduced motion. Preserve localized crawlable routes, canonical links and language switching. |

Launch requires the live path and its explicit unavailable/exhausted states to pass. Recorded
examples keep the site useful during an outage but do not replace qualification of the hosted live
path. The homepage must remain lightweight: lazy-load the playground, supported catalog and heavy
preview dependencies on their destination routes.

### Stage 2 — interoperability and controlled comparison

| ID | Deliverable | Dependencies | Acceptance criteria |
| --- | --- | --- | --- |
| SITE-12 | Integration and interoperability examples | Published adapter contracts; SITE-09, SITE-11 | Demonstrate the supported transport/provider/framework integrations without consumer-specific patches. Provide exact dependency versions, setup, event/state flow and limits. Supported means a qualified executable example; planned adapters are labeled planned. |
| SITE-13 | Controlled comparison page | Evaluation protocol; SITE-02, SITE-05, SITE-10 | Run or replay an explicitly defined comparison using equivalent task goals and capabilities. Identify model snapshots/settings, catalog/schema context, input/cache accounting, output limits, retries, failures and acceptance rubric. Show raw artifacts and render-success results with measured latency and usage; one run is illustrative, not a benchmark conclusion. Bound multiple-lane live cost before admission. |
| SITE-14 | Methodology and reproducible results | SITE-05, SITE-13; evaluation artifact publication | Link full prompts, versioned schemas/catalogs, harness configuration, samples and raw results. Include task/sample counts, distributions, failures and uncertainty, not only successful examples. Separate fixed-output representation size, model generation, repair and end-to-end interaction measurements. Publish the date and scope of pricing estimates and separate cold/cached inputs. Qualify any historical token-efficiency claims against their original experiment rather than extending them to the new runtime. |

A comparison must not disadvantage a baseline by omitting its normal tooling or supplying Lyra
with richer task information. Where different stacks cannot provide equivalent behavior, disclose
the difference and narrow the claim. Historical application-authoring experiments and generative
wire-format experiments remain separate evidence sets. Replaying published trials is a valid public
mode when clearly identified; public interactive comparisons need not launch expensive benchmark
batches on every click.

### Stage 3 — outcome mini-apps and iterative dashboards

| ID | Deliverable | Dependencies | Acceptance criteria |
| --- | --- | --- | --- |
| SITE-15 | Outcome mini-apps with conversational edits | Qualified state/patch runtime; SITE-07–SITE-11 | Demonstrate a dashboard and at least one non-dashboard mini-app. Follow-up requests change a prior result while preserving unrelated state under the documented contract. Inspect before/after source or patches; recover from invalid edits without corrupting the last valid result. Show real action effects and identify any simulated effects. |
| SITE-16 | Data provenance and tool activity | Qualified tool/data contracts; SITE-04, SITE-15 | Clearly distinguish fixtures, recorded tool results and live data; show source and refresh/capture time. Present pending/success/error tool activity and partial failures without leaking credentials or raw private payloads. Start with public or fixture datasets; account connections and private data need a separately reviewed authentication and retention design. |
| SITE-17 | Save, share and export options | SITE-04, SITE-05, SITE-15 | Start with explicit downloadable artifacts and optional opt-in local saving with delete/reset controls. Restore only validated version-compatible documents. Local browser storage is a single-browser convenience, never multiuser application persistence. Public sharing is a separately gated feature: explicit consent, clear visibility, redaction, size/expiry limits and deletion behavior; never publish a live prompt or tool payload by default. |
| SITE-20 | Saved application dashboards and multiuser publishing showcase | Core host persistence, authentication, ACL, revision and application-route contracts; SITE-04, SITE-15–SITE-17 | Demonstrate author → save draft → publish → another viewer opens the application route → permitted fork/edit → save a new revision. A public curated example may use fixture documents and simulated roles only when every simulated identity, permission and persistence step is clearly labeled. An authenticated real-sharing showcase is separately qualified against host APIs and durable application persistence. Enforce view/edit/publish/fork permissions on the server, resolve document/catalog versions and revision conflicts, and fetch data under each viewer’s own authorization. Never imply that a shared URL grants access to underlying data or that local storage proves multiuser persistence. |

The Stage 3 publishing demonstration follows the core application persistence contracts rather than
creating a website-specific document store or authorization model. Published dashboards have stable
application routes and explicit visibility; edits use the qualified revision/draft workflow, and a
fork creates a separately owned document according to host policy. Qualification covers unauthorized
view/edit attempts, revoked access, version incompatibility and concurrent edits. Curated fixture
playback can explain this journey before an authenticated showcase is available, but its labels
must make clear that no real cross-user persistence or authorization is being exercised. The simpler
local save/export option can ship earlier without implying completion of SITE-20.

### Stage 4 — advanced capabilities and sustained evidence

| ID | Deliverable | Dependencies | Acceptance criteria |
| --- | --- | --- | --- |
| SITE-18 | Advanced demonstrations | Corresponding advanced runtime contracts; SITE-11, SITE-15, SITE-16 | Add richer layouts, large data, advanced components or connectors only after their own runtime qualification. Declare optional peers and capability limits. Preserve responsive behavior, accessible actions, bounded resource usage and error recovery; expand catalog coverage through explicit fixtures rather than marketing counts. |
| SITE-19 | Versioned evidence and release maintenance | SITE-14; library release process | Publish which package/catalog/model versions each example and result qualifies. Revalidate affected fixtures and integration examples on upgrades; retire incompatible recordings or keep them explicitly versioned. Re-run relevant evaluations before changing performance claims. Track demo load cost and render responsiveness separately from provider latency; document limitations and dates. |

## Qualification and release sequence

1. Qualify and publish the runtime contracts needed for the intended stage. Website pins and
   examples consume reviewed published packages; an unpublished checkout is not a public dependency.
2. Establish the Stage 0 service, validation/isolation, privacy and evidence boundaries before
   opening paid live generation. Test provider calls with stubs and isolated storage; ordinary
   browser tests must not submit real requests or consume provider budget.
3. Deliver Stage 1 as a coherent launch: feature page, CTA, chat, showcase, source playground,
   declared catalog, observable failures and complete locale packs. Verify the public build,
   website type checking, relevant backend suites and supported browser checks. Inspect desktop,
   narrow and RTL layouts and the actual interactive states.
4. Deploy the website/service only through their explicitly authorized release processes. Verify
   version identity, streaming proxy behavior, cache/CSP headers, service-disable behavior and
   rollback readiness. A bounded provider smoke run is a separate controlled qualification action.
5. Add Stage 2 comparisons only with published methodology. Deliver Stage 3 and Stage 4 as their
   upstream contracts qualify; keep planned capabilities visibly distinct from released ones.

Required failure coverage includes incomplete SSE frames, split Unicode, invalid/oversized output,
unsupported components, provider timeout/error, exhausted budget, rate limiting, cancellation,
network loss, reconnection, repeated submission and stale completion. Qualification must also show
that a failed run cannot escape the preview boundary or retain/expose a prompt through logs, caches,
share links or an unrelated session.

## Effort and decisions

Plan approximately **3–5 engineering weeks after the required runtime contracts are qualified** for
a bounded marketing/demo delivery covering the hosted foundations, Stage 1 and initial controlled
comparison. This is a conditional scope estimate, separate from core runtime development, not a
calendar commitment. Full translation review, provider procurement, advanced connectors and later
mini-app capabilities may extend elapsed time and require separate estimates.

Before implementation, resolve the initial provider/model and spend envelope, anonymous versus
account-based admission, hosting ownership, supported catalog, three launch fixtures, retention
policy, comparison baselines and translation-review ownership. Prefer the existing site architecture
and published catalog/reference pipeline; do not introduce a second marketing system or couple the
public demonstration service to Admin.
