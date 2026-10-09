# Imports and registration

## Component status, versioning, and deprecation

Every public `lr-*` component has an explicit status and `since` version in the package metadata.
`since` is the earliest published Lyra UI release manifest that contained the tag; for a component
introduced by the current release, it is the current package version.

- **Stable** components are supported for production use. An incompatible public API or behavior
  change requires a semver-major release.
- **Experimental** components are still open to design review, but they are not exempt from
  compatibility promises: once published, their public APIs receive the same full-semver protection
  as stable components until they are formally deprecated and removed.

Deprecation is explicit metadata, not an implication from status. Each deprecated component or
member names a replacement, a deprecation version, a rationale, and the earliest permitted removal
version. If an API is deprecated in major version M, it remains available for the complete M+1
release line and cannot be removed before M+2. This policy applies equally to stable and
experimental public APIs.

**9.0.0 took a one-time exception to that policy, and says so rather than quietly breaking it.**
Three members whose recorded removal window had genuinely opened were removed normally
(`lr-tool-call-chip`/`lr-message-parts`' `lr-tool-chip-select`, and `lr-flow-canvas`'
`--lr-flow-canvas-node-current-outline-color`). Alongside them, a small set of members that had
_never_ been deprecated were renamed and their old spellings removed in the same release, without the
customary M+1 warning period — `lr-usage-badge`'s `compact`, `lr-chart`'s `horizontal`,
`lr-rag-answer`/`lr-retrieval-results`' `error`, `lr-ingestion-queue`'s
`virtualizeThreshold` → `virtualizeAt`,
`lr-knowledge-base`'s `lr-kb-*` events, `lr-data-grid`'s `columns`/`filename` option fields, and
`lr-test-results`' two legacy detail-slot spellings, plus the component-specific
`LyraModelCatalog`/`LyraVoiceCatalog` aliases in favor of the shared `LyraCatalog<T>`. Every one has
a mechanical migration listed in the 9.0.0 changelog entry and in `migration.md`. From 9.0.0 onward
the M+2 rule applies as written; treat the above as a documented exception, not a precedent.

