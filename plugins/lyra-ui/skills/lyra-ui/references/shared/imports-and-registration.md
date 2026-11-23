# Imports and registration

## Component status, versioning, and deprecation

Every public `lr-*` component records a status and `since` version in package metadata. `since`
is the earliest published release manifest containing the tag, or the current version for a new tag.

- **Stable** components support production use.
- **Experimental** components remain open to design review.

Once published, both statuses have full-semver protection until formal deprecation and removal; an incompatible
public API or behavior change requires a semver-major release.

Deprecation is explicit metadata, independent of status: it records a replacement, deprecation version,
rationale and earliest removal version. An API deprecated in major M remains available throughout
M+1 and cannot be removed before M+2, for stable and experimental APIs alike.

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

Deprecation also covers **slot content** inside a supported slot, such as non-item menu content;
the slot description identifies it. Deprecated **package entry points**, **stylesheets**,
**exported types/functions/constants**, and **global events/root attributes** appear under
"Deprecated package exports" in `llms/index.md`. Named exports also carry `@deprecated` for editors.
Component records appear in the `llms/components/<tag>.md` header and `custom-elements.json`
(from `@aceshooting/lyra-ide`): declaration `deprecations` contain records, and a member's
`deprecationRef` identifies one as `kind:name`. Generic CEM readers can use `deprecated`.
These records are exhaustive; audit upgrades against them, not console output.

**Development warnings.** The `development` package condition includes deprecation diagnostics;
the default production condition omits them. With Lit's development build, some deprecated usages
emit `console.warn` naming the element or module, API and replacement, once per page for each
owner/API. Observable usages include setting a deprecated property/attribute, connecting a tag,
vetoing through an alias event or calling a function. Deprecated forms keep working; adopting the
replacement removes the warning. Production never emits these deprecation warnings.

Warnings require cheap, exact observation. Many deprecations never warn, including slot content and unobservable CSS
parts, custom properties and custom states. A silent console does not prove absence of deprecated
usage. Tests deliberately exercising it can pre-seed Lit's development-mode
`globalThis.litIssuedWarnings` set before rendering with
`lyra-deprecated:<owner>:<kind>:<name>`: `<kind>`/`<name>` come from the record; `<owner>` is the
element name or package-relative module specifier. See [styles and tokens](styles-and-tokens.md)
for theme migration.

### Release history and upgrade notes

`since` records when a tag first appeared, not later changes. Before upgrading, read the
package's [CHANGELOG.md](../../CHANGELOG.md) (current major, including minor and patch).
Family-wide breaking-change summaries open each authored `llms/<family>.md`, and each generated
`llms/components/<tag>.md` header links its family summary. `llms/migration.md` covers only
`wa-*`/`sl-*` renames, not Lyra release history.

