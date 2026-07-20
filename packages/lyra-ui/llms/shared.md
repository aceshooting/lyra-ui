## Importing and registering components

Every component is a side-effect entry point that registers its own tag. The path always carries
the source family segment — `components/<family>/<dir>/<file>.js`, **never** `components/<tag>/`:

```js
import '@aceshooting/lyra-ui/components/forms/combobox/combobox.js'; // registers <lr-combobox>
import '@aceshooting/lyra-ui/components/data/table/table.js';        // registers <lr-table>
```

`llms/index.md` lists the exact path for all 249 tags. A wrong or missing family segment is a hard
module-resolution failure, not a silent no-op — `exports` maps `./components/*` straight onto
`./dist/components/*`.

- **Class without registration.** Each entry has a `.class.js` sibling exporting the class (and the
  `HTMLElementTagNameMap` augmentation) without touching `customElements`:
  `import { LyraTable } from '@aceshooting/lyra-ui/components/data/table/table.class.js';`. Use it
  for subclassing, `instanceof` checks, or type-only imports.
- **Root barrel.** `import '@aceshooting/lyra-ui';` registers everything **except** the 15 tags
  gated behind an optional peer dependency: `lr-chart` and its 8 typed subclasses (`lr-line-chart`,
  `lr-bar-chart`, `lr-pie-chart`, `lr-doughnut-chart`, `lr-radar-chart`, `lr-polar-area-chart`,
  `lr-bubble-chart`, `lr-scatter-chart`), `lr-box-plot`, `lr-histogram`, `lr-map`, `lr-graph`,
  `lr-knowledge-graph-explorer`, and `lr-geojson-view`. Those always need their own subpath import.
  The barrel also re-exports every class and type (127 `Lyra*EventMap` types included), so it is the
  one import that defeats tree-shaking — prefer per-component entries in application code.
- **`lr-flag`** registers from the barrel, but resolving a flag by `country`/`language` (rather than
  a pre-resolved `src`) additionally needs
  `import '@aceshooting/lyra-ui/components/media/flag/flag-peer.js';` once.
- **Other subpaths.** `@aceshooting/lyra-ui/theme.css` (ready-made light/dark theme),
  `@aceshooting/lyra-ui/ai` (provider-neutral data types), `@aceshooting/lyra-ui/testing`
  (happy-dom shims), `@aceshooting/lyra-ui/internal/*` (shared internals, all documented below).

## Events

Public events are `lr-`-prefixed `CustomEvent`s (`lr-change`, `lr-input`, `lr-select`, …), dispatched
through `LyraElement`'s `protected emit<T>(name, detail?, options?)`: **bubbling, composed, and
non-cancelable by default**, with the payload on `event.detail`. A component that offers a genuine
veto point opts into `{ cancelable: true }` and checks `defaultPrevented` before acting (as
`lr-export` does) — that is called out per component. Native-like `input`/`change` events follow the
same non-cancelable default.

Never assume a native DOM event name works: a component mirrors a native contract only where its own
section says so. `preventDefault()` on a non-cancelable event does nothing.

## TypeScript

- **Per-component event maps.** Every component with events exports a `Lyra<Name>EventMap` type, and
  `LyraElement<Events>` declares a typed `addEventListener` overload — so `event.detail` is inferred
  with no cast:
  ```ts
  import { LyraTable } from '@aceshooting/lyra-ui/components/data/table/table.class.js';
  const table = document.querySelector('lr-table') as LyraTable;
  table.addEventListener('lr-sort', (event) => event.detail.key); // typed
  ```
- **`HTMLElementTagNameMap`** is augmented in the `.class.d.ts` files. `document.querySelector('lr-table')`
  is only typed as `LyraTable` when that class module is in the type graph — importing just the
  registration entry (`table.js`) also pulls it in, since the entry re-exports the class module.
- **Generics.** Row/item-carrying components are generic over their data type
  (`LyraTable<T>`, `LyraTableEventMap<T>`, …); annotate the element to keep `detail` payloads typed.
- **Setting object properties from templates** requires a property binding, never an attribute —
  see "Framework integration".

## Form association

`FormAssociated(Base)` (`internal/form-associated.ts`) makes a `LitElement` form-associated:
`static formAssociated = true` plus `attachInternals()` in the constructor, which eagerly calls
`internals.setFormValue('')` so an untouched control is present in `FormData` as `""` from
construction — matching native `<input>` — instead of being absent.

