## Importing and registering components

Every component is a side-effect entry point that registers its own tag. The path always carries
the source family segment — `components/<family>/<dir>/<file>.js`, **never** `components/<tag>/`:

```js
import '@aceshooting/lyra-ui/components/forms/combobox/combobox.js'; // registers <lr-combobox>
import '@aceshooting/lyra-ui/components/data/table/table.js';        // registers <lr-table>
```

`llms/index.md` lists the exact path for all 251 tags. A wrong or missing family segment is a hard
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
  The barrel also re-exports every class and type (every `Lyra*EventMap` type included), so it is the
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
undeclared by default rather than set to `auto`. Setting one *to* `auto` is therefore not the same
as leaving it alone: it wins over the fallback arm and makes the per-size minimum-height floor dead
code. See each control's own reference page for its exact pair.

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

### Theme mode/accent runtime (`@aceshooting/lyra-ui/theme.js`)

Flipping the mode class/attribute above is something every app ends up hand-rolling — persist a
choice, apply it on load, avoid the flash of wrong theme before the app boots. `theme.js` is that
runtime, published as its own subpath: **zero dependencies, no Lit, no component imports, and no
side effects on import**, so an app can persist and apply a theme without pulling the component
graph into its first-paint bundle.

```ts
import { setLyraTheme, getLyraTheme } from '@aceshooting/lyra-ui/theme.js';

setLyraTheme({ mode: 'dark' });                  // unspecified fields keep their current value
setLyraTheme({ accent: '#7c3aed' });             // mode stays 'dark'
getLyraTheme();                                  // → { mode: 'dark', accent: '#7c3aed' }
setLyraTheme({ mode: 'auto', accent: null });    // clears the override and the accent
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
- **`mode`** is `'light' | 'dark' | 'auto'`. `'light'`/`'dark'` set **both `data-lr-theme`** (the
  attribute `theme.css` actually keys its palette blocks on) **and `data-theme`** (the generic
  attribute canvas-rendered components watch, so `lr-chart`/`lr-heatmap`/`lr-qr-code` repaint on
  the switch rather than keeping stale colors — see `llms/components/lr-chart.md`). `'auto'`
  removes both, which means **no override — not "follow the OS"**:
  - **With `theme.css` imported** (the setup this section is nested under), its `:root` block sets
    the full light palette unconditionally and that file ships no `prefers-color-scheme` block, so
    `'auto'` renders **light** whatever the OS is set to.
  - **Without `theme.css`**, no real `--lr-theme-*` value is set, so the token layer's
    `prefers-color-scheme: dark` fallback described above does apply and bare components follow
    the OS.

  To follow the OS *alongside* `theme.css`, resolve the preference yourself and pass a concrete
  mode — `setLyraTheme` deliberately does no `matchMedia` work of its own:
  ```ts
  const os = matchMedia('(prefers-color-scheme: dark)');
  const sync = () => setLyraTheme({ mode: os.matches ? 'dark' : 'light' });
  sync();
  os.addEventListener('change', sync);
  ```
- **`accent`** is written to `--lr-theme-accent` as an inline custom property on the root element.
  This is a **hook for your CSS, not a token the library reads** — no lyra-ui component consumes
  `--lr-theme-accent`. Point the real inputs at it to make it retint anything, **writing one rule
  per mode**:
  ```css
  :root { --lr-theme-color-brand-fill-loud: var(--lr-theme-accent, #0969da); }
  .lr-dark,
  [data-lr-theme='dark'] { --lr-theme-color-brand-fill-loud: var(--lr-theme-accent, #4ea0f0); }
  ```
  **Each arm's fallback must carry that mode's own value.** A single `:root` rule flattens both
  modes to one color whenever the accent is unset (`accent: null`, the default): `:root` and
  `[data-lr-theme='dark']` have equal specificity and both match `<html>` — the element
  `setLyraTheme` writes `data-lr-theme` onto — so a consumer stylesheet loaded after `theme.css`
  wins the tie on source order and pins the light-mode blue in dark mode. Copy each fallback from
  the matching palette block in `theme.css` (`#0969da` light / `#4ea0f0` dark here).

  Because that is a `--lr-theme-*` input, it reaches every nested shadow root — see "Where an
  override actually reaches" above for why setting a `--lr-*` token instead would not.

**No-flash bootstrap.** `lyraThemeBootstrap` is a self-contained IIFE **string** (not a function),
meant to be inlined into a `<script>` in `<head>` **before any stylesheet**, so the persisted theme
is on the root element before first paint. It is a string precisely so this can happen in an
unbundled `<script>` context without shipping or parsing the module:

```html
<head>
  <script>/* server-inlines lyraThemeBootstrap here */</script>
  <link rel="stylesheet" href="/theme.css" />
</head>
```

It reads the same storage key, applies the same two attributes and `--lr-theme-accent`, and
swallows any error — malformed storage or a blocked `localStorage` leaves the document untouched
rather than throwing before your app loads.

**This runtime does no color math.** It stores and applies whatever accent string you give it; it
does not validate the value, compute a palette from it, or check contrast against any surface.
Verifying that an accent meets WCAG contrast against the light *and* dark palettes is yours.

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
`getRegisteredLyraLocales`, `subscribeLyraLocaleRegistry`, `resolveLyraLocale`,
`resolveLyraDirection`, `resolveLyraString`, `LYRA_DEFAULT_STRINGS`, and the types
`LyraLocaleStrings` / `LyraMessageKey`. **`LYRA_DEFAULT_STRINGS` is the authoritative key list**
(1005 keys, matching the `LyraMessageKey` union) — read it to find the key to override rather than
guessing one. Lookup falls back exact locale → base language → English. Date, number, byte,
relative-time and calendar output goes through `Intl`.

`getRegisteredLyraLocales(): string[]` lists every locale with strings registered via
`registerLyraLocale()`, plus `'en'` (always available through the built-in English fallback),
sorted and deduped. `subscribeLyraLocaleRegistry(listener: () => void): () => void` fires whenever
`registerLyraLocale()` registers *any* locale — including one that isn't the currently active
locale — unlike the page-level locale-change subscription every component already uses
internally, which only fires for the active locale's own string changes. `<lr-locale-picker>` is
the built-in consumer of both; see `llms/components/lr-locale-picker.md`.

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
- **`prefix.ts`** — `LYRA_PREFIX = 'lr'`; `tag(name)` → `` `lr-${name}` ``; `defineElement(name, ctor)`,
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

Use the API even when you are working inside the lyra-ui repo itself. It is the only intake path —
do not write the request into a local file instead, where nothing will pick it up.

Keep the report short and concrete:

- **Name the component you wanted**, in library style (`lr-kanban-board`), so the gap is searchable.
- **Say what it had to do** in a sentence or two — the behaviour, not your implementation.
- **List the `lr-*` components you actually checked** and why each fell short. This is what separates
  a real gap from a naming mismatch, and it is the part only you can supply.
