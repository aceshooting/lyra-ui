# Lyra Gen companion

`@aceshooting/lyra-gen` is independently versioned. Pin the installed version,
check its Lyra UI peer range and release status, then read its `README.md` and the relevant guide
below. Package, view-format and catalog versions are separate contracts. Use granular imports;
the root registers no elements, while `@aceshooting/lyra-gen/gen-view.js` registers `lr-gen-view`.
Use only entries in the installed package's explicit `exports` map. Its `examples/` files are
application source recipes, not importable package subpaths; `docs/compatibility.md` owns the
implementation-path migration and separately experimental entry boundary.

The 1.x compatibility contract covers the declared view/chat/dashboard, static SSR, pinned SDK
and owned protocol profiles; only `adapters/a2ui-candidate.js` is an experimental exported API.
Read the installed compatibility guide's qualification limits before making release or performance
claims; provider/comparator campaigns and human assistive-technology review are not implied.

## Choose and validate the boundary

- Keep existing widget-v2 documents on `lr-widget-renderer`; a Gen view uses `version: '1'`, an
  exact catalog reference, a surface/revision and explicit unique node ids.
- Select the smallest reviewed catalog with `subsetCatalog()` or `selectCatalogPreset()` from
  `catalog.js`. Catalog roles map to trusted components; registration does not expose their full
  APIs. Read the selected property schemas, child/slot rules and required accessible names.
  A subset must include each role's required child roles (`catalog.dependency` otherwise); optional
  ones (`alert`/`empty` -> `button`) may be omitted and are then rejected under that parent.
- `buildCatalogPrompt()` and `exportCatalogJsonSchema()` from `prompts.js` supply request context,
  not a provider client or proof of provider schema support. Keep transport and token budgets in
  the host. Runtime `validateView()` from `runtime.js` remains required for every input route.
- `parseMarkup()` from `parser.js` parses restricted data syntax, never HTML/JSX/JavaScript.
  Quoted strings and JSON-valued properties do not authorize expression evaluation. Never send
  rejected input through `innerHTML`, an HTML viewer or an evaluator.
- Partial input stays inert. Markup streams expose syntax results at `finish()`; JSON streams
  validate there. Island parsers expose closed blocks that still need `validateView()`; the chat
  controller validates before publication. Preserve prose and localized per-boundary fallbacks.

```ts
import { initialCatalog, subsetCatalog } from '@aceshooting/lyra-gen/catalog.js';
import { validateView } from '@aceshooting/lyra-gen/runtime.js';

const selected = subsetCatalog(initialCatalog, ['stack', 'heading', 'text']);
if (!selected.ok) throw new Error('The requested catalog is unavailable.');
const admitted = validateView(receivedValue, selected.value);
// Render only admitted.value when admitted.ok is true, using the same selected catalog.
```

## Composite answer blocks

`answerBlocksCatalog()` from `catalog.js` is an opt-in overlay (id `<base id>+blocks`) adding
`kpi-row`, `comparison` and `steps`. Each is expanded during validation into `row`/`stat`, `table`
and a read-only `stepper`, with child ids `<id>--<index>`. Generate views against the overlay's own
catalog reference; the base catalog and stored views are unchanged.

## Opt-in error isolation

Strict rejection is the default. Pass `recovery: 'isolate'` to `validateView`, the parse routes,
chat options or `<lr-gen-view recovery="isolate">` to replace a component-local failure (bad
properties, unknown role, missing accessible name) by an in-place fallback while siblings keep
their state, focus and actions; check `result.isolated`. Identity, binding, action, URL/security,
budget and root failures still reject the whole view. Persist the original input, not an isolated
view, and isolate again on load.

## Preserve state and host authority

Bind `.document`, `.catalog` and JSON-valued `.bindingState` as properties. For `.controlled`
edits, handle `lr-gen-state-change` and supply the accepted values. Keep a generated element stable
across sibling prose updates; refinements retain logical ids and advance the same surface's
revision. `applyViewPatch()` checks the expected revision. Reassigning `.bindingState` replaces
local state, so do not replay an old value over newer edits. `lr-gen-ready` reports renderer/child
update settlement, not remote-data completion; focus and completion announcements remain host-owned.

Authorize every `lr-gen-action` at the actual effect boundary. Catalog `confirm` actions require
`.confirmAction(action, signal)`; an absent callback denies them. Respect cancellation and stale
surface/viewer context. Catalog loaders, property adapters, URL sinks and field collection are
trusted host capabilities: follow `docs/security.md`, including exact approved-field policy when
required. Generated prose and labels do not establish safe collection intent or grant permissions.

Use viewer-authorized data maps; generated references do not fetch URLs or confer credentials.
Saved dashboards need server authorization and atomic conditional writes. Stored answers use
explicit approved catalog migrations preserving original and dirty state; dashboard envelope
migrations are separate. Unsupported identities need a visible localized fallback. `repairView()`
uses a host transport, bounded actual usage and a current generation/view/state guard; commit its
candidate only while that generation remains current. Never repair identity, security or resource
failures into acceptance.

## Own language separately from data

`@aceshooting/lyra-translations` matches the **Lyra UI** version, not the independent Gen version.
Its full catalogs include core chrome and the seven `genView*` renderer messages in the
`conversation` slice; slice imports also need the families/shared keys used by child controls.
Override renderer messages through `.strings` or `registerLyraLocale()` and supply host-localized
`strings` to `createChatStream()`. Generated prose and caller labels stay application content. The host chooses
requested prose language and display locale separately and applies `lang`/`dir`. Preserve finite
JSON numbers and ISO dates where the schema admits them; format display values through the
component/host locale rather than replacing source data with localized strings.

## Read the guide for the task

Paths below are relative to the installed companion. Follow their exact APIs and examples rather
than expanding this skill into a second API reference.

| Task | Guide |
|---|---|
| Presets, schemas, examples and structured inputs | `docs/catalog-presets.md`, `docs/structured-input.md` |
| Local scripted Markets, Weather and editable travel-budget walkthrough | `docs/guided-demo.md` (example-owned en/fr/ar copy; no model request) |
| Chat, stable `renderPart` shells and SDK parts | `docs/interactive-chat.md`, `docs/ai-sdk.md` |
| Rendering, state, readiness and approval | `docs/rendering.md`, `docs/approval.md` |
| Saved/live dashboards | `docs/dashboards.md`, `docs/dashboard-composition.md` |
| Completion, repair and stored answers | `docs/recovery-and-diagnostics.md`, `docs/stored-answer-migrations.md` |
| Server snapshots | `docs/ssr.md` |
| Protocol profiles and release evidence | `docs/a2ui.md`, `docs/compatibility.md`, `docs/threat-matrix.md` |

A deterministic example, synthetic replay, schema export or adapter is not evidence of model
quality, latency, accessibility review, production hosting or full protocol conformance. Report
only the installed profile and verification actually performed; unmet roadmap criteria remain pending.
