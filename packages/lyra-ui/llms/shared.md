## Component status, versioning, and deprecation

Every public `lr-*` component has an explicit status and `since` version in the package metadata.
`since` is the earliest published Lyra UI release manifest that contained the tag; for a component
introduced by the current release, it is the current package version.

- **Stable** components are supported for production use. An incompatible public API or behavior
  change requires a semver-major release.
- **Experimental** components are still open to design review, but they are not exempt from
  compatibility promises: once published, their public APIs receive the same full-semver protection
  as stable components until they are formally deprecated and removed.

An experimental component graduates to stable only after its documented API, populated
accessibility state, behavior in Chromium, Firefox, and WebKit, and compatibility contract pass
maintainer review and release qualification. A stable component keeps that status only while those
contracts remain release-blocking.

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

### The support window

Compatibility promises are bounded by a published support window, not by "evergreen browsers":
Chromium 120+, Gecko 121+, WebKit 16.4+, and Node 20+ (ESM only; there is no CommonJS entry point).
Those floors are derived from platform features the source actually uses — `:dir()`, `:has()`,
`@container`, `color-mix()`, `ElementInternals` form association — because the package ships
untranspiled ES2022 modules with no polyfills and no build-time downleveling. There is deliberately
no `browserslist` field: it would describe a build step this package does not have. CI proves the
current stable build of each engine (the full suite on Chromium, a contract subset on Firefox and
WebKit, on Node 20 and 22); the version floors are derived rather than tested. Raising any floor is
a semver-major change. Full policy, including the known WebKit cross-shadow-selection gap and the
rule for when a `@supports` fallback may be dropped:
<https://github.com/aceshooting/lyra-ui/blob/main/docs/support-policy.md>.

## Importing and registering components

Every component has a stable, tag-shaped side-effect entry point that registers its own tag. Use
`components/<tag>.js`; this public boundary stays unchanged if the internal family folders move:

```js
import "@aceshooting/lyra-ui/components/lr-combobox.js"; // registers <lr-combobox>
import "@aceshooting/lyra-ui/components/lr-table.js"; // registers <lr-table>
```

The older family-shaped registration paths remain supported for compatibility. Class-only
`.class.js` entries still use their owning family path because they intentionally expose source
organization and do not register a tag.

Principal v8 and compatibility registrations use the same exact shape:

```js
import "@aceshooting/lyra-ui/components/lr-page.js";
import "@aceshooting/lyra-ui/components/lr-video.js";
import "@aceshooting/lyra-ui/components/lr-video-playlist.js";
import "@aceshooting/lyra-ui/components/lr-native-time-input.js";
import "@aceshooting/lyra-ui/components/lr-pan-zoom.js";
import "@aceshooting/lyra-ui/components/lr-split-panel.js";
import "@aceshooting/lyra-ui/components/lr-alert.js";
```

`llms/index.md` lists every tag and its owning implementation module. The stable tag-shaped alias
and the family-shaped compatibility path both resolve through the package's `./components/*`
export.

**Breaking in 8.0.0 — the package root no longer registers anything.** Through 7.x, importing the
bare `@aceshooting/lyra-ui` root had the side effect of defining every non-optional-peer tag, so a
project that only wanted a type or a helper from it silently pulled 268 component definitions into
its eager bundle. The root is now a pure, side-effect-free export surface, and the registrations
moved to an explicit entry:

```js
import "@aceshooting/lyra-ui/all.js"; // exactly the pre-8 root behaviour, opted into by name
```

_Nothing was removed from the root's named surface._ Every class, helper, and type it exported in
7.x is still exported, from the same specifier; `all.js` re-exports that identical surface, so
`import { LyraTable } from '@aceshooting/lyra-ui';` and the `@aceshooting/lyra-ui/all.js` form of it
both keep working. Only the registration side effect changed.

_Migrating._ If a bare `import '@aceshooting/lyra-ui';` (or a bundler entry that relied on it) was
how your tags got defined, add the `/all.js` specifier — a one-line change with identical behaviour.
If instead the root was only ever imported for values or types, delete nothing: those imports now
cost what they should. The symptom of a missed migration is an unupgraded element — the tag renders
as an empty inert box with its light DOM visible — not a module error, because the specifier still
resolves and still hands back everything it used to.

_Granular imports remain the recommendation._ `all.js` is a compatibility and prototyping
convenience, not the intended production shape: it is side-effectful by definition and cannot be
tree-shaken down to the handful of elements a page actually renders.

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
- **Root barrel.** `import '@aceshooting/lyra-ui';` registers **nothing** (see the 8.0.0 note
  above). It re-exports a broad compatibility surface of commonly used classes, helpers, and types,
  but it is not an exhaustive promise that every component-owned type or future export is present.
  Prefer the owning component entry in application code, both for the smallest bundle and the
  complete contract of that component.
- **`all.js` compatibility entry.** `import '@aceshooting/lyra-ui/all.js';` registers the 268
  root-included tags — everything **except** the 16 inventory-designated optional-peer-family tags:
  `lr-chart` and its 8 typed subclasses (`lr-line-chart`, `lr-bar-chart`, `lr-pie-chart`,
  `lr-doughnut-chart`, `lr-radar-chart`, `lr-polar-area-chart`, `lr-bubble-chart`,
  `lr-scatter-chart`), `lr-box-plot`, `lr-histogram`, `lr-map`, `lr-graph`,
  `lr-knowledge-graph-explorer`, `lr-geojson-view`, and `lr-geojson-viewer`. Those always need their own subpath import,
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
  } from "@aceshooting/lyra-ui/components/viewers/document-viewer/document-viewer.js";
  ```
  Prefer the granular entry for component-local imports; use the root export when an application
  deliberately shares the contracts across several viewer integrations.
- **`lr-flag`** registers from the barrel, but resolving a flag by `country`/`language` (rather than
  a pre-resolved `src`) additionally needs
  `import '@aceshooting/lyra-ui/components/media/flag/flag-peer.js';` once.
- **Other subpaths.** `@aceshooting/lyra-ui/theme.css` (ready-made light/dark theme),
  `@aceshooting/lyra-ui/native.css` (opt-in native-element styles inside `.lr-native`),
  `@aceshooting/lyra-ui/utilities.css` (opt-in light-DOM layout/text utilities),
  `@aceshooting/lyra-ui/theme.js` (the zero-dependency mode/accent runtime),
  `@aceshooting/lyra-ui/localization.js` (side-effect-free locale runtime),
  `@aceshooting/lyra-ui/autoloader.js` (side-effect-free on-demand tag loading),
  `@aceshooting/lyra-ui/autoloader-cdn.js` (browser-guarded auto-start side effect),
  `@aceshooting/lyra-ui/translations/<locale>.js` (the ten shipped message catalogs),
  `@aceshooting/lyra-ui/events` (the global typed-event map — types only, no runtime),
  `@aceshooting/lyra-ui/ai` (provider-neutral data types), `@aceshooting/lyra-ui/testing`
  (happy-dom shims), `@aceshooting/lyra-ui/utilities/*` (the curated shared helpers, all documented below).

### Optional autoloader

`@aceshooting/lyra-ui/autoloader.js` exports `discover(root?, options?)`, `start(root?, options?)`,
and `stop()`. It contains an inventory-generated literal class-module import for every known Lyra
tag, so a bundler can split each component while ordinary granular imports remain independent.
Importing this entry alone has no side effect and registers nothing.

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
  its marker and in-flight cache, so a later scan or insertion can retry it.

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

## Events

Lyra-specific events are `lr-`-prefixed `CustomEvent`s (`lr-change`, `lr-input`, `lr-select`, …),
dispatched through `LyraElement`'s `protected emit<T>(name, detail?, options?)`: **bubbling,
composed, and non-cancelable by default**, with the payload on `event.detail`. A component that
offers a genuine veto point opts into `{ cancelable: true }` and checks `defaultPrevented` before
acting (as `lr-export` does) — that is called out per component. Native wrappers may additionally
relay unprefixed `Event`, `InputEvent`, or `FocusEvent` instances; each component section documents
the exact native names, constructors, bubbling, and cancelability it supports.

Never assume a native DOM event name works: a component mirrors a native contract only where its own
section says so. `preventDefault()` on a non-cancelable event does nothing.

Every one of those names is also typed — per component through its own event map, and globally
through `@aceshooting/lyra-ui/events` for listeners on an ancestor, `document` or `window`. See
"TypeScript" below.

## TypeScript

- **Per-component event maps.** Every component with events exports a `Lyra<Name>EventMap` type, and
  `LyraElement<Events>` declares a typed `addEventListener` overload — so `event.detail` is inferred
  with no cast:
  ```ts
  import { LyraTable } from "@aceshooting/lyra-ui/components/data/table/table.class.js";
  const table = document.querySelector("lr-table") as LyraTable;
  table.addEventListener("lr-sort", (event) => event.detail.key); // typed
  ```
- **`HTMLElementTagNameMap`** is augmented in the `.class.d.ts` files. `document.querySelector('lr-table')`
  is only typed as `LyraTable` when that class module is in the type graph — importing just the
  registration entry (`table.js`) also pulls it in, since the entry re-exports the class module.
- **Generics.** Row/item-carrying components are generic over their data type
  (`LyraTable<T>`, `LyraTableEventMap<T>`, …); annotate the element to keep `detail` payloads typed.
- **Setting object properties from templates** requires a property binding, never an attribute —
  see "Framework integration".
- **Framework template declarations are opt-in.** Import exactly the declaration entry your
  compiler uses once in its type graph:
  ```ts
  import type {} from "@aceshooting/lyra-ui/custom-elements-jsx"; // React 19 / JSX
  import type {} from "@aceshooting/lyra-ui/vue";
  import type {} from "@aceshooting/lyra-ui/svelte";
  ```
  All three are generated from `custom-elements.json` and type the documented properties,
  attribute aliases, events, element refs, and CSS custom properties. Their emitted JavaScript is
  empty: they are declaration merging, not runtime wrappers, and they do not register any tag.
- **Delegated, `document` and `window` listeners: `@aceshooting/lyra-ui/events`.** Component events
  bubble and are composed, so they reach ancestors, `document`, and `window` — but a listener
  attached _there_ has no element type to key off and would otherwise receive a bare `Event`. This
  subpath declares `LyraGlobalEventMap` (all generated Lyra event names) and mixes it into
  `GlobalEventHandlersEventMap`, which types `element`, `document` and `window`
  `addEventListener` calls alike:

  ```ts
  import "@aceshooting/lyra-ui/events";

  document.addEventListener("lr-sort", (event) => event.detail); // typed on document
  ```

  It is **opt-in**: the augmentation only applies once that import is somewhere in the project's
  type graph, so add it once (a root `main.ts`, or a `.d.ts` in the project's `include`). A direct
  element reference never needs it — `LyraElement` overrides `addEventListener`, so
  `table.addEventListener('lr-sort', …)` resolves through `LyraTableEventMap` first either way.
  `LyraGlobalEventMap` is exported as well, for writing your own typed helper over it.

- **The surface is per-event type aliases, not runtime event classes.** `LyraSortEvent` and its
  generated siblings are `type` aliases over the owning component's own map entry
  (`LyraTableEventMap['lr-sort']`) — there is nothing to `new`, and `instanceof LyraSortEvent` is
  not a thing. The module compiles to `export {};`: shipping runtime event subclasses to type a
  listener would cost every consumer runtime bytes for a compile-time concern, so it deliberately
  costs zero.
- **A shared event name narrows to the union of its dispatchers.** One name can come from several
  components with different details — `lr-select` from five, `lr-selection-change` from five — so
  its global entry is the _union_ of their entries, and `event.detail` there exposes only what all
  of them share. Index the owning component's own map when you need one component's exact detail:

  ```ts
  import type { LyraCommandPaletteEventMap } from "@aceshooting/lyra-ui/components/layout/command-palette/command-palette.class.js";

  type PaletteSelect = LyraCommandPaletteEventMap["lr-select"]; // the precise detail
  ```

  Native-named events some form controls re-emit (`blur`, `change`, `focus`, `input`) are
  deliberately **absent** from the global map — they already exist in the DOM's own event maps with
  their standard types, and redeclaring them globally would widen a built-in. Those stay typed
  through the component's own event map.

## Form association

`FormAssociated(Base)` (`@aceshooting/lyra-ui/utilities/form-associated.js`) makes a `LitElement`
form-associated: `static formAssociated = true` plus `attachInternals()` in the constructor, which
eagerly calls
`internals.setFormValue('')` so an untouched control is present in `FormData` as `""` from
construction — matching native `<input>` — instead of being absent.

It adds `name: string`, a non-reflecting live `value: string`, reflected
`defaultValue: string` (attribute `value`), `customError: string | null` (attribute
`custom-error`), `disabled: boolean` (reflected), and `required: boolean` (reflected). These use
hand-written accessors declared with Lit's `noAccessor`, so attribute writes and `internals` calls
happen synchronously rather than waiting for Lit's update cycle.

Mapped controls accept `null` as a setter-only clearing input without changing their getter types:
`.name = null` removes the name and reads back as `''`. The controls that publish a mapped nullable
`value` setter are listed in each control's component reference; ordinary string values clear to `''`, while checkbox
and switch values restore the native `'on'` default and remove their `value` attribute. An explicit
non-null `'on'` reflects `value="on"`. This is a property-assignment spelling only — never write
`name="null"` or `value="null"` in markup.

Every form-associated control exposes element-valued reads from `form` and `getForm()`, plus
`labels`, `validity`, `validationMessage`, `willValidate`, and `effectiveDisabled`. The `form`
setter accepts an owner id, an identified `HTMLFormElement`, or `null`; it reflects/removes the
host's `form` attribute while subsequent reads still return the browser-resolved form element.
Methods include `checkValidity()`, `reportValidity()`, and `setCustomValidity()`.

Native external labels work across the shadow boundary for every form-associated Lyra control:

```html
<label for="display-name">Display name</label>
<lr-input id="display-name" name="displayName"></lr-input>
```

The label text names the internal role owner, and clicking the label focuses text/select-like
controls or activates toggle/button-like controls exactly once. The relationship stays live when
labels are inserted, removed, retargeted, or edited. A host `aria-label` always wins. Compound
controls such as `lr-tool-param-form`, `lr-rubric-form`, and `lr-time-range` put that aggregate name
on an internal `role="group"` while retaining the more specific names of their fields/handles.
Disabled controls, including controls disabled by an ancestor `<fieldset disabled>`, ignore label
activation.

- **Read `effectiveDisabled`, not `disabled`, for the merged state.** `effectiveDisabled` is own
  `disabled` OR an ancestor `<fieldset disabled>`'s cascaded state.
  `formDisabledCallback(fieldsetDisabled)` stores the ancestor state privately, so `disabled` always
  reflects only the consumer's own attribute/property, as native `<input>` does.
- **Validity is real.** `updateValidity()` calls `internals.setValidity({ valueMissing: true }, …)`
  whenever `required` is set and `value === ''`, re-run on every `value`/`required` change and once
  from `connectedCallback()` — so `checkValidity()`/`reportValidity()`/`:invalid`/`:user-invalid`
  reflect actual constraint state.
- **`setCustomValidity(message: string): void`** — the consumer channel for an error no client-side
  constraint can express: a server-side rejection ("that email is already registered"), a
  cross-field rule, a business constraint. A non-empty `message` raises `customError` and becomes
  `validationMessage`, so the control fails `checkValidity()`, blocks submission, and matches
  `:invalid`; `''` clears it. Every value-carrying form-associated control in the library exposes
  it, mixin-based or not.
  ```ts
  const email = document.querySelector("lr-input")!;
  email.setCustomValidity("That address is already registered.");
  form.requestSubmit(); // blocked; the browser reveals this message
  email.setCustomValidity(""); // cleared
  ```
  The method, reflected `customError` property, and `custom-error` attribute are one atomic state:
  a non-empty method/property write reflects the same message, while `setCustomValidity('')`,
  `resetValidity()`, `customError = ''`, or `customError = null` clears validity and removes the
  attribute. Serialized or cloned markup therefore cannot resurrect a message already cleared at
  runtime.
  Two behaviors are inherited verbatim from native controls and are the ones worth knowing.
  **Clearing restores computed validity rather than forcing the control valid** — a
  required-and-empty field whose custom error is cleared is still `valueMissing`. And **the custom
  error outlives everything except another `setCustomValidity('')`**: it survives each intrinsic
  recomputation (every `value`/`required` change re-runs one) and survives `form.reset()`. Clear it
  yourself when the condition that raised it goes away. The message is your content, so it is
  emitted verbatim and never localized — pass a string already in the user's language.
- **`customError` and `lr-invalid`.** Assigning `customError` is the reflected property form of
  `setCustomValidity()`; assign `null` to clear it and remove `custom-error`. Whenever the native
  non-bubbling `invalid` event fires, the host also emits exactly one bubbling, composed
  `lr-invalid` alias with no detail.

  **`lr-invalid` is cancelable, and cancelling it cancels the native event too.** It is one of the
  library's few real veto points: `event.preventDefault()` on `lr-invalid` forwards the cancellation
  to the platform `invalid` event that triggered it, which suppresses that event's default —
  the browser's own validation bubble, and the focus/scroll `reportValidity()` performs on the first
  invalid control. That is what lets an app render its own error banner from `lr-invalid` without the
  native UI appearing alongside it. Nothing else changes: the control is still invalid, still fails
  `checkValidity()`, and still blocks submission.

  ```ts
  form.addEventListener("lr-invalid", (event) => {
    event.preventDefault(); // no native bubble, no auto-scroll
    showMyOwnErrorSummary(event.target as HTMLElement);
  });
  ```

  Leave it uncancelled to keep the platform behavior. The listener has to be attached before the
  validity check runs (`lr-invalid` bubbles and composes, so the form or `document` is a fine place);
  a `preventDefault()` after the fact does nothing.

- **Validation anchoring.** An internal controller passes
  `internals.setValidity(flags, message, anchor)` with `anchor` = the first focusable descendant in
  the shadow root (`input:not([type='hidden']), textarea, select, button, [tabindex]:not([tabindex='-1'])`),
  re-resolved after each render — the browser cannot focus the non-focusable custom-element host when
  native validation UI tries to reveal the invalid control.
- **Live/default dirty semantics.** A `.value` write changes only the live value and marks it dirty;
  it never reflects the `value` attribute. Declarative markup, `defaultValue`, or a later
  `setAttribute('value', …)` updates the current reset default and updates the live value only while
  it is still pristine. `form.reset()` restores that current default and clears the dirty flag.
  `formStateRestoreCallback()` restores string state synchronously without emitting a user event.
- **Who uses the mixin.** Ten classes take it directly — `lr-input` (and its `lr-number-input` /
  `lr-time-input` subclasses), `lr-textarea`, `lr-code-editor`, `lr-otp-input`, `lr-color-picker`,
  `lr-emoji-picker`, `lr-date-input`, `lr-phone-input`, `lr-chat-composer`, and
  `lr-known-date`. Controls with non-string values or markup-derived defaults hand-roll an
  equivalent with the same `setValidity`/default-capture behavior — `lr-slider` because its value
  is numeric (and its range submission has two entries), `lr-combobox` because its value
  can be an array in `multiple` mode, `lr-select` because its default comes from a `selected`
  `<lr-option>` rather than a `value` attribute. Divergences are documented per component.
  `lr-button` and `lr-icon-button` are form-associated only to act as submit/reset controls: they
  carry no value and no validity. `lr-time-range` is form-associated only for fieldset-cascaded
  disablement: no submission value, no state restoration.

### Enter submits the form

A native `<input>` submits its form owner when the user presses Enter. The `<input>` these controls
render has no form owner at all — it lives in a shadow tree, and only the _host_ element
participates in the light-DOM `<form>` — so the platform can never run implicit submission for it,
and Enter in a text field would silently do nothing, which reads as a broken form. Text-entry
controls implement it themselves, to the platform's rules rather than an approximation of them:

- **Modifiers disqualify the keystroke.** `Ctrl`/`Cmd`/`Alt`/`Shift`+Enter is an application
  shortcut (send-and-keep-open, insert-newline, open-in-new-tab), never implicit submission.
- **An IME composition Enter is not a submit.** Enter commits the highlighted candidate in
  Japanese/Chinese/Korean input; submitting there throws away the word being typed.
- **A `keydown` a listener above already `preventDefault()`ed stays vetoed** — an open suggestion
  panel committing a selection, or your own shortcut, keeps the keystroke.
- **The submitter is resolved, not skipped.** The form's default button — the first enabled submit
  control in `form.elements` — is used as the submitter, so `SubmitEvent.submitter`, that button's
  own `name`/`value` entry, and its `formaction`/`formmethod`/`formnovalidate` overrides all
  survive. An `<lr-button type="submit">` is activated through its own `click()`, since a
  form-associated custom element is never a legal `requestSubmit()` submitter.
- **A submit-button-less form submits only from a single field**, matching the platform's rule that
  a form with no default button refuses implicit submission when more than one text-entry field
  blocks it.
- **Validation still runs.** Submission goes through `requestSubmit()`, never `submit()`, so an
  invalid field blocks it exactly as a real submit button would.

**Deliberately not wired everywhere**, because Enter already means something else: `lr-textarea` and
`lr-code-editor` insert a newline (the whole point of a multi-line surface); `lr-select`'s trigger is
a `role="combobox"` where Enter opens the listbox and then commits the active option, per the ARIA
combobox pattern; `lr-date-picker` selects the focused day. A `disabled` or `readonly` control stays
inert either way.

## CSS custom states

Every value-carrying form-associated control publishes its validation state as CSS custom states, so
a light-DOM stylesheet can react to validity without reaching into a shadow root or mirroring the
state onto an attribute of your own:

```css
lr-input:state(user-invalid)::part(input-wrapper) {
  border-color: var(--lr-color-danger-border-loud);
}
```

Six states, in three pairs:

| State                         | Matches when                                           |
| ----------------------------- | ------------------------------------------------------ |
| `required` / `optional`       | the control's `required` is set / is not set           |
| `valid` / `invalid`           | `validity.valid` is `true` / `false`                   |
| `user-valid` / `user-invalid` | the same, **and** the control has been interacted with |

Exactly one of the first two pairs matches at any moment. The third is the one that differs:
**before the control has been interacted with, neither `user-valid` nor `user-invalid` matches** —
and that is precisely what makes the pair worth having. A pristine required field is genuinely
`invalid` from the moment it connects, so a rule on `:state(invalid)` paints an untouched form red
before the user has typed anything; the same rule on `:state(user-invalid)` waits.

"Interacted with" means an `input`, `change` or blur on that control, or a `reportValidity()`
call — which is what a submit attempt runs, so a failed submit switches the `user-*` states on for
every field that failed. `form.reset()` makes the control pristine again and they stop matching.
`setCustomValidity()` participates like any other constraint: raising a custom error flips `invalid`
immediately, and `user-invalid` too if the control has already been touched.

**A control barred from constraint validation publishes neither `valid` nor `invalid`** — and
therefore neither `user-valid` nor `user-invalid`. "Barred" is the platform's own term and the
platform's own list: the control's own `disabled`, an ancestor `<fieldset disabled>`, `readonly`
where the control has it, or anything else that makes `willValidate` false. A native
`<input required disabled>` matches neither `:valid` nor `:invalid`, and these states match native.
This matters because the idiomatic rule is written against the _tag_:

```css
lr-input:state(user-invalid)::part(input-wrapper) {
  border-color: var(--lr-color-danger-border-loud);
}
```

A disabled required field that still published `invalid` painted every greyed-out control in the
form red. `required`/`optional` are unaffected — they describe the attribute, not the validation
outcome, so they keep publishing exactly like native `:required`/`:optional`, and a disabled
required field still matches `:state(required)`. Style the barred case through
`:state(disabled)`/`:disabled` and `:state(readonly)`, not through the validity pair.

The states are published the same way whether a control uses the `FormAssociated` mixin or drives
`ElementInternals` directly, so a rule written against `lr-input` behaves identically on
`lr-checkbox`. `lr-button` and `lr-icon-button` are the exception noted above: form-associated, but
with no value and therefore no validity to publish. Where an engine cannot register a custom state
at all, the styling hook is simply absent — validity, submission blocking and
`checkValidity()`/`reportValidity()` are unaffected, so never make a `:state()` rule the only signal
that a field is wrong.

## The required-field marker

A labelled control with `required` set paints a marker after its label text — by default ` *` in
`--lr-color-danger`. It is **one shared rule**, rendered as an `::after` on the `form-control-label`
part, so it looks and sits identically on every control that has that part, in every family: the
labelled form controls, plus `lr-file-input`, `lr-model-select`, `lr-voice-picker`, and
`lr-tool-param-form`, which marks its _per-field_ labels the same way. A control with no
`form-control-label` part — `lr-checkbox`, `lr-switch`, `lr-radio`, whose default slot _is_ the
visible label — has no label box to hang a marker on and paints none; a control that renders the
part with no label text set paints none either, so no stray glyph is ever orphaned.

Three custom properties control it. Each is read as an inline `var()` fallback at the point of use,
never declared on `:host`, so setting one on **any ancestor** of the control reaches it — and one
declaration on `:root` retunes every marker in the application at once:

| Property                             | Default                  | What it does                                                                                                 |
| ------------------------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `--lr-form-control-required-content` | `' *'`                   | The marker itself, as a CSS `content` string. Must be _quoted_.                                              |
| `--lr-form-control-required-color`   | `var(--lr-color-danger)` | The marker's colour, independent of every other danger surface.                                              |
| `--lr-form-control-required-offset`  | `0`                      | Inline space between the label text and the marker (a logical `margin-inline-start`, so it flips under RTL). |

```css
/* mark the requirement in words, in the page's language */
:root {
  --lr-form-control-required-content: " (required)";
  --lr-form-control-required-color: var(--lr-color-text-quiet);
  --lr-form-control-required-offset: var(--lr-space-2xs);
}