It adds `name: string`, `value: string`, `disabled: boolean` (reflected), `required: boolean`
(reflected). **All four** are hand-written accessors declared with Lit's `noAccessor`, so the
attribute write / `internals` call fires synchronously on assignment rather than on Lit's async
update cycle (`internals.setFormValue()` runs synchronously off `value`; `disabled`'s reflection
lands before same-tick form APIs run).

Readonly getters, on every form-associated control: `form`, `labels`, `validity`,
`validationMessage`, `willValidate`, `effectiveDisabled`; methods `checkValidity()` and
`reportValidity()` delegate to `internals`.

- **Read `effectiveDisabled`, not `disabled`, for the merged state.** `effectiveDisabled` is own
  `disabled` OR an ancestor `<fieldset disabled>`'s cascaded state.
  `formDisabledCallback(fieldsetDisabled)` stores the ancestor state privately, so `disabled` always
  reflects only the consumer's own attribute/property, as native `<input>` does.
- **Validity is real.** `updateValidity()` calls `internals.setValidity({ valueMissing: true }, …)`
  whenever `required` is set and `value === ''`, re-run on every `value`/`required` change and once
  from `connectedCallback()` — so `checkValidity()`/`reportValidity()`/`:invalid`/`:user-invalid`
  reflect actual constraint state.
- **Validation anchoring.** `AnchoredValidityController` (`internal/anchored-validity.ts`) passes
  `internals.setValidity(flags, message, anchor)` with `anchor` = the first focusable descendant in
  the shadow root (`input:not([type='hidden']), textarea, select, button, [tabindex]:not([tabindex='-1'])`),
  re-resolved after each render — the browser cannot focus the non-focusable custom-element host when
  native validation UI tries to reveal the invalid control.
- **Reset semantics.** `formResetCallback()` restores the value captured from the element's original
  `value` *content attribute* (native `defaultValue` semantics). Only a later `setAttribute('value', …)`
  or declarative markup updates that captured default; assigning the `.value` IDL property never
  does. `formStateRestoreCallback()` restores string state synchronously without emitting a user
  event.
- **Who uses the mixin.** `lr-date-input`, `lr-chat-composer`, and `lr-slider` use it directly.
  Controls with non-string values or markup-derived defaults hand-roll an equivalent with the same
  `setValidity`/default-capture behavior — `lr-combobox` because its value can be an array in
  `multiple` mode, `lr-select` because its default comes from a `selected` `<lr-option>` rather than
  a `value` attribute. Divergences are documented per component. `lr-time-range` is form-associated
  only for fieldset-cascaded disablement: no submission value, no state restoration.

## Theming and design tokens

Three layers, and **which one you set decides how far the override reaches**:

1. **`--lr-theme-*`** — the application input layer. Declared exactly once, at `:root` in
   `theme.css`, and never inside any component's shadow styles. Set these to retheme.
2. **`--lr-*`** — internal tokens. Each reads one `--lr-theme-*` input with a hardcoded fallback
   (`--lr-color-brand: var(--lr-theme-color-brand-fill-loud, #0969da)`), so every component renders
   correctly with no theme configured.
3. **`--lr-<component>-*`** — per-component properties, for one element at a time. Listed in each
   component's own section.

### Where an override actually reaches

**A `--lr-*` token is declared on every `lr-*` element's `:host`.** So a `--lr-*` value you set on
an ancestor is re-declared — and lost — at the first `lr-*` element between that ancestor and the
component you meant to style. It never reaches anything nested inside another component.

**`--lr-theme-*` inputs are declared only once**, at `:root`, and never inside a component's shadow
styles — so they inherit normally through every nested shadow root. **Setting a `--lr-theme-*` input
on a wrapper element is the supported way to retheme one subtree.** Setting a `--lr-*` token there
only works for that wrapper's direct children.

```css
/* Reaches everything in the subtree, however deeply nested. */
.invoice-panel { --lr-theme-color-brand-fill-loud: #7c3aed; }

/* Reaches direct lr-* children only — shadowed at the first nested lr-* host. */
.invoice-panel { --lr-color-brand: #7c3aed; }
```

Layer 3 is the exception that proves the rule: a handful of `--lr-<component>-*` escape hatches are
deliberately left **undeclared** by their component and read only through a `var()` fallback at the
point of use, precisely so a value set on an ancestor is not shadowed. Each one says so in its own
section; assume shadowing for anything that doesn't.

**Diagnostic:** if a token override has no effect on a nested component, check which layer you set
before assuming the component is at fault. A `--lr-*` override that works on a standalone control
and stops working once you nest that control inside another component is this rule, not a bug.