Deprecation records also cover contracts that are not a single member. Deprecated **slot
content** is a kind of content inside a slot that stays supported (for example, content other than
items in a menu's default slot); the slot's own description says which content is deprecated.
Deprecated **package entry points**, **stylesheets**, **exported types/functions/constants**, and
**global events/root attributes** are listed under "Deprecated package exports" at the end of
`llms/index.md`. Deprecated named exports also carry `@deprecated` in their declarations for editor
feedback. Each component's own deprecations
are listed in its `llms/components/<tag>.md` header and in `custom-elements.json` (from `@aceshooting/lyra-ide`; the declaration's
`deprecations`, with a member's `deprecationRef` identifying its record as `kind:name`).
The standard `deprecated` field remains available to generic CEM readers. These records are the complete
list of deprecated APIs; audit an upgrade against them, not against console output.

**Development warnings.** The `development` package condition includes runtime diagnostics; the
default production condition omits them. Some deprecations log a development-mode `console.warn` naming the
element or package module, the deprecated API, and its replacement. A warning only ever fires for
usage that can be observed cheaply and exactly — setting a deprecated property or attribute,
connecting a deprecated tag, vetoing through a deprecated alias event, or calling a deprecated
function — and **not every deprecated API
warns**: many deprecations have no runtime warning, among them `lr-icon`'s `auto-width`,
`lr-stat`'s default-slot icon and `lr-menu`'s non-item default-slot content. Deprecated CSS parts, custom properties, and
custom states are styling hooks a component cannot observe, so they never warn. A silent console
is therefore not evidence that an application uses no deprecated API. Where a warning exists, it
fires once per page for each element name or module and deprecated API, and only when Lit runs its
development build; production builds never warn. The deprecated form keeps working either
way, and moving to the replacement removes the warning. A test suite that fails on console output
while deliberately exercising a deprecated form can pre-seed Lit's development-mode
`globalThis.litIssuedWarnings` set, before the element renders, with the key
`lyra-deprecated:<owner>:<kind>:<name>` — `<kind>` and `<name>` as in the deprecation record.
`<owner>` is the element name or package-relative module specifier. Theme migration guidance is in
[styles and tokens](styles-and-tokens.md).

### Release history and upgrade notes

`since` records when a tag first appeared, not later changes. Before upgrading, read the
package's [CHANGELOG.md](../../CHANGELOG.md) (current major, including minor and patch).
Family-wide breaking-change summaries open each authored `llms/<family>.md`, and each generated
`llms/components/<tag>.md` header links its family summary. `llms/migration.md` covers only
`wa-*`/`sl-*` renames, not Lyra release history.

The major-version landmarks after 9.0.0 are:

- **10.0.0:** removed eligible members deprecated during 9.x and made the public-contract
  corrections listed in its changelog entry; follow that entry's per-member migration guidance.
- **11.0.0:** carried no known consumer-breaking change; consumers upgrading from 10.x were not
  expected to change code.
- **12.0.0:** removed the inherited static `LyraElement.getPropertyDescriptor()` surface after Lit
  deprecated that finalization hook. Ordinary component consumers need no migration; only subclasses
  that themselves overrode the hook are affected. Collection snapshot enforcement moved to a
  decorator-agnostic accessor seam instead.

- **24.0.0:** removed eligible v22 compatibility routes, including package-root component
  constructors, duplicate nested registration entries, the combined `ssr-loader.js` entry, and the
  retired theme/preset facade. Use stable tag-shaped registration entries, a component's
  registration-free `.class.js` subpath, the split SSR/hydration entries, and the current style API.
  The [v23-to-v24 migration guide](v23-to-v24-migration.md) gives the removed routes, ordered
  consumer cleanup and retained-profile instructions.

### The support window

Compatibility promises are bounded by a published support window, not by "evergreen browsers":
Chromium 120+, Gecko 121+, WebKit 16.4+, and Node 22+ (ESM only; there is no CommonJS entry point).
Those floors are derived from platform features the source actually uses — `:dir()`, `:has()`,
`@container`, `color-mix()`, `ElementInternals` form association — because the package ships
untranspiled ES2022 modules with no polyfills and no build-time downleveling. There is deliberately
no `browserslist` field: it would describe a build step this package does not have. The version
floors are derived from those platform features rather than individually verified version-by-version.
Raising any floor is a semver-major change. Full policy, including the known WebKit
cross-shadow-selection gap and the
rule for when a `@supports` fallback may be dropped:
<https://github.com/aceshooting/lyra-ui/blob/main/docs/support-policy.md>.

## Importing and registering components

Every component has a stable, tag-shaped side-effect entry point that registers its own tag. Use
`components/<tag>.js`; this public boundary stays unchanged if the internal family folders move:

```js
import "@aceshooting/lyra-ui/components/lr-combobox.js"; // registers <lr-combobox>
import "@aceshooting/lyra-ui/components/lr-table.js"; // registers <lr-table>
```

Family barrel entries remain supported and register their family. Class-only `.class.js` entries
use their owning family/component path because they intentionally expose source organization and
do not register a tag.

New application code can import any component through its stable tag-shaped path:

```js
import "@aceshooting/lyra-ui/components/lr-context-menu.js";
import "@aceshooting/lyra-ui/components/lr-menubar.js";
import "@aceshooting/lyra-ui/components/lr-tool-call-block.js";
```

`llms/index.md` lists every tag and its owning implementation module. The stable tag-shaped alias
and the supported family barrel each resolve through the package's component exports.

The package root is a pure, side-effect-free export surface. Import a component entry to register
only that tag, or use the explicit `all.js` entry when whole-library registration is needed:

```js
import "@aceshooting/lyra-ui/all.js"; // explicitly registers the root-included tags
```

The package root does not re-export component constructors. Import a class from its owning
component's `.class.js` subpath; import the stable tag-shaped entry to register it. The root remains
a side-effect-free home for shared utilities and types. Family registration barrels and `all.js`
remain side-effectful convenience entries; prefer tag-shaped imports for smaller application
bundles.

The entry points, then:

- **Class without registration.** Each entry has a `.class.js` sibling exporting the class (and the
  `HTMLElementTagNameMap` augmentation) without touching `customElements`:
  `import { LyraTable } from '@aceshooting/lyra-ui/components/data/table/table.class.js';`. Use it
  for subclassing, `instanceof` checks, or type-only imports.
- **Duplicate package copies.** Re-registering the same constructor is silent and idempotent. If a
  different Lyra constructor already owns a tag, the first definition remains active and Lyra emits
  one warning for that exact conflict with the existing/incoming package versions, constructor
  names, and both constructor references. An existing non-Lyra definition is reported with an
  `unknown` existing version rather than guessed provenance.
- **Root barrel.** `import '@aceshooting/lyra-ui';` registers **nothing**. It re-exports a broad
  compatibility surface of commonly used classes, helpers, and types,
  but it is not an exhaustive promise that every component-owned type or future export is present.
  Prefer the owning component entry in application code, both for the smallest bundle and the
  complete contract of that component.
- **`all.js` compatibility entry.** `import '@aceshooting/lyra-ui/all.js';` registers the 293
  root-included tags — everything **except** the 15 inventory-designated optional-peer-family tags:
  `lr-chart` and its 8 typed subclasses (`lr-line-chart`, `lr-bar-chart`, `lr-pie-chart`,
  `lr-doughnut-chart`, `lr-radar-chart`, `lr-polar-area-chart`, `lr-bubble-chart`,
  `lr-scatter-chart`), `lr-box-plot`, `lr-histogram`, `lr-map`, `lr-graph`,
  `lr-knowledge-graph-explorer` and `lr-geojson-viewer`. Those always need their own subpath import,
  from `all.js` exactly as from the root — the entry deliberately preserves the optional-peer
  isolation contract rather than putting `chart.js`, `maplibre-gl`, or the `d3-*` set on the
  critical path of every install. It is the one import that defeats tree-shaking.
  (Server-side, `@aceshooting/lyra-ui/ssr/all.js` is the counterpart that _does_ register the
  complete inventory, optional-peer families included; see "SSR and declarative shadow DOM".)
- **Document anchor/highlight types.** The granular document-viewer entry owns and exports
  `LyraAnchor`, `LyraAnchorKind`, `LyraHighlight`, `LyraHighlightTone`,
  `AnchorTargetCapabilities`, `HighlightActivateDetail`, `TextSelectDetail`, and
  `AnchorResultDetail`. The registration-free root now intentionally re-exports these contracts,
  together with `LyraAnchorTarget` and `LyraAnchorTargetEventMap`, and all are semver-covered:
  ```ts
  import type {
    LyraAnchor,
    LyraHighlight,
    AnchorTargetCapabilities,
  } from "@aceshooting/lyra-ui/components/lr-document-viewer.js";
  ```
  Prefer the granular entry for component-local imports; use the root export when an application
  deliberately shares the contracts across several viewer integrations.
- **`lr-flag`** registers from the barrel, but resolving a flag by `country`/`language` (rather than
  a pre-resolved `src`) additionally needs
  `import '@aceshooting/lyra-ui/components/media/flag/flag-peer.js';` once.
- **Other subpaths.** `@aceshooting/lyra-ui/theme.css` (ready-made light/dark theme, including the
  document token layer),
  `@aceshooting/lyra-ui/looks/shadcn.css` (opt-in shadcn/ui look, imported after `theme.css` — see
  [The shadcn look](./styles-and-tokens.md#the-shadcn-look--looksshadcncss)),
  `@aceshooting/lyra-ui/tokens-root.css` (the document token layer alone, for pages that do not
  use `theme.css`; link one of the two, not both),
  `@aceshooting/lyra-ui/native.css` (opt-in native-element styles inside `.lr-native`),
  `@aceshooting/lyra-ui/utilities.css` (opt-in light-DOM layout/text/typography utilities),
  `@aceshooting/lyra-ui/theme.js` (the zero-dependency style runtime),
  `@aceshooting/lyra-ui/localization.js` (side-effect-free locale runtime),
  `@aceshooting/lyra-ui/autoloader.js` (side-effect-free on-demand tag loading),
  `@aceshooting/lyra-ui/autoloader-cdn.js` (browser-guarded auto-start side effect),
  `@aceshooting/lyra-translations/<locale>.js` (the sixty-six message catalogs, in the companion package),
  `@aceshooting/lyra-ui/events` (the global typed-event map — types only, no runtime),
  `@aceshooting/lyra-ui/ai` (provider-neutral data types), `@aceshooting/lyra-ui/testing`
  (happy-dom shims, `createLyraEvent()` for building a validated test event, a small set of
  interaction drivers that go through a component's own real activation path, and
  `waitForLyraElement()`/`waitForToast()` for awaiting a lazily registered mount),
  `@aceshooting/lyra-ui/utilities/*` (the curated shared helpers, all documented below).

### Registration-free component helpers

The following focused helpers are public, side-effect-free modules. They do not define a custom
element, so they are suitable for server code, workers, or applications that need the same data
normalization as a component without registering it:

```ts
import {
  DEFAULT_INTERNAL_PATTERNS,
  parseStackTrace,
  STACK_TRACE_LIMITS,
} from '@aceshooting/lyra-ui/components/agent-tools/stack-trace/stack-trace-parse.js';
import {
  MAX_RENDERED_LYRA_SPANS,
  normalizeLyraSpans,
} from '@aceshooting/lyra-ui/components/agent-tools/trace-tree/span.js';
import {
  agentStatusMessage,
  agentStatusVariant,
} from '@aceshooting/lyra-ui/components/agent-tools/agent-status-presentation.js';
import {
  approvalAction,
  approvalDecision,
} from '@aceshooting/lyra-ui/components/agent-tools/approval-state.js';
import { DEFAULT_WIDGET_TYPE_REGISTRY } from '@aceshooting/lyra-ui/components/conversation/widget-renderer/default-registry.js';
```

Their companion type exports remain on those same paths: stack parsing exposes `StackFrame`,
`StackGroup`, `StackTraceParseOptions`, and `StackTraceParseResult`; span projection exposes
`LyraSpan`, `LyraSpanKind`, `LyraSpanStatus`, and `LyraSpanProjection`; status and approval helpers
expose their respective presentation and decision types. The status helpers are `agentStatusKind`,
`agentStatusLabel`, `agentStatusMessage`, `agentStatusVariant`, `isAgentStatusTerminal`, and
`isAgentStatusActive`; approval also exports `ApprovalAction` and `ApprovalDecision`; span also
exports `normalizeLyraSpanKind` and `normalizeLyraSpanStatus`; the widget registry module exports
only `DEFAULT_WIDGET_TYPE_REGISTRY`. Import a component registration entry separately when the page
also renders that component.

### Optional autoloader

`@aceshooting/lyra-ui/autoloader.js` exports `discover(root?, options?)`, `start(root?, options?)`,
and `stop()`. It can load each known Lyra tag independently, allowing bundlers to split components
while granular imports remain independent. Importing this entry alone has no side effect and
registers nothing.

- `discover()` scans once. `start()` performs the same initial scan, then observes dynamic and
  Turbo-style replacement subtrees; a later `start()` stops the previous watcher. `stop()` is
  idempotent, disconnects it, invalidates pending definitions, and removes loader-owned markers.
- The optional root is a `Document`, `DocumentFragment`/open `ShadowRoot`, or `Element`; the default
  is `document`. Caller-owned open shadow roots are traversed iteratively. Each element resolves
  against its owning/scoped custom-element registry rather than an unrelated global registry.
- `maxElements` (default `10_000`), `maxRoots` (`2_000`), `maxDepth` (`256`), and `maxWork`
  (`100_000`) bound one complete discovery operation. `maxConcurrency` (`16`) bounds concurrent
  definition and first-update tasks. Invalid limits throw `RangeError`; an initial `discover()` or
  `start()` preflights its currently rendered tree and rejects a traversal-limit failure before
  loading it. Newly rendered shadow content remains under the same cumulative ceilings, but a
  failure found there necessarily follows the parent definition that rendered it.
- A discovered element carries `data-lr-autoload-pending` until its class is defined and its first
  `updateComplete` settles. The exported `AUTOLOADER_PENDING_ATTRIBUTE` is that exact string. A
  pre-existing consumer-owned marker is never removed by the loader.
- `{ events: true }` emits bubbling/composed `lr-autoload-preload`, `lr-autoload-loaded`,
  `lr-autoload-error`, and `lr-autoload-traversal-error` events on the supplied root. Detail is
  `{ tag, optionalPeers }`, plus the caught `error` for the error event. `loaded` means the registry
  definition exists; the pending marker remains authoritative until first render finishes. A
  watched insertion that exceeds a traversal ceiling emits the traversal event with
  `{ limit, maximum, error }`. A statically over-limit insertion launches no definitions from that
  insertion; a later failure in its first-update shadow content leaves the already loaded parent
  intact. Later work can still retry.
- Optional-peer tags are skipped by default. `optionalPeers: ['dompurify', 'postal-mime']` enables
  a tag only when the allowlist contains **all** packages recorded for it; `optionalPeers: 'all'`
  is for an installation that deliberately provides the entire peer set. A failed import clears
  its marker and in-flight cache, so a later scan or insertion can invoke the loader again.
  Browser caching of failed native module fetches can still prevent a new network request;
  clearing the loader cache does not clear the browser's module map.

```ts
import { start, stop } from "@aceshooting/lyra-ui/autoloader.js";

await start(document, {
  optionalPeers: ["dompurify", "postal-mime"],
  events: true,
});
// Later, when this application no longer owns the rendered subtree:
stop();
```

`@aceshooting/lyra-ui/autoloader-cdn.js` is the separate side-effect entry. It auto-starts only
when `document` exists and reads `data-lyra-optional-peers="peer-a,peer-b"` plus the boolean
`data-lyra-autoload-events` from its own `<script>`. Add `data-lyra-autoloader` to that script when
an ESM CDN executes the package entry behind a wrapper URL. Neither entry imports the root barrel,
and both are safe to import in plain Node.

## Optional native scoped registries

`utilities/scoped-registry.js` exports `supportsScopedRegistries()` and
`createScopedRegistry(definitions, { document? })`. Native support is optional and checked at
runtime; unsupported browsers and SSR reject creation explicitly. No polyfill or global fallback
is installed. Ordinary component registration imports keep their existing global behavior.

Use class-only imports and provide full tag names, including composed children:

```js
import { createScopedRegistry, supportsScopedRegistries } from '@aceshooting/lyra-ui/utilities/scoped-registry.js';
import { LyraChangeReview } from '@aceshooting/lyra-ui/components/agent-tools/change-review/change-review.class.js';
import { LyraDiffView } from '@aceshooting/lyra-ui/components/utility/diff-view/diff-view.class.js';

if (!supportsScopedRegistries()) throw new Error('This view needs native scoped registries.');
const scope = createScopedRegistry({
  'lr-change-review': LyraChangeReview,
  'lr-diff-view': LyraDiffView,
});
const root = scope.attachShadow(document.querySelector('#review-host'));
const review = scope.createElement('lr-change-review');
root.append(review);
```

Each handle owns `registry`, a Lit-compatible `creationScope`, `createElement(name)`,
`attachShadow(host, options = { mode:'open' })`, and `define(name, class)` for late definitions.
Per-scope subclasses retain `instanceof` the imported class. Nested Lit templates and shadow roots
use that scope. Missing template definitions throw; they never consult the global registry.
`define` is idempotent for the same source class and rejects a conflicting class. It upgrades
parser-created elements in the scope. Use it instead of calling `registry.define` directly.

For applications that do not want to list internal child classes, a separate optional loader
uses the generated registration graph's transitive closure:

```js
import { loadScopedRegistry } from '@aceshooting/lyra-ui/utilities/scoped-registry-loader.js';
const scope = await loadScopedRegistry(['lr-approval-queue']);
const queue = scope.createElement('lr-approval-queue');
scope.attachShadow(document.querySelector('#agent-host')).append(queue);
```

The catalog loads class-only modules for the requested closure. It does not install optional-peer
integration bridges; peer-backed components still need their dependencies. The explicit-map
entry does not load this catalog. Direct Lit rendering into the root should pass
`{ creationScope: scope.creationScope }` as its render options.

Create a separate handle for each owning document, supplying `{ document: targetDocument }` when
needed. Attaching a root in another document throws. Existing roots, scoped SSR/hydration, and
adopting an existing scoped tree into a different document are outside this API. Caller-created
DOM nodes retain their original construction registry. Arbitrary imperative global element
creation in third-party factories is not intercepted; those factories must use the handle.

## Collection identity

Every host-supplied collection has one explicit identity policy. An actionable or keyed collection
uses a stable, nonempty business identity and ignores malformed identities plus later duplicates
before rendering, counting, focus reconciliation, selection lookup, persistence, or event dispatch.
The first valid occurrence wins and reordering the input does not turn its array position into its
identity. When repeated values are intentionally meaningful, the component keeps them and exposes
an occurrence index in every state or event that must address one occurrence; the relevant
component section says so.

Lyra-owned controlled properties and action details name the domain instead of overloading the
platform's `HTMLElement.id`: for example `panelId`, `commandId`, `cellId`, `stepId`, `viewId`,
`attachmentId`, `cueId`, `highlightId`, and `spanId`. Controlled active/persisted fields and event
details use the same domain name. Compound identities retain every required scope field (for
example `{ invocationId, sourceKey }`). Published input-record schemas may retain an established
generic `id`/`key`/`path` spelling; the component still applies its documented uniqueness or
occurrence policy and exposes domain-named controlled state and action details.

Treat an empty or whitespace-only required identity as missing. Unless a component's contract
explicitly documents and tests an input normalization such as trimming surrounding whitespace,
Lyra does not rewrite a valid retained identity merely to validate it. When normalization is part
of that contract, the normalized value is the identity used consistently for duplicate detection,
selection, persistence, keyed DOM ownership, and event details. Assign a new collection when the
data changes, and keep the business identity stable across object replacement so those consumers
continue to follow the same logical record.
