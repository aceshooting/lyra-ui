# Testing and utilities

## Testing form-associated components: `@aceshooting/lyra-ui/testing`

`@aceshooting/lyra-ui/testing` exports `installHappyDomFormAssociatedShims(): void` for test
environments without usable `ElementInternals`. In that environment, form participation is inert
while components retain local validity and state behavior. Install the helper once before assertions
that need form-value or validity behavior: it supplies
`setFormValue()`, `setValidity()`, `checkValidity()`, `reportValidity()`, and readonly
`form`/`labels`/`validity`/`validationMessage`/`willValidate`. The shim is a no-op where the
platform already provides internals, so it is safe in a shared setup file.

`installHappyDomShims()` installs that shim plus two more Happy DOM gap fixes, each a no-op where
the engine already behaves (feature-detected, so safe in a shared setup file and never part of a
production bundle): `installHappyDomShadowFocusShim()` makes `ShadowRoot.activeElement` return
`null` for a sibling or detached shadow root instead of throwing a `TypeError` (own-root and
nested-root focus are unchanged; it returns a function that restores the original descriptor), and `installHappyDomAriaControlsShim()` adds `Element.ariaControlsElements` only
when absent. Setting it stores the references and writes an empty `aria-controls`; reading returns
only targets in the element's own or an ancestor shadow scope (sibling and descendant shadow
targets are dropped); `null` clears it and removes the attribute; a changed `aria-controls`
attribute resolves ids in the element's own root instead.

## Constructing a validated test event: `createLyraEvent()`

`@aceshooting/lyra-ui/testing` also exports
`createLyraEvent(tag, name, detail?): CustomEvent`, for a downstream suite that wants to dispatch
one specific `lr-*` component's documented event — at a listener under test, without rendering the
real component — instead of hand-rolling a `CustomEvent` and guessing its shape and flags:

```ts
import { createLyraEvent } from '@aceshooting/lyra-ui/testing';

const event = createLyraEvent('lr-confirm-bar', 'lr-approve-request', { args: null, waitUntil: () => {} });
event.cancelable; // true — lr-confirm-bar's own lr-approve-request call site is cancelable
target.dispatchEvent(event);
```

`tag` and `name` are checked against that component's own generated event map: an event name the
tag does not document, an unregistered tag, or a `detail` of the wrong shape are all compile
errors. `bubbles` and `composed` are always `true` (every `lr-*` event is), and `cancelable` is
looked up per tag and event from the component's own documented contract, so a listener that calls
`preventDefault()` on a genuinely cancelable event is actually exercised — the exact case a
hand-built event with a guessed `cancelable` value silently skips. `detail` is always optional,
even where the real component's own type makes it required, so a test that only cares about the
dispatched event's flags does not have to fabricate a realistic one; an omitted or `undefined`
detail becomes `null`, matching `LyraElement.emit()`'s own normalization. `createLyraEvent()`
builds the event only — dispatch it yourself with `target.dispatchEvent(event)`.

Scope: covers every `lr-*`-named event a component documents. A component's native-named
re-emits (`input`, `change`, `blur`, `focus`, ...) already have real DOM event types and dispatch
semantics of their own that this factory does not model.

## Driving a component's real activation path: interaction drivers

For the exact gap `createLyraEvent()` leaves open — choosing an option, submitting a confirm
decision, toggling a switch, activating a step — `@aceshooting/lyra-ui/testing` exports a small
set of typed interaction drivers, one per interaction, that go through the real component's own
activation path (its own shadow-part lookup and `.click()`, the same as its own tests) instead of
a downstream suite reverse-engineering internal detail shapes or shadow-part selectors itself:

```ts
import {
  chooseOption,
  submitConfirmDecision,
  toggleSwitch,
  activateStep,
} from '@aceshooting/lyra-ui/testing';

await chooseOption(combobox, 'banana'); // opens the listbox, clicks the matching [part="option"] row
await submitConfirmDecision(confirmBar, 'approved'); // clicks [part="approve-button"]
await toggleSwitch(switchEl); // calls switchEl.click(), lr-switch's own activation path
await activateStep(stepper, 'review'); // clicks the [part="step"] button for that stepId (or pass an index)
```