**There is no way to tell a live `--lr-*` declaration from a dead one without rendering.** A dead
declaration is byte-identical to a working one in the stylesheet, and nothing in a build reports
it — a test asserting on stylesheet source text (`expect(source).toContain('--lr-token: …')`)
passes just as happily when the token is being shadowed at a nested host. Verify with
`getComputedStyle` on the real element in the real state, and perturb the value deliberately to
confirm the assertion actually bites.

The same trap has a second form inside a component's own styles: a *declared* value always wins
over a `var()` fallback arm, and `auto` is a declared value. That is why the exact-height escape
hatches (`--lr-input-control-height`, `--lr-select-trigger-height`, `--lr-chip-height`, …) are
undeclared by default rather than set to `auto` — see `llms/forms.md`.

### Tokens with a contract attached

- **`--lr-theme-icon-button-size`** (default `2.5rem`) backs `--lr-icon-button-size`, the tappable
  box of **every** icon-only control in the library — `lr-icon-button` itself, and the
  expand/clear/toggle affordances inside `lr-date-input`, `lr-combobox`, `lr-input`, and
  `lr-select`. It is a *floor*, not a fixed size. Keep the resolved value **at or above 24px**
  (WCAG 2.2 SC 2.5.8 target size); the default leaves headroom. Lowering it below that shrinks
  every affordance in the library at once.
- **Aligning your own content next to a checkbox or radio.** `--lr-checkbox-label-indent` /
  `--lr-radio-label-indent` publish the label offset, but custom properties inherit *down*, not
  sideways, so a sibling node in your tree cannot read them off the control. Compute the same
  formula from the `--lr-theme-*` inputs you control:
  ```css
  padding-inline-start: calc(
    min(var(--lr-theme-icon-button-size, 2.5rem), 1.75rem) + var(--lr-theme-space-s, 0.5rem)
  );
  ```

**`llms/tokens.md` is the full generated catalog** of every token, its `--lr-theme-*` input, and its
fallback — consult it rather than guessing a token name.

```css
@import '@aceshooting/lyra-ui/theme.css'; /* optional ready-made light + dark base */
:root { --lr-theme-color-brand-fill-loud: #7c3aed; }
```

With `theme.css` imported, switch modes by putting `class="lr-light"`/`class="lr-dark"` (or
`data-lr-theme="light"`/`"dark"`) on any ancestor; it also sets `color-scheme`. Without it, the token
layer still ships a `prefers-color-scheme: dark` fallback that re-points the hardcoded defaults at a
dark palette — that fallback applies only where no real `--lr-theme-*` value is set.

The token layer also sets `:host([hidden]) { display: none !important; }` and an inherited
`box-sizing: border-box` reset.

## Localization: `locale`, `strings`, and the locale runtime

Every built-in string — button labels, accessible names, descriptions, validation messages, status
announcements, empty/loading states — resolves through the locale runtime. Consumer data and slotted
content are never translated.

Two knobs exist on **every** `lr-*` element, inherited from `LyraElement` and therefore not repeated
in the per-component sections:

- **`locale: string = ''`** (reflected attribute) — per-instance locale override. Empty means "use
  the nearest `locale`/`lang` ancestor".
- **`strings: LyraLocaleStrings = {}`** (property only, no attribute) — per-instance message
  overrides, merged over the registered catalog.

```ts
import { registerLyraLocale, setLyraLocale } from '@aceshooting/lyra-ui';

registerLyraLocale('fr', { close: 'Fermer', retry: 'Réessayer' }); // app-wide, partial catalogs fine
setLyraLocale('fr'); // …or just set <html lang="fr"> and let components inherit it
```

```html
<lr-toast .strings=${{ close: 'Fermer' }}></lr-toast>
```

Exported from the package root: `registerLyraLocale`, `setLyraLocale`, `getLyraLocale`,
`resolveLyraLocale`, `resolveLyraDirection`, `resolveLyraString`, `LYRA_DEFAULT_STRINGS`, and the
types `LyraLocaleStrings` / `LyraMessageKey`. **`LYRA_DEFAULT_STRINGS` is the authoritative key list**
(996 keys, matching the `LyraMessageKey` union) — read it to find the key to override rather than
guessing one. Lookup falls back exact locale → base language → English. Date, number, byte,
relative-time and calendar output goes through `Intl`.