/* or suppress the marker entirely and rely on your own label copy */
lr-input.no-marker {
  --lr-form-control-required-content: "";
}
```

Three things follow from `content` being a consumer-supplied string:

- **It is never localized by the library.** `localize()` covers strings the library authors; this
  one is yours, so a translated marker (` (obligatoire)`, ` (必須)`) is set per locale by the
  application — one declaration on the root element beside whatever else the locale switch changes.
- **The default's leading space is part of the glyph**, which is why
  `--lr-form-control-required-offset` defaults to `0`. A replacement string that omits the space
  should set an offset rather than baking one in, so the spacing stays a length.
- **Suppressing the marker is a styling change, not a semantic one.** `required` still reflects,
  still reaches the accessibility tree through the control's own `aria-required`, still publishes
  `:state(required)`, and still fails `valueMissing`. If the marker is the only way a form
  communicates requiredness, replace it with visible copy rather than removing it.

## The shared styling vocabulary

Four property names carry one meaning library-wide, so a value learned on one component transfers to
every other component that takes it. Each component's own section lists which it accepts and what it
defaults to; the meanings are fixed here.

- **`variant` — semantic tone, and only tone.** `neutral | brand | success | warning | danger`.
  It selects one row of the semantic colour grid below and changes nothing else: not shape, not
  density, not how much of the control is filled in. Nothing in the library spells this concept
  `tone` or `kind`.
- **`appearance` — how a control fills itself, and only that.**
  - `accent` — the loud semantic fill, for the one primary action in a view
  - `filled` — a quiet tint of the same tone, for secondary actions
  - `outlined` — a border with no fill
  - `filled-outlined` — both, for a control that must read as bounded on a busy surface
  - `plain` — neither; text and icon only
- **`frame` — how a container draws its own bounds.** `card | plain`: a bounded, elevated card, or
  dissolved into the surrounding layout. This is a _separate_ property from `appearance` on
  purpose — the two used to share one name for two unrelated jobs, so `appearance="plain"` meant
  "no fill" on a control and "no card chrome" on a panel.
- **`size` — one ladder: `2xs | xs | s | m | l | xl`, defaulting to `m`.** `small`/`medium`/`large`
  are accepted **everywhere** `s`/`m`/`l` are — the Web Awesome and Shoelace spellings, so migrating
  from either is a tag rename with no attribute rewrite. Neither spelling is normalised away in JS;
  the CSS matches both, so `size="medium"` and `size="m"` are the same control and `el.size` reads
  back whatever you assigned.

Every tier resolves through one set of `--lr-form-control-*` knobs — `height`, `font-size`,
`padding-inline`, `padding-block`, `gap`, `radius` — each chaining to a matching
`--lr-theme-form-control-*` input. So a button, an input, a select and a combobox at the same tier
line up in a toolbar row, and an application can compact the whole control scale from one place
without touching a component.

These are exported TypeScript **type aliases**, never `enum`s: an `enum` is nominal, so
`el.variant = 'brand'` would stop type-checking, and it emits a runtime object that costs bytes in a
library whose delivery promise is tree-shaking. Each component's class module re-exports the exact
vocabulary it accepts (for example, `ButtonVariant` or the shared `LyraFrame`), so a consumer never
needs a separate types import.

A small number of components use `variant` for a rendering _mode_ rather than a tone — the shape a
visualizer draws, the skeleton a placeholder mimics. Those unions are component-specific and are
spelled out in that component's own section; the tone vocabulary above is what `variant` means
everywhere a tone is what the property is for.

## Theming and design tokens

Three layers, and **which one you set decides how far the override reaches**:

1. **`--lr-theme-*`** — the application input layer. `theme.css` supplies values on its root and
   light/dark mode selectors; component shadow styles never redeclare them. Set these to retheme.
2. **`--lr-*`** — internal tokens. Themeable base tokens read a `--lr-theme-*` input and use a
   built-in fallback when it is unset. Aliases, computed tokens, and the colour ramp may instead
   resolve through another internal token or a fixed contract value. See
   [the colour ramp and the semantic grid](#the-colour-ramp-and-the-semantic-grid) for how a colour
   resolves through this layer.
3. **`--lr-<component>-*`** — per-component properties, for one element at a time. Listed in each
   component's own section.

### The colour ramp and the semantic grid

Colour has two layers beneath the `--lr-*` tokens you normally read.

**The ramp — `--lr-ramp-<variant>-<step>`.** Five variants (`brand`, `success`, `warning`,
`danger`, `neutral`) × eleven steps (`05 10 20 30 40 50 60 70 80 90 95`). The step number is
approximate perceptual lightness: `-05` is nearly black, `-95` nearly white, `-50` the mid tone. The
ramp is generated in OKLCH, so the same step number reads as the same _apparent_ lightness across
every variant — which is what makes the grid above it predictable rather than 45 separate
decisions.

**Never reference a ramp step directly — from application CSS or from a component's own styles.**
Two reasons, and both fail silently. A step encodes a light-mode choice: `-50` is a comfortable fill
on white and unreadable on a dark surface, so a rule written against it looks correct until someone
switches modes. And the ramp carries no `--lr-theme-*` hook and is re-declared on every `lr-*`
element's own `:host`, so a `:root { --lr-ramp-brand-50: … }` in an application stylesheet is
shadowed at the first component it reaches and changes nothing at all. Read the grid instead; it
picks the right step per mode for you, and it is the layer that _is_ overridable.

**The grid — `--lr-color-<variant>-<role>-<emphasis>`.** `{brand|success|warning|danger|neutral}` ×
`{fill|border|on}` × `{quiet|normal|loud}` = 45 slots. This is the layer components consume and the
layer to build on. Its _shape_ is identical in light and dark; only which ramp step each slot
resolves to changes, so a rule written against it is mode-independent for free.

- `fill` — a background. `on` — text and icons that sit **on** the matching `fill`. `border` — an
  outline.
- `emphasis` runs `quiet → normal → loud`. Louder means more prominent, not lighter or darker: in
  light mode it descends the ramp and in dark mode it climbs it.

**The contrast guarantee is what makes the grid usable without thinking.** For every variant, in
both modes: `on-<e>` clears WCAG 1.4.3's 4.5:1 against `fill-<e>` at the _same_ emphasis — so
`background: var(--lr-color-danger-fill-loud); color: var(--lr-color-danger-on-loud)` is legible by
construction, and no other pairing is promised. `border-normal` and `border-loud` clear 1.4.11's
3:1 against the page surface, so a control's visible bounds are always discernible. `border-quiet`
is deliberately exempt: it exists for decoration that is not load-bearing — a rule between table
rows, a hairline inside an already-bounded card — so never use it as a control's only boundary. All
of this is checked at build time across both modes, not asserted by hand.

**Every slot has its own `--lr-theme-*` override**, named after the slot, so one decision can be
rethemed without forking anything beneath it:

```css
/* Both the grid slot and the flat alias below now resolve to this. */
.invoice-panel {
  --lr-theme-color-brand-fill-loud: #7c3aed;
}
```

The full chain for one colour is therefore: your `--lr-theme-*` input, else the grid slot's default,
else the ramp step it points at. To move a whole tone, set its nine `--lr-theme-color-<variant>-*`
inputs — that is the wholesale route, since the ramp itself is not a consumer override point.

The flat names are aliases into the grid, kept because they read well at the call site:

```css
--lr-color-brand      /* == --lr-color-brand-fill-loud  */
--lr-color-brand-quiet/* == --lr-color-brand-fill-quiet */
--lr-color-on-brand   /* == --lr-color-brand-on-loud    */
```

**Nine generic slots follow the active `variant`.** On a component that takes `variant`,
`--lr-color-{fill,border,on}-{quiet,normal,loud}` — the same shape as the grid, with the variant
segment dropped — resolve to that element's current variant row. `variant="danger"` re-points
`--lr-color-fill-loud` at `--lr-color-danger-fill-loud`, and so on for all nine. The names keep the
grid's tiers so its contrast promise stays readable at the call site: `on-loud` is legible on
`fill-loud` whatever the variant happens to be. Use them in a `::part()` rule that should track the
element's variant instead of pinning one tone:

```css
/* Follows whatever variant the element is set to. */
lr-callout::part(base) {
  background: var(--lr-color-fill-quiet);
  color: var(--lr-color-on-quiet);
}
```

They are declared only on components that actually take a `variant` — six blocks of nine
declarations per shadow root is real weight for an element that would never read them — so treat
them as part of that component's surface, not as an ambient global. On a component with no
`variant`, reach for the fully-qualified grid slot instead.

### Interaction states: hover and press

Two knobs plus a partner colour describe every hover and press in the library:

```css
--lr-color-mix-hover    /* 12% — how far a hovered surface moves */
--lr-color-mix-active   /* 22% — how far a pressed one moves */
--lr-color-mix-partner  /* what it moves toward; defaults to var(--lr-color-text) */
```

**Hover and press are a colour mix, not a brightness filter.** The distinction is the whole design:
`filter: brightness()` multiplies every channel, so it lightens a dark control and darkens a light
one only by coincidence, does nothing whatsoever to a pure white or pure black fill, and — because a
filter applies to the element _and its descendants_ — drags the control's text and icons along with
its background. Mixing toward a partner colour has none of those properties: it is defined on the
fill alone, it always moves, and it moves in the direction the surface actually needs.

Making the partner follow the text colour is what makes the direction automatic. On a light surface
the text is dark, so a hover darkens; on a dark surface it is light, so the identical declaration
lightens. Components write it as:

```css
background: color-mix(
  in oklab,
  var(--lr-button-hover-base),
  var(--lr-color-mix-partner) var(--lr-color-mix-hover)
);
```

where the first argument is the colour the surface moves _away from_ — the fill that tier actually
paints. A chrome-less tier (outlined, plain, link) paints no fill of its own and mixes from the page
surface it sits on instead, which is why hovering one still moves.

Because the two knobs are percentages, a theme can flatten or exaggerate **every** interaction in
the library at once — `--lr-theme-color-mix-hover: 4%` for a restrained UI, `20%` for a punchy one —
without touching a single component. Point `--lr-theme-color-mix-partner` at a concrete colour to
override the follow-the-text behaviour where a surface needs a fixed direction.

### Elevation

Five shadow steps, so elevation carries information instead of one shadow serving every surface:

| Token            | For                                                                              |
| ---------------- | -------------------------------------------------------------------------------- |
| `--lr-shadow-xs` | a raised affordance inside a control — a segmented control's selected thumb      |
| `--lr-shadow-s`  | a small floating handle or a card lifted off the page — slider thumb, stat card  |
| `--lr-shadow-m`  | an anchored, transient surface — menus, dropdowns, popovers, tooltips            |
| `--lr-shadow-l`  | a persistent panel that owns its own region — dialog, drawer, toast, app rail    |
| `--lr-shadow-xl` | the topmost surface on screen — command palette, fullscreen widget, tool dialogs |

`--lr-shadow` is an alias for `--lr-shadow-m`.

**The steps are mode-aware, and that is not cosmetic.** Elevation is a luminance difference, and a
12%-alpha black shadow against a near-black surface is not one — so in dark mode the alphas roughly
triple and the geometry of the two largest steps grows, because a wider, softer shadow is what still
reads as depth when the surface underneath is already dark. The shadow _colour_ is its own token,
`--lr-shadow-color` (a bare `R G B` triple, not a full colour, so each step can apply its own
alpha), which lets a theme tint every shadow in the library from one place:

```css
:root {
  --lr-theme-shadow-color: 30 27 75;
} /* every step now casts an indigo shadow */
```

Reach for the tier that matches what the surface _is_, not the one that happens to look right on the
page you are on — that is what keeps two overlapping surfaces reading in the correct order.

### Cascade layers

`theme.css` declares its layer order up front, then puts all of its own tokens in `lr-theme`:

```css
@layer lr-base, lr-theme, lr-utilities, lr-overrides;
```

- **`lr-base`** — contains the explicitly scoped native-element rules only when the optional
  `native.css` asset is imported.
- **`lr-theme`** — where every `--lr-theme-*` token `theme.css` ships is declared.
- **`lr-utilities`** — contains exact `lr-*` classes only when the optional `utilities.css` asset is
  imported.
- **`lr-overrides`** — named so an application can opt its own rules into a defined position
  relative to Lyra's rather than inventing one.

**The consequence, stated plainly: any _unlayered_ declaration you write beats _every_ layered one,
whatever its specificity and whatever the load order.** So a plain
`:root { --lr-theme-color-brand-fill-loud: … }` in your own stylesheet wins even when your file is
loaded _before_ `theme.css`, and it needs no `!important` and no extra specificity. That is the
point of layering the theme at all: before this, `theme.css` declared its tokens unlayered at
`:root` — specificity (0,1,0), identical to a consumer's own `:root` rule — so whether your
override won came down to which stylesheet the bundler, the `<link>` and the `@import` happened to
emit first. Declaring the order up front also fixes it regardless of the order the stylesheets
themselves load in.

To place your overrides deliberately rather than relying on being unlayered:

```css
@layer lr-overrides {
  :root {
    --lr-theme-color-brand-fill-loud: #7c3aed;
  }
}
```

**Breaking in 8.0.0 — if you wrapped your Lyra overrides in a layer of your own, re-check them.**
That rule used to be compared against an _unlayered_ `theme.css`, which meant it lost
unconditionally, whatever its specificity. Now both sides are layered, so the winner is decided by
**layer order** — and layer order is fixed by whichever name the browser saw first. Import
`theme.css` before your own `@layer` statement and your layer sorts after Lyra's and wins; declare
your layers first and `lr-theme` is appended after them and wins instead. The outcome can therefore
flip in either direction on a change that only moves an `@import`, with nothing in the stylesheet
looking wrong. Two fixes, either is fine:

```css
/* 1. Unlayer them — an unlayered rule outranks all four Lyra layers unconditionally,
      whatever the load order. This is the one that cannot be broken by an import move. */
:root {
  --lr-theme-color-brand-fill-loud: #7c3aed;
}

/* 2. Or keep your layer and pin it after Lyra's, once, before anything else loads. */
@layer lr-base, lr-theme, lr-utilities, lr-overrides, app-theme;
@layer app-theme {
  :root {
    --lr-theme-color-brand-fill-loud: #7c3aed;
  }
}
```

The second form is the one to reach for when the application already has a layer architecture:
re-declaring the order is additive, and the first occurrence of each name is what fixes its
position — so stating all five names yourself pins `app-theme` last no matter when `theme.css`
loads.

### Where an override actually reaches

**Shared computed `--lr-*` design-token outputs are declared on every `lr-*` element's `:host`.**
That includes palette, spacing, radius, typography, and motion outputs such as
`--lr-color-brand`, `--lr-space-m`, and `--lr-radius`. A value for one of those shared outputs set
on an ancestor is re-declared — and lost — at the first `lr-*` element between that ancestor and
the component you meant to style. It never reaches anything nested inside another component.

**`--lr-theme-*` inputs are never redeclared inside a component's shadow styles.** `theme.css`
supplies them on its root and light/dark mode selectors, so an application override inherits normally
through every nested shadow root. **Setting a `--lr-theme-*` input on a wrapper element is the
supported way to retheme one subtree.** Setting a `--lr-*` token there only works for that wrapper's
direct children.

```css
/* Reaches everything in the subtree, however deeply nested. */
.invoice-panel {
  --lr-theme-color-brand-fill-loud: #7c3aed;
}

/* A shared computed output reaches direct lr-* children only — shadowed at the first nested host. */
.invoice-panel {
  --lr-color-brand: #7c3aed;
}
```

Documented component hooks are different: `--lr-<component>-*` properties (plus an upstream
mirror's documented unprefixed spellings) are public inputs. Components consume each public input
through a use-site fallback backed by a private default; they do not redeclare the public name on
`:host`. A component hook therefore inherits through wrappers and nested shadow hosts, while a
value set directly on the component remains authoritative. This makes one wrapper declaration a
reliable way to theme a group of matching components:

```css
.invoice-actions {
  --lr-button-radius: var(--lr-radius-pill);
  --lr-button-fill: var(--lr-color-brand-quiet);
}
```

State and size selectors change only the private fallback. An inherited or direct public value
continues to win in every state and size tier.

**Diagnostic:** if a shared design-token output has no effect on a nested component, check which
layer you set before assuming the component is at fault. If a documented component-specific hook
fails when inherited from a wrapper, that is a component bug; setting the same hook directly on
every host should not be necessary.

**There is no way to tell a live `--lr-*` declaration from a dead one without rendering.** A dead
declaration is byte-identical to a working one in the stylesheet, and nothing in a build reports
it — a test asserting on stylesheet source text (`expect(source).toContain('--lr-token: …')`)
passes just as happily when the token is being shadowed at a nested host. Verify with
`getComputedStyle` on the real element in the real state, and perturb the value deliberately to
confirm the assertion actually bites.

The same trap has a second form inside a component's own styles: a _declared_ value always wins
over a `var()` fallback arm, and `auto` is a declared value. That is why the exact-height escape
hatches (`--lr-input-control-height`, `--lr-select-trigger-height`, `--lr-chip-height`, …) are
undeclared by default rather than set to `auto`. Setting one _to_ `auto` is therefore not the same
as leaving it alone: it wins over the fallback arm and makes the per-size minimum-height floor dead
code. See each control's own reference page for its exact pair.

### Tokens with a contract attached

- **`--lr-theme-icon-button-size`** (default `2.5rem`) backs `--lr-icon-button-size`, the tappable
  box of **every** icon-only control in the library — `lr-icon-button` itself, and the
  expand/clear/toggle affordances inside `lr-date-input`, `lr-combobox`, `lr-input`, and
  `lr-select`. It is a _floor_, not a fixed size. Keep the resolved value **at or above 24px**
  (WCAG 2.2 SC 2.5.8 target size); the default leaves headroom. Lowering it below that shrinks
  every affordance in the library at once.
- **Aligning your own content next to a checkbox or radio.** `--lr-checkbox-label-indent` /
  `--lr-radio-label-indent` publish the label offset, but custom properties inherit _down_, not
  sideways, so a sibling node in your tree cannot read them off the control. Compute the same
  formula from the `--lr-theme-*` inputs you control:
  ```css
  padding-inline-start: calc(
    min(var(--lr-theme-icon-button-size, 2.5rem), 1.75rem) + var(--lr-theme-space-s, 0.5rem)
  );
  ```

**`llms/tokens.md` is the full generated catalog** of every token. It records the theme input and
fallback for themeable tokens, and the resolved alias, ramp, or fixed value for derived tokens —
consult it rather than guessing a token name.

```css
@import "@aceshooting/lyra-ui/theme.css"; /* optional ready-made light + dark base */
:root {
  --lr-theme-color-brand-fill-loud: #7c3aed;
}
```

With `theme.css` imported, switch modes by putting `class="lr-light"`/`class="lr-dark"` (or
`data-lr-theme="light"`/`"dark"`) on any ancestor; it also sets `color-scheme`. Without it, the token
layer still ships a `prefers-color-scheme: dark` fallback that re-points the hardcoded defaults at a
dark palette. Two things switch that fallback off:

- **A real `--lr-theme-*` value**, which the fallback only substitutes for.
- **`data-lr-theme="light"` on the component itself**, which pins light mode regardless of the OS.
  Both layers honour it now: the palette layer always did, and the token layer — the hardcoded
  surface/text/border defaults — does too, so `<lr-card data-lr-theme="light">` on a dark machine is
  light throughout rather than light chrome over a dark colour grid. The mirror-image
  `data-lr-theme="dark"` pins dark on a light machine the same way, and a `.lr-dark` /
  `data-lr-theme="dark"` _ancestor_ is followed as well (through `:host-context()` where the engine
  has it, and through `theme.css`'s inheriting custom properties everywhere else).

Note the asymmetry: the _light_ pin is read on the component itself (`:host([data-lr-theme='light'])`),
while a _dark_ ancestor is followed through `:host-context()`. Putting `data-lr-theme="light"` on
`<html>` — what `theme.js`'s `setLyraTheme({ mode: 'light' })` does — pins the page through
`theme.css`'s real `--lr-theme-*` values, which inherit into every shadow root. Without `theme.css`
there are no such values to inherit, so put the attribute on the components you actually need
pinned.

The token layer also sets `:host([hidden]) { display: none !important; }` and an inherited
`box-sizing: border-box` reset.

### Theme mode/accent runtime (`@aceshooting/lyra-ui/theme.js`)

Flipping the mode class/attribute above is something every app ends up hand-rolling — persist a
choice, apply it on load, avoid the flash of wrong theme before the app boots. `theme.js` is that
runtime, published as its own subpath: **zero dependencies, no Lit, no component imports, and no
side effects on import**, so an app can persist and apply a theme without pulling the component
graph into its first-paint bundle.

```ts
import { setLyraTheme, getLyraTheme } from "@aceshooting/lyra-ui/theme.js";