`chooseOption()` accepts any of `<lr-combobox>`, `<lr-select>`, `<lr-model-select>`,
`<lr-locale-picker>` and `<lr-voice-picker>` — every component that independently implements the
same `[part="option"]` row plus `data-value` delegated-click pattern for its own listbox/popup.
`submitConfirmDecision()`
accepts either `<lr-confirm-bar>` or `<lr-tool-approval-dialog>`, which render the identical
`[part="approve-button"]`/`[part="deny-button"]` pair and emit cancelable
`lr-approve-request`/`lr-deny-request` events. The driver awaits the component's render;
if a listener calls `preventDefault()` on either component, or `waitUntil()` on the confirm bar,
the action may still be pending when the driver returns.

Each driver is `async` and awaits `updateComplete` before returning, so assertions written
immediately after it see the render reached by that interaction. Host-driven async decisions
still need their own completion check. Each driver also throws a plain `Error` — never a
silent no-op — when the requested interaction cannot actually happen: the target is disabled, the
option owner/stepper is read-only or has no matching row/step currently rendered, or the confirm
bar is already decided. That is the exact failure mode a hand-rolled event misses (for example
dispatching a confirm event without `cancelable`, which makes a `preventDefault()`-based
pending-state handler a silent no-op that still looks tested) — these drivers exercise the
component for real, so a precondition that blocks the interaction is surfaced as a thrown error
instead of quietly doing nothing.

Pure DOM operations only (`Element.click()`, shadow-part queries, public properties) — no
`@web/test-runner`/CDP-only helper, so they also run under a downstream suite's own
happy-dom/jsdom environment, not only a real browser.

Scope: one driver per interaction named above. Not a general "drive any component" toolkit —
render the real component and interact with it directly for anything else.

## Awaiting a lazily registered mount: `waitForLyraElement()` and `waitForToast()`

An imperative API can register its elements lazily -- `toast()` dynamically `import()`s
`<lr-toast>`/`<lr-toast-item>` on first call (a deliberate bundle-size trade: importing the package
root, or even `toast()` itself, never pulls the element classes into an eagerly loaded bundle). A
fire-and-forget `toast(...)` call -- the normal application pattern, since a component should not
block its own flow on a toast -- therefore leaves the document empty for at least one microtask
after the call returns. `@aceshooting/lyra-ui/testing` exports `waitForLyraElement()` for this shape
in general, plus `waitForToast()` as the named convenience for `toast()` specifically:

```ts
import { waitForToast } from '@aceshooting/lyra-ui/testing';

toast('Saved'); // fire-and-forget; toast.class.js/toast-item.class.js may still be importing
const item = await waitForToast('Saved'); // resolves once a matching <lr-toast-item> mounts
expect(item.textContent?.trim()).to.equal('Saved');
```

`waitForToast(match?, options?)` resolves once a `<lr-toast-item>` is connected and upgraded. A
string `match` compares against the item's trimmed `textContent` (what `toast('Saved')` sets
verbatim); pass a predicate — `(item: LyraToastItem) => boolean` — for anything else (a substring,
an icon/action check, a specific variant); omitting `match` resolves the first toast item to mount.

The underlying `waitForLyraElement<T>(selector, options?)` is generic over any element reachable
from `options.root` (`document` by default): it resolves once an element matching `selector` is
both connected and upgraded — registered with a constructor the element is actually an instance of
— filtered further by an optional `options.match: (element: T) => boolean`. An element already
present in markup before its class registers (the SSR/hydration case) is not a match until it
upgrades. Both resolve via `MutationObserver` (new elements arriving) and
`customElements.whenDefined()` (an already-connected-but-undefined element finishing registration)
rather than polling on a timer, and both reject with an Error describing the selector, the timeout,
and how many non-matching candidates were found — after a bounded `options.timeoutMs` (2000ms
default). Every underlying API is standard DOM/HTML with no `@web/test-runner`/CDP dependency, so
both also run under a downstream suite's own happy-dom environment, not only a real browser.