The [archived v23-to-v24 migration guide](https://github.com/aceshooting/lyra-ui/blob/main/docs/archive/llms/shared/v23-to-v24-migration.md) gives the removed routes, ordered consumer
cleanup and retained-profile instructions. Use stable tag-shaped registration entries, a component's
registration-free `.class.js` subpath, the split SSR/hydration entries, and the current style API.

### The support window

The published support window is Chromium 120+, Gecko 121+, WebKit 16.4+ and Node 22+ (ESM only,
no CommonJS entry). These floors derive from `:dir()`, `:has()`, `@container`, `color-mix()` and
`ElementInternals` form association, not individual version-by-version verification. Lyra ships
untranspiled ES2022 modules without polyfills or build-time downleveling. There is no `browserslist`
field: it would describe a build step Lyra does not have. Raising a floor is semver-major. Full policy, including WebKit's
cross-shadow-selection gap and conditions for dropping a `@supports` fallback:
<https://github.com/aceshooting/lyra-ui/blob/main/docs/support-policy.md>.

## Importing and registering components

Every component has a stable, tag-shaped side-effect entry point that registers its own tag. Use
`components/<tag>.js`; this public boundary stays unchanged if the internal family folders move.
Load the token stylesheet first — `theme.css`, or `tokens-root.css` (the document token layer
alone) when the page does not use `theme.css` — with a `<link>` in `<head>` or a bundler CSS import:

```js
import "@aceshooting/lyra-ui/theme.css"; // or tokens-root.css; once per page, before any component
import "@aceshooting/lyra-ui/components/lr-combobox.js"; // registers <lr-combobox>
import "@aceshooting/lyra-ui/components/lr-table.js"; // registers <lr-table>
```

Without either stylesheet, the first registration loads the layer as a separate script on demand
and components hold their first render until it arrives, so a missed import still renders
correctly, one request later.

Family barrels register their family. Registration-free `.class.js` entries retain the owning
family/component path, exposing source organization.

New application code can import any component through its stable tag-shaped path:

```js
import "@aceshooting/lyra-ui/components/lr-context-menu.js";
import "@aceshooting/lyra-ui/components/lr-menubar.js";
import "@aceshooting/lyra-ui/components/lr-tool-call-block.js";
```

`llms/index.md` lists tags and implementation modules; stable aliases and family barrels resolve
through component exports.

The package root is a pure, side-effect-free export surface. Import a component entry to register
only that tag, or use the explicit `all.js` entry when whole-library registration is needed:

```js
import "@aceshooting/lyra-ui/all.js"; // explicitly registers the root-included tags
```

The root exports shared utilities/types, not component constructors. Use a component's owning
`.class.js` for its class and tag-shaped entry to register it. Family barrels and `all.js` remain
side-effectful conveniences; prefer tag imports for smaller bundles.

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
- **Root barrel.** `import '@aceshooting/lyra-ui';` registers **nothing**. Its broad compatibility
  surface of commonly used classes, helpers and types is not exhaustive for component-owned types
  or future exports. Prefer the owning entry for that component's complete contract and smaller
  bundles.

- **`all.js` compatibility entry.** `import '@aceshooting/lyra-ui/all.js';` registers the 306
  root-included tags — everything **except** the 15 inventory-designated optional-peer-family tags:
  `lr-chart` and its 8 typed subclasses (`lr-line-chart`, `lr-bar-chart`, `lr-pie-chart`,
  `lr-doughnut-chart`, `lr-radar-chart`, `lr-polar-area-chart`, `lr-bubble-chart`,
  `lr-scatter-chart`), `lr-box-plot`, `lr-histogram`, `lr-map`, `lr-graph`,
  `lr-knowledge-graph-explorer` and `lr-geojson-viewer`. Those always need their own subpath import,
  from `all.js` exactly as from the root — the entry deliberately preserves the optional-peer
  isolation contract rather than putting `chart.js`, `@aceshooting/lyra-map`, `maplibre-gl`, or the `d3-*` set on the
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
  `@aceshooting/lyra-ui/theme-core.css` (the same without the built-in Shadcn, Glass and Emerald
  profile, for a single-look application),
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
  `@aceshooting/lyra-translations/<locale>.js` (the eighty message catalogs, in the companion package),
  `@aceshooting/lyra-ui/events` (the global typed-event map — types only, no runtime),
  `@aceshooting/lyra-ui/ai` (provider-neutral data types), `@aceshooting/lyra-ui/testing`
  (happy-dom shims, `createLyraEvent()` for building a validated test event, a small set of
  interaction drivers that go through a component's own real activation path, and
  `waitForLyraElement()`/`waitForToast()` for awaiting a lazily registered mount),
  `@aceshooting/lyra-ui/utilities/*` (the curated shared helpers, all documented below).

### One runtime per document

Active Lyra components and overlay utilities in a `Document`, including lazy chunks, must share
one evaluated `@aceshooting/lyra-ui` graph. Identical versions/archive bytes can still produce
separate runtimes through different optional-peer contexts. Matching versions or avoiding tag
conflicts does not share Escape, focus, modal inertness, scroll-lock or native-modal coordination.
Shadow roots/scoped registries do not isolate these resources; separate documents are independent.

Choose the application that owns UI and its required optional peers. For a Vite application whose
project root directly depends on UI, configure
[`resolve.dedupe`](https://vite.dev/config/shared-options#resolve-dedupe):

```js
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: { dedupe: ['@aceshooting/lyra-ui'] },
});
```

A shared build root without that dependency must explicitly select the owning application's
public UI exports. For Vite 8, this example uses a
[pre-enforced resolver](https://vite.dev/guide/api-plugin#plugin-ordering) and the same resolver
in [dependency optimization](https://vite.dev/config/dep-optimization-options#optimizedeps-rolldownoptions):

```js
import { createRequire } from 'node:module';
import { defineConfig } from 'vite';

const application = createRequire(new URL('./app/package.json', import.meta.url));
const resolveUi = () => ({
  name: 'application-ui-runtime',
  resolveId(source) {
    return /^@aceshooting\/lyra-ui(?:\/.*)?$/u.test(source)
      ? application.resolve(source)
      : null;
  },
});

export default defineConfig({
  resolve: { dedupe: ['@aceshooting/lyra-ui'] },
  plugins: [{ ...resolveUi(), enforce: 'pre' }],
  optimizeDeps: { rolldownOptions: { plugins: [resolveUi()] } },
});
```

Replace `./app/package.json` with the owning application's manifest. UI's current default public
exports support `createRequire().resolve()` without assuming install layout or importing CommonJS.
Import-only companion exports instead require an ESM entry resolved in their owning application.
Retain that UI context's required optional peers and companion worker/renderer identity checks;
deduplicating incompatible peers does not repair them.

Reusable libraries should peer-depend on UI and externalize its root and every public subpath,
without bundling a separate copy. Verify actually served development dependencies and production
module graphs, including lazy imports: development optimization can collapse copies that remain
split in production. Alias the whole package, never an internal owner or diagnostic module.

Active use of a second instrumented runtime emits one `[lr-runtime-duplicate]` warning per
document, including when versions match. It detects an unsupported split runtime; it does not
merge or repair overlay state. Passive imports and SSR do not claim a document. If the document's
diagnostic marker cannot be used, `[lr-runtime-diagnostic-unavailable]` is bounded to once per
runtime per document; components continue to operate. A throwing console logger does not abort
connection or overlay acquisition. Silence is not proof of correct bundling: older uninstrumented
copies and partial internal deduplication can escape detection. Keep the whole-package singleton
configuration even when no warning appears.

### Registration-free component helpers

These public, side-effect-free helpers share component data normalization without defining custom
elements, for server, worker or application code:

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

### Single script tag (no build step, no import map)

`@aceshooting/lyra-cdn` is a companion package with a pre-bundled build of the same components: lit,
tslib and Floating UI are inlined into relative, code-split chunks, so one tag is the whole install.
Only the components the page renders are fetched (the autoloader's lazy loaders become chunks).

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@aceshooting/lyra-cdn@VERSION/dist/theme.css">
<script type="module" src="https://cdn.jsdelivr.net/npm/@aceshooting/lyra-cdn@VERSION/dist/lyra-ui.loader.js"></script>

<lr-button variant="primary">Save</lr-button>
```

It versions together with `@aceshooting/lyra-ui`; pin an exact version in production. Also published
beside the loader: `theme.css`, `theme-core.css`, `density.css`, `accents.css`, `design-tokens.css`,
`native.css` and `utilities.css`.

- The loader starts the autoloader on `DOMContentLoaded` (immediately when the document is already
  parsed) and keeps watching insertions. It injects no styles or inline script.
- Script attributes: `data-lyra-optional-peers="dompurify,postal-mime"` (or `all`),
  `data-lyra-autoload-events`, the opt-out `data-lyra-autoload="false"` (alias
  `data-lyra-no-autoload`), which loads the module without starting it (it re-exports `start`,
  `stop` and `discover`), and `data-lyra-cloak-timeout` (milliseconds, default `2000`).
- Cloaking: elements carrying class or attribute `lr-cloak` are revealed when the first scan
  settles, or when the cloak timeout elapses, whichever comes first. Pair it with `.lr-fouce-hidden`
  from `utilities.css` to hide not-yet-defined tags.
- Optional peers and the non-English catalogs of `@aceshooting/lyra-translations` are not bundled.
  A component that needs one takes its usual localized fallback until the dependency resolves, for
  example through an import map to a CDN URL.
- Bundler users keep importing `@aceshooting/lyra-ui` itself; the CDN build ships no source maps.

### Optional autoloader

`@aceshooting/lyra-ui/autoloader.js` exports `discover(root?, options?)`, `start(root?, options?)`
and `stop()`. It independently loads known tags for component splitting; granular imports stay
independent. Importing it has no side effects or registrations.

- `discover()` scans once. `start()` scans, then watches dynamic/Turbo-style replacement subtrees,
  stopping any previous watcher. Idempotent `stop()` disconnects it, invalidates pending definitions
  and removes loader-owned markers.
- Root defaults to `document`: accept a `Document`, `DocumentFragment`/open `ShadowRoot` or
  `Element`. Traverse caller-owned open shadows iteratively and use each element's owning/scoped
  custom-element registry, never an unrelated global registry.

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

### Loading from a CDN with no build step

An import map lets plain HTML use the same bare specifiers as an application. The ESM CDN rewrites
each package's own dependencies, so map only the entries you import:

```html
<script type="importmap">
  {
    "imports": {
      "@aceshooting/lyra-ui/": "https://esm.sh/@aceshooting/lyra-ui@30/",
      "lit": "https://esm.sh/lit@3",
      "lit/": "https://esm.sh/lit@3/"
    }
  }
</script>
<script type="module">
  import '@aceshooting/lyra-ui/autoloader-cdn.js'; // defines each lr-* tag when it first appears
  import { allDefined } from '@aceshooting/lyra-ui/utilities/defined.js';
  await allDefined({ timeout: 5000 }); // resolves after the page's lr-* tags are defined
</script>
<lr-button>Hello</lr-button>
```

Pin an exact version for production, and import `components/lr-<tag>.js` instead of the autoloader
when the page uses only a few tags. Add `data-lyra-autoloader` to the autoloader `<script>` if the
CDN serves the entry behind a wrapper URL. Without an import map, use the full CDN URL in each
`import`. `startLoader`/`stopLoader` are accepted aliases of the autoloader's `start`/`stop`.

## Optional native scoped registries

`utilities/scoped-registry.js` exports `supportsScopedRegistries()` and
`createScopedRegistry(definitions, { document? })`. Creation checks optional native support and
rejects unsupported browsers/SSR; no polyfill or global fallback is installed. Ordinary registration
imports retain global behavior.

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

Each host collection declares an identity policy. Actionable/keyed collections require stable,
nonempty business identities: ignore malformed identities and later duplicates before rendering,
counting, focus reconciliation, selection lookup, persistence or events. First valid occurrence
wins; reordering never makes array position its identity. Intentionally repeated values remain,
with an occurrence index in every state/event addressing one; the component documents this.

Controlled properties, persisted/active fields and action details use the same domain names rather than
`HTMLElement.id`: e.g. `panelId`, `commandId`, `cellId`, `stepId`, `viewId`, `attachmentId`, `cueId`,
`highlightId` and `spanId`. Compound identities retain all scope fields, e.g.
`{ invocationId, sourceKey }`. Published input records may retain established `id`/`key`/`path`
spellings while applying their documented uniqueness/occurrence policy and exposing domain-named
controlled state/action details.

Empty/whitespace-only required identities are missing. Valid retained identities are not rewritten
for validation unless the component explicitly documents and tests normalization, such as trimming.
Then use the normalized identity consistently for duplicates, selection, persistence, keyed DOM
ownership and event details. Assign a new collection when data changes; retain business identities
across object replacement so consumers follow the same logical records.