setLyraTheme({ mode: "dark" }); // unspecified fields keep their current value
setLyraTheme({ accent: "#7c3aed" }); // mode stays 'dark'
getLyraTheme(); // → { mode: 'dark', accent: '#7c3aed' }
setLyraTheme({ mode: "auto" }); // follows the OS, including later changes
setLyraTheme({ mode: "unset", accent: null }); // removes Lyra's override and accent
```

- **`setLyraTheme({ mode?, accent? })`** persists to `localStorage['lyra-theme']`, applies to
  `document.documentElement`, and dispatches `lr-theme-change` on `window` with
  `detail: { mode, accent }`. Fields you omit keep their current value; pass `null` to clear the
  accent. It **never throws** — when `localStorage` is unavailable (private browsing, quota, a
  sandboxed iframe) it degrades to apply-without-persist, and the "fields you omit keep their
  current value" rule still holds across calls in that state: the merge falls back to the last
  theme applied in this session rather than to the default.
- **`getLyraTheme()`** returns `{ mode, accent }`, defaulting to `{ mode: 'auto', accent: null }`
  when nothing is stored or the stored value is malformed. Storage is re-read on every call — no
  in-memory cache — so a value written by another tab or a previous session is picked up cold.
  Where storage is unreadable or unwritable it reports the theme last applied, so the return value
  always describes what the document is actually showing and a toggle UI bound to it stays in sync.
- **`mode`** is `'light' | 'dark' | 'auto' | 'unset'`. `'light'`/`'dark'` set **both
  `data-lr-theme`** (the
  attribute `theme.css` actually keys its palette blocks on) **and `data-theme`** (the generic
  attribute canvas-rendered components watch, so `lr-chart`/`lr-heatmap`/`lr-qr-code` repaint on
  the switch rather than keeping stale colors — see `llms/components/lr-chart.md`). `'auto'`
  resolves `prefers-color-scheme` immediately and keeps following changes. `'unset'` removes both
  attributes; use it when the application owns mode selection through another cascade.
- **`accent`** accepts an absolute CSS color. Lyra keeps `--lr-theme-accent` as a compatibility
  value and derives the complete brand quiet/normal/loud fill, border, paired on-color, and focus
  token ramp as inline `--lr-theme-*` inputs. Each paired foreground is selected for at least
  4.5:1 contrast against its fill; normal/loud borders and focus are adjusted to at least 3:1
  against the shipped mode surface. If an application also replaces that surface input, it must
  recheck or override the paired ramp inputs. Malformed values, CSS-wide keywords, `currentColor`,
  system colors, relative-color syntax, and unresolved `var()` expressions fail closed to
  `accent: null`. Pass `null` to restore the palette supplied by `theme.css`.

  These are `--lr-theme-*` inputs, so they reach every nested shadow root — see "Where an override
  actually reaches" above for why setting a `--lr-*` token instead would not.

**Theme presets.** `@aceshooting/lyra-ui/theme/presets.js` exports
`LYRA_THEME_PRESETS`, `defineLyraThemePreset()` and `applyLyraThemePreset()`. Built-in keys are
`system`, `light`, `dark`, `unset`, `emerald`, `ruby`, `amethyst`, and `sapphire`; the gemstone
presets use system-following mode plus the named accent. Application presets use a stable lowercase
kebab-case `id` and a `theme: { mode?, accent? }` record. `defineLyraThemePreset()` validates the
id and field shapes, freezes both records, and leaves CSS color-syntax validation to the production
runtime when the preset is applied:

```ts
import {
  applyLyraThemePreset,
  defineLyraThemePreset,
} from "@aceshooting/lyra-ui/theme/presets.js";

applyLyraThemePreset("sapphire");
applyLyraThemePreset(
  defineLyraThemePreset({
    id: "application-ocean",
    theme: { mode: "dark", accent: "#22d3ee" },
  })
);
```

Applying a preset uses the production runtime. When every explicitly requested field survives its
runtime validation, Lyra reflects the id to `data-lr-theme-preset` and emits
`lr-theme-preset-change` on `window` with `{ id, theme }`, where `theme` is the complete applied
snapshot. If runtime validation changes a field (for example, an invalid accent fails closed to
`null`), only the ordinary `lr-theme-change` event is emitted and no preset marker is written,
because the resulting state is not exactly that named preset. A direct `setLyraTheme()` call also
removes the preset marker.

**No-flash bootstrap.** `lyraThemeBootstrap` is a self-contained IIFE **string** (not a function),
meant to be inlined into a `<script>` in `<head>` **before any stylesheet**, so the persisted theme
is on the root element before first paint. It reads `localStorage['lyra-theme']`.
`createLyraThemeBootstrap({ storageKey })` returns the same kind of string for an application-owned
key, so an existing persistence layer can reuse the pre-paint half independently of
`setLyraTheme()`/`getLyraTheme()`. Calling the factory with no options returns the same string as
`lyraThemeBootstrap`. The result is a string precisely so this can happen in an unbundled
`<script>` context without shipping or parsing the module. Custom keys are escaped against HTML
script termination and JavaScript line separators. Under a Content Security Policy, give the
inline script the nonce or hash required by the application:

```html
<head>
  <script>
    /* server-inlines lyraThemeBootstrap here */
  </script>
  <link rel="stylesheet" href="/theme.css" />
</head>
```

Both variants read a stored `{ mode, accent }` record, resolve `auto`, and apply the same two
attributes and derived brand ramp as the runtime. A missing or malformed record receives the
runtime's `{ mode: 'auto', accent: null }` default; blocked `localStorage` leaves the document
untouched rather than throwing before your app loads.

### Invalidating canvas theme values

Canvas pixels do not participate in the CSS cascade after they are drawn. Lyra automatically
redraws its canvas renderers when theme attributes, style/link nodes, CSSOM rules, adopted style
sheets, or relevant media-query results change. If an application theme engine changes computed
tokens through another mechanism, call the explicit realm-level invalidation hook afterwards:

```ts
import { invalidateLyraTheme } from "@aceshooting/lyra-ui/utilities/theme.js";

invalidateLyraTheme(); // the global document realm
invalidateLyraTheme(shadowRoot); // the realm owning this root/element/document
```

`invalidateLyraTheme(root?: Document | ShadowRoot | Element): void` coalesces each connected
canvas consumer's redraw to its normal microtask/render schedule. The optional root selects a
browser realm; it does not limit invalidation to a subtree. The function is a no-op during server
rendering and retains no document or stylesheet after the last canvas consumer disconnects.

## Preventing layout shift from lazy-upgrading elements (CLS)

An undefined custom element is an inline box with no intrinsic size, so every `lr-*` in the initial
viewport contributes a reflow as its definition loads. Components that additionally defer on an
optional peer (`lr-chart`, `lr-map`, `lr-flag`, `lr-flow-canvas`, `lr-knowledge-graph-explorer`)
render a skeleton while that peer resolves, which can cost a second shift when the real content
replaces it. Each component is individually well-behaved; the aggregate on a first paint is what
costs a Lighthouse Cumulative Layout Shift score.

Lyra ships an optional, opt-in stylesheet that reserves each component's intrinsic footprint before
upgrade:

```css
@import "@aceshooting/lyra-ui/reservations.css";
```

It styles **only** `:not(:defined)` elements, inside an `@layer lr-reservations`, so it becomes inert
the moment a definition upgrades and can never fight a component's own layout. It sets no colors and
no `:root` rules.

**Every reservation is expressed with the same custom property and fallback token the component's
own stylesheet uses** — `--lr-chart-height` / `--lr-size-280px` for the chart family,
`--lr-flag-aspect-ratio` for `lr-flag`, `--lr-form-control-height` for the field controls, and so
on. That is the point of shipping it rather than documenting measured pixel values: a hand-written
reservation rots silently the moment a component's default changes, whereas these track it, and
theming a component through its documented custom property re-themes its reservation with it.

Hand-rolling equivalent rules is still fine — the pattern is just:

```css
lr-chart:not(:defined) {
  display: block;
  min-block-size: var(--lr-chart-height, var(--lr-size-280px));
}
```

Two things worth knowing:

- A per-instance override needs the matching custom property to be set as well, not only the
  attribute, or the pre-upgrade frame and the upgraded frame will disagree. `<lr-chart height="500px">`
  should carry `style="--lr-chart-height: 500px"` too if it sits above the fold.
- The reservation covers the definition-upgrade shift. A component that then swaps a skeleton for
  peer-resolved content stays stable as long as the reserved box matches the final footprint, which
  is why the reservations target each component's *final* default size rather than its skeleton's.

## Scope: what this library does not provide

Lyra is a component library, not an application framework. The following are deliberately out of
scope, so they are worth not searching the catalog for:

- **Client-side routing.** There is no router and no route-outlet component. URL ownership belongs to
  the application (or its router of choice), because a component library that took it over would
  conflict with every framework router a consumer might already run. The navigation components are
  designed to be *driven* by whatever router you use rather than to own the URL themselves:
  `lr-app-rail-item`, `lr-breadcrumb-item` and `lr-tab-group` all expose their active/selected state
  as ordinary reflected properties, so binding is a one-way write from your route state plus a click
  handler that calls your router. Wire it once in your shell component; there is no Lyra-specific
  pattern to learn.
- **Data fetching, caching, and state management.** Components take data as properties and emit
  events; they never fetch on your behalf, except the documented viewers/`src`-taking components,
  which are explicit about it.
- **Form submission and validation orchestration.** Form-associated controls integrate with the
  native `<form>`/`ElementInternals` contract; the submission lifecycle stays the application's.

## Optional native styles and CSS utilities

Lyra ships two independent light-DOM stylesheets. Neither is imported by the root barrel, a family
barrel, a component entry, or `theme.css`, so applications that do not opt in keep their existing
native-element and utility conventions unchanged.

```css
@import "@aceshooting/lyra-ui/native.css";
@import "@aceshooting/lyra-ui/utilities.css";
```

`native.css` places its rules in `lr-base` and styles native elements only when they are
**descendants** of an explicit `.lr-native` scope. It has no `:root`, `html`, `body`, or unscoped
reset, and the element carrying `.lr-native` is not styled by the native bundle itself. The rules
stay in light DOM: they do not pierce a component's shadow root.

```html
<section class="lr-native">
  <h2>Profile</h2>
  <label for="profile-name">Display name</label>
  <input id="profile-name" />
  <button type="button">Save</button>
</section>
```

`utilities.css` places exact, zero-specificity `:where(.lr-*)` classes in `lr-utilities`. It never
uses a substring class selector, so a class such as `app-lr-flex-preview` does not opt in. Both
assets repeat `@layer lr-base, lr-theme, lr-utilities, lr-overrides`; an ordinary unlayered
application rule therefore beats them regardless of load order.

### Utility class inventory

| Group                       | Exact classes                                                                                                                                                     |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Display and composition     | `lr-block`, `lr-inline-block`, `lr-flex`, `lr-inline-flex`, `lr-grid`, `lr-flow-root`, `lr-stack`, `lr-cluster`, `lr-grid-auto`                                   |
| Flex direction and wrapping | `lr-row`, `lr-column`, `lr-wrap`, `lr-nowrap`, `lr-grow`, `lr-grow-0`, `lr-shrink`, `lr-shrink-0`                                                                 |
| Item alignment              | `lr-items-start`, `lr-items-center`, `lr-items-end`, `lr-items-stretch`, `lr-items-baseline`, `lr-self-start`, `lr-self-center`, `lr-self-end`, `lr-self-stretch` |
| Distribution                | `lr-justify-start`, `lr-justify-center`, `lr-justify-end`, `lr-justify-between`, `lr-justify-around`                                                              |
| Gaps                        | `lr-gap-0`, `lr-gap-xs`, `lr-gap-s`, `lr-gap-m`, `lr-gap-l`, `lr-gap-2xl`                                                                                         |
| Logical sizing              | `lr-inline-full`, `lr-block-full`, `lr-size-full`, `lr-min-inline-0`, `lr-min-block-0`, `lr-max-inline-full`, `lr-max-inline-prose`, `lr-center`                  |
| Overflow                    | `lr-overflow-auto`, `lr-overflow-hidden`                                                                                                                          |
| Text alignment and size     | `lr-text-start`, `lr-text-center`, `lr-text-end`, `lr-text-xs`, `lr-text-sm`, `lr-text-base`, `lr-text-lg`, `lr-text-xl`, `lr-text-quiet`                         |
| Font                        | `lr-font-normal`, `lr-font-medium`, `lr-font-semibold`, `lr-font-bold`, `lr-font-mono`                                                                            |
| Text flow                   | `lr-text-break`, `lr-text-nowrap`, `lr-truncate`, `lr-text-balance`, `lr-text-pretty`, `lr-prose`                                                                 |
| Visibility and focus        | `lr-visually-hidden`, `lr-visually-hidden-focusable`, `lr-fouce-hidden`, `lr-hidden`                                                                              |
| Page allocation             | `lr-page-mobile-only`, `lr-page-desktop-only`                                                                                                                     |

`lr-fouce-hidden` hides only an opted-in custom element while it matches `:not(:defined)`, then
reveals it automatically after registration. `lr-visually-hidden-focusable` becomes visible on
focus or when a descendant receives focus, making it suitable for skip links.

The Page helpers key off the reflected `view` state of their containing `<lr-page>`:
`lr-page-mobile-only` is hidden for `view="desktop"`, and `lr-page-desktop-only` is hidden for
`view="mobile"`. Page derives that state from its own allocated inline size, not the viewport.

### Bundle-specific override hooks

The bundles consume the ordinary shared color, typography, spacing, border, radius, focus, size,
and opacity tokens first. These additional hooks customize only the light-DOM bundle behavior:

| Hook                                      | Default/fallback and use                                                     |
| ----------------------------------------- | ---------------------------------------------------------------------------- |
| `--lr-layout-gap`                         | `--lr-space-m`; default gap for `lr-stack`, `lr-cluster`, and `lr-grid-auto` |
| `--lr-grid-min-inline-size`               | `--lr-size-14rem`; minimum auto-grid item inline size                        |
| `--lr-content-max-inline-size`            | `--lr-size-48rem`; `lr-center` content measure                               |
| `--lr-prose-max-inline-size`              | `65ch`; `lr-prose` and `lr-max-inline-prose` measure                         |
| `--lr-prose-flow-space`                   | `--lr-space-l`; flow spacing between direct prose blocks                     |
| `--lr-prose-quote-padding`                | `--lr-space-l`; logical quote inset                                          |
| `--lr-prose-quote-border-width`           | `--lr-border-width-thick`; logical quote edge                                |
| `--lr-visually-hidden-size`               | `--lr-border-width-thin`; retained hidden box size                           |
| `--lr-native-link-decoration-width`       | `--lr-border-width-thin`; resting underline thickness                        |
| `--lr-native-link-underline-offset`       | `--lr-space-2xs`; underline offset                                           |
| `--lr-native-link-hover-decoration-width` | `--lr-border-width-medium`; hovered underline thickness                      |
| `--lr-native-pre-padding`                 | `--lr-space-m`; preformatted block padding                                   |
| `--lr-native-tab-size`                    | `2`; preformatted tab width                                                  |
| `--lr-native-quote-padding`               | `--lr-space-l`; native blockquote logical inset                              |
| `--lr-native-quote-border-width`          | `--lr-border-width-thick`; native blockquote logical edge                    |
| `--lr-native-control-min-block-size`      | `--lr-icon-button-size`; native control hit-area floor                       |
| `--lr-native-control-padding-block`       | `--lr-space-s`; native control block padding                                 |
| `--lr-native-control-padding-inline`      | `--lr-space-m`; native control inline padding                                |
| `--lr-native-placeholder-opacity`         | `1`; native input/textarea placeholder opacity                               |
| `--lr-native-summary-min-block-size`      | `--lr-icon-button-size`; native summary hit-area floor                       |
| `--lr-native-fieldset-padding`            | `--lr-space-l`; fieldset padding                                             |
| `--lr-native-legend-padding`              | `--lr-space-xs`; legend inline padding                                       |
| `--lr-native-table-cell-padding`          | `--lr-space-s`; caption and table-cell padding                               |
| `--lr-native-rule-space`                  | `--lr-space-l`; horizontal-rule block margin                                 |

## Localization: `locale`, `strings`, and the locale runtime

Every built-in string — button labels, accessible names, descriptions, validation messages, status
announcements, empty/loading states — resolves through the locale runtime. Consumer data and slotted
content are never translated.

Two knobs exist on **every** `lr-*` element, inherited from `LyraElement` and therefore not repeated
in the per-component sections:

- **`locale: string = ''`** (reflected attribute) — per-instance locale override. Empty means "use
  the nearest `locale`/`lang` ancestor".
- **`strings: LyraLocaleStrings = {}`** (property only, no attribute) — per-instance message
  overrides, merged over the registered catalog. Assignment takes an immutable snapshot of up to
  4,096 own enumerable data properties. Mutating the assigned object later has no effect; assign a
  new object to update it. Accessors and malformed entries are ignored per key without being run.

```ts
import {
  registerLyraLocale,
  setLyraLocale,
} from "@aceshooting/lyra-ui/localization.js";

registerLyraLocale("fr", { close: "Fermer", retry: "Réessayer" }); // app-wide, partial catalogs fine
setLyraLocale("fr"); // page-level selection; see the precedence order below
```

```html
<lr-toast .strings=${{ close: 'Fermer' }}></lr-toast>
```

**Which locale a component ends up using.** Four sources, first answer wins:

1. **The component's own `locale`, then its own `lang`.**
2. **The nearest ancestor declaring `locale` or `lang`** (crossing shadow boundaries), except that
   `lang` on `<html>` is not read here — see 4. A `locale` attribute on `<html>` _is_, since that
   attribute is this library's own and can only be a deliberate opt-in.
3. **`setLyraLocale(tag)`**, the page-level selection.
4. **`<html lang>`**, the document default.
5. **`'en'`.**

**Breaking in 9.0.0:** steps 3 and 4 were the other way round, which made `setLyraLocale()` inert on
any page that declares `<html lang>` — i.e. essentially every well-formed page. `setLyraLocale('fr')`
under `<html lang="en">` silently kept rendering English. It now wins. Two consequences: an
application that switched locale by _rewriting_ `<html lang>` still works only if it never also
called `setLyraLocale()` (the explicit call now pins the locale until changed or cleared with
`setLyraLocale('')`), and a per-subtree `lang`/`locale` override is unaffected — it still beats both.

To keep `<html lang>`/`dir` in step with `setLyraLocale()` — which everything _outside_ this library
reads, from `:lang()` rules to spellcheck to a screen reader's pronunciation — use
`bridgeLyraLocale()` from `@aceshooting/lyra-ui/utilities/localization.js` (see
[Shared helpers](#shared-helpers-utilities)).

The side-effect-free `@aceshooting/lyra-ui/localization.js` entry exports
`registerLyraLocale`, `setLyraLocale`, `getLyraLocale`, `getLyraLocaleDirection`,
`getRegisteredLyraLocales`, `subscribeLyraLocaleRegistry`, `resolveLyraLocale`,
`resolveLyraDirection`, `resolveLyraString`, `LYRA_DEFAULT_STRINGS`, and the types
`LyraLocaleStrings`, `LyraLocaleMeta`, `LyraLocaleDirection`, `LyraMessageKey`, `LyraMessage`,
`LyraPluralMessage` and `LyraPluralCategory`. The package root continues to re-export the same
surface for compatibility and remains registration-free in v8; use the dedicated entry when the
application only needs locale setup and the narrower import graph.
**`LYRA_DEFAULT_STRINGS` is the authoritative key list** (matching the `LyraMessageKey` union) —
read it to find the key to override rather than guessing one. Date, number, byte, relative-time and
calendar output goes through `Intl`.

**Locale-tag identity.** Registration, active selection, `getLyraLocale()`, registry enumeration,
component resolution and `bridgeLyraLocale()` all use the same public spelling. `_` remains an input
alias, and structurally valid BCP-47 tags go through the platform canonicalizer, so `PT_BR` becomes
`pt-BR` and deprecated aliases collapse onto their current tag. Private-use-only and short legacy
application tags that the platform canonicalizer rejects remain supported as bounded lowercase
identities. `registerLyraLocale()` and `setLyraLocale()` reject values that are neither valid BCP-47
nor bounded alphanumeric custom tags; an inherited invalid over-complex `locale`/`lang` safely
resolves to English. Structurally valid long BCP-47 tags remain accepted.

**Lookup order for a tag.** Every message resolves through one chain, and `Intl.PluralRules`
category selection walks the same chain, so the two can never disagree:

1. **The BCP-47 truncation walk, most specific first** — `zh-Hans-CN` → `zh-Hans` → `zh`.
   Casing and `_` separators are normalized, so `pt_BR` and `pt-br` are the same key. Lookup chains
   are memoized and capped at 64 candidates. A structurally valid tag beyond the normal complexity
   ceiling retains its exact tag, base language and English fallback without constructing an
   unbounded prefix ladder; malformed over-complex inherited input goes directly to English.
2. **Then any registered, well-formed BCP-47 catalog sharing the base language**, which is how a
   _regional-only_ catalog is reached from a less specific tag: `lang="zh"` and `lang="zh-Hans"`
   both find the shipped `zh-CN` catalog, and `lang="pt"`/`lang="pt-PT"` both find `pt-BR`. Order within this
   step is deterministic and independent of import order — most shared subtags first
   (`zh-Hant-TW` prefers a registered `zh-TW` over `zh-CN`), then alphabetically as the tie-break
   (bare `zh` with both registered picks `zh-CN`). Register the regional tag you actually mean if
   the tie-break isn't the answer you want. Legacy/custom tags are exact/truncation-addressable
   only and do not become regional siblings accidentally.
3. **Then `en`**, always available through the built-in English defaults.

Step 1 always beats step 2: with both `zh` and `zh-CN` registered, `zh-Hans-CN` resolves to `zh`.

```ts
import { getLyraLocaleDirection } from "@aceshooting/lyra-ui/localization.js";