Scope: awaiting a lazy mount reachable from a root you already have a handle to. Not a replacement
for `updateComplete` (a mounted element may still have a pending render) or for the interaction
drivers above (already-mounted components' own activation paths). `toast()` is currently the only
imperative `lyra-ui` API that registers its elements through a dynamic `import()`; `confirm()`
registers `<lr-dialog>` synchronously (a static import plus an idempotent `defineElement()` call) and
mounts its transient dialog before returning, so it has no equivalent gap. Both helpers mount in
their owning document's `body`, so their output follows that document-level style scope rather than
a local island around the call site.

## happy-dom's custom-property resolver and host-to-part token forwarding

happy-dom merges ancestor and own-element custom properties into one flat map and resolves
`var()` recursively with no visited set or depth cap, so a `:host` token captured from a public
token and forwarded back onto that same public name on a `[part]` recurses forever
(`RangeError: Maximum call stack size exceeded` from `CSSVariableFormatter.resolveVariables`).
Real browsers resolve host and part on separate elements and never cycle. Tests can pass while
the unhandled errors still make the runner exit non-zero.

Current versions are unaffected: composing components set their defaults on
`<lr-icon-button>`'s private `--_lr-icon-button-<token>-default` tier, and `<lr-icon-button>` still
checks the public token first, so an ancestor override reaches a composed control. A project
still hitting the `RangeError` should upgrade `@aceshooting/lyra-ui`; no resolver patch or
real-browser fallback is needed.

## Editor and tooling integration

The companion package `@aceshooting/lyra-ide` (not `@aceshooting/lyra-ui`) ships machine-readable
metadata for editors: `custom-elements.json` (Custom Elements Manifest), `web-types.json`
(JetBrains, zero-config), and `vscode-html-data.json` / `vscode-css-data.json` (point
`html.customData` / `css.customData` at `./node_modules/@aceshooting/lyra-ide/...` in
`.vscode/settings.json`). For an agent, `llms/components/<tag>.md` is the cheaper source; these
files matter when scaffolding a project's editor configuration. Build tools can import the manifest
through the explicit `@aceshooting/lyra-ide/custom-elements.json` package export; native Node ESM
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

**Which tags an entry registers, and which message keys it can reach (`registrations.json`).** A
stable per-tag entry (`@aceshooting/lyra-ui/components/lr-<name>.js`) can, at import time, define
more than one custom element: importing `lr-table.js` also registers `<lr-empty>`,
`<lr-pagination>`, `<lr-skeleton>` and `<lr-spinner>`, because `lr-table`'s registration entry
imports those composed children's own registration entries before defining `<lr-table>` itself.
`custom-elements.json` declares one custom element per family source module, with no field for a
stable per-tag entry specifier and none for the extra tags importing it registers as a side effect.
For that, read the generated `@aceshooting/lyra-ui/registrations.json` instead (`schemaVersion: 1`):
`{ entries: [{ tag, entry, registrationModule, distModule, registers, localeKeys }],
integrations: [{ entry, registrationModule, distModule, registers, localeKeys }] }`. Every
`entries` row describes the stable per-tag alias above and always carries `tag`. `integrations`
lists the published integration-bridge specifiers, which install an integration — an optional-peer
resolver, a lazy document-format registrar — without being any single component's own alias, so
they carry no `tag`: `components/media/flag/flag-peer.js`,
`components/viewers/archive-viewer/archive-viewer-register.js` and
`components/viewers/ebook-viewer/ebook-viewer-register.js`, the three imports a per-tag alias cannot
stand in for. They are a separate array rather than tag-less rows mixed into `entries`, so a reader
that keys `entries` by `tag` keeps working; `integrations`, `distModule` and `localeKeys` are all
additive, which is why the schema version is unchanged. `registrationModule` is the `src/` path used
internally; `distModule` is a retained published specifier and equals the stable `entry` for v24
per-tag registrations and integration bridges. `registers` is every `lr-*` tag
importing `entry` defines, direct or transitive, derived from the same transitive-import analysis
`scripts/check-component-dependencies.mjs` already performs against the real registration graph
(not a second hand-maintained list). `localeKeys` is every `LyraMessageKey` the registered tags can
reach — including a key reached only through an indirect lookup table (e.g. `lr-attachment-trigger`'s
`{ triggerKey: 'attachmentTriggerFiles' }`-shaped map), because it reuses
`generate-default-string-slices.mjs`'s own reachability walk rather than a literal-`localize()`-only
scan. All of it is regenerated by `pnpm run registration-graph`.

## Independence and migration

Lyra has no runtime, theme, or design-token dependency on Shoelace or Web Awesome. Documented `wa-*`
comparisons are migration references only; Lyra's own tokens, events, localization runtime, and
implementation are the source of truth. `llms/migration.md` holds the generated per-tag
`exact`/`rewritten`/`warning-required`/`conceptual-only`/`unsupported` decision and every declared
member/default/import rewrite. Only the first two classifications are automatic; use the codemod's
location-aware report rather than treating a README relationship as a rename allowlist.

Security-motivated differences remain explicit. `lr-include` sanitizes every fragment, omits a
script-executing mode, and defaults to same-origin fetches. Its post-sanitization transclusion is
network-silent and non-interactive: anchors remain only for resolvable same-document `#fragment`
links (rebased per include instance); every other navigation or resource attribute, including
`href`, `src`, `srcset`, `action`, `ping`, and `poster`, is stripped, so images do not load.
Form-control and custom-element wrappers are unwrapped to safe ordinary text or children, while
controls with no passive content are removed. Link-like controls strip `opener` and force-add
`noopener noreferrer` whenever `target` is set while preserving other settable author tokens where
the component exposes `rel`; iframe/media/viewer inputs keep their URL validation, sandbox, size
caps, and generation guards. A use that depends on weaker behavior is left unchanged with a warning.
For a staged theme migration, map existing values onto `--lr-theme-*` explicitly in application CSS
rather than expecting an implicit compatibility layer.

## Family barrels

Each of the eleven component families has an entry point that registers every element in it:
`@aceshooting/lyra-ui/components/forms`, `.../components/overlays`, and so on for `agent-tools`,
`charts`, `conversation`, `data`, `layout`, `media`, `retrieval`, `utility` and `viewers`.

A family barrel is **side-effectful by design**: importing it registers every tag in that family, the
same way `all.js` registers its root-included tags (the package root itself registers nothing — see
"Importing and registering components"). Reach for one when you genuinely use most of a family
and want a single import; reach for the granular
`@aceshooting/lyra-ui/components/<tag>.js` path when you do not, because a barrel cannot be
tree-shaken down to the two elements you actually render. The tag-shaped path remains stable if a
component moves between Lyra's internal family folders. Duplicate nested registration paths were
removed in v24; family barrels remain supported.

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

`@aceshooting/lyra-ui/internal/*` is not a published subpath. The helpers below are the supported
public utility surface and are covered by semver. Each subpath and the extensionless barrel use
explicit named exports, so an implementation helper added to `internal/` does not silently become
public:

```ts
// Public utility import
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
  A subclass declaring `protected static deprecatedAliases` must call
  `installDeprecatedAliases()` once in a static block. Import the installer from its granular
  `@aceshooting/lyra-ui/utilities/deprecated-aliases.js` route:

  ```ts
  import { LyraElement } from '@aceshooting/lyra-ui/utilities/lyra-element.js';
  import { installDeprecatedAliases } from '@aceshooting/lyra-ui/utilities/deprecated-aliases.js';

  class MyElement extends LyraElement {
    static { installDeprecatedAliases(); }
    protected static override deprecatedAliases = { oldName: 'newName' };
  }
  ```

  The installer adds alias synchronization to the base-class hooks; classes without alias tables
  do not need it.
- **`utilities-deprecated-aliases-contracts`** — The opt-in installer for a subclass's
  `deprecatedAliases` table. Call it once from a static block on that subclass; it installs
  property/attribute synchronization on the shared element hooks.
  `installDeprecatedAliases(): void`
  Import: `@aceshooting/lyra-ui/utilities/deprecated-aliases.js`.
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
  malformed records without a non-empty string `anchor.kind` are omitted, while each accepted
  record's otherwise-opaque `anchor` retains caller identity so reference-based anchor jumps still
  work.
- **`positioner` → `place(anchor, popup, opts?): () => void`, `trackRect(target, onUpdate(rect)): () =>
void`, and `virtualAnchorFromRect()`** — thin wrapper over `@floating-ui/dom`'s
  `computePosition` + `autoUpdate`. Forces `strategy: 'fixed'` (matching the
  popup's own `position: fixed` CSS — otherwise it lands offset by the page scroll), middleware
  `offset(opts.offset ?? 4)`, `flip()`, `shift({ padding: 8 })`, default `placement: 'bottom-start'`.
  Returns a cleanup function that stops observation and queued updates — call it in `disconnectedCallback()`.
  For `place()`, element-resize notifications coalesce into the next animation frame; initial
  computation, scrolling and layout-shift updates begin immediately. Cleanup cancels a pending
  resize frame.
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
  in the same `<form>` as these. `attachInternalsSafely()` inspects own and inherited data
  descriptors without reading accessors, calls an eligible implementation once, and returns the
  fallback internals for a missing, accessor-backed, non-callable, or throwing capability.
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
  (`next`); the `value` getter/setter (`next`); `defaultValue`; `customError`; `disabled`; `required`; readonly
  `effectiveDisabled`; the `form` getter/setter (`owner`); readonly `labels`, `validity`,
  `validationMessage`, and `willValidate`; `setFormValue(next)`; `getForm()`; `checkValidity()`;
  `reportValidity()`; `setCustomValidity(message)`; `resetValidity()`; `formResetCallback()`; and
  `formStateRestoreCallback(state, reason)`.
  Writing `null` to `defaultValue` removes its markup value and resets the default to the adapter's
  empty value; reading it still returns `TValue`. This does not overwrite a dirty live value.
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
name(next: string | null); get value(): TValue; set value(next: TValue | null); get defaultValue(): TValue;
set defaultValue(next: TValue | null); customError: string | null;
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
  `CheckedFormAssociated(Base)` is the checkbox-, switch- and radio-shaped variant of that mixin: the
  string `value` (default `'on'`) is submitted only while `checked`, `checked` has native
  dirty/default semantics, reset and state restore round-trip it, and `required` means "must be
  checked". It adds `CheckedFormAssociatedInterface { checked: boolean; get defaultChecked():
boolean; set defaultChecked(next: boolean) }`.
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
- **`format` → `formatNumber(value, locale?, options?)`, `formatDate(value, locale?, options?)`,
  `formatRelativeTime(value, locale?, options?)`, and `formatBytes(value, locale?, options?)`** —
  pure, string-returning wrappers over the same memoized `Intl` formatter cache and locale
  resolution `<lr-format-number>`, `<lr-format-date>`, `<lr-relative-time>`, and `<lr-format-bytes>`
  render through. Reach for these when you need a formatted **string** rather than a rendered
  element: interpolating into a message template, populating a text-only property on another
  component (a stat tile's value, a chart tick label, a badge's cost text), building a search
  predicate, or composing an accessibility announcement.
  An omitted `locale` (or the explicit `'auto'` sentinel) on any of the four resolves to the page's
  active `setLyraLocale()` locale, exactly like a rendered `<lr-*>` component with no closer
  `locale`/`lang` override — not a hardcoded `'en'`. It falls back to `'en'` only once no active
  locale has ever been set, so an app that never calls `setLyraLocale()` sees no change. An
  explicit BCP-47 tag always stays authoritative over the active locale.
  `formatNumber()` and `formatBytes()` accept a `bigint` or a decimal/integer string, not just a
  `number`, for exact-precision input (large ids, monetary amounts, exact byte counts) — a plain
  `number` is a float64 and cannot exactly represent an integer beyond `Number.MAX_SAFE_INTEGER` or
  most decimal fractions. `formatBytes()` still selects its unit (`byte`..`petabyte`/`bit`..
  `petabit`) from an approximate magnitude, since which unit is only ever a display choice, but
  computes the displayed amount itself with exact `bigint` division, so the digits a `bigint`/string
  input carries are never rounded away. `formatDate()` and `formatRelativeTime()` accept the same
  date sources as `<lr-format-date>`/`<lr-relative-time>`'s `date` property (an ISO/date string,
  epoch milliseconds, or a `Date`) and return `undefined` for an unresolvable source instead of
  throwing; `formatBytes()` likewise returns `undefined` for a non-finite or unparseable `value`.
  `formatNumber()` and invalid `options` on any of the four throw the same error
  `Intl.NumberFormat`/`Intl.DateTimeFormat`/`Intl.RelativeTimeFormat`'s own constructor would.
  `formatRelativeTime()`'s `options.unit` accepts an explicit unit or `'auto'` (default) to pick
  the largest unit the magnitude clears, matching `<lr-relative-time unit="auto">`'s heuristic;
  `options.now` fixes the reference instant for a deterministic test or an "as of" report. It is a
  one-shot computation — pair it with your own timer, or use `<lr-relative-time sync>`, for text
  that must stay current while displayed.
  The exact signatures are `formatNumber(value: number | bigint | string, locale?: string,
options?: Intl.NumberFormatOptions): string`, `formatDate(value: string | number | Date, locale?:
string, options?: Intl.DateTimeFormatOptions): string | undefined`,
  `formatRelativeTime(value: string | number | Date, locale?: string,
options?: LyraFormatRelativeTimeOptions): string | undefined`, and `formatBytes(value: number |
bigint | string, locale?: string, options?: LyraFormatBytesOptions): string | undefined`.
  `LyraFormatRelativeTimeOptions { readonly unit?: LyraRelativeTimeUnit | 'auto'; readonly format?:
LyraFormatDisplay; readonly numeric?: LyraRelativeTimeNumeric; readonly now?: number }` and
  `LyraFormatBytesOptions { readonly unit?: LyraFormatBytesUnit; readonly display?:
LyraFormatDisplay; readonly unitStep?: number; readonly decimals?: number }`.

  ```ts
  import { formatBytes, formatRelativeTime } from "@aceshooting/lyra-ui/utilities/format.js";

  const size = formatBytes(12_345_678_901_234_567_890n, "en-US"); // exact, no float rounding
  const updated = formatRelativeTime(item.updatedAt, "en-US"); // "3 days ago"
  ```
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
  `OverlayActivationOptions` exposes `host`, `panel`, optional `modalRoot`, `auxiliaryRoots`, `modal`, `lockScroll`,
  `suspendWhenUnrendered`, `onEscape`, `onBackdrop`, `preferredInitialFocus`,
  `beforeInitialFocus`, `restoreFocusTo`, `trapFocus`, `onTab`, and `deferredReturn` (resolved after
  the synchronous focus return of a restoring close: a deferred pass for a target the host only
  re-shows afterward, or `undefined` to skip it; every activation and deactivation abandons a pass
  still pending for the host). `OverlayHandle` exposes
  `focusInitial()`, `focusAutofocus()`, `updateRestoreFocusTo(target)`,
  `deactivate({ restoreFocus?, deferScrollLockRelease? }?)`, `suspend()`, `resume()`, `isTopmost()`,
  `isActive()`, and `dismissBackdrop()`; the deactivate argument is the exported
  `OverlayDeactivateOptions` record, and its return value is the deferred scroll-lock release
  function (or `undefined`).
  `deactivate({ restoreFocus: false })` on the topmost entry hands focus to the overlay now on top
  only when the closing panel held focus or that overlay traps focus (a modal); focus that sat
  elsewhere, such as a field the user moved to while a hover panel was open, stays put.
  `auxiliaryRoots` resolves additional component-owned roots to include in a modal's interactive
  allowance and focus traversal; initial focus still targets the primary panel.
  Exact records are `OverlayActivationOptions { host: HTMLElement; panel: () => HTMLElement |
null; modalRoot?: () => HTMLElement | null; auxiliaryRoots?: () => readonly HTMLElement[]; onEscape: () => void; onBackdrop?: () => void;
preferredInitialFocus?: () => HTMLElement | null; beforeInitialFocus?: () => boolean;
restoreFocusTo?: OverlayRestoreFocusTarget; modal?: boolean; trapFocus?: boolean; onTab?: () =>
void; suspendWhenUnrendered?: boolean; lockScroll?: boolean; deferredReturn?: () =>
DeferredFocusReturnPass | undefined }`, `OverlayDeactivateOptions {
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
  `bridgeLyraLocale(options?): () => void`** — the _active-locale_ half of the locale runtime.
  Import these helpers from the side-effect-free `@aceshooting/lyra-ui/localization.js` entry.
  The former `utilities/localization.js` route was removed in 23.0.0. The extensionless `@aceshooting/lyra-ui/utilities`
  barrel keeps exporting them. `subscribeLyraLocale()` is distinct from
  `subscribeLyraLocaleRegistry()`, which answers a different question — see "Localization".
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
  import { bridgeLyraLocale, setLyraLocale } from "@aceshooting/lyra-ui/localization.js";
  import "@aceshooting/lyra-translations/ar.js";

  const stop = bridgeLyraLocale(); // mirrors onto <html>
  setLyraLocale("ar"); // <html lang="ar" dir="rtl">
  stop(); // restores whatever <html> carried before
  ```

  `resolveLyraScopedString(/* public names: host, key, defaults, overrides, fallback, values */):
unknown` is a scoped variant of `resolveLyraString()` (see "Localization"): the same
override → fallback → registered-locale-catalog resolution chain, but against a caller-supplied
`defaults` record instead of the complete `LYRA_DEFAULT_STRINGS` catalog, so resolving a handful
of an application's own messages never needs the full compatibility catalog — pass a small
`defaults` object of just the keys used. `@aceshooting/lyra-ui/localization.js` is side-effect-free,
so a bundler drops the unused catalog; an unbundled graph that imports it still loads the catalog.

  ```ts
  import { resolveLyraScopedString } from "@aceshooting/lyra-ui/localization.js";

  const label = resolveLyraScopedString(host, "save", { save: "Save" });
  ```

**Known gotchas:**

- `formResetCallback()` restores the _content attribute_ default, so `el.value = 'x'` never redefines
  what `form.reset()` restores to (native `defaultValue`/`defaultSelected` semantics).

## Reference artifacts

The package includes authored family and shared references plus derived index, component, token,
peer, migration, and concatenated references.

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