Gotcha: `localize()`'s optional second argument is a fallback string. Passing a defined literal there
silently defeats a registered catalog — omit it, or pass `undefined`.

## RTL and direction

Direction is inherited from `dir`/`lang`; no component forces its own. Layout mirrors through CSS
logical properties. Where physical math is unavoidable — drag ratios, arrow-key direction, anchored
placement — components consult `internal/rtl.ts`: `isRtl(el)` (used by `lr-split`, `lr-time-range`,
`lr-dock-panel`), plus `rtlAwareSide(side, el)` and `rtlAwarePlacement(placement, el)`, which swap
the `left`/`right` component of a value under RTL and pass it through unchanged under LTR
(`lr-menu` resolves its `placement` this way). Test both directions for anything with horizontal
order, start/end placement, drag deltas, or previous/next navigation.

## Provider-neutral AI types: `@aceshooting/lyra-ui/ai`

The agentic components share one vocabulary, exported as types from a dedicated subpath. Use these
instead of hand-rolling state shapes — they bind field-for-field onto the components, with no
adapter layer:

```ts
import type { AgentRun, ChatMessage, ToolInvocation, RetrievalChunk } from '@aceshooting/lyra-ui/ai';
```

- **Run/step state** — `AgentStatusKind`, `AgentStatus`, `AgentStep`, `AgentRun`
- **Conversation** — `ChatMessage`, `ToolInvocation`
- **Documents & grounding** — `DocumentRef`, `Citation`, `RetrievalQuery`, `RetrievalChunk`,
  `GroundingAssessment`
- **Event payloads** — `RunLifecycleEventDetail`, `RetrievalProgressEventDetail`,
  `CitationSelectEventDetail`, `ToolApprovalEventDetail`, `CancelEventDetail`, `RetryEventDetail`,
  `ExportEventDetail`

`src/ai/types.contract.ts` holds compile-time assertions that each type still matches the property it
feeds on `lr-chat-message`, `lr-tool-call-chip`, `lr-tool-result-view`, `lr-source-card`,
`lr-attachment-chip`, and `lr-document-preview` — the binding is enforced by `tsc`, not by
convention. The types are structural and provider-agnostic: map any vendor's payload onto them once,
at the edge.

## Optional peer dependencies

All 26 peers are optional and lazily loaded; nothing is imported eagerly. `llms/peers.md` is the
generated component → peer table. The shared contract: a component resolves its peer through a
dynamic `import()` on first use, rendering an `<lr-skeleton>` placeholder with `aria-busy="true"` on
the host meanwhile; if the peer is genuinely absent it falls back to an empty/degraded render plus a
single deduped `console.warn` — it never throws and never blocks paint. `lr-phone-input` is the
exception: it takes a consumer-built adapter (`loadLibphonenumberAdapter()`) rather than importing
`libphonenumber-js` itself.

## Framework integration

Plain custom elements, so they work anywhere — with the usual two caveats.

- **Complex values must be property-bound, not attribute-bound.** An attribute stringifies:
  `rows="[object Object]"`. Use the framework's property syntax for anything that isn't a string,
  number, or boolean: Lit `.rows=${rows}`, Vue `:rows.prop="rows"` (or `.rows="rows"`), Angular
  `[rows]="rows"`, Svelte `bind:this` + assignment, React 19+ passes objects to custom-element
  properties natively (earlier React needs a ref).
- **Events are dashed custom events.** Lit `@lr-change=${…}`, Vue `@lr-change="…"`, Angular
  `(lr-change)="…"`, Svelte `on:lr-change={…}`, React `ref.addEventListener('lr-change', …)`.
- **Angular** additionally needs `CUSTOM_ELEMENTS_SCHEMA` in the module/component that uses the tags.
- In-DOM templates lower-case attribute names; camelCase property names only survive in framework
  templates and JS, never in hand-written HTML attributes.

## SSR and declarative shadow DOM

Components are Lit 3 elements, so they work in principle with `@lit-labs/ssr` +
`@lit-labs/ssr-dom-shim`, and `lr-button` is spot-checked. This is **not** systematically tested:
components that touch observers, Floating UI, `matchMedia`, or canvas at construction are unverified
under SSR. Treat SSR as best-effort and render client-side where correctness matters.

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

## Editor and tooling integration

The published package ships machine-readable metadata for editors, all regenerated on `prepack`:
`custom-elements.json` (Custom Elements Manifest), `web-types.json` (JetBrains, zero-config), and
`vscode-html-data.json` / `vscode-css-data.json` (point `html.customData` / `css.customData` at them
in `.vscode/settings.json`). For an agent, `llms/components/<tag>.md` is the cheaper source; these
files matter when scaffolding a project's editor configuration.