getLyraLocaleDirection("ar-EG"); // 'rtl' — declared by the shipped `ar` catalog, inherited by the region
getLyraLocaleDirection("de"); // 'ltr'
```

`getLyraLocaleDirection(tag): 'ltr' | 'rtl'` answers "does this locale need `dir="rtl"`?" without
an application keeping its own tag table. It reads a `dir` declared by `registerLyraLocale()`'s
optional third argument first (walked through the same chain above, so a region inherits its base
language's declaration), then `Intl.Locale`'s text-info surface where the engine has it, and
finally `'ltr'`. It only _reports_ a direction — nothing in the library applies one; see
[RTL and direction](#rtl-and-direction).

```ts
registerLyraLocale("ar", { close: "إغلاق" }, { dir: "rtl", name: "العربية" });
```

`registerLyraLocale(tag, strings, meta?)`'s third argument is optional catalog metadata —
`{ dir?: 'ltr' | 'rtl'; name?: string }` (`LyraLocaleMeta`). Nothing in it is ever rendered: `dir`
feeds `getLyraLocaleDirection()`, `name` is the locale's endonym for an application's own locale
list. It merges the same way `strings` does, so a later two-argument call adding messages never
drops metadata, and the two-argument call remains the normal way to register a catalog.

Registration snapshots at most 4,096 own enumerable catalog properties before publishing them.
Each accepted value is either a string or a plain/null-prototype CLDR plural record whose own data
properties are string categories and which includes `other`. Nested plural records are cloned and
frozen. Arrays, `null`, inherited properties, accessors and malformed records are ignored per key:
they never execute and never replace that key's last valid translation, while valid sibling keys
still merge. Empty strings remain intentional translations. Per-instance `.strings` overrides use
the same validation, so `resolveLyraString()` always returns a string and malformed overrides fall
through to the next valid tier.

`getRegisteredLyraLocales(): readonly string[]` returns a fresh frozen list of every locale with strings registered via
`registerLyraLocale()`, plus `'en'` (always available through the built-in English fallback),
sorted, deduped and canonically spelled. `subscribeLyraLocaleRegistry(listener: () => void): () =>
void` fires when registry membership grows, including for a newly registered locale that is not
active; extending an existing catalog does not change membership and does not fire it.
`subscribeLyraLocale()` (on `@aceshooting/lyra-ui/utilities/localization.js`) instead fires when the
active selection changes or a registration can alter the active locale's messages/direction, and
filters unrelated registrations. Both return an idempotent unsubscribe. Delivery uses the eligible
starting listener snapshots: one callback failure cannot prevent later active, component or
registry listeners from running. State commits first, then the mutator throws one `AggregateError`
containing all callback failures after delivery completes. `<lr-locale-picker>` is the built-in
consumer of the registry subscription; see `llms/components/lr-locale-picker.md`.

Gotcha: `localize()`'s optional second argument is a fallback string. Passing a defined literal there
silently defeats a registered catalog — omit it, or pass `undefined`.

### Ready-made catalogs: `@aceshooting/lyra-ui/translations/<locale>.js`

Ten full catalogs ship with the package — **`ar`, `de`, `es`, `fa`, `fr`, `he`, `ja`, `pt-BR`,
`ru`, `zh-CN`** — each covering every key in `LYRA_DEFAULT_STRINGS`. They are **side-effect-only
modules**: import one bare, read nothing from it, and it calls `registerLyraLocale()` for you.

```ts
import "@aceshooting/lyra-ui/translations/de.js";
import "@aceshooting/lyra-ui/translations/ar.js"; // declares dir: 'rtl'; direction still comes from dir
import "@aceshooting/lyra-ui/translations/fa.js"; // fa-IR falls back to this base catalog
import "@aceshooting/lyra-ui/translations/he.js"; // he-IL falls back to this base catalog
import "@aceshooting/lyra-ui/translations/pt-BR.js"; // also serves pt and pt-PT
import "@aceshooting/lyra-ui/translations/zh-CN.js"; // also serves zh, zh-Hans and zh-Hans-CN
```

Persian and Hebrew use CLDR plural categories (`fa`: `one`/`other`; `he`:
`one`/`two`/`other`). `ar`, `fa` and `he` declare `dir: 'rtl'`, so `getLyraLocaleDirection()`
answers for them (and for `ar-EG`, `fa-IR`, `he-IL`) — but locale selection still does not _force_
writing direction: set `dir="rtl"` on the page or an ancestor yourself.

`pt-BR` and `zh-CN` are the only Portuguese and Chinese catalogs, and they are regional tags. Step 2
of the lookup order above is what makes them reachable from `lang="pt"`, `lang="pt-PT"`,
`lang="zh"`, `lang="zh-Hans"` and `lang="zh-Hans-CN"` — no separate `pt`/`zh` alias registration is
needed. They are still listed under their real tags in `getRegisteredLyraLocales()`.

Import only the locales the application can actually offer — each is a separate module, so unimported
ones cost nothing. A catalog registered this way is merged like any other, so a later
`registerLyraLocale('de', { close: '…' })` still overrides individual keys, and a per-instance
`.strings` still wins over both. Importing a catalog registers it; it does not _select_ it —
`setLyraLocale()` or `<html lang>` still chooses. What the import does do is make the locale show up
in `getRegisteredLyraLocales()`, and therefore in `<lr-locale-picker>`, so the set you import is the
set a user can switch between.

### Pluralized messages

A message may be a plain string or a **`LyraPluralMessage`** — an object keyed by CLDR plural
category, one string per category the language needs:

```ts
import { registerLyraLocale } from "@aceshooting/lyra-ui/localization.js";

registerLyraLocale("en", {
  viewerSearchMatchCount: { one: "{count} match", other: "{count} matches" },
});
registerLyraLocale("ru", {
  viewerSearchMatchCount: {
    one: "{count} совпадение",
    few: "{count} совпадения",
    many: "{count} совпадений",
    other: "{count} совпадения",
  },
});
```

- **The categories are `zero | one | two | few | many | other`** — the values
  `Intl.PluralRules.prototype.select()` can return. A language uses only the subset its grammar
  needs: English and German `one`/`other`, Russian `one`/`few`/`many`/`other`, Arabic all six,
  Japanese and Chinese only `other`.
- **`other` is required.** It is the terminal step of the category fallback chain, so every
  selection is guaranteed to land on a real string. TypeScript enforces it; the remaining five keys
  are optional. A missing intermediate category widens to a grammatical neighbour before falling
  back to `other`.
- **Selection is driven by `values.count`**, run through `Intl.PluralRules` at the component's
  effective locale — never at the locale the catalog was authored in, so an unregistered locale
  still pluralizes correctly against whatever strings it does have.
- **`pluralCount` is the escape hatch for a pre-formatted count.** When `{count}` must render as
  locale-grouped text (`Intl.NumberFormat` output is a string, and `'1,024'` cannot select a
  category), pass the display string as `count` and the raw number as `pluralCount`. A non-finite
  or absent value selects `other`.

**Breaking in 8.0.0:** a catalog that paired a singular key with a separate `<key>Plural` key must be
rewritten as one object-valued entry. The old spelling is not read, and nothing warns — the plural
key becomes an unused entry and the singular renders for every count. Fold the pair into
`{ one: …, other: … }` under the singular key's name.

## RTL and direction

Direction is inherited from the platform `dir` cascade; locale/`lang` selection does not change it,
and no component forces its own. Pair an RTL locale with `dir="rtl"` — ask
`getLyraLocaleDirection(tag)` rather than hard-coding a list of RTL tags, and note that
`<lr-locale-picker>`'s `lr-change` detail already carries the picked locale's `direction`, so
applying it is `document.documentElement.dir = event.detail.direction`. Layout mirrors through CSS
logical properties. Where physical math is unavoidable — drag ratios, arrow-key direction, anchored
placement — components share one internal direction helper: `isRtl(el)` (used by `lr-multi-split`,
`lr-time-range`, `lr-dock-panel`), plus `rtlAwareSide(side, el)` and `rtlAwarePlacement(placement,
el)`, which swap the `left`/`right` component of a value under RTL and pass it through unchanged
under LTR (`lr-menu` resolves its `placement` this way). These are implementation detail, not a
published subpath — resolve direction in your own code with `getComputedStyle(el).direction`, which
is the same answer through the same inheritance. Test both directions for anything with horizontal
order, start/end
placement, drag deltas, or previous/next navigation.

## Provider-neutral AI types: `@aceshooting/lyra-ui/ai`

The agentic components share one vocabulary, exported as types from a dedicated subpath. Use these
instead of hand-rolling state shapes — they bind field-for-field onto the components, with no
adapter layer:

```ts
import {
  createAgentStreamState,
  reduceAgentStream,
  adaptAiSdkMessage,
  AgUiStreamAdapter,
  adaptA2UiSurface,
  type AgentRun,
  type ChatMessage,
  type MessagePart,
  type RetrievalChunk,
} from "@aceshooting/lyra-ui/ai";
```

- **Run/step state** — `AgentStatusKind`, `AgentStatus`, `AgentStep`, `AgentRun`
- **Conversation** — `ChatMessage`, ordered `MessagePart` variants, `ToolInvocation`
- **Documents & grounding** — `DocumentRef`, `Citation`, `RetrievalQuery`, `RetrievalChunk`,
  `RetrievalScoreBreakdown`, `GroundedClaim`, `GroundingAssessment`, `DocumentLocator`
- **Streaming runtime** — `AgentStreamEvent`, `AgentStreamState`, `createAgentStreamState()`,
  `reduceAgentStream()`, `reduceAgentStreamEvents()`; every event carries a monotonic `generation`
  and strictly increasing `sequence`. A newer generation atomically retires the previous run, while
  an older or replayed cursor is ignored. JSON Patch input is structurally validated and rejects
  prototype-mutating paths.
- **Protocol adapters** — `adaptAiSdkMessage()`, `AgUiStreamAdapter`, and `adaptA2UiSurface()` map
  structural provider messages, events, and documents onto the neutral runtime without pulling
  vendor SDKs into the package. Feed AG-UI events through `new AgUiStreamAdapter().push(event)`.
  Adapter inputs are treated as untrusted data, recursively snapshotted, and rejected without
  throwing when malformed, non-serializable, or over their configured budgets.
- **Resource limits** — pass a partial `AgentStreamLimits` to `createAgentStreamState()`, or adapter
  limit options to the relevant adapter. The exported `DEFAULT_AGENT_STREAM_LIMITS`,
  `DEFAULT_AI_SDK_ADAPTER_LIMITS`, `DEFAULT_AG_UI_ADAPTER_LIMITS`, and
  `DEFAULT_A2UI_ADAPTER_LIMITS` constants document the defaults; invalid limit values fall back to
  them. Runtime breaches become an explicit error state/event, while snapshot/A2UI rejection
  returns `null` or an empty adapter result as documented by that boundary.
- **Message-part invariants** — `MessagePartState` is transport-only (`'streaming' | 'complete'`):
  failures use an `ErrorMessagePart` or the owning domain error. Tool results are a success/error
  union, and a `type: 'data'` part contains exactly one of `data` or `widget`.
- **Event payloads** — `RunLifecycleEventDetail`, `RetrievalProgressEventDetail`,
  `CitationSelectEventDetail`, `ToolApprovalEventDetail`, `CancelEventDetail`, `RetryEventDetail`,
  `ExportEventDetail`

The package's no-emit type-test program asserts that each type still matches the property it feeds
on `lr-chat-message`, `lr-tool-call-chip`, `lr-tool-result-view`, `lr-source-card`,
`lr-attachment-chip`, and `lr-document-preview`. The binding is enforced by `tsc` without shipping
an importable contract module. The types are structural and provider-agnostic: map any vendor's
payload onto them once, at the edge.

### Task-first AI composition guide

- **Render one model response:** `lr-message-parts`; use `lr-chat-message` only when the message
  shell (avatar, author, actions) is also needed.
- **Build the main prompt affordance:** `lr-prompt-input`; it already composes attachments,
  model/voice/source controls, mentions/commands, and `lr-prompt-queue`.
- **Run an agent workspace:** `lr-agent-workspace` + `reduceAgentStream()`; add
  `lr-subagent-panel` for nested runs and `lr-mcp-app` only for executable MCP App resources.
- **Show grounded output:** `lr-rag-answer`; pass claim records for `lr-claim-evidence`, use
  `lr-retrieval-compare` for retrieval tuning and `lr-rag-eval-dashboard` for run metrics.
- **Develop prompts/tools:** `lr-prompt-studio` and `lr-json-schema-viewer`.
- **Build voice sessions:** `lr-realtime-session`; it composes the existing audio visualizer,
  push-to-talk control, and transcript feed while leaving transport ownership with the host.

Family registration entry points are additive: importing
`@aceshooting/lyra-ui/components/conversation`, `/agent-tools`, or `/retrieval` registers and
exports that complete family. Granular component entry points remain the smallest bundles and are
preferred in production.

## Optional peer dependencies

All 28 peers are optional, in two groups. The 25 component-facing peers remain outside the default
install; components load them on demand where applicable. React, Svelte, and Vue are
compile-time-only peers for their matching
opt-in declaration entries (`custom-elements-jsx`, `svelte`, and `vue`): those entries emit empty
JavaScript, no component loads a framework, and Lyra ships no runtime wrapper. `llms/peers.md` is the
generated peer-role/component table. Loading and failure UI for component peers is
component-specific: viewer sections document their localized loading/error/notice states, while
`lr-include` preserves its light-DOM fallback/live region and emits `lr-include-error` when its
sanitizer is unavailable. Some components additionally issue a deduped warning. Consult the owning
component section instead of assuming every peer user renders an `<lr-skeleton>` or the same
degraded state. `lr-phone-input` is the exception to dynamic peer import: it takes a consumer-built
adapter (`loadLibphonenumberAdapter()`) rather than importing `libphonenumber-js` itself.

## Framework integration

Plain custom elements, so they work anywhere — with the usual two caveats. React 19/JSX, Vue 3,
and Svelte 5 projects can opt into the generated declarations shown under "TypeScript" without
installing or shipping a wrapper; import the normal granular registration entry separately.

- **Complex values must be property-bound, not attribute-bound.** An attribute stringifies:
  `rows="[object Object]"`. Use the framework's property syntax for anything that isn't a string,
  number, or boolean: Lit `.rows=${rows}`, Vue `:rows.prop="rows"` (or `.rows="rows"`), Angular
  `[rows]="rows"`, Svelte `bind:this` + assignment, React 19+ passes objects to custom-element
  properties natively (earlier React needs a ref).
- **Events are dashed custom events.** Lit `@lr-change=${…}`, React 19
  `onlr-change={…}`, Vue `@lr-change="…"`, Angular `(lr-change)="…"`, and Svelte 5
  `onlr-change={…}` (or the legacy `on:lr-change={…}`). Earlier React versions use
  `ref.addEventListener('lr-change', …)`.
- **Angular** additionally needs `CUSTOM_ELEMENTS_SCHEMA` in the module/component that uses the tags.
- In-DOM templates lower-case attribute names; camelCase property names only survive in framework
  templates and JS, never in hand-written HTML attributes.

## SSR and declarative shadow DOM

Root, `all.js`, and granular component imports are server-safe under Node 20+.
`@aceshooting/lyra-ui/ssr/all.js` is the **server-only** convenience entry: unlike the browser
`all.js`, it registers the complete inventory including the optional-peer families — defining those
tags never imports their peers (each component loads its own lazily, client-side), and the
browser-bundle argument for excluding them does not apply to a server render. Use the public
`@aceshooting/lyra-ui/ssr-loader.js` entry for the tested Lit SSR contract. Its exported
`LYRA_SSR_SUPPORT_MATRIX`, `LYRA_SSR_RENDER_AND_HYDRATE_TAGS`, and
`LYRA_SSR_CLIENT_RENDER_TAGS` classify every inventory tag exactly once:

- `render-and-hydrate`: `@lit-labs/ssr` emits Declarative Shadow DOM, and the client reuses the
  existing shadow root and nodes.
- `client-render`: the server emits the host's serializable attributes and light DOM with no shadow
  template; the component renders when its definition upgrades in the browser. Use this for initial
  renders that require light-DOM traversal, layout, canvas, observers, media, or other browser APIs.

Server setup (the fallback must precede Lit's renderer):

```ts
import { lyraSsrElementRenderers } from "@aceshooting/lyra-ui/ssr-loader.js";
import { render, LitElementRenderer } from "@lit-labs/ssr";
import { html } from "lit";