## Independence and migration

Lyra has no runtime, theme, or design-token dependency on Shoelace or Web Awesome. Documented `wa-*`
comparisons are migration references only; Lyra's own tokens, events, localization runtime, and
implementation are the source of truth. `llms/migration.md` holds the generated `wa-*`/`sl-*` → `lr-*`
tables. For a staged migration, map existing external theme values onto `--lr-theme-*` explicitly in
application CSS rather than expecting an implicit compatibility layer.

## Shared internals: `internal/`

Not custom elements — infrastructure the components compose. Importable via
`@aceshooting/lyra-ui/internal/*`.

- **`LyraElement`** (`internal/lyra-element.ts`) — the base class. `static styles = [tokens]`;
  subclasses prepend `LyraElement.styles` to their own `static styles`. Supplies `emit()` (see
  "Events"), the typed `addEventListener` overload (see "TypeScript"), `locale`/`strings` (see
  "Localization"), and protected `localize()` / `effectiveLocale` / `effectiveDirection`, all
  memoized once per update cycle.
- **`positioner.ts` → `place(anchor, popup, opts?): () => void`** — thin wrapper over
  `@floating-ui/dom`'s `computePosition` + `autoUpdate`. Forces `strategy: 'fixed'` (matching the
  popup's own `position: fixed` CSS — otherwise it lands offset by the page scroll), middleware
  `offset(opts.offset ?? 4)`, `flip()`, `shift({ padding: 8 })`, default `placement: 'bottom-start'`.
  Returns a cleanup function that stops the `autoUpdate` loop — call it in `disconnectedCallback()`.
  Used by `lr-combobox`, `lr-select`, `lr-date-input`, `lr-export-button`, `lr-model-select`,
  `lr-mention-popover`, `lr-tool-call-chip`, `lr-citation-badge`, and `lr-menu`.
- **`prefix.ts`** — `LYRA_PREFIX = 'lyra'`; `tag(name)` → `` `lr-${name}` ``; `defineElement(name, ctor)`,
  an idempotent `customElements.define` that is safe if a module is evaluated twice.
- **`a11y.ts`** — `nextId(scope)`, a monotonic id generator (`nextId('combobox-list')` →
  `"lr-combobox-list-3"`); `srOnly`, a visually-hidden-but-AT-visible class.
- **`icons.ts`** — the shared inline-SVG set (`chevronIcon`, `closeIcon`, `playIcon`, `pauseIcon`,
  `calendarIcon`, `expandIcon`). One 24×24 viewBox per icon, rendered at `1em` so each inherits the
  caller's font size; none bakes in a direction — callers rotate the wrapping `part` via CSS.
- **`scroll-lock.ts` → `lockScroll(): () => void`** — ref-counted `document.documentElement` scroll
  lock (used by `lr-widget`'s fullscreen mode); safe to acquire/release concurrently, restores the
  original `overflow` only when the last lock releases.
- **`overlay-manager.ts` → `activateOverlay(options): OverlayHandle`** — per-`Document` coordination
  for `lr-dialog`, overlay-mode `lr-responsive-panel`, the three tool dialogs, mobile `lr-app-rail`,
  and fullscreen `lr-widget`. All overlays share one topmost stack: only the top entry handles
  Escape, Tab trapping, and backdrop dismissal. Content outside the active modal's composed path is
  inert, including lower overlays and page content added while it is open. Focus traversal crosses
  slots and open shadow roots; activation preserves focus already inside but pulls outside focus in,
  and closing restores the still-connected opener. Nested closes restore into the surviving overlay
  before returning to the original trigger.
- **`announcer.ts` → `Announcer`** — throttled live-region announcements, paired with
  `lr-live-region`.

**Known gotchas:**
- `formResetCallback()` restores the *content attribute* default, so `el.value = 'x'` never redefines
  what `form.reset()` restores to (native `defaultValue`/`defaultSelected` semantics).
- There is no shared label/input association helper; `lr-combobox` and `lr-date-input` each pair
  their own `<label part="form-control-label" for=…>` with a matching input `id`, so clicking the
  label focuses the field.

## Packaging

`custom-elements.json`, the editor metadata, and every file under `llms/` are regenerated by
`prepack` and included in `package.json`'s `files` allowlist, so a published tarball always carries
an up-to-date copy matching its `dist/`.