const result = render(html`<lr-page><main>Dashboard</main></lr-page>`, {
  elementRenderers: lyraSsrElementRenderers(LitElementRenderer),
});
```

In the browser, import `@aceshooting/lyra-ui/ssr-loader.js` before any other module that can import
Lit. This installs `@lit-labs/ssr-client/lit-element-hydrate-support.js` before component
registration. `getLyraSsrMode(tagName)` reads one tag's tier, and
`diagnoseLyraHydration(document)` inspects current Lyra hosts in the supplied tree and every
reachable open shadow root, awaits registered hosts' current updates, and reports `ready`,
`unregistered`, `missing-shadow-root`, or `update-failed`. `ready` means the current update finished
and a shadow root exists; it does not claim that server markup was observed or hydrated. Read each
diagnostic's separate `mode` to distinguish the declared `render-and-hydrate` and `client-render`
tiers.

The loader preserves optional-peer isolation: import a root-excluded component's granular
registration after the loader. A fallback cannot serialize JS property bindings, so put initial
server state in attributes/light DOM or assign it client-side. A `render-and-hydrate` component
whose rendering depends on something only a browser can answer — its own light-DOM children, or a
browser global such as `EyeDropper` — reproduces the server's answer on the hydrating render and
corrects itself on the next update, so a slotted override lands one frame after hydration; a
browser-only mount is unaffected and renders the final result the first time. Layout/observer/canvas/media work
begins after hydration, and remote content is client-only. CI imports every granular module, renders
every inventory tag through its declared tier, and crawls a real Chromium DSD page (including
`lr-page`) while failing hydration warnings/errors or DOM-identity replacement.

## Testing a downstream project: `@aceshooting/lyra-ui/testing`

`testing/happy-dom-shims.ts` exports `installHappyDomFormAssociatedShims(): void` for a consumer's
own Vitest + happy-dom suite. happy-dom implements no `ElementInternals`, and every form-associated
component calls `this.attachInternals()` unconditionally in its constructor, so instantiating one
throws immediately without the shim. Call it once from a Vitest `setupFiles` entry, before importing
any component. It patches `HTMLElement.prototype.attachInternals` with a stub covering what the
components actually call — `setFormValue()`, `setValidity()`, `checkValidity()`, `reportValidity()`,
plus readonly `form`/`labels`/`validity`/`validationMessage`/`willValidate`. `setValidity()` matters
beyond construction: `AnchoredValidityController` calls it on every update, so without the shim a
form control throws on any `value` change, not only when it is created. The shim is a no-op wherever
`attachInternals` already exists (any real browser), so it is safe to call unconditionally from a
shared setup file. This package's own tests run in real browsers via `@web/test-runner` and never
call it.

## Accessibility contract

Semantic roles live on the shadow-DOM element that owns them, with explicit false states for
toggle/selection/expansion ARIA attributes and deliberate host-name forwarding. Form-associated
controls preserve `ElementInternals`, reset, validity, focus, and native editing behavior. Reusable
layouts respond to their allocated container rather than the viewport, and decorative or infinite
motion simplifies under `prefers-reduced-motion: reduce`.

Keyboard model: a composite widget (menu, tab group, tree, table, calendar, carousel, segmented
control) is a single tab stop using a roving `tabindex`; arrow keys move within it and skip disabled, hidden,
`aria-hidden` and `inert` items; `Home`/`End` jump to the ends; `Enter` and `Space` both activate;
`Escape` dismisses the topmost dismissible overlay and returns focus to whatever opened it.
`ArrowLeft`/`ArrowRight` mean previous/next and swap under `dir="rtl"`.

**What that contract is verified by, precisely.** Every one of the 283 components carries at least
one axe-core assertion in its own directory's tests, in a test that mounts its own tag; contrast
(4.5:1 text, 3:1 control borders, in both the light and dark palettes), a 40px minimum target size,
pressed-state coverage for every hoverable part, and `::part()` reachability are separate blocking
gates. All of that is automated. **No screen reader has been run against this library, in any
pairing, and no human accessibility audit exists** — so treat "accessible" here as "passes an
automated rule engine and a written role/name/state contract", never as verified assistive-technology
behavior, and expect no conformance claim or VPAT. The full statement of what is and is not covered,
plus how to report an accessibility bug, is at
<https://github.com/aceshooting/lyra-ui/blob/main/docs/accessibility.md>.

## Editor and tooling integration

The published package ships machine-readable metadata for editors, all regenerated on `prepack`:
`custom-elements.json` (Custom Elements Manifest), `web-types.json` (JetBrains, zero-config), and
`vscode-html-data.json` / `vscode-css-data.json` (point `html.customData` / `css.customData` at them
in `.vscode/settings.json`). For an agent, `llms/components/<tag>.md` is the cheaper source; these
files matter when scaffolding a project's editor configuration. Build tools can import the manifest
through the explicit `@aceshooting/lyra-ui/custom-elements.json` package export; native Node ESM
uses `with { type: 'json' }` on that import.

**Inherited members in `custom-elements.json`.** A subclass declaration's `cssParts` array is
always the complete flattened set, including everything inherited from a superclass — `::part()`
has no type-level inheritance chain a consumer could otherwise walk. `attributes`, `members`,
`events`, `slots`, and `cssProperties` are the opposite: a subclass declaration lists only its own
entries plus any inherited entry it explicitly overrides, pruning an inherited-and-unmodified entry
of those four kinds. This is intentional, not a gap — a TypeScript/JS consumer already gets the
full set for free from the generated `.d.ts` `extends` chain, the same resolution `web-types.json`
and `vscode-html-data.json` perform ahead of time. A consumer reading `custom-elements.json`
directly and needing the complete `attributes`/`members`/`events`/`slots`/`cssProperties` set for
those four kinds must walk the declaration's own `superclass.name`/`superclass.module` across
`modules[].declarations[]` itself, or read `web-types.json`/`vscode-html-data.json` instead, which
are already fully resolved.

## Independence and migration

Lyra has no runtime, theme, or design-token dependency on Shoelace or Web Awesome. Documented `wa-*`
comparisons are migration references only; Lyra's own tokens, events, localization runtime, and
implementation are the source of truth. `llms/migration.md` holds the generated per-tag
`exact`/`rewritten`/`warning-required`/`conceptual-only`/`unsupported` decision and every declared
member/default/import rewrite. Only the first two classifications are automatic; use the codemod's
location-aware report rather than treating a README relationship as a rename allowlist.

Security-motivated differences remain explicit. `lr-include` sanitizes every fragment, omits a
script-executing mode, and defaults to same-origin fetches; link-like controls strip `opener` and
force-add `noopener noreferrer` whenever `target` is set while preserving other settable author
tokens where the component exposes `rel`; iframe/media/viewer inputs keep their URL validation,
sandbox, size caps, and generation guards. A use that depends on weaker behavior is left unchanged
with a warning. For a staged theme migration, map existing values onto `--lr-theme-*` explicitly in
application CSS rather than expecting an implicit compatibility layer.

## Family barrels

Each of the eleven component families has an entry point that registers every element in it:
`@aceshooting/lyra-ui/components/forms`, `.../components/overlays`, and so on for `agent-tools`,
`charts`, `conversation`, `data`, `layout`, `media`, `retrieval`, `utility` and `viewers`.

They existed for three families before 8.0.0, were in the exports map, and were documented nowhere —
so they were effectively unreachable. All eleven now exist and are listed here.

A family barrel is **side-effectful by design**: importing it registers every tag in that family, the
same way `all.js` registers all of them (the package root itself registers nothing as of 8.0.0 — see
"Importing and registering components"). Reach for one when you genuinely use most of a family
and want a single import; reach for the granular
`@aceshooting/lyra-ui/components/<tag>.js` path when you do not, because a barrel cannot be
tree-shaken down to the two elements you actually render. The tag-shaped path remains stable if a
component moves between Lyra's internal family folders; existing family-shaped registration paths
remain supported.

```js
import "@aceshooting/lyra-ui/components/forms"; // every form control
import "@aceshooting/lyra-ui/components/lr-input.js"; // just <lr-input>
```

---

## Shared helpers: `utilities/`

Not custom elements — infrastructure the components compose, curated into a supported public
surface. Importable one module per helper, e.g.
`@aceshooting/lyra-ui/utilities/positioner.js` — the `.js` is required — or as a whole from the extensionless
`@aceshooting/lyra-ui/utilities`.

**This replaced `@aceshooting/lyra-ui/internal/*` in 8.0.0. `@aceshooting/lyra-ui/internal/*` is no
longer a published subpath** — the import fails to resolve rather than degrading. The whole
`internal/` tree used to be exported with no stability statement, which made every internal
refactor potentially breaking for someone. The helpers below are the supported surface and are
covered by semver. Each subpath and the extensionless barrel use explicit named exports, so an
implementation helper added to `internal/` does not silently become public. Rewriting an existing
supported import is a path swap and nothing more:

```ts
// before 8.0.0
import { place } from "@aceshooting/lyra-ui/internal/positioner.js";
// 8.0.0
import { place } from "@aceshooting/lyra-ui/utilities/positioner.js";
```

If you were importing something from `internal/` that is not listed below, it was never a supported
entry point. After getting the user's explicit agreement, submit a capability request through the
feature-request API described in "When no component fits" so it can be promoted deliberately.

- **`LyraElement`** — the base class. `static styles = [tokens]`;
  subclasses prepend `LyraElement.styles` to their own `static styles`. Supplies `emit()` (see
  "Events"), the typed `addEventListener` overload (see "TypeScript"), `locale`/`strings` (see
  "Localization"), and protected `localize()` / `effectiveLocale` / `effectiveDirection`, all
  memoized once per update cycle. `LyraEmitOptions { cancelable?: boolean }` is the public options
  object accepted by `emit()`; set `cancelable` only for a real, branch-on-veto operation.
- **`catalog` → `LyraCatalogEntry` and `LyraCatalog<T>`** — type-only shared vocabulary for model,
  voice, and future catalog-backed controls. Import it from
  `@aceshooting/lyra-ui/utilities/catalog.js`; both types are also available from the package root
  and the model-select/voice-picker granular entries. The exact contracts are `LyraCatalogEntry {
id: string; label: string }` and `LyraCatalog<T extends LyraCatalogEntry = LyraCatalogEntry> =
readonly string[] | readonly T[]`. A catalog is homogeneous: use string shorthand (the same
  string becomes both id and label) or typed object rows, never a mixed array. Readonly tuples and
  arrays are accepted, and object catalogs retain an extended row type such as
  `LyraModelCatalogEntry` or `LyraVoiceCatalogEntry`.
- **`anchor-target` → `LyraAnchorTarget` and `LyraAnchorTargetEventMap`** — type-only structural
  contracts for viewers that expose Lyra's shared document-anchor surface. Import them from
  `@aceshooting/lyra-ui/utilities/anchor-target.js` when a host, adapter, or external viewer needs
  to accept or implement `highlights`, `activeHighlightId`, `anchor`, `anchorKinds`, and
  `scrollToAnchor(target)` without importing the internal mixin. The event map types the shared
  `lr-highlight-activate`, `lr-text-select`, and `lr-anchor-result` listener vocabulary; a concrete
  viewer can support only the events it actually emits, as documented on that component.
  The exact structural contract is `LyraAnchorTarget { highlights: readonly LyraHighlight[];
activeHighlightId: string | null; anchor: LyraAnchor | string | null; readonly anchorKinds:
readonly LyraAnchorKind[]; scrollToAnchor(target: LyraAnchor | string): Promise<boolean> }`.
  Assigning `highlights` synchronously creates a frozen array of copied, frozen highlight records;
  each record's opaque `anchor` retains caller identity so reference-based anchor jumps still work.
- **`positioner` → `place(anchor, popup, opts?): () => void`, `trackRect(target, onUpdate(rect)): () =>
void`, and `virtualAnchorFromRect()`** — thin wrapper over `@floating-ui/dom`'s
  `computePosition` + `autoUpdate`. Forces `strategy: 'fixed'` (matching the
  popup's own `position: fixed` CSS — otherwise it lands offset by the page scroll), middleware
  `offset(opts.offset ?? 4)`, `flip()`, `shift({ padding: 8 })`, default `placement: 'bottom-start'`.
  Returns a cleanup function that stops the `autoUpdate` loop — call it in `disconnectedCallback()`.
  `trackRect()` reports the target's initial viewport rect exactly once before returning, follows
  later layout/viewport changes, and returns the same cleanup shape.
  `virtualAnchorFromRect()` adapts a live rectangle provider to the exported `VirtualAnchor`
  contract; `PlaceOptions` and its closed-set placement/sizing types are exported for typed wrappers.
  The structural result is `PlacementResult { placement: Placement; arrow?: { x?: number;
y?: number } }`, where `arrow`
  contains its resolved coordinates when supplied. `VirtualAnchor` exposes
  `getBoundingClientRect()` and optional `contextElement`; `virtualAnchorFromRect({ x, y, width?,
height?, contextElement? })` builds one. `PlaceOptions` exposes `placement`, `strategy`, `offset`,
  `skidding`, `boundary`, `flip`, `flipFallbackPlacements`, `flipFallbackStrategy`, `flipBoundary`,
  `flipPadding`, `shift`, `shiftBoundary`, `shiftPadding`, `padding`, `autoSize`,
  `autoSizeBoundary`, `autoSizePadding`, `sync`, `arrow`, `arrowPadding`, `hoverBridge`, and
  `onPlaced(result)`.
  Exact authoring contracts are `VirtualAnchor { getBoundingClientRect(): DOMRect;
contextElement?: Element }`, `virtualAnchorFromRect(rect: { x: number; y: number; width?: number;
height?: number; contextElement?: Element }): VirtualAnchor`, and `PlaceOptions { placement?:
Placement; strategy?: PlaceStrategy; offset?: number; skidding?: number; boundary?:
PlaceBoundary; flip?: boolean; flipFallbackPlacements?: Placement[]; flipFallbackStrategy?:
PlaceFlipFallbackStrategy; flipBoundary?: PlaceBoundary; flipPadding?: number; shift?: boolean;
shiftBoundary?: PlaceBoundary; shiftPadding?: number; padding?: number; autoSize?: PlaceAutoSize;
autoSizeBoundary?: PlaceBoundary; autoSizePadding?: number; sync?: PlaceSync; arrow?: HTMLElement;
arrowPadding?: number; hoverBridge?: HTMLElement; onPlaced?: (result: PlacementResult) => void }`.
  `place()` and `virtualAnchorFromRect()` throw `RangeError` before registering observers, invoking
  callbacks, or writing styles when coordinates/options are non-finite, dimensions or padding are
  negative; finite signed `offset`/`skidding` stay valid. If a previously valid live anchor later
  returns invalid geometry, positioning stops and rolls back without publishing partial state or a
  placement callback.
  Used by `lr-combobox`, `lr-select`, `lr-date-input`, `lr-export-button`, `lr-model-select`,
  `lr-mention-popover`, `lr-tool-call-chip`, `lr-citation-badge`, and `lr-menu`.
- **`prefix`** — `LYRA_PREFIX = 'lr'`; `tag(name)` → `` `lr-${name}` ``; `defineElement(name, ctor)`,
  an idempotent `customElements.define` that is safe if a module is evaluated twice.
  Exact callable contracts are `tag(name: string): string` and
  `defineElement(name: string, ctor: CustomElementConstructor): void`.
- **`a11y`** — `nextId(scope)`, a monotonic id generator (`nextId('combobox-list')` →
  `"lr-combobox-list-3"`); `srOnly`, a visually-hidden-but-AT-visible class. The callable contract
  is `nextId(scope: string): string`.
- **`icons`** — the shared inline-SVG set (`calendarIcon`, `chevronIcon`, `closeIcon`, `expandIcon`,
  `eyeIcon`, `eyeOffIcon`, `fileIcon`, `folderIcon`, `pauseIcon`, `playIcon`, and `spinnerIcon`).
  One 24×24 viewBox per icon, rendered at `1em` so each inherits the
  caller's font size; none bakes in a direction — callers rotate the wrapping `part` via CSS.
  Each is a zero-argument template factory: `calendarIcon(): SVGTemplateResult`,
  `chevronIcon(): SVGTemplateResult`, `closeIcon(): SVGTemplateResult`,
  `expandIcon(): SVGTemplateResult`, `eyeIcon(): SVGTemplateResult`,
  `eyeOffIcon(): SVGTemplateResult`, `fileIcon(): SVGTemplateResult`,
  `folderIcon(): SVGTemplateResult`, `pauseIcon(): SVGTemplateResult`,
  `playIcon(): SVGTemplateResult`, and `spinnerIcon(): SVGTemplateResult`.
- **`scroll-lock` → `lockScroll(doc = document): () => void`** — ref-counted
  `doc.documentElement` scroll lock (used by `lr-widget`'s fullscreen mode); safe to acquire/release
  concurrently, restores the original `overflow` only when the last lock releases.
- **`form-associated` → `FormAssociated(Base)`**, plus `attachInternalsSafely()` and
  `createFallbackInternals()` — the mixin documented under "Form association" above, exposed so an
  application can build its **own** form-associated control alongside Lyra's and have it
  participate in a form, restore on reset, and report validity the same way every `lr-` control
  does. Reach for it instead of hand-rolling `attachInternals()` when a bespoke control has to sit
  in the same `<form>` as these.
  The free-function signatures are `attachInternalsSafely(host)`,
  `createStringArrayFormDataState(name, values)`, `readStringArrayFormDataState(state)`, and
  `FormAssociated(Base, valueAdapter?)`. For a non-string value, pass a typed
  `FormValueAdapter<T>` as that `valueAdapter`;
  `FormSubmissionValue`, `createStringArrayFormDataState()`,
  `readStringArrayFormDataState()`, `isEmptyFormValue()`, and `stringFormValueAdapter` are the
  retained adapter-building seams. Form-owner mutation, validity barring, anchor installation, and
  other mixin implementation helpers are deliberately not exported.
  `FormValueAdapter<T>` has readonly `empty`, required `toFormValue(value)`, and optional
  `toFormState(value)`, `isEmpty(value)`, `fromAttribute(attribute)`, `toAttribute(value)`, and
  `fromFormState(state)`. `FormAssociatedInterface<T>` exposes `internals`; the `name` getter/setter
  (`next`); `value`; `defaultValue`; `customError`; `disabled`; `required`; readonly
  `effectiveDisabled`; the `form` getter/setter (`owner`); readonly `labels`, `validity`,
  `validationMessage`, and `willValidate`; `setFormValue(next)`; `getForm()`; `checkValidity()`;
  `reportValidity()`; `setCustomValidity(message)`; `resetValidity()`; `formResetCallback()`; and
  `formStateRestoreCallback(state, reason)`.
  The exact callable signatures are `attachInternalsSafely(host: HTMLElement): ElementInternals`,
  `createFallbackInternals(): ElementInternals`, `createStringArrayFormDataState(name: string,
values: readonly string[]): FormData`, `readStringArrayFormDataState(state: string | File |
FormData | null): string[]`, `isEmptyFormValue(value: unknown): boolean`, and
  `FormAssociated<T, TValue = string>(Base: T, valueAdapter?:
FormValueAdapter<TValue>): T & Constructor<FormAssociatedInterface<TValue> &
FormAssociatedSubclassInterface<TValue>>`.
  The exact adapter records are `FormValueAdapter<TValue> { readonly empty: TValue;
toFormValue(value: TValue): FormSubmissionValue; toFormState?(value: TValue):
FormSubmissionValue; isEmpty?(value: TValue): boolean; fromAttribute?(attribute: string): TValue;
toAttribute?(value: TValue): string | null; fromFormState?(state: FormSubmissionValue): TValue }`
  and `FormAssociatedInterface<TValue> { internals: ElementInternals; get name(): string; set
name(next: string | null); value: TValue; defaultValue: TValue; customError: string | null;
disabled: boolean; required: boolean; readonly effectiveDisabled: boolean; get form():
HTMLFormElement | null; set form(owner: FormOwnerValue); readonly labels: NodeList; readonly
validity: ValidityState; readonly validationMessage: string; readonly willValidate: boolean;
setFormValue(next: TValue): void; getForm(): HTMLFormElement | null; checkValidity(): boolean;
reportValidity(): boolean; setCustomValidity(message: string): void; resetValidity(): void;
formResetCallback(): void; formStateRestoreCallback(state: FormSubmissionValue, reason:
'autocomplete' | 'restore'): void }`. The exported subclass seam is
  `FormAssociatedSubclassInterface<TValue> { protected captureLiveValueCheckpoint(): { readonly
value: TValue; readonly dirty: boolean }; protected restoreLiveValueCheckpoint(checkpoint: {
readonly value: TValue; readonly dirty: boolean }): void }`.
- **`group-by-recency` → `groupByRecency(items, options?)`** — buckets dated items into
  Today / Yesterday / Previous 7 Days / Older, on **local calendar-day boundaries** ("yesterday" is
  the previous calendar date, not 24–48 hours ago). Plain data in, plain data out — no DOM.
  `getTimestamp` extracts the date (default: the item _is_ a `Date`; a returned number is epoch
  **milliseconds**), `now` fixes the reference instant for deterministic tests or an "as of" report,
  and `labels` overrides any of the four English defaults — the strings are yours, so localize them
  through your own catalog. Empty buckets are omitted, order within a bucket is the input's, a
  future timestamp lands in Today and an unparseable one in Older. Exposed because an application
  rendering its own list beside `lr-thread-list` needs bucketing that agrees with the component's;
  reimplementing "this week" is how two lists on one page start disagreeing about what day it is.
  The typed records are `RecencyLabels { today?; yesterday?; previousWeek?; older? }`,
  `GroupByRecencyOptions<T> { getTimestamp?(item); now?; labels? }`, and
  `RecencyBucket<T> { label; items }`.
  The callable signature is `groupByRecency<T>(items: T[], options?:
GroupByRecencyOptions<T>): RecencyBucket<T>[]`.
- **`defined` → `allDefined(root?, options?): Promise<void>`** — iteratively waits for every
  currently rendered, inventory-known Lyra tag below a `Document`, `DocumentFragment`/open
  `ShadowRoot`, or `Element` to be defined in its owning/scoped registry. It also waits for each
  available `updateComplete`, then repeats so tags created by that first render are included. Open
  shadow roots are traversed without recursive calls; unknown `lr-*` names are ignored instead of
  hanging. `AllDefinedOptions` bounds the complete operation with `maxElements` (default `10_000`),
  `maxRoots` (`2_000`), `maxDepth` (`256`), `maxWork` (`100_000`), and `maxPasses` (`100`). Invalid
  limits throw `RangeError`; exceeding a limit rejects instead of resolving with a partial
  readiness result. Consumer-owned elements with throwing registry or update-completion accessors
  are treated as unavailable while valid siblings continue. With no browser document or registry
  it resolves immediately. It **does not import or define components**: pair it with explicit
  registration imports, `discover()`, or
  `start()` when bootstrap/tests need a readiness barrier.
  The exact options record is `AllDefinedOptions { readonly maxPasses?: number; readonly
maxElements?: number; readonly maxRoots?: number; readonly maxDepth?: number; readonly maxWork?:
number }`.
- **`css-length` → `resolveCssLength(value, options?)`** — resolves finite numbers and CSS
  `px`/`rem`/`em`/`%`/`vw`/`vh` lengths to pixels without allocating DOM. Supply `host` for live
  font and owner-realm context, `percentBase` for percentages, and an optional `viewportBasis` for
  deterministic viewport-unit resolution: either a `Window` or `{ inlineSize, blockSize }`.
  Unsupported expressions and unavailable context return `undefined`; range policy remains the
  caller's responsibility.
  Its exact signatures are `resolveCssLength(value: number | string | undefined, options?:
ResolveCssLengthOptions): number | undefined` and `ResolveCssLengthOptions { readonly host?:
Element; readonly percentBase?: number; readonly viewportBasis?: Window | Readonly<{
inlineSize: number; blockSize: number }> }`.
- **`layered-layout` → `layeredLayout()`** — the deterministic, dependency-free layered-DAG
  ("Sugiyama-lite") layout `lr-flow-canvas` draws with: cycle handling, longest-path layering,
  barycenter crossing reduction, and coordinates assigned along the block axis so the result is
  RTL-neutral. `fixedPositions` entries keep their given coordinates: their combined inline extent
  is reserved before computed boxes, and a fixed layer's block extent advances every later layer,
  so fixed and computed boxes retain `gapX`/`gapY` separation without moving the anchors. Two
  conflicting caller-fixed boxes are deliberately kept verbatim. Node dimensions, gaps, and fixed
  coordinates must be finite, non-negative values no greater than `Number.MAX_SAFE_INTEGER`; bad
  geometry throws `RangeError` before graph traversal. Traversal is iterative, and
  `maxVirtualWaypoints` sets the nonnegative integer routing budget (default 10,000; invalid values
  use the default, negative values clamp to zero, and fractions truncate). The returned
  `LayeredLayoutResult` contains readonly `positions`, `virtualWaypointCount`, and `truncated`;
  when truncated, long edges influence ordering through their real endpoints instead of allocating
  every intermediate layer. Positions are raw box centers; the first computed layer starts at
  `y = 0`, so its centers are offset by half that layer's height. Centering the drawing in your own
  canvas is yours.
  Its exact data contracts are `LayeredLayoutNode { id; width; height }`,
  `LayeredLayoutEdge { source; target }`, `LayeredLayoutOptions { fixedPositions?:
ReadonlyMap<string, Readonly<{ x: number; y: number }>>; gapX?: number; gapY?: number;
maxVirtualWaypoints?: number }`, and `LayeredLayoutResult { readonly positions:
ReadonlyMap<string, Readonly<{ x: number; y: number }>>; readonly truncated: boolean; readonly
virtualWaypointCount: number }`. The callable contract is `layeredLayout(input: { nodes: readonly
LayeredLayoutNode[]; edges: readonly LayeredLayoutEdge[]; options?: LayeredLayoutOptions }):
LayeredLayoutResult`. Call `layeredLayout(input)` with `input.nodes`, `input.edges`, and
  optional `input.options`; the result's `positions` map contains readonly `{ x, y }` coordinates.
- **`animation-registry` → `setDefaultAnimation(animationName, animation)`,
  `setAnimation(element, animationName, animation)`, and
  `getAnimation(element, animationName, options?)`** — public
  motion overrides in native Web Animations API vocabulary. Resolution is per-element first,
  page-wide default second, then the component's token-derived fallback. `rtlKeyframes` supplies a
  logical-direction alternative; `getAnimation()` infers computed direction unless `options.dir`
  is explicit. Passing `null` disables visible motion without skipping the owning component's
  events or promise lifecycle. Each setter returns an idempotent cleanup that restores the previous
  stacked registration; element registrations live in a `WeakMap`, so neither the registry nor a
  retained cleanup keeps a detached element alive. Each registration takes a bounded shallow
  frozen snapshot of its readonly keyframe arrays, keyframe records, and options, so later caller
  mutation cannot alter another component's motion; `getAnimation()` returns a fresh readonly
  frozen snapshot. Each logical direction retains at most 512 keyframes, a keyframe may carry at
  most 256 enumerable own fields, and the options record may carry at most 64. An oversized or
  getter-throwing JavaScript record is retained as an inert override: resolution uses the caller's
  valid bounded fallback, or the zero-duration disabled result when no valid fallback exists.
  Reduced motion is respected by default by
  flattening delay/duration/end-delay to zero and iterations to one while preserving the resolved
  end frame; only a caller with a stronger policy should pass `respectReducedMotion: false`.
  The exact records are `LyraElementAnimation { readonly keyframes: readonly Readonly<Keyframe>[];
readonly rtlKeyframes?: readonly Readonly<Keyframe>[]; readonly options?:
Readonly<KeyframeAnimationOptions> }`, `LyraResolvedElementAnimation { readonly keyframes:
readonly Readonly<Keyframe>[]; readonly options: Readonly<KeyframeAnimationOptions> }`, and
  `LyraGetAnimationOptions { readonly dir?: 'ltr' | 'rtl'; readonly fallback?:
LyraElementAnimation | null; readonly respectReducedMotion?: boolean }`. The callable contracts are
  `setDefaultAnimation(animationName: string, animation: LyraElementAnimation | null):
LyraAnimationCleanup`, `setAnimation(element: Element, animationName: string, animation:
LyraElementAnimation | null): LyraAnimationCleanup`, and `getAnimation(element: Element,
animationName: string, options?: LyraGetAnimationOptions): LyraResolvedElementAnimation`.

  ```ts
  import {
    setAnimation,
    type LyraElementAnimation,
  } from "@aceshooting/lyra-ui/utilities/animation-registry.js";

  const dialog = document.querySelector("lr-dialog");
  const enter: LyraElementAnimation = {
    keyframes: [{ opacity: 0 }, { opacity: 1 }],
    options: { duration: 180 },
  };
  const release = setAnimation(dialog, "dialog.show", enter);
  // release() restores the previous registration.
  ```

- **`overlay-manager` → `activateOverlay(options): OverlayHandle` and
  `suspendLyraModalsFor(externalModal): () => void`** — per-`Document` coordination used by Lyra's
  modal and focus-returning overlay surfaces, including dialogs/drawers, Page/app navigation,
  command/tool surfaces, lightbox/tour, and responsive/floating/fullscreen panels. All entries share
  one topmost stack: only the top entry handles Escape, Tab
  trapping, and backdrop dismissal. Content outside the active modal's composed path is inert,
  including lower overlays and page content added while it is open. Focus traversal crosses slots
  and open shadow roots; activation preserves focus already inside but pulls outside focus in, and
  closing restores the still-connected opener. Nested closes restore into the surviving overlay
  before returning to the original trigger. `OverlayActivationOptions.lockScroll` gives the manager
  document-scoped, ref-counted ownership of scroll locking for the entry's registered lifetime; it
  releases that ownership during disconnect or rendered suspension. `suspendWhenUnrendered` defaults
  to `false`. When enabled, an active entry whose resolved panel generates no CSS layout box —
  including because `display: none` is set on the host or an ancestor — releases inerting,
  focus-trap/stack ownership, and manager-owned scroll lock without changing the component's logical
  open state. It resumes in its original stack order when rendered again.
  `deactivate`'s `deferScrollLockRelease` option (default `false`) skips releasing the entry's
  scroll lock as part of deactivation and instead returns the release function, so a component with
  a visible exit animation can hold the lock until that animation actually finishes rather than the
  instant it starts closing; it is ignored (returns `undefined`) when the entry never requested
  `lockScroll`.
  `OverlayActivationOptions` exposes `host`, `panel`, optional `modalRoot`, `modal`, `lockScroll`,
  `suspendWhenUnrendered`, `onEscape`, `onBackdrop`, `preferredInitialFocus`,
  `beforeInitialFocus`, `restoreFocusTo`, `trapFocus`, and `onTab`. `OverlayHandle` exposes
  `focusInitial()`, `focusAutofocus()`, `updateRestoreFocusTo(target)`,
  `deactivate({ restoreFocus?, deferScrollLockRelease? }?)`, `suspend()`, `resume()`, `isTopmost()`,
  `isActive()`, and `dismissBackdrop()`; the deactivate argument is the exported
  `OverlayDeactivateOptions` record, and its return value is the deferred scroll-lock release
  function (or `undefined`).
  Exact records are `OverlayActivationOptions { host: HTMLElement; panel: () => HTMLElement |
null; modalRoot?: () => HTMLElement | null; onEscape: () => void; onBackdrop?: () => void;
preferredInitialFocus?: () => HTMLElement | null; beforeInitialFocus?: () => boolean;
restoreFocusTo?: OverlayRestoreFocusTarget; modal?: boolean; trapFocus?: boolean; onTab?: () =>
void; suspendWhenUnrendered?: boolean; lockScroll?: boolean }`, `OverlayDeactivateOptions {
restoreFocus?: boolean; deferScrollLockRelease?: boolean }`, and `OverlayHandle { focusInitial():
void; focusAutofocus(): boolean; updateRestoreFocusTo(target: OverlayRestoreFocusTarget): void;
deactivate(options?: OverlayDeactivateOptions): (() => void) | undefined; suspend(): void;
resume(): void; isTopmost(): boolean; isActive(): boolean; dismissBackdrop(): boolean }`.
  When a third-party modal must open above a Lyra modal, call the public helper after its root is
  connected, then release it when that modal closes:

  ```ts
  import { suspendLyraModalsFor } from "@aceshooting/lyra-ui/utilities/overlay-manager.js";

  const externalModal = document.querySelector<HTMLElement>("#vendor-modal")!;
  const release = suspendLyraModalsFor(externalModal);
  release(); // idempotent
  ```

  The handle is document-scoped and nestable. While any
  such handle is active, Lyra yields Escape/Tab ownership and keeps only the external modal paths
  non-inert; disconnecting or adopting the external root releases its handle automatically.

- **`announcer` → `Announcer` and `acquireAnnouncementSink()`** — throttled live-region
  announcements, paired with `lr-live-region`. `Announcer` is the DOM-free coalescing engine;
  `acquireAnnouncementSink(politeness, options?)` hands back the ref-counted, visually hidden region
  in the **host document's light DOM** that every Lyra announcement lands in (a live region inside a
  shadow root is not reliably announced). The module also exports `ANNOUNCEMENT_SINK_ATTRIBUTE` —
  the `data-lr-live-region` marker those regions carry — so a consumer's DOM diffing, snapshot
  testing, or `MutationObserver` can recognize and ignore them. Both are documented in full in
  `llms/components/lr-live-region.md`.
  The constructor accepts `AnnouncerOptions { throttleMs?; onFlush(text); timerHost? }`; each call
  accepts `AnnounceOptions { force? }`; and `AnnouncerTimerHost` provides `setTimeout(handler,
timeout)` plus `clearTimeout(handle)`. `AnnouncementSinkOptions` exposes `document`, `source`, and
  `messageTtlMs`; its `AnnouncementSink` handle exposes readonly `element` and `politeness`, mutable
  `messageTtlMs`, `announce(text)`, and `release()`.
  Exact sink contracts are `acquireAnnouncementSink(politeness: AnnouncementPoliteness, options?:
AnnouncementSinkOptions): AnnouncementSink`, `AnnouncementSinkOptions { document?: Document;
source?: Element; messageTtlMs?: number }`, `AnnouncementSink { readonly element: HTMLElement;
readonly politeness: AnnouncementPoliteness; messageTtlMs: number; announce(text: string): void;
release(): void }`, and `AnnouncerTimerHost { setTimeout(handler: () => void, timeout: number):
number; clearTimeout(handle: number): void }`.
- **`localization` → `subscribeLyraLocale(listener): () => void` and
  `bridgeLyraLocale(options?): () => void`** — the _active-locale_ half of the locale runtime,
  which the side-effect-free `@aceshooting/lyra-ui/localization.js` entry does not carry (that one
  has `subscribeLyraLocaleRegistry()`, which answers a different question — see "Localization").
  `subscribeLyraLocale()` fires whenever the active selection changes, and when a newly registered
  or extended catalog can alter that selection's messages or direction. Registrations unrelated to
  the active lookup chain are filtered. An application can therefore re-render its **own**
  locale-dependent output in step with the components without reacting to every lazy catalog.

  `bridgeLyraLocale()` mirrors the active locale's canonical public tag onto an element's `lang`
  and — unless `direction: false` — its `dir`, resolved through `getLyraLocaleDirection()`.
  `setLyraLocale()`
  only tells _this library_ which locale is in force; `:lang()` selectors, hyphenation and quote
  marks, spelling dictionaries, a screen reader's pronunciation of untranslated prose and every
  third-party widget all read the platform `lang`/`dir` cascade instead, so an application that
  switches locale at runtime has to write those attributes itself. This is that glue, in one
  supported place. `target` defaults to `document.documentElement`; pass an application root to
  scope it to a subtree. It is strictly opt-in — importing the module does nothing, and the library
  never calls it for you. While no locale is active it leaves the target's authored `lang`/`dir`
  alone rather than blanking them. Multiple bridges on the same target share one subscription and
  authored-state snapshot; cleanup handles can release in any order, and the last release restores
  exactly what the target carried before the first bridge, including an attribute that was absent.
  Direction remains mirrored while any active handle leaves `direction` enabled.
  Its exact options record is `LyraLocaleBridgeOptions { target?: Element; direction?: boolean }`.

  ```ts
  import { bridgeLyraLocale } from "@aceshooting/lyra-ui/utilities/localization.js";
  import { setLyraLocale } from "@aceshooting/lyra-ui/localization.js";
  import "@aceshooting/lyra-ui/translations/ar.js";

  const stop = bridgeLyraLocale(); // mirrors onto <html>
  setLyraLocale("ar"); // <html lang="ar" dir="rtl">
  stop(); // restores whatever <html> carried before
  ```

**Known gotchas:**

- `formResetCallback()` restores the _content attribute_ default, so `el.value = 'x'` never redefines
  what `form.reset()` restores to (native `defaultValue`/`defaultSelected` semantics).

## Packaging

`custom-elements.json`, the React/Vue/Svelte declaration entry points, editor metadata, and derived
LLM artifacts are regenerated by `prepack` and included in `package.json`'s `files` allowlist. The
family references, this shared guide, and the introductory LLM sources are authored inputs; the
generated index, per-component pages, tokens, peers, migration reference, and concatenated catalog
are freshness-checked against them, the manifest, and `dist/` before publication.

## When no component fits, file it

First rule out a naming mismatch: check `llms/index.md` for a component covering the same job
under a different name. Most apparent gaps are discovery failures, not missing components.

Then check the live catalog — one read-only request, no side effects, nothing filed:

```bash
curl -sS 'https://www.lyra-ui.com/api/v1/components/search?q=kanban+board+swimlane'
```

It returns the closest components with doc links. Search as many phrasings as you like; this
endpoint is meant to be used freely, and it is the cheapest way to discover that a "missing"
component already exists under a name you did not guess.

If nothing fits, report the gap so it can be built — but **ask the user and get their explicit
agreement first.** Filing sends the user's description to an external service; show them what you
intend to submit, and never file as a silent side effect of noticing a gap. If the user has not
said yes, do not send it.

```bash
curl -sS -X POST https://www.lyra-ui.com/api/v1/feature-requests \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "Kanban board",
    "description": "Needed a drag-and-drop board with swimlanes for a task view; nothing in the catalog covers it.",
    "searched_for": ["kanban", "board", "swimlane", "drag drop"],
    "settled_for": "a hand-rolled div grid with HTML5 drag events",
    "agent": "claude-code"
  }'
```

Accepted fields: `title` (required, ≤120 chars), `description` (required, ≤4000 chars), `use_case`,
`searched_for` (array of terms tried — the most valuable field, since it records which name was
expected and that's exactly what makes a component undiscoverable), `settled_for` (what was used
instead), `agent`, and the optional contact fields `name` (≤120) and `email` (≤200). Anonymous
submission is the default and is fine — `name`/`email` only add value if the maintainer might
follow up. Ask the user whether they want to be reachable before adding either one; never invent,
guess, or reuse an address from context you happen to have (git config, an earlier message, the
environment). All submissions, including any name/email, are stored privately and shown only to
the maintainer — never published.

The response includes `matches` (the closest existing components, with doc links — read it, since
it often answers the gap outright) and an `id`; status is readable later at
`https://www.lyra-ui.com/api/v1/feature-requests/{id}`. The full schema is at
`https://www.lyra-ui.com/api/v1/openapi.json`.

**Never include private material.** Submissions leave the user's machine. Describe the component
generically — no source code, no client or product names, no file paths, no credentials. If the
need cannot be described without such details, do not file it.

Use the API even when you are working inside the lyra-ui repo itself. It is the only supported
automated intake path for an assistant acting on a user's behalf — do not write the request into a
local file instead, where nothing will pick it up, and do not silently open a GitHub issue. A person
filing their own report can use the human-facing routes in `SUPPORT.md`.

Keep the report short and concrete:

- **Name the component you wanted**, in library style (`lr-kanban-board`), so the gap is searchable.
- **Say what it had to do** in a sentence or two — the behaviour, not your implementation.
- **List the `lr-*` components you actually checked** and why each fell short. This is what separates
  a real gap from a naming mismatch, and it is the part only you can supply.

## Exported TypeScript contracts

These named interfaces and helper signatures are available to typed integrations. They are grouped by capability so the component sections above can stay focused.

- **`ai-adapters-a2ui-contracts`** — AI adapter and runtime contracts.
  `A2UiAdapterLimits {
  maxComponents: unknown;
  maxDepth: unknown;
  maxOutputNodes: unknown;
  maxChildrenPerComponent: unknown;
  maxNodes: unknown;
  maxBytes: unknown;
  maxStringCharacters: unknown;
}`
  `A2UiLikeAction {
  id: unknown;
  payload: unknown;
}`
  `A2UiLikeComponent {
  id: unknown;
  type: unknown;
  props: unknown;
  text: unknown;
  children: unknown;
  action: unknown;
}`
  `A2UiLikeSurface {
  surfaceId: unknown;
  rootId: unknown;
  components: unknown;
  data: unknown;
}`
  `adaptA2UiSurface(/* public names: surface, typeMap, limits */): unknown`

- **`ai-adapters-ag-ui-contracts`** — AI adapter and runtime contracts.
  `AgUiAdapterLimits {
  maxBufferedTools: unknown;
  maxToolArgumentBytes: unknown;
  maxTextDeltaCharacters: unknown;
  maxDepth: unknown;
  maxNodes: unknown;
  maxBytes: unknown;
  maxStringCharacters: unknown;
}`
  `AgUiLikeEvent {
  type: unknown;
  eventId: unknown;
  runId: unknown;
  messageId: unknown;
  role: unknown;
  delta: unknown;
  toolCallId: unknown;
  toolCallName: unknown;
  result: unknown;
  message: unknown;
  code: unknown;
  snapshot: unknown;
  messages: unknown;
}`

- **`ai-adapters-ai-sdk-contracts`** — AI adapter and runtime contracts.
  `adaptAiSdkMessage(/* public names: message, limits */): unknown`
  `AiSdkAdapterLimits {
  maxParts: unknown;
  maxDepth: unknown;
  maxNodes: unknown;
  maxBytes: unknown;
  maxStringCharacters: unknown;
}`
  `AiSdkLikeMessage {
  id: unknown;
  role: unknown;
  parts: unknown;
  metadata: unknown;
}`

- **`ai-runtime-contracts`** — AI adapter and runtime contracts.
  `AgentStreamLimits {
  maxMessages: unknown;
  maxPartsPerMessage: unknown;
  maxTools: unknown;
  maxDeltaCharacters: unknown;
  maxTextCharactersPerPart: unknown;
  maxIdentifierCharacters: unknown;
  maxStatusMessageCharacters: unknown;
  maxPatchOperations: unknown;
  maxSnapshotDepth: unknown;
  maxSnapshotNodes: unknown;
  maxSnapshotBytes: unknown;
  maxRetainedBytes: unknown;
}`
  `AgentStreamState {
  generation: unknown;
  cursor: unknown;
  limits: unknown;
  runId: unknown;
  status: unknown;
  messages: unknown;
  tools: unknown;
  sharedState: unknown;
  error: unknown;
  message: unknown;
  code: unknown;
}`
  `applySharedStatePatch(/* public names: value, patch */): unknown`
  `createAgentStreamState(/* public names: limits */): unknown`
  `parseJsonPatch(/* public names: value, limits */): unknown`
  `reduceAgentStreamEvents(/* public names: state, events */): unknown`
  `reduceAgentStream(/* public names: state, event */): unknown`

- **`ai-snapshot-contracts`** — AI adapter and runtime contracts.
  `createProviderSnapshotBudget(/* public names: limits */): unknown`
  `ProviderSnapshotBudget {
  limits: unknown;
  bytes: unknown;
  nodes: unknown;
}`
  `ProviderSnapshotLimits {
  maxDepth: unknown;
  maxNodes: unknown;
  maxBytes: unknown;
  maxStringCharacters: unknown;
}`
  `resolveProviderSnapshotLimits(/* public names: limits */): unknown`
  `snapshotProviderValue(/* public names: value, budget */): unknown`

- **`ai-types-contracts`** — AI adapter and runtime contracts.
  `AgentRun {
  id: unknown;
  status: unknown;
  startedAt: unknown;
  endedAt: unknown;
  model: unknown;
  costEstimate: unknown;
  steps: unknown;
}`
  `AgentStatus {
  kind: unknown;
  message: unknown;
}`
  `AgentStep {
  id: unknown;
  kind: unknown;
  label: unknown;
  status: unknown;
  startedAt: unknown;
  endedAt: unknown;
}`
  `AttachmentMessagePart {
  type: unknown;
  document: unknown;
  id: unknown;
  state: unknown;
  metadata: unknown;
}`
  `AudioMessagePart {
  type: unknown;
  src: unknown;
  transcript: unknown;
  mimeType: unknown;
  id: unknown;
  state: unknown;
  metadata: unknown;
}`
  `CancelEventDetail {
  reason: unknown;
}`
  `ChatMessage {
  id: unknown;
  role: unknown;
  status: unknown;
  timestamp: unknown;
  text: unknown;
  attachments: unknown;
  parts: unknown;
  metadata: unknown;
}`
  `Citation {
  id: unknown;
  chunkId: unknown;
  sourceId: unknown;
  span: unknown;
  start: unknown;
  end: unknown;
  label: unknown;
  locator: unknown;
  answerRange: unknown;
  quote: unknown;
  metadata: unknown;
}`
  `CitationMessagePart {
  type: unknown;
  citation: unknown;
  id: unknown;
  state: unknown;
  metadata: unknown;
}`
  `CitationSelectEventDetail {
  citation: unknown;
}`
  `DataMessagePart {
  type: unknown;
  name: unknown;
  data: unknown;
  widget: unknown;
  id: unknown;
  state: unknown;
  metadata: unknown;
}`
  `DocumentRef {
  id: unknown;
  name: unknown;
  mimeType: unknown;
  uri: unknown;
  version: unknown;
}`
  `ErrorMessagePart {
  type: unknown;
  message: unknown;
  code: unknown;
  retryable: unknown;
  id: unknown;
  state: unknown;
  metadata: unknown;
}`
  `ExportEventDetail {
  format: unknown;
}`
  `GroundedClaim {
  id: unknown;
  text: unknown;
  status: unknown;
  citationIds: unknown;
  answerRange: unknown;
  start: unknown;
  end: unknown;
  confidence: unknown;
  explanation: unknown;
}`
  `GroundingAssessment {
  supportedClaims: unknown;
  unsupportedClaims: unknown;
  coverage: unknown;
  confidence: unknown;
  warnings: unknown;
  claims: unknown;
}`
  `MessagePartBase {
  id: unknown;
  state: unknown;
  metadata: unknown;
}`
  `ReasoningMessagePart {
  type: unknown;
  text: unknown;
  collapsed: unknown;
  id: unknown;
  state: unknown;
  metadata: unknown;
}`
  `RetrievalChunk {
  id: unknown;
  text: unknown;
  score: unknown;
  source: unknown;
  metadata: unknown;
  rank: unknown;
  locator: unknown;
  queryId: unknown;
  stage: unknown;
  traceId: unknown;
  scores: unknown;
}`
  `RetrievalProgressEventDetail {
  queryId: unknown;
  stage: unknown;
  progress: unknown;
}`
  `RetrievalQuery {
  text: unknown;
  filters: unknown;
  mode: unknown;
  scope: unknown;
}`
  `RetrievalScoreBreakdown {
  dense: unknown;
  sparse: unknown;
  rerank: unknown;
  final: unknown;
}`
  `RetryEventDetail {
  attempt: unknown;
  messageId: unknown;
}`
  `RunLifecycleEventDetail {
  runId: unknown;
  status: unknown;
}`
  `TextMessagePart {
  type: unknown;
  text: unknown;
  id: unknown;
  state: unknown;
  metadata: unknown;
}`
  `ToolApprovalEventDetail {
  invocationId: unknown;
  approved: unknown;
}`
  `ToolCallMessagePart {
  type: unknown;
  invocation: unknown;
  id: unknown;
  state: unknown;
  metadata: unknown;
}`
  `ToolInvocation {
  id: unknown;
  name: unknown;
  args: unknown;
  status: unknown;
  result: unknown;
  error: unknown;
}`
  `ToolResultErrorMessagePart {
  error: unknown;
  result: unknown;
  type: unknown;
  invocationId: unknown;
  name: unknown;
  id: unknown;
  state: unknown;
  metadata: unknown;
}`
  `ToolResultSuccessMessagePart {
  result: unknown;
  error: unknown;
  type: unknown;
  invocationId: unknown;
  name: unknown;
  id: unknown;
  state: unknown;
  metadata: unknown;
}`
  `WidgetMessagePart {
  type: unknown;
  name: unknown;
  data: unknown;
  widget: unknown;
  id: unknown;
  state: unknown;
  metadata: unknown;
}`

- **`autoloader-contracts`** — Shared utility contracts.
  `AutoloaderErrorEventDetail {
  error: unknown;
  tag: unknown;
  optionalPeers: unknown;
}`
  `AutoloaderEventDetail {
  tag: unknown;
  optionalPeers: unknown;
}`
  `AutoloaderOptions {
  optionalPeers: unknown;
  events: unknown;
  maxConcurrency: unknown;
  maxElements: unknown;
  maxRoots: unknown;
  maxDepth: unknown;
  maxWork: unknown;
}`
  `AutoloaderTraversalErrorEventDetail {
  limit: unknown;
  maximum: unknown;
  error: unknown;
}`
  `discover(root?: LyraDefinitionRoot, options?: AutoloaderOptions): Promise<readonly AutoloadableTagName[]>`
  `start(root?: LyraDefinitionRoot, options?: AutoloaderOptions): Promise<readonly AutoloadableTagName[]>`
  `stop(): unknown`

- **`custom-elements-jsx-contracts`** — Framework integration type contracts.
  `LyraReactIntrinsicElements {
  "lr-accordion": unknown;
  "lr-accordion-item": unknown;
  "lr-activity-feed": unknown;
  "lr-agent-eval-dashboard": unknown;
  "lr-agent-run": unknown;
  "lr-agent-trace": unknown;
  "lr-agent-workspace": unknown;
  "lr-alert": unknown;
  "lr-animated-image": unknown;
  "lr-animation": unknown;
  "lr-app-rail": unknown;
  "lr-app-rail-item": unknown;
  "lr-approval-queue": unknown;
  "lr-archive-viewer": unknown;
  "lr-artifact-panel": unknown;
  "lr-attachment-chip": unknown;
  "lr-attachment-trigger": unknown;
  "lr-audio-visualizer": unknown;
  "lr-av-player": unknown;
  "lr-avatar": unknown;
  "lr-avatar-group": unknown;
  "lr-badge": unknown;
  "lr-bar-chart": unknown;
  "lr-box-plot": unknown;
  "lr-branch-picker": unknown;
  "lr-breadcrumb": unknown;
  "lr-breadcrumb-item": unknown;
  "lr-browser-frame": unknown;
  "lr-bubble-chart": unknown;
  "lr-button": unknown;
  "lr-button-group": unknown;
  "lr-calendar": unknown;
  "lr-calendar-viewer": unknown;
  "lr-callout": unknown;
  "lr-card": unknown;
  "lr-carousel": unknown;
  "lr-carousel-item": unknown;
  "lr-chart": unknown;
  "lr-chat-composer": unknown;
  "lr-chat-message": unknown;
  "lr-chat-viewport": unknown;
  "lr-checkbox": unknown;
  "lr-checkbox-group": unknown;
  "lr-checkpoint": unknown;
  "lr-chip": unknown;
  "lr-chip-group": unknown;
  "lr-chunk-inspector": unknown;
  "lr-citation-badge": unknown;
  "lr-claim-evidence": unknown;
  "lr-code-block": unknown;
  "lr-code-block-core": unknown;
  "lr-code-editor": unknown;
  "lr-color-picker": unknown;
  "lr-combobox": unknown;
  "lr-command-palette": unknown;
  "lr-commit-card": unknown;
  "lr-community-card": unknown;
  "lr-compare-panel": unknown;
  "lr-condition-builder": unknown;
  "lr-confirm-bar": unknown;
  "lr-contact-viewer": unknown;
  "lr-context-inspector": unknown;
  "lr-context-meter": unknown;
  "lr-control-group": unknown;
  "lr-conversation-item": unknown;
  "lr-copy-button": unknown;
  "lr-csv-viewer": unknown;
  "lr-dashboard-grid": unknown;
  "lr-data-grid": unknown;
  "lr-dataset-viewer": unknown;
  "lr-date-input": unknown;
  "lr-date-picker": unknown;
  "lr-details": unknown;
  "lr-dialog": unknown;
  "lr-diff-view": unknown;
  "lr-divider": unknown;
  "lr-dock-panel": unknown;
  "lr-document-compare": unknown;
  "lr-document-library": unknown;
  "lr-document-preview": unknown;
  "lr-document-viewer": unknown;
  "lr-docx-viewer": unknown;
  "lr-doughnut-chart": unknown;
  "lr-drawer": unknown;
  "lr-drilldown-panel": unknown;
  "lr-dropdown": unknown;
  "lr-dropdown-item": unknown;
  "lr-ebook-viewer": unknown;
  "lr-email-viewer": unknown;
  "lr-embedding-explorer": unknown;
  "lr-emoji-picker": unknown;
  "lr-empty": unknown;
  "lr-entity-card": unknown;
  "lr-entity-chip": unknown;
  "lr-entity-dossier": unknown;
  "lr-env-list": unknown;
  "lr-eval-dataset": unknown;
  "lr-eval-result": unknown;
  "lr-eval-run": unknown;
  "lr-export-button": unknown;
  "lr-file-icon": unknown;
  "lr-file-input": unknown;
  "lr-file-tree": unknown;
  "lr-filter-bar": unknown;
  "lr-flag": unknown;
  "lr-flow-canvas": unknown;
  "lr-flow-controls": unknown;
  "lr-flow-minimap": unknown;
  "lr-flow-node": unknown;
  "lr-flow-run-status": unknown;
  "lr-format-bytes": unknown;
  "lr-format-date": unknown;
  "lr-format-number": unknown;
  "lr-gauge": unknown;
  "lr-generation-metrics": unknown;
  "lr-geojson-view": unknown;
  "lr-geojson-viewer": unknown;
  "lr-graph": unknown;
  "lr-graph-legend": unknown;
  "lr-graph-query-builder": unknown;
  "lr-grounding-summary": unknown;
  "lr-handoff-divider": unknown;
  "lr-heatmap": unknown;
  "lr-highlight-layer": unknown;
  "lr-histogram": unknown;
  "lr-html-viewer": unknown;
  "lr-icon": unknown;
  "lr-icon-button": unknown;
  "lr-image-comparer": unknown;
  "lr-image-viewer": unknown;
  "lr-include": unknown;
  "lr-ingestion-queue": unknown;
  "lr-input": unknown;
  "lr-intersection-observer": unknown;
  "lr-json-viewer": unknown;
  "lr-kbd": unknown;
  "lr-knowledge-base": unknown;
  "lr-knowledge-base-admin": unknown;
  "lr-knowledge-graph-explorer": unknown;
  "lr-known-date": unknown;
  "lr-lightbox": unknown;
  "lr-line-chart": unknown;
  "lr-lite-chart": unknown;
  "lr-live-region": unknown;
  "lr-locale-picker": unknown;
  "lr-map": unknown;
  "lr-markdown": unknown;
  "lr-markdown-core": unknown;
  "lr-mcp-app": unknown;
  "lr-media-card": unknown;
  "lr-memory-panel": unknown;
  "lr-mention-popover": unknown;
  "lr-menu": unknown;
  "lr-menu-item": unknown;
  "lr-menu-label": unknown;
  "lr-message-actions": unknown;
  "lr-message-feedback": unknown;
  "lr-message-parts": unknown;
  "lr-mind-map": unknown;
  "lr-model-select": unknown;
  "lr-model-settings-panel": unknown;
  "lr-multi-split": unknown;
  "lr-mutation-observer": unknown;
  "lr-native-time-input": unknown;
  "lr-neighbor-list": unknown;
  "lr-node-palette": unknown;
  "lr-notebook-viewer": unknown;
  "lr-number-input": unknown;
  "lr-option": unknown;
  "lr-otp-input": unknown;
  "lr-page": unknown;
  "lr-page-rail": unknown;
  "lr-pagination": unknown;
  "lr-pan-zoom": unknown;
  "lr-path-strip": unknown;
  "lr-pdf-viewer": unknown;
  "lr-phone-input": unknown;
  "lr-pie-chart": unknown;
  "lr-polar-area-chart": unknown;
  "lr-policy-summary": unknown;
  "lr-poll-status": unknown;
  "lr-popover": unknown;
  "lr-popup": unknown;
  "lr-pptx-viewer": unknown;
  "lr-progress-bar": unknown;
  "lr-progress-ring": unknown;
  "lr-prompt-input": unknown;
  "lr-prompt-queue": unknown;
  "lr-prompt-studio": unknown;
  "lr-provenance-panel": unknown;
  "lr-push-to-talk": unknown;
  "lr-qr-code": unknown;
  "lr-radar-chart": unknown;
  "lr-radio": unknown;
  "lr-radio-button": unknown;
  "lr-radio-group": unknown;
  "lr-rag-answer": unknown;
  "lr-rag-eval-dashboard": unknown;
  "lr-random-content": unknown;
  "lr-rating": unknown;
  "lr-realtime-session": unknown;
  "lr-relative-time": unknown;
  "lr-reorder-item": unknown;
  "lr-reorder-list": unknown;
  "lr-resize-observer": unknown;
  "lr-responsive-panel": unknown;
  "lr-result-card": unknown;
  "lr-result-field": unknown;
  "lr-retrieval-compare": unknown;
  "lr-retrieval-results": unknown;
  "lr-retrieval-search": unknown;
  "lr-retrieval-trace": unknown;
  "lr-rubric-form": unknown;
  "lr-scatter-chart": unknown;
  "lr-json-schema-viewer": unknown;
  "lr-scroller": unknown;
  "lr-segmented": unknown;
  "lr-select": unknown;
  "lr-selection-toolbar": unknown;
  "lr-sequence-playback": unknown;
  "lr-sequence-strip": unknown;
  "lr-skeleton": unknown;
  "lr-slider": unknown;
  "lr-source-card": unknown;
  "lr-source-list": unknown;
  "lr-source-picker": unknown;
  "lr-span-waterfall": unknown;
  "lr-sparkline": unknown;
  "lr-spinner": unknown;
  "lr-split-panel": unknown;
  "lr-spreadsheet-viewer": unknown;
  "lr-stack-trace": unknown;
  "lr-stat": unknown;
  "lr-stepper": unknown;
  "lr-stream-status": unknown;
  "lr-streaming-text": unknown;
  "lr-subagent-panel": unknown;
  "lr-suggestion-chips": unknown;
  "lr-svg-viewer": unknown;
  "lr-swatch-picker": unknown;
  "lr-switch": unknown;
  "lr-tab": unknown;
  "lr-tab-group": unknown;
  "lr-tab-panel": unknown;
  "lr-table": unknown;
  "lr-tag": unknown;
  "lr-task-list": unknown;
  "lr-terminal": unknown;
  "lr-test-results": unknown;
  "lr-textarea": unknown;
  "lr-thinking-panel": unknown;
  "lr-thread-list": unknown;
  "lr-time-input": unknown;
  "lr-time-range": unknown;
  "lr-timeline": unknown;
  "lr-timeline-item": unknown;
  "lr-toast": unknown;
  "lr-toast-item": unknown;
  "lr-token-input": unknown;
  "lr-tool-approval-dialog": unknown;
  "lr-tool-call-chip": unknown;
  "lr-tool-param-form": unknown;
  "lr-tool-result-dialog": unknown;
  "lr-tool-result-view": unknown;
  "lr-tool-select-dialog": unknown;
  "lr-tool-timeline": unknown;
  "lr-tooltip": unknown;
  "lr-tour": unknown;
  "lr-trace-tree": unknown;
  "lr-transcript-feed": unknown;
  "lr-tree": unknown;
  "lr-tree-item": unknown;
  "lr-typing-indicator": unknown;
  "lr-usage-badge": unknown;
  "lr-video": unknown;
  "lr-video-playlist": unknown;
  "lr-virtual-list": unknown;
  "lr-visually-hidden": unknown;
  "lr-voice-picker": unknown;
  "lr-widget": unknown;
  "lr-widget-renderer": unknown;
  "lr-word-cloud": unknown;
  "lr-xml-viewer": unknown;
  "lr-zoomable-frame": unknown;
}`

- **`internal-ansi-contracts`** — Shared utility contracts.
  `AnsiStyles {
  bold: unknown;
  dim: unknown;
  italic: unknown;
  underline: unknown;
  inverse: unknown;
  fg: unknown;
  bg: unknown;
}`

- **`internal-canvas-color-contracts`** — Shared utility contracts.
  `resolveCanvasColor(/* public names: scope, color, fallback */): unknown`
  `resolveCanvasColors(/* public names: scope, colors, fallback */): unknown`

- **`internal-localization-runtime-contracts`** — Shared utility contracts.
  `getLyraLocaleDirection(/* public names: locale */): unknown`
  `getLyraLocale(): unknown`
  `getRegisteredLyraLocales(): unknown`
  `registerLyraLocale(/* public names: locale, strings, meta */): unknown`
  `resolveLyraDirection(/* public names: host */): unknown`
  `resolveLyraLocale(/* public names: host */): unknown`
  `setLyraLocale(/* public names: locale */): unknown`
  `subscribeLyraLocaleRegistry(/* public names: listener */): unknown`

- **`internal-localization-types-contracts`** — Shared utility contracts.
  `LyraLocaleMeta {
  dir: unknown;
  name: unknown;
}`

- **`internal-localization-contracts`** — Shared utility contracts.
  `resolveLyraString(/* public names: host, key, overrides, fallback, values */): unknown`

- **`internal-node-type-style-contracts`** — Shared utility contracts.
  `LyraNodeTypeStyle {
  id: unknown;
  label: unknown;
  color: unknown;
  shape: unknown;
}`

- **`internal-registered-animation-contracts`** — Shared utility contracts.
  `RegisteredAnimationSpec {
  keyframes: unknown;
  rtlKeyframes: unknown;
  durationProperties: unknown;
  easingProperties: unknown;
  fallbackDuration: unknown;
  fallbackEasing: unknown;
  options: unknown;
}`

- **`internal-text-viewer-target-contracts`** — Shared utility contracts.
  `LyraSearchChangeDetail {
  query: unknown;
  matchCount: unknown;
  matchCountExact: unknown;
  activeIndex: unknown;
}`
  `LyraTextViewerTarget {
  search: unknown;
  query: unknown;
  searchNext: unknown;
  searchPrevious: unknown;
  clearSearch: unknown;
  highlights: unknown;
  activeHighlightId: unknown;
  anchor: unknown;
  anchorKinds: unknown;
  scrollToAnchor: unknown;
  target: unknown;
}`

- **`ssr-contracts`** — Shared utility contracts.
  `diagnoseLyraHydration(/* public names: root */): unknown`
  `getLyraSsrMode(/* public names: tagName */): unknown`
  `LyraHydrationDiagnostic {
  element: unknown;
  tag: unknown;
  mode: unknown;
  status: unknown;
  error: unknown;
}`
  `LyraLitElementRendererConstructor {
  prototype: unknown;
  matchesClass: unknown;
  constructor: unknown;
  tagName: unknown;
  attributes: unknown;
}`
  `LyraSsrClientRenderReason {
  code: unknown;
  detail: unknown;
}`
  `lyraSsrElementRenderers(/* public names: litElementRenderer */): unknown`

- **`svelte-contracts`** — Framework integration type contracts.
  `LyraElementTagNameMap {
  "lr-accordion": unknown;
  "lr-accordion-item": unknown;
  "lr-activity-feed": unknown;
  "lr-agent-eval-dashboard": unknown;
  "lr-agent-run": unknown;
  "lr-agent-trace": unknown;
  "lr-agent-workspace": unknown;
  "lr-alert": unknown;
  "lr-animated-image": unknown;
  "lr-animation": unknown;
  "lr-app-rail": unknown;
  "lr-app-rail-item": unknown;
  "lr-approval-queue": unknown;
  "lr-archive-viewer": unknown;
  "lr-artifact-panel": unknown;
  "lr-attachment-chip": unknown;
  "lr-attachment-trigger": unknown;
  "lr-audio-visualizer": unknown;
  "lr-av-player": unknown;
  "lr-avatar": unknown;
  "lr-avatar-group": unknown;
  "lr-badge": unknown;
  "lr-bar-chart": unknown;
  "lr-box-plot": unknown;
  "lr-branch-picker": unknown;
  "lr-breadcrumb": unknown;
  "lr-breadcrumb-item": unknown;
  "lr-browser-frame": unknown;
  "lr-bubble-chart": unknown;
  "lr-button": unknown;
  "lr-button-group": unknown;
  "lr-calendar": unknown;
  "lr-calendar-viewer": unknown;
  "lr-callout": unknown;
  "lr-card": unknown;
  "lr-carousel": unknown;
  "lr-carousel-item": unknown;
  "lr-chart": unknown;
  "lr-chat-composer": unknown;
  "lr-chat-message": unknown;
  "lr-chat-viewport": unknown;
  "lr-checkbox": unknown;
  "lr-checkbox-group": unknown;
  "lr-checkpoint": unknown;
  "lr-chip": unknown;
  "lr-chip-group": unknown;
  "lr-chunk-inspector": unknown;
  "lr-citation-badge": unknown;
  "lr-claim-evidence": unknown;
  "lr-code-block": unknown;
  "lr-code-block-core": unknown;
  "lr-code-editor": unknown;
  "lr-color-picker": unknown;
  "lr-combobox": unknown;
  "lr-command-palette": unknown;
  "lr-commit-card": unknown;
  "lr-community-card": unknown;
  "lr-compare-panel": unknown;
  "lr-condition-builder": unknown;
  "lr-confirm-bar": unknown;
  "lr-contact-viewer": unknown;
  "lr-context-inspector": unknown;
  "lr-context-meter": unknown;
  "lr-control-group": unknown;
  "lr-conversation-item": unknown;
  "lr-copy-button": unknown;
  "lr-csv-viewer": unknown;
  "lr-dashboard-grid": unknown;
  "lr-data-grid": unknown;
  "lr-dataset-viewer": unknown;
  "lr-date-input": unknown;
  "lr-date-picker": unknown;
  "lr-details": unknown;
  "lr-dialog": unknown;
  "lr-diff-view": unknown;
  "lr-divider": unknown;
  "lr-dock-panel": unknown;
  "lr-document-compare": unknown;
  "lr-document-library": unknown;
  "lr-document-preview": unknown;
  "lr-document-viewer": unknown;
  "lr-docx-viewer": unknown;
  "lr-doughnut-chart": unknown;
  "lr-drawer": unknown;
  "lr-drilldown-panel": unknown;
  "lr-dropdown": unknown;
  "lr-dropdown-item": unknown;
  "lr-ebook-viewer": unknown;
  "lr-email-viewer": unknown;
  "lr-embedding-explorer": unknown;
  "lr-emoji-picker": unknown;
  "lr-empty": unknown;
  "lr-entity-card": unknown;
  "lr-entity-chip": unknown;
  "lr-entity-dossier": unknown;
  "lr-env-list": unknown;
  "lr-eval-dataset": unknown;
  "lr-eval-result": unknown;
  "lr-eval-run": unknown;
  "lr-export-button": unknown;
  "lr-file-icon": unknown;
  "lr-file-input": unknown;
  "lr-file-tree": unknown;
  "lr-filter-bar": unknown;
  "lr-flag": unknown;
  "lr-flow-canvas": unknown;
  "lr-flow-controls": unknown;
  "lr-flow-minimap": unknown;
  "lr-flow-node": unknown;
  "lr-flow-run-status": unknown;
  "lr-format-bytes": unknown;
  "lr-format-date": unknown;
  "lr-format-number": unknown;
  "lr-gauge": unknown;
  "lr-generation-metrics": unknown;
  "lr-geojson-view": unknown;
  "lr-geojson-viewer": unknown;
  "lr-graph": unknown;
  "lr-graph-legend": unknown;
  "lr-graph-query-builder": unknown;
  "lr-grounding-summary": unknown;
  "lr-handoff-divider": unknown;
  "lr-heatmap": unknown;
  "lr-highlight-layer": unknown;
  "lr-histogram": unknown;
  "lr-html-viewer": unknown;
  "lr-icon": unknown;
  "lr-icon-button": unknown;
  "lr-image-comparer": unknown;
  "lr-image-viewer": unknown;
  "lr-include": unknown;
  "lr-ingestion-queue": unknown;
  "lr-input": unknown;
  "lr-intersection-observer": unknown;
  "lr-json-viewer": unknown;
  "lr-kbd": unknown;
  "lr-knowledge-base": unknown;
  "lr-knowledge-base-admin": unknown;
  "lr-knowledge-graph-explorer": unknown;
  "lr-known-date": unknown;
  "lr-lightbox": unknown;
  "lr-line-chart": unknown;
  "lr-lite-chart": unknown;
  "lr-live-region": unknown;
  "lr-locale-picker": unknown;
  "lr-map": unknown;
  "lr-markdown": unknown;
  "lr-markdown-core": unknown;
  "lr-mcp-app": unknown;
  "lr-media-card": unknown;
  "lr-memory-panel": unknown;
  "lr-mention-popover": unknown;
  "lr-menu": unknown;
  "lr-menu-item": unknown;
  "lr-menu-label": unknown;
  "lr-message-actions": unknown;
  "lr-message-feedback": unknown;
  "lr-message-parts": unknown;
  "lr-mind-map": unknown;
  "lr-model-select": unknown;
  "lr-model-settings-panel": unknown;
  "lr-multi-split": unknown;
  "lr-mutation-observer": unknown;
  "lr-native-time-input": unknown;
  "lr-neighbor-list": unknown;
  "lr-node-palette": unknown;
  "lr-notebook-viewer": unknown;
  "lr-number-input": unknown;
  "lr-option": unknown;
  "lr-otp-input": unknown;
  "lr-page": unknown;
  "lr-page-rail": unknown;
  "lr-pagination": unknown;
  "lr-pan-zoom": unknown;
  "lr-path-strip": unknown;
  "lr-pdf-viewer": unknown;
  "lr-phone-input": unknown;
  "lr-pie-chart": unknown;
  "lr-polar-area-chart": unknown;
  "lr-policy-summary": unknown;
  "lr-poll-status": unknown;
  "lr-popover": unknown;
  "lr-popup": unknown;
  "lr-pptx-viewer": unknown;
  "lr-progress-bar": unknown;
  "lr-progress-ring": unknown;
  "lr-prompt-input": unknown;
  "lr-prompt-queue": unknown;
  "lr-prompt-studio": unknown;
  "lr-provenance-panel": unknown;
  "lr-push-to-talk": unknown;
  "lr-qr-code": unknown;
  "lr-radar-chart": unknown;
  "lr-radio": unknown;
  "lr-radio-button": unknown;
  "lr-radio-group": unknown;
  "lr-rag-answer": unknown;
  "lr-rag-eval-dashboard": unknown;
  "lr-random-content": unknown;
  "lr-rating": unknown;
  "lr-realtime-session": unknown;
  "lr-relative-time": unknown;
  "lr-reorder-item": unknown;
  "lr-reorder-list": unknown;
  "lr-resize-observer": unknown;
  "lr-responsive-panel": unknown;
  "lr-result-card": unknown;
  "lr-result-field": unknown;
  "lr-retrieval-compare": unknown;
  "lr-retrieval-results": unknown;
  "lr-retrieval-search": unknown;
  "lr-retrieval-trace": unknown;
  "lr-rubric-form": unknown;
  "lr-scatter-chart": unknown;
  "lr-json-schema-viewer": unknown;
  "lr-scroller": unknown;
  "lr-segmented": unknown;
  "lr-select": unknown;
  "lr-selection-toolbar": unknown;
  "lr-sequence-playback": unknown;
  "lr-sequence-strip": unknown;
  "lr-skeleton": unknown;
  "lr-slider": unknown;
  "lr-source-card": unknown;
  "lr-source-list": unknown;
  "lr-source-picker": unknown;
  "lr-span-waterfall": unknown;
  "lr-sparkline": unknown;
  "lr-spinner": unknown;
  "lr-split-panel": unknown;
  "lr-spreadsheet-viewer": unknown;
  "lr-stack-trace": unknown;
  "lr-stat": unknown;
  "lr-stepper": unknown;
  "lr-stream-status": unknown;
  "lr-streaming-text": unknown;
  "lr-subagent-panel": unknown;
  "lr-suggestion-chips": unknown;
  "lr-svg-viewer": unknown;
  "lr-swatch-picker": unknown;
  "lr-switch": unknown;
  "lr-tab": unknown;
  "lr-tab-group": unknown;
  "lr-tab-panel": unknown;
  "lr-table": unknown;
  "lr-tag": unknown;
  "lr-task-list": unknown;
  "lr-terminal": unknown;
  "lr-test-results": unknown;
  "lr-textarea": unknown;
  "lr-thinking-panel": unknown;
  "lr-thread-list": unknown;
  "lr-time-input": unknown;
  "lr-time-range": unknown;
  "lr-timeline": unknown;
  "lr-timeline-item": unknown;
  "lr-toast": unknown;
  "lr-toast-item": unknown;
  "lr-token-input": unknown;
  "lr-tool-approval-dialog": unknown;
  "lr-tool-call-chip": unknown;
  "lr-tool-param-form": unknown;
  "lr-tool-result-dialog": unknown;
  "lr-tool-result-view": unknown;
  "lr-tool-select-dialog": unknown;
  "lr-tool-timeline": unknown;
  "lr-tooltip": unknown;
  "lr-tour": unknown;
  "lr-trace-tree": unknown;
  "lr-transcript-feed": unknown;
  "lr-tree": unknown;
  "lr-tree-item": unknown;
  "lr-typing-indicator": unknown;
  "lr-usage-badge": unknown;
  "lr-video": unknown;
  "lr-video-playlist": unknown;
  "lr-virtual-list": unknown;
  "lr-visually-hidden": unknown;
  "lr-voice-picker": unknown;
  "lr-widget": unknown;
  "lr-widget-renderer": unknown;
  "lr-word-cloud": unknown;
  "lr-xml-viewer": unknown;
  "lr-zoomable-frame": unknown;
}`
  `LyraSvelteElements {
  "lr-accordion": unknown;
  "lr-accordion-item": unknown;
  "lr-activity-feed": unknown;
  "lr-agent-eval-dashboard": unknown;
  "lr-agent-run": unknown;
  "lr-agent-trace": unknown;
  "lr-agent-workspace": unknown;
  "lr-alert": unknown;
  "lr-animated-image": unknown;
  "lr-animation": unknown;
  "lr-app-rail": unknown;
  "lr-app-rail-item": unknown;
  "lr-approval-queue": unknown;
  "lr-archive-viewer": unknown;
  "lr-artifact-panel": unknown;
  "lr-attachment-chip": unknown;
  "lr-attachment-trigger": unknown;
  "lr-audio-visualizer": unknown;
  "lr-av-player": unknown;
  "lr-avatar": unknown;
  "lr-avatar-group": unknown;
  "lr-badge": unknown;
  "lr-bar-chart": unknown;
  "lr-box-plot": unknown;
  "lr-branch-picker": unknown;
  "lr-breadcrumb": unknown;
  "lr-breadcrumb-item": unknown;
  "lr-browser-frame": unknown;
  "lr-bubble-chart": unknown;
  "lr-button": unknown;
  "lr-button-group": unknown;
  "lr-calendar": unknown;
  "lr-calendar-viewer": unknown;
  "lr-callout": unknown;
  "lr-card": unknown;
  "lr-carousel": unknown;
  "lr-carousel-item": unknown;
  "lr-chart": unknown;
  "lr-chat-composer": unknown;
  "lr-chat-message": unknown;
  "lr-chat-viewport": unknown;
  "lr-checkbox": unknown;
  "lr-checkbox-group": unknown;
  "lr-checkpoint": unknown;
  "lr-chip": unknown;
  "lr-chip-group": unknown;
  "lr-chunk-inspector": unknown;
  "lr-citation-badge": unknown;
  "lr-claim-evidence": unknown;
  "lr-code-block": unknown;
  "lr-code-block-core": unknown;
  "lr-code-editor": unknown;
  "lr-color-picker": unknown;
  "lr-combobox": unknown;
  "lr-command-palette": unknown;
  "lr-commit-card": unknown;
  "lr-community-card": unknown;
  "lr-compare-panel": unknown;
  "lr-condition-builder": unknown;
  "lr-confirm-bar": unknown;
  "lr-contact-viewer": unknown;
  "lr-context-inspector": unknown;
  "lr-context-meter": unknown;
  "lr-control-group": unknown;
  "lr-conversation-item": unknown;
  "lr-copy-button": unknown;
  "lr-csv-viewer": unknown;
  "lr-dashboard-grid": unknown;
  "lr-data-grid": unknown;
  "lr-dataset-viewer": unknown;
  "lr-date-input": unknown;
  "lr-date-picker": unknown;
  "lr-details": unknown;
  "lr-dialog": unknown;
  "lr-diff-view": unknown;
  "lr-divider": unknown;
  "lr-dock-panel": unknown;
  "lr-document-compare": unknown;
  "lr-document-library": unknown;
  "lr-document-preview": unknown;
  "lr-document-viewer": unknown;
  "lr-docx-viewer": unknown;
  "lr-doughnut-chart": unknown;
  "lr-drawer": unknown;
  "lr-drilldown-panel": unknown;
  "lr-dropdown": unknown;
  "lr-dropdown-item": unknown;
  "lr-ebook-viewer": unknown;
  "lr-email-viewer": unknown;
  "lr-embedding-explorer": unknown;
  "lr-emoji-picker": unknown;
  "lr-empty": unknown;
  "lr-entity-card": unknown;
  "lr-entity-chip": unknown;
  "lr-entity-dossier": unknown;
  "lr-env-list": unknown;
  "lr-eval-dataset": unknown;
  "lr-eval-result": unknown;
  "lr-eval-run": unknown;
  "lr-export-button": unknown;
  "lr-file-icon": unknown;
  "lr-file-input": unknown;
  "lr-file-tree": unknown;
  "lr-filter-bar": unknown;
  "lr-flag": unknown;
  "lr-flow-canvas": unknown;
  "lr-flow-controls": unknown;
  "lr-flow-minimap": unknown;
  "lr-flow-node": unknown;
  "lr-flow-run-status": unknown;
  "lr-format-bytes": unknown;
  "lr-format-date": unknown;
  "lr-format-number": unknown;
  "lr-gauge": unknown;
  "lr-generation-metrics": unknown;
  "lr-geojson-view": unknown;
  "lr-geojson-viewer": unknown;
  "lr-graph": unknown;
  "lr-graph-legend": unknown;
  "lr-graph-query-builder": unknown;
  "lr-grounding-summary": unknown;
  "lr-handoff-divider": unknown;
  "lr-heatmap": unknown;
  "lr-highlight-layer": unknown;
  "lr-histogram": unknown;
  "lr-html-viewer": unknown;
  "lr-icon": unknown;
  "lr-icon-button": unknown;
  "lr-image-comparer": unknown;
  "lr-image-viewer": unknown;
  "lr-include": unknown;
  "lr-ingestion-queue": unknown;
  "lr-input": unknown;
  "lr-intersection-observer": unknown;
  "lr-json-viewer": unknown;
  "lr-kbd": unknown;
  "lr-knowledge-base": unknown;
  "lr-knowledge-base-admin": unknown;
  "lr-knowledge-graph-explorer": unknown;
  "lr-known-date": unknown;
  "lr-lightbox": unknown;
  "lr-line-chart": unknown;
  "lr-lite-chart": unknown;
  "lr-live-region": unknown;
  "lr-locale-picker": unknown;
  "lr-map": unknown;
  "lr-markdown": unknown;
  "lr-markdown-core": unknown;
  "lr-mcp-app": unknown;
  "lr-media-card": unknown;
  "lr-memory-panel": unknown;
  "lr-mention-popover": unknown;
  "lr-menu": unknown;
  "lr-menu-item": unknown;
  "lr-menu-label": unknown;
  "lr-message-actions": unknown;
  "lr-message-feedback": unknown;
  "lr-message-parts": unknown;
  "lr-mind-map": unknown;
  "lr-model-select": unknown;
  "lr-model-settings-panel": unknown;
  "lr-multi-split": unknown;
  "lr-mutation-observer": unknown;
  "lr-native-time-input": unknown;
  "lr-neighbor-list": unknown;
  "lr-node-palette": unknown;
  "lr-notebook-viewer": unknown;
  "lr-number-input": unknown;
  "lr-option": unknown;
  "lr-otp-input": unknown;
  "lr-page": unknown;
  "lr-page-rail": unknown;
  "lr-pagination": unknown;
  "lr-pan-zoom": unknown;
  "lr-path-strip": unknown;
  "lr-pdf-viewer": unknown;
  "lr-phone-input": unknown;
  "lr-pie-chart": unknown;
  "lr-polar-area-chart": unknown;
  "lr-policy-summary": unknown;
  "lr-poll-status": unknown;
  "lr-popover": unknown;
  "lr-popup": unknown;
  "lr-pptx-viewer": unknown;
  "lr-progress-bar": unknown;
  "lr-progress-ring": unknown;
  "lr-prompt-input": unknown;
  "lr-prompt-queue": unknown;
  "lr-prompt-studio": unknown;
  "lr-provenance-panel": unknown;
  "lr-push-to-talk": unknown;
  "lr-qr-code": unknown;
  "lr-radar-chart": unknown;
  "lr-radio": unknown;
  "lr-radio-button": unknown;
  "lr-radio-group": unknown;
  "lr-rag-answer": unknown;
  "lr-rag-eval-dashboard": unknown;
  "lr-random-content": unknown;
  "lr-rating": unknown;
  "lr-realtime-session": unknown;
  "lr-relative-time": unknown;
  "lr-reorder-item": unknown;
  "lr-reorder-list": unknown;
  "lr-resize-observer": unknown;
  "lr-responsive-panel": unknown;
  "lr-result-card": unknown;
  "lr-result-field": unknown;
  "lr-retrieval-compare": unknown;
  "lr-retrieval-results": unknown;
  "lr-retrieval-search": unknown;
  "lr-retrieval-trace": unknown;
  "lr-rubric-form": unknown;
  "lr-scatter-chart": unknown;
  "lr-json-schema-viewer": unknown;
  "lr-scroller": unknown;
  "lr-segmented": unknown;
  "lr-select": unknown;
  "lr-selection-toolbar": unknown;
  "lr-sequence-playback": unknown;
  "lr-sequence-strip": unknown;
  "lr-skeleton": unknown;
  "lr-slider": unknown;
  "lr-source-card": unknown;
  "lr-source-list": unknown;
  "lr-source-picker": unknown;
  "lr-span-waterfall": unknown;
  "lr-sparkline": unknown;
  "lr-spinner": unknown;
  "lr-split-panel": unknown;
  "lr-spreadsheet-viewer": unknown;
  "lr-stack-trace": unknown;
  "lr-stat": unknown;
  "lr-stepper": unknown;
  "lr-stream-status": unknown;
  "lr-streaming-text": unknown;
  "lr-subagent-panel": unknown;
  "lr-suggestion-chips": unknown;
  "lr-svg-viewer": unknown;
  "lr-swatch-picker": unknown;
  "lr-switch": unknown;
  "lr-tab": unknown;
  "lr-tab-group": unknown;
  "lr-tab-panel": unknown;
  "lr-table": unknown;
  "lr-tag": unknown;
  "lr-task-list": unknown;
  "lr-terminal": unknown;
  "lr-test-results": unknown;
  "lr-textarea": unknown;
  "lr-thinking-panel": unknown;
  "lr-thread-list": unknown;
  "lr-time-input": unknown;
  "lr-time-range": unknown;
  "lr-timeline": unknown;
  "lr-timeline-item": unknown;
  "lr-toast": unknown;
  "lr-toast-item": unknown;
  "lr-token-input": unknown;
  "lr-tool-approval-dialog": unknown;
  "lr-tool-call-chip": unknown;
  "lr-tool-param-form": unknown;
  "lr-tool-result-dialog": unknown;
  "lr-tool-result-view": unknown;
  "lr-tool-select-dialog": unknown;
  "lr-tool-timeline": unknown;
  "lr-tooltip": unknown;
  "lr-tour": unknown;
  "lr-trace-tree": unknown;
  "lr-transcript-feed": unknown;
  "lr-tree": unknown;
  "lr-tree-item": unknown;
  "lr-typing-indicator": unknown;
  "lr-usage-badge": unknown;
  "lr-video": unknown;
  "lr-video-playlist": unknown;
  "lr-virtual-list": unknown;
  "lr-visually-hidden": unknown;
  "lr-voice-picker": unknown;
  "lr-widget": unknown;
  "lr-widget-renderer": unknown;
  "lr-word-cloud": unknown;
  "lr-xml-viewer": unknown;
  "lr-zoomable-frame": unknown;
}`

- **`testing-happy-dom-shims-contracts`** — Shared utility contracts.
  `installHappyDomFormAssociatedShims(): unknown`
  `installStubInternalsForTest(/* public names: host */): unknown`

- **`theme-gemstones-data-contracts`** — Shared utility contracts.
  `GemstoneAccent {
  key: unknown;
  fill: unknown;
  deep: unknown;
}`

- **`theme-gemstones-contracts`** — Shared utility contracts.
  `gemstoneGlyph(/* public names: color */): unknown`

- **`theme-presets-contracts`** — Shared utility contracts.
  `applyLyraThemePreset(/* public names: presetOrName */): unknown`
  `defineLyraThemePreset(/* public names: preset */): unknown`
  `LyraThemePresetChangeDetail {
  id: unknown;
  theme: unknown;
}`
  `LyraThemePreset {
  id: unknown;
  theme: unknown;
}`

- **`theme-theme-contracts`** — Shared utility contracts.
  `createLyraThemeBootstrap(/* public names: options */): unknown`
  `getLyraTheme(): unknown`
  `LyraThemeBootstrapOptions {
  storageKey: unknown;
}`
  `LyraTheme {
  mode: unknown;
  accent: unknown;
}`
  `setLyraTheme(/* public names: theme */): unknown`

- **`vue-contracts`** — Framework integration type contracts.
  `LyraVueGlobalComponents {
  "lr-accordion": unknown;
  "lr-accordion-item": unknown;
  "lr-activity-feed": unknown;
  "lr-agent-eval-dashboard": unknown;
  "lr-agent-run": unknown;
  "lr-agent-trace": unknown;
  "lr-agent-workspace": unknown;
  "lr-alert": unknown;
  "lr-animated-image": unknown;
  "lr-animation": unknown;
  "lr-app-rail": unknown;
  "lr-app-rail-item": unknown;
  "lr-approval-queue": unknown;
  "lr-archive-viewer": unknown;
  "lr-artifact-panel": unknown;
  "lr-attachment-chip": unknown;
  "lr-attachment-trigger": unknown;
  "lr-audio-visualizer": unknown;
  "lr-av-player": unknown;
  "lr-avatar": unknown;
  "lr-avatar-group": unknown;
  "lr-badge": unknown;
  "lr-bar-chart": unknown;
  "lr-box-plot": unknown;
  "lr-branch-picker": unknown;
  "lr-breadcrumb": unknown;
  "lr-breadcrumb-item": unknown;
  "lr-browser-frame": unknown;
  "lr-bubble-chart": unknown;
  "lr-button": unknown;
  "lr-button-group": unknown;
  "lr-calendar": unknown;
  "lr-calendar-viewer": unknown;
  "lr-callout": unknown;
  "lr-card": unknown;
  "lr-carousel": unknown;
  "lr-carousel-item": unknown;
  "lr-chart": unknown;
  "lr-chat-composer": unknown;
  "lr-chat-message": unknown;
  "lr-chat-viewport": unknown;
  "lr-checkbox": unknown;
  "lr-checkbox-group": unknown;
  "lr-checkpoint": unknown;
  "lr-chip": unknown;
  "lr-chip-group": unknown;
  "lr-chunk-inspector": unknown;
  "lr-citation-badge": unknown;
  "lr-claim-evidence": unknown;
  "lr-code-block": unknown;
  "lr-code-block-core": unknown;
  "lr-code-editor": unknown;
  "lr-color-picker": unknown;
  "lr-combobox": unknown;
  "lr-command-palette": unknown;
  "lr-commit-card": unknown;
  "lr-community-card": unknown;
  "lr-compare-panel": unknown;
  "lr-condition-builder": unknown;
  "lr-confirm-bar": unknown;
  "lr-contact-viewer": unknown;
  "lr-context-inspector": unknown;
  "lr-context-meter": unknown;
  "lr-control-group": unknown;
  "lr-conversation-item": unknown;
  "lr-copy-button": unknown;
  "lr-csv-viewer": unknown;
  "lr-dashboard-grid": unknown;
  "lr-data-grid": unknown;
  "lr-dataset-viewer": unknown;
  "lr-date-input": unknown;
  "lr-date-picker": unknown;
  "lr-details": unknown;
  "lr-dialog": unknown;
  "lr-diff-view": unknown;
  "lr-divider": unknown;
  "lr-dock-panel": unknown;
  "lr-document-compare": unknown;
  "lr-document-library": unknown;
  "lr-document-preview": unknown;
  "lr-document-viewer": unknown;
  "lr-docx-viewer": unknown;
  "lr-doughnut-chart": unknown;
  "lr-drawer": unknown;
  "lr-drilldown-panel": unknown;
  "lr-dropdown": unknown;
  "lr-dropdown-item": unknown;
  "lr-ebook-viewer": unknown;
  "lr-email-viewer": unknown;
  "lr-embedding-explorer": unknown;
  "lr-emoji-picker": unknown;
  "lr-empty": unknown;
  "lr-entity-card": unknown;
  "lr-entity-chip": unknown;
  "lr-entity-dossier": unknown;
  "lr-env-list": unknown;
  "lr-eval-dataset": unknown;
  "lr-eval-result": unknown;
  "lr-eval-run": unknown;
  "lr-export-button": unknown;
  "lr-file-icon": unknown;
  "lr-file-input": unknown;
  "lr-file-tree": unknown;
  "lr-filter-bar": unknown;
  "lr-flag": unknown;
  "lr-flow-canvas": unknown;
  "lr-flow-controls": unknown;
  "lr-flow-minimap": unknown;
  "lr-flow-node": unknown;
  "lr-flow-run-status": unknown;
  "lr-format-bytes": unknown;
  "lr-format-date": unknown;
  "lr-format-number": unknown;
  "lr-gauge": unknown;
  "lr-generation-metrics": unknown;
  "lr-geojson-view": unknown;
  "lr-geojson-viewer": unknown;
  "lr-graph": unknown;
  "lr-graph-legend": unknown;
  "lr-graph-query-builder": unknown;
  "lr-grounding-summary": unknown;
  "lr-handoff-divider": unknown;
  "lr-heatmap": unknown;
  "lr-highlight-layer": unknown;
  "lr-histogram": unknown;
  "lr-html-viewer": unknown;
  "lr-icon": unknown;
  "lr-icon-button": unknown;
  "lr-image-comparer": unknown;
  "lr-image-viewer": unknown;
  "lr-include": unknown;
  "lr-ingestion-queue": unknown;
  "lr-input": unknown;
  "lr-intersection-observer": unknown;
  "lr-json-viewer": unknown;
  "lr-kbd": unknown;
  "lr-knowledge-base": unknown;
  "lr-knowledge-base-admin": unknown;
  "lr-knowledge-graph-explorer": unknown;
  "lr-known-date": unknown;
  "lr-lightbox": unknown;
  "lr-line-chart": unknown;
  "lr-lite-chart": unknown;
  "lr-live-region": unknown;
  "lr-locale-picker": unknown;
  "lr-map": unknown;
  "lr-markdown": unknown;
  "lr-markdown-core": unknown;
  "lr-mcp-app": unknown;
  "lr-media-card": unknown;
  "lr-memory-panel": unknown;
  "lr-mention-popover": unknown;
  "lr-menu": unknown;
  "lr-menu-item": unknown;
  "lr-menu-label": unknown;
  "lr-message-actions": unknown;
  "lr-message-feedback": unknown;
  "lr-message-parts": unknown;
  "lr-mind-map": unknown;
  "lr-model-select": unknown;
  "lr-model-settings-panel": unknown;
  "lr-multi-split": unknown;
  "lr-mutation-observer": unknown;
  "lr-native-time-input": unknown;
  "lr-neighbor-list": unknown;
  "lr-node-palette": unknown;
  "lr-notebook-viewer": unknown;
  "lr-number-input": unknown;
  "lr-option": unknown;
  "lr-otp-input": unknown;
  "lr-page": unknown;
  "lr-page-rail": unknown;
  "lr-pagination": unknown;
  "lr-pan-zoom": unknown;
  "lr-path-strip": unknown;
  "lr-pdf-viewer": unknown;
  "lr-phone-input": unknown;
  "lr-pie-chart": unknown;
  "lr-polar-area-chart": unknown;
  "lr-policy-summary": unknown;
  "lr-poll-status": unknown;
  "lr-popover": unknown;
  "lr-popup": unknown;
  "lr-pptx-viewer": unknown;
  "lr-progress-bar": unknown;
  "lr-progress-ring": unknown;
  "lr-prompt-input": unknown;
  "lr-prompt-queue": unknown;
  "lr-prompt-studio": unknown;
  "lr-provenance-panel": unknown;
  "lr-push-to-talk": unknown;
  "lr-qr-code": unknown;
  "lr-radar-chart": unknown;
  "lr-radio": unknown;
  "lr-radio-button": unknown;
  "lr-radio-group": unknown;
  "lr-rag-answer": unknown;
  "lr-rag-eval-dashboard": unknown;
  "lr-random-content": unknown;
  "lr-rating": unknown;
  "lr-realtime-session": unknown;
  "lr-relative-time": unknown;
  "lr-reorder-item": unknown;
  "lr-reorder-list": unknown;
  "lr-resize-observer": unknown;
  "lr-responsive-panel": unknown;
  "lr-result-card": unknown;
  "lr-result-field": unknown;
  "lr-retrieval-compare": unknown;
  "lr-retrieval-results": unknown;
  "lr-retrieval-search": unknown;
  "lr-retrieval-trace": unknown;
  "lr-rubric-form": unknown;
  "lr-scatter-chart": unknown;
  "lr-json-schema-viewer": unknown;
  "lr-scroller": unknown;
  "lr-segmented": unknown;
  "lr-select": unknown;
  "lr-selection-toolbar": unknown;
  "lr-sequence-playback": unknown;
  "lr-sequence-strip": unknown;
  "lr-skeleton": unknown;
  "lr-slider": unknown;
  "lr-source-card": unknown;
  "lr-source-list": unknown;
  "lr-source-picker": unknown;
  "lr-span-waterfall": unknown;
  "lr-sparkline": unknown;
  "lr-spinner": unknown;
  "lr-split-panel": unknown;
  "lr-spreadsheet-viewer": unknown;
  "lr-stack-trace": unknown;
  "lr-stat": unknown;
  "lr-stepper": unknown;
  "lr-stream-status": unknown;
  "lr-streaming-text": unknown;
  "lr-subagent-panel": unknown;
  "lr-suggestion-chips": unknown;
  "lr-svg-viewer": unknown;
  "lr-swatch-picker": unknown;
  "lr-switch": unknown;
  "lr-tab": unknown;
  "lr-tab-group": unknown;
  "lr-tab-panel": unknown;
  "lr-table": unknown;
  "lr-tag": unknown;
  "lr-task-list": unknown;
  "lr-terminal": unknown;
  "lr-test-results": unknown;
  "lr-textarea": unknown;
  "lr-thinking-panel": unknown;
  "lr-thread-list": unknown;
  "lr-time-input": unknown;
  "lr-time-range": unknown;
  "lr-timeline": unknown;
  "lr-timeline-item": unknown;
  "lr-toast": unknown;
  "lr-toast-item": unknown;
  "lr-token-input": unknown;
  "lr-tool-approval-dialog": unknown;
  "lr-tool-call-chip": unknown;
  "lr-tool-param-form": unknown;
  "lr-tool-result-dialog": unknown;
  "lr-tool-result-view": unknown;
  "lr-tool-select-dialog": unknown;
  "lr-tool-timeline": unknown;
  "lr-tooltip": unknown;
  "lr-tour": unknown;
  "lr-trace-tree": unknown;
  "lr-transcript-feed": unknown;
  "lr-tree": unknown;
  "lr-tree-item": unknown;
  "lr-typing-indicator": unknown;
  "lr-usage-badge": unknown;
  "lr-video": unknown;
  "lr-video-playlist": unknown;
  "lr-virtual-list": unknown;
  "lr-visually-hidden": unknown;
  "lr-voice-picker": unknown;
  "lr-widget": unknown;
  "lr-widget-renderer": unknown;
  "lr-word-cloud": unknown;
  "lr-xml-viewer": unknown;
  "lr-zoomable-frame": unknown;
}`
