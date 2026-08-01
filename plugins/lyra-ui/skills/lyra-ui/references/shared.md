## Importing and registering components

Every component is a side-effect entry point that registers its own tag. The path always carries
the source family segment — `components/<family>/<dir>/<file>.js`, **never** `components/<tag>/`:

```js
import '@aceshooting/lyra-ui/components/forms/combobox/combobox.js'; // registers <lr-combobox>
import '@aceshooting/lyra-ui/components/data/table/table.js';        // registers <lr-table>
```

`llms/index.md` lists the exact path for every tag. A wrong or missing family segment is a hard
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
  The barrel also re-exports a broad compatibility surface of commonly used classes, helpers, and
  types, but it is not an exhaustive promise that every component-owned type or future export is
  present. It is the one import that defeats tree-shaking — prefer the owning component entry in
  application code, both for the smallest bundle and the complete contract of that component.
- **Document anchor/highlight types.** The granular document-viewer entry owns and exports
  `LyraAnchor`, `LyraAnchorKind`, `LyraHighlight`, `LyraHighlightTone`,
  `AnchorTargetCapabilities`, `HighlightActivateDetail`, `TextSelectDetail`, and
  `AnchorResultDetail`:
  ```ts
  import type {
    LyraAnchor,
    LyraHighlight,
    AnchorTargetCapabilities,
  } from '@aceshooting/lyra-ui/components/viewers/document-viewer/document-viewer.js';
  ```
  Use that entry instead of depending on incidental root-barrel coverage.
- **`lr-flag`** registers from the barrel, but resolving a flag by `country`/`language` (rather than
  a pre-resolved `src`) additionally needs
  `import '@aceshooting/lyra-ui/components/media/flag/flag-peer.js';` once.
- **Other subpaths.** `@aceshooting/lyra-ui/theme.css` (ready-made light/dark theme),
  `@aceshooting/lyra-ui/theme.js` (the zero-dependency mode/accent runtime),
  `@aceshooting/lyra-ui/localization.js` (side-effect-free locale runtime),
  `@aceshooting/lyra-ui/translations/<locale>.js` (the eight shipped message catalogs),
  `@aceshooting/lyra-ui/events` (the global typed-event map — types only, no runtime),
  `@aceshooting/lyra-ui/ai` (provider-neutral data types), `@aceshooting/lyra-ui/testing`
  (happy-dom shims), `@aceshooting/lyra-ui/utilities/*` (the curated shared helpers, all documented below).

## Events

Public events are `lr-`-prefixed `CustomEvent`s (`lr-change`, `lr-input`, `lr-select`, …), dispatched
through `LyraElement`'s `protected emit<T>(name, detail?, options?)`: **bubbling, composed, and
non-cancelable by default**, with the payload on `event.detail`. A component that offers a genuine
veto point opts into `{ cancelable: true }` and checks `defaultPrevented` before acting (as
`lr-export` does) — that is called out per component. Native-like `input`/`change` events follow the
same non-cancelable default.

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
- **Delegated, `document` and `window` listeners: `@aceshooting/lyra-ui/events`.** Component events
  bubble and are composed, so they reach ancestors, `document`, and `window` — but a listener
  attached *there* has no element type to key off and would otherwise receive a bare `Event`. This
  subpath declares `LyraGlobalEventMap` (270 event names) and mixes it into
  `GlobalEventHandlersEventMap`, which types `element`, `document` and `window`
  `addEventListener` calls alike:
  ```ts
  import '@aceshooting/lyra-ui/events';

  document.addEventListener('lr-sort', (event) => event.detail); // typed on document
  ```
  It is **opt-in**: the augmentation only applies once that import is somewhere in the project's
  type graph, so add it once (a root `main.ts`, or a `.d.ts` in the project's `include`). A direct
  element reference never needs it — `LyraElement` overrides `addEventListener`, so
  `table.addEventListener('lr-sort', …)` resolves through `LyraTableEventMap` first either way.
  `LyraGlobalEventMap` is exported as well, for writing your own typed helper over it.
- **The surface is per-event type aliases, not runtime event classes.** `LyraSortEvent` and its 269
  siblings are `type` aliases over the owning component's own map entry
  (`LyraTableEventMap['lr-sort']`) — there is nothing to `new`, and `instanceof LyraSortEvent` is
  not a thing. The module compiles to `export {};`: shipping 270 event subclasses to type a
  listener would cost every consumer runtime bytes for a compile-time concern, so it deliberately
  costs zero.
- **A shared event name narrows to the union of its dispatchers.** One name can come from several
  components with different details — `lr-select` from five, `lr-selection-change` from five — so
  its global entry is the *union* of their entries, and `event.detail` there exposes only what all
  of them share. Index the owning component's own map when you need one component's exact detail:
  ```ts
  import type { LyraCommandPaletteEventMap } from '@aceshooting/lyra-ui/components/layout/command-palette/command-palette.class.js';

  type PaletteSelect = LyraCommandPaletteEventMap['lr-select']; // the precise detail
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

It adds `name: string`, `value: string`, `disabled: boolean` (reflected), `required: boolean`
(reflected). **All four** are hand-written accessors declared with Lit's `noAccessor`, so the
attribute write / `internals` call fires synchronously on assignment rather than on Lit's async
update cycle (`internals.setFormValue()` runs synchronously off `value`; `disabled`'s reflection
lands before same-tick form APIs run).

Readonly getters, on every form-associated control: `form`, `labels`, `validity`,
`validationMessage`, `willValidate`, `effectiveDisabled`; methods `checkValidity()`,
`reportValidity()` and `setCustomValidity()`.

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
  const email = document.querySelector('lr-input')!;
  email.setCustomValidity('That address is already registered.');
  form.requestSubmit();          // blocked; the browser reveals this message
  email.setCustomValidity('');   // cleared
  ```
  Two behaviors are inherited verbatim from native controls and are the ones worth knowing.
  **Clearing restores computed validity rather than forcing the control valid** — a
  required-and-empty field whose custom error is cleared is still `valueMissing`. And **the custom
  error outlives everything except another `setCustomValidity('')`**: it survives each intrinsic
  recomputation (every `value`/`required` change re-runs one) and survives `form.reset()`. Clear it
  yourself when the condition that raised it goes away. The message is your content, so it is
  emitted verbatim and never localized — pass a string already in the user's language.
- **Validation anchoring.** An internal controller passes
  `internals.setValidity(flags, message, anchor)` with `anchor` = the first focusable descendant in
  the shadow root (`input:not([type='hidden']), textarea, select, button, [tabindex]:not([tabindex='-1'])`),
  re-resolved after each render — the browser cannot focus the non-focusable custom-element host when
  native validation UI tries to reveal the invalid control.
- **Reset semantics.** `formResetCallback()` restores the value captured from the element's original
  `value` *content attribute* (native `defaultValue` semantics). Only a later `setAttribute('value', …)`
  or declarative markup updates that captured default; assigning the `.value` IDL property never
  does. `formStateRestoreCallback()` restores string state synchronously without emitting a user
  event.
- **Who uses the mixin.** Eleven classes take it directly — `lr-input` (and its `lr-number-input` /
  `lr-time-input` subclasses), `lr-textarea`, `lr-code-editor`, `lr-otp-input`, `lr-color-picker`,
  `lr-emoji-picker`, `lr-slider`, `lr-date-input`, `lr-phone-input`, `lr-chat-composer`, and
  `lr-known-date`. Controls with non-string values or markup-derived defaults hand-roll an
  equivalent with the same `setValidity`/default-capture behavior — `lr-combobox` because its value
  can be an array in `multiple` mode, `lr-select` because its default comes from a `selected`
  `<lr-option>` rather than a `value` attribute. Divergences are documented per component.
  `lr-button` and `lr-icon-button` are form-associated only to act as submit/reset controls: they
  carry no value and no validity. `lr-time-range` is form-associated only for fieldset-cascaded
  disablement: no submission value, no state restoration.

### Enter submits the form

A native `<input>` submits its form owner when the user presses Enter. The `<input>` these controls
render has no form owner at all — it lives in a shadow tree, and only the *host* element
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

| State | Matches when |
| --- | --- |
| `required` / `optional` | the control's `required` is set / is not set |
| `valid` / `invalid` | `validity.valid` is `true` / `false` |
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

The states are published the same way whether a control uses the `FormAssociated` mixin or drives
`ElementInternals` directly, so a rule written against `lr-input` behaves identically on
`lr-checkbox`. `lr-button` and `lr-icon-button` are the exception noted above: form-associated, but
with no value and therefore no validity to publish. Where an engine cannot register a custom state
at all, the styling hook is simply absent — validity, submission blocking and
`checkValidity()`/`reportValidity()` are unaffected, so never make a `:state()` rule the only signal
that a field is wrong.

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
  dissolved into the surrounding layout. This is a *separate* property from `appearance` on
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
library whose delivery promise is tree-shaking. Each component re-exports the vocabulary it accepts
under a local alias from its own class module (`ButtonVariant`, `MediaCardFrame`, …), so a consumer
never needs a separate types import.

A small number of components use `variant` for a rendering *mode* rather than a tone — the shape a
visualizer draws, the skeleton a placeholder mimics. Those unions are component-specific and are
spelled out in that component's own section; the tone vocabulary above is what `variant` means
everywhere a tone is what the property is for.

## Theming and design tokens

Three layers, and **which one you set decides how far the override reaches**:

1. **`--lr-theme-*`** — the application input layer. Declared exactly once, at `:root` in
   `theme.css`, and never inside any component's shadow styles. Set these to retheme.
2. **`--lr-*`** — internal tokens. Each reads one `--lr-theme-*` input, and falls back to the
   built-in palette when that input is unset, so every component renders correctly with no theme
   configured. See [the colour ramp and the semantic grid](#the-colour-ramp-and-the-semantic-grid)
   for how a colour resolves through this layer.
3. **`--lr-<component>-*`** — per-component properties, for one element at a time. Listed in each
   component's own section.

### The colour ramp and the semantic grid

Colour has two layers beneath the `--lr-*` tokens you normally read.

**The ramp — `--lr-ramp-<variant>-<step>`.** Five variants (`brand`, `success`, `warning`,
`danger`, `neutral`) × eleven steps (`05 10 20 30 40 50 60 70 80 90 95`). The step number is
approximate perceptual lightness: `-05` is nearly black, `-95` nearly white, `-50` the mid tone. The
ramp is generated in OKLCH, so the same step number reads as the same *apparent* lightness across
every variant — which is what makes the grid above it predictable rather than 45 separate
decisions.

**Never reference a ramp step directly — from application CSS or from a component's own styles.**
Two reasons, and both fail silently. A step encodes a light-mode choice: `-50` is a comfortable fill
on white and unreadable on a dark surface, so a rule written against it looks correct until someone
switches modes. And the ramp carries no `--lr-theme-*` hook and is re-declared on every `lr-*`
element's own `:host`, so a `:root { --lr-ramp-brand-50: … }` in an application stylesheet is
shadowed at the first component it reaches and changes nothing at all. Read the grid instead; it
picks the right step per mode for you, and it is the layer that *is* overridable.

**The grid — `--lr-color-<variant>-<role>-<emphasis>`.** `{brand|success|warning|danger|neutral}` ×
`{fill|border|on}` × `{quiet|normal|loud}` = 45 slots. This is the layer components consume and the
layer to build on. Its *shape* is identical in light and dark; only which ramp step each slot
resolves to changes, so a rule written against it is mode-independent for free.

- `fill` — a background. `on` — text and icons that sit **on** the matching `fill`. `border` — an
  outline.
- `emphasis` runs `quiet → normal → loud`. Louder means more prominent, not lighter or darker: in
  light mode it descends the ramp and in dark mode it climbs it.

**The contrast guarantee is what makes the grid usable without thinking.** For every variant, in
both modes: `on-<e>` clears WCAG 1.4.3's 4.5:1 against `fill-<e>` at the *same* emphasis — so
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
.invoice-panel { --lr-theme-color-brand-fill-loud: #7c3aed; }
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
filter applies to the element *and its descendants* — drags the control's text and icons along with
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

where the first argument is the colour the surface moves *away from* — the fill that tier actually
paints. A chrome-less tier (outlined, plain, link) paints no fill of its own and mixes from the page
surface it sits on instead, which is why hovering one still moves.

Because the two knobs are percentages, a theme can flatten or exaggerate **every** interaction in
the library at once — `--lr-theme-color-mix-hover: 4%` for a restrained UI, `20%` for a punchy one —
without touching a single component. Point `--lr-theme-color-mix-partner` at a concrete colour to
override the follow-the-text behaviour where a surface needs a fixed direction.

### Elevation

Five shadow steps, so elevation carries information instead of one shadow serving every surface:

| Token | For |
| --- | --- |
| `--lr-shadow-xs` | a raised affordance inside a control — a segmented control's selected thumb |
| `--lr-shadow-s` | a small floating handle or a card lifted off the page — slider thumb, stat card |
| `--lr-shadow-m` | an anchored, transient surface — menus, dropdowns, popovers, tooltips |
| `--lr-shadow-l` | a persistent panel that owns its own region — dialog, drawer, toast, app rail |
| `--lr-shadow-xl` | the topmost surface on screen — command palette, fullscreen widget, tool dialogs |

`--lr-shadow` is an alias for `--lr-shadow-m`.

**The steps are mode-aware, and that is not cosmetic.** Elevation is a luminance difference, and a
12%-alpha black shadow against a near-black surface is not one — so in dark mode the alphas roughly
triple and the geometry of the two largest steps grows, because a wider, softer shadow is what still
reads as depth when the surface underneath is already dark. The shadow *colour* is its own token,
`--lr-shadow-color` (a bare `R G B` triple, not a full colour, so each step can apply its own
alpha), which lets a theme tint every shadow in the library from one place:

```css
:root { --lr-theme-shadow-color: 30 27 75; } /* every step now casts an indigo shadow */
```

Reach for the tier that matches what the surface *is*, not the one that happens to look right on the
page you are on — that is what keeps two overlapping surfaces reading in the correct order.

### Cascade layers

`theme.css` declares its layer order up front, then puts all of its own tokens in `lr-theme`:

```css
@layer lr-base, lr-theme, lr-utilities, lr-overrides;
```

- **`lr-base`** — reserved for any future element-level reset; empty today.
- **`lr-theme`** — where every `--lr-theme-*` token `theme.css` ships is declared.
- **`lr-utilities`** and **`lr-overrides`** — deliberately empty and named, so an application can
  opt its own layers into a defined position relative to Lyra's rather than inventing one.

**The consequence, stated plainly: any *unlayered* declaration you write beats *every* layered one,
whatever its specificity and whatever the load order.** So a plain
`:root { --lr-theme-color-brand-fill-loud: … }` in your own stylesheet wins even when your file is
loaded *before* `theme.css`, and it needs no `!important` and no extra specificity. That is the
point of layering the theme at all: before this, `theme.css` declared its tokens unlayered at
`:root` — specificity (0,1,0), identical to a consumer's own `:root` rule — so whether your
override won came down to which stylesheet the bundler, the `<link>` and the `@import` happened to
emit first. Declaring the order up front also fixes it regardless of the order the stylesheets
themselves load in.

To place your overrides deliberately rather than relying on being unlayered:

```css
@layer lr-overrides {
  :root { --lr-theme-color-brand-fill-loud: #7c3aed; }
}
```

**Breaking in 8.0.0 — if you wrapped your Lyra overrides in a layer of your own, re-check them.**
That rule used to be compared against an *unlayered* `theme.css`, which meant it lost
unconditionally, whatever its specificity. Now both sides are layered, so the winner is decided by
**layer order** — and layer order is fixed by whichever name the browser saw first. Import
`theme.css` before your own `@layer` statement and your layer sorts after Lyra's and wins; declare
your layers first and `lr-theme` is appended after them and wins instead. The outcome can therefore
flip in either direction on a change that only moves an `@import`, with nothing in the stylesheet
looking wrong. Two fixes, either is fine:

```css
/* 1. Unlayer them — an unlayered rule outranks all four Lyra layers unconditionally,
      whatever the load order. This is the one that cannot be broken by an import move. */
:root { --lr-theme-color-brand-fill-loud: #7c3aed; }

/* 2. Or keep your layer and pin it after Lyra's, once, before anything else loads. */
@layer lr-base, lr-theme, lr-utilities, lr-overrides, app-theme;
@layer app-theme {
  :root { --lr-theme-color-brand-fill-loud: #7c3aed; }
}
```

The second form is the one to reach for when the application already has a layer architecture:
re-declaring the order is additive, and the first occurrence of each name is what fixes its
position — so stating all five names yourself pins `app-theme` last no matter when `theme.css`
loads.

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
  `[data-lr-theme='dark']` both match `<html>` — the element `setLyraTheme` writes `data-lr-theme`
  onto — and your unlayered rule outranks `theme.css`'s layered dark block regardless of source
  order (see "Cascade layers"), so one `:root` rule pins the light-mode blue in dark mode. Copy each
  fallback from the matching palette block in `theme.css` (`#0969da` light / `#4ea0f0` dark here).

  Because that is a `--lr-theme-*` input, it reaches every nested shadow root — see "Where an
  override actually reaches" above for why setting a `--lr-*` token instead would not.

**No-flash bootstrap.** `lyraThemeBootstrap` is a self-contained IIFE **string** (not a function),
meant to be inlined into a `<script>` in `<head>` **before any stylesheet**, so the persisted theme
is on the root element before first paint. It reads `localStorage['lyra-theme']`.
`createLyraThemeBootstrap({ storageKey })` returns the same kind of string for an application-owned
key, so an existing persistence layer can reuse the pre-paint half independently of
`setLyraTheme()`/`getLyraTheme()`. Calling the factory with no options returns the same string as
`lyraThemeBootstrap`. The result is a string precisely so this can happen in an unbundled
`<script>` context without shipping or parsing the module:

```html
<head>
  <script>/* server-inlines lyraThemeBootstrap here */</script>
  <link rel="stylesheet" href="/theme.css" />
</head>
```

Both variants expect a stored `{ mode, accent }` record, apply the same two attributes and
`--lr-theme-accent`, and swallow any error — malformed storage or a blocked `localStorage` leaves
the document untouched rather than throwing before your app loads.

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
import {
  registerLyraLocale,
  setLyraLocale,
} from '@aceshooting/lyra-ui/localization.js';

registerLyraLocale('fr', { close: 'Fermer', retry: 'Réessayer' }); // app-wide, partial catalogs fine
setLyraLocale('fr'); // …or just set <html lang="fr"> and let components inherit it
```

```html
<lr-toast .strings=${{ close: 'Fermer' }}></lr-toast>
```

The side-effect-free `@aceshooting/lyra-ui/localization.js` entry exports
`registerLyraLocale`, `setLyraLocale`, `getLyraLocale`, `getRegisteredLyraLocales`,
`subscribeLyraLocaleRegistry`, `resolveLyraLocale`, `resolveLyraDirection`, `resolveLyraString`,
`LYRA_DEFAULT_STRINGS`, and the types `LyraLocaleStrings`, `LyraMessageKey`, `LyraMessage`,
`LyraPluralMessage` and `LyraPluralCategory`. The package root continues to re-export the same
surface for compatibility, but it also registers the non-peer-gated component graph; use the
dedicated entry when the application only needs locale setup.
**`LYRA_DEFAULT_STRINGS` is the authoritative key list** (1203 keys, matching the
`LyraMessageKey` union) — read it to find the key to override rather than guessing one. Lookup
falls back exact locale → base language → English. Date, number, byte, relative-time and calendar
output goes through `Intl`.

`getRegisteredLyraLocales(): string[]` lists every locale with strings registered via
`registerLyraLocale()`, plus `'en'` (always available through the built-in English fallback),
sorted and deduped. `subscribeLyraLocaleRegistry(listener: () => void): () => void` fires whenever
`registerLyraLocale()` registers *any* locale — including one that isn't the currently active
locale — unlike the page-level locale-change subscription every component already uses
internally, which only fires for the active locale's own string changes. `<lr-locale-picker>` is
the built-in consumer of both; see `llms/components/lr-locale-picker.md`.

Gotcha: `localize()`'s optional second argument is a fallback string. Passing a defined literal there
silently defeats a registered catalog — omit it, or pass `undefined`.

### Ready-made catalogs: `@aceshooting/lyra-ui/translations/<locale>.js`

Eight full catalogs ship with the package — **`ar`, `de`, `es`, `fr`, `ja`, `pt-BR`, `ru`,
`zh-CN`** — each covering every key in `LYRA_DEFAULT_STRINGS`. They are **side-effect-only
modules**: import one bare, read nothing from it, and it calls `registerLyraLocale()` for you.

```ts
import '@aceshooting/lyra-ui/translations/de.js';
import '@aceshooting/lyra-ui/translations/ar.js'; // RTL; direction still comes from dir/lang
```

Import only the locales the application can actually offer — each is a separate module, so unimported
ones cost nothing. A catalog registered this way is merged like any other, so a later
`registerLyraLocale('de', { close: '…' })` still overrides individual keys, and a per-instance
`.strings` still wins over both. Importing a catalog registers it; it does not *select* it —
`setLyraLocale()` or `<html lang>` still chooses. What the import does do is make the locale show up
in `getRegisteredLyraLocales()`, and therefore in `<lr-locale-picker>`, so the set you import is the
set a user can switch between.

### Pluralized messages

A message may be a plain string or a **`LyraPluralMessage`** — an object keyed by CLDR plural
category, one string per category the language needs:

```ts
import { registerLyraLocale } from '@aceshooting/lyra-ui/localization.js';

registerLyraLocale('en', {
  viewerSearchMatchCount: { one: '{count} match', other: '{count} matches' },
});
registerLyraLocale('ru', {
  viewerSearchMatchCount: {
    one: '{count} совпадение',
    few: '{count} совпадения',
    many: '{count} совпадений',
    other: '{count} совпадения',
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

Direction is inherited from `dir`/`lang`; no component forces its own. Layout mirrors through CSS
logical properties. Where physical math is unavoidable — drag ratios, arrow-key direction, anchored
placement — components share one internal direction helper: `isRtl(el)` (used by `lr-split`,
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
  adaptAiSdkStream,
  adaptAgUiEvents,
  adaptA2UiSurface,
  type AgentRun,
  type ChatMessage,
  type MessagePart,
  type RetrievalChunk,
} from '@aceshooting/lyra-ui/ai';
```

- **Run/step state** — `AgentStatusKind`, `AgentStatus`, `AgentStep`, `AgentRun`
- **Conversation** — `ChatMessage`, ordered `MessagePart` variants, `ToolInvocation`
- **Documents & grounding** — `DocumentRef`, `Citation`, `RetrievalQuery`, `RetrievalChunk`,
  `RetrievalScoreBreakdown`, `GroundedClaim`, `GroundingAssessment`, `DocumentLocator`
- **Streaming runtime** — `AgentStreamEvent`, `AgentStreamState`, `createAgentStreamState()`,
  `reduceAgentStream()`, `reduceAgentStreamEvents()`; event ids make replay/duplicate delivery
  deterministic, and JSON Patch application rejects prototype-mutating paths
- **Protocol adapters** — `adaptAiSdkStream()`, `adaptAgUiEvents()`, and `adaptA2UiSurface()` map
  structural provider events/documents onto the neutral runtime without pulling vendor SDKs into
  the package
- **Event payloads** — `RunLifecycleEventDetail`, `RetrievalProgressEventDetail`,
  `CitationSelectEventDetail`, `ToolApprovalEventDetail`, `CancelEventDetail`, `RetryEventDetail`,
  `ExportEventDetail`

`src/ai/types.contract.ts` holds compile-time assertions that each type still matches the property it
feeds on `lr-chat-message`, `lr-tool-call-chip`, `lr-tool-result-view`, `lr-source-card`,
`lr-attachment-chip`, and `lr-document-preview` — the binding is enforced by `tsc`, not by
convention. The types are structural and provider-agnostic: map any vendor's payload onto them once,
at the edge.

### Task-first AI composition guide

- **Render one model response:** `lr-message-parts`; use `lr-chat-message` only when the message
  shell (avatar, author, actions) is also needed.
- **Build the main prompt affordance:** `lr-prompt-input`; it already composes attachments,
  model/voice/source controls, mentions/commands, and `lr-prompt-queue`.
- **Run an agent workspace:** `lr-agent-workspace` + `reduceAgentStream()`; add
  `lr-subagent-panel` for nested runs and `lr-mcp-app` only for executable MCP App resources.
- **Show grounded output:** `lr-rag-answer`; pass claim records for `lr-claim-evidence`, use
  `lr-retrieval-compare` for retrieval tuning and `lr-rag-eval-dashboard` for run metrics.
- **Develop prompts/tools:** `lr-prompt-studio` and `lr-schema-viewer`.
- **Build voice sessions:** `lr-realtime-session`; it composes the existing audio visualizer,
  push-to-talk control, and transcript feed while leaving transport ownership with the host.

Family registration entry points are additive: importing
`@aceshooting/lyra-ui/components/conversation`, `/agent-tools`, or `/retrieval` registers and
exports that complete family. Granular component entry points remain the smallest bundles and are
preferred in production.

## Optional peer dependencies

All 26 peers are optional and their implementations are loaded on demand; nothing is imported
eagerly. `llms/peers.md` is the generated component → peer table. Loading and failure UI is
component-specific: viewer sections document their localized loading/error/notice states, while
`lr-include` preserves its light-DOM fallback/live region and emits `lr-include-error` when its
sanitizer is unavailable. Some components additionally issue a deduped warning. Consult the owning
component section instead of assuming every peer user renders an `<lr-skeleton>` or the same
degraded state. `lr-phone-input` is the exception to dynamic peer import: it takes a consumer-built
adapter (`loadLibphonenumberAdapter()`) rather than importing `libphonenumber-js` itself.

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

## Family barrels

Each of the eleven component families has an entry point that registers every element in it:
`@aceshooting/lyra-ui/components/forms`, `.../components/overlays`, and so on for `agent-tools`,
`charts`, `conversation`, `data`, `layout`, `media`, `retrieval`, `utility` and `viewers`.

They existed for three families before 8.0.0, were in the exports map, and were documented nowhere —
so they were effectively unreachable. All eleven now exist and are listed here.

A family barrel is **side-effectful by design**: importing it registers every tag in that family, the
same way the root barrel registers all of them. Reach for one when you genuinely use most of a family
and want a single import; reach for the granular
`@aceshooting/lyra-ui/components/<family>/<file>.js` path — which is what every example in these docs
uses — when you do not, because a barrel cannot be tree-shaken down to the two elements you actually
render.

```js
import '@aceshooting/lyra-ui/components/forms';        // every form control
import '@aceshooting/lyra-ui/components/forms/input/input.js';  // just <lr-input>
```

---

## Shared helpers: `utilities/`

Not custom elements — infrastructure the components compose, curated into a supported public
surface. Importable one module per helper, e.g.
`@aceshooting/lyra-ui/utilities/positioner.js` — the `.js` is required, since `./utilities/*` maps
straight onto `./dist/utilities/*` — or as a whole from the extensionless
`@aceshooting/lyra-ui/utilities`.

**This replaced `@aceshooting/lyra-ui/internal/*` in 8.0.0. `@aceshooting/lyra-ui/internal/*` is no
longer a published subpath** — the import fails to resolve rather than degrading. The whole
`internal/` tree used to be exported with no stability statement, which made every internal
refactor potentially breaking for someone. The eleven helpers below are the supported surface; they
are re-exported from `utilities/` unchanged and are covered by semver. Rewriting an existing import
is a path swap and nothing more:

```ts
// before 8.0.0
import { place } from '@aceshooting/lyra-ui/internal/positioner.js';
// 8.0.0
import { place } from '@aceshooting/lyra-ui/utilities/positioner.js';
```

If you were importing something from `internal/` that is not listed below, it was never a supported
entry point — open an issue and it can be promoted deliberately.

- **`LyraElement`** — the base class. `static styles = [tokens]`;
  subclasses prepend `LyraElement.styles` to their own `static styles`. Supplies `emit()` (see
  "Events"), the typed `addEventListener` overload (see "TypeScript"), `locale`/`strings` (see
  "Localization"), and protected `localize()` / `effectiveLocale` / `effectiveDirection`, all
  memoized once per update cycle.
- **`positioner` → `place(anchor, popup, opts?): () => void`** — thin wrapper over
  `@floating-ui/dom`'s `computePosition` + `autoUpdate`. Forces `strategy: 'fixed'` (matching the
  popup's own `position: fixed` CSS — otherwise it lands offset by the page scroll), middleware
  `offset(opts.offset ?? 4)`, `flip()`, `shift({ padding: 8 })`, default `placement: 'bottom-start'`.
  Returns a cleanup function that stops the `autoUpdate` loop — call it in `disconnectedCallback()`.
  Used by `lr-combobox`, `lr-select`, `lr-date-input`, `lr-export-button`, `lr-model-select`,
  `lr-mention-popover`, `lr-tool-call-chip`, `lr-citation-badge`, and `lr-menu`.
- **`prefix`** — `LYRA_PREFIX = 'lr'`; `tag(name)` → `` `lr-${name}` ``; `defineElement(name, ctor)`,
  an idempotent `customElements.define` that is safe if a module is evaluated twice.
- **`a11y`** — `nextId(scope)`, a monotonic id generator (`nextId('combobox-list')` →
  `"lr-combobox-list-3"`); `srOnly`, a visually-hidden-but-AT-visible class.
- **`icons`** — the shared inline-SVG set (`chevronIcon`, `closeIcon`, `playIcon`, `pauseIcon`,
  `calendarIcon`, `expandIcon`). One 24×24 viewBox per icon, rendered at `1em` so each inherits the
  caller's font size; none bakes in a direction — callers rotate the wrapping `part` via CSS.
- **`scroll-lock` → `lockScroll(): () => void`** — ref-counted `document.documentElement` scroll
  lock (used by `lr-widget`'s fullscreen mode); safe to acquire/release concurrently, restores the
  original `overflow` only when the last lock releases.
- **`form-associated` → `FormAssociated(Base)`**, plus `attachInternalsSafely()` and
  `createFallbackInternals()` — the mixin documented under "Form association" above, exposed so an
  application can build its **own** form-associated control alongside Lyra's and have it
  participate in a form, restore on reset, and report validity the same way every `lr-` control
  does. Reach for it instead of hand-rolling `attachInternals()` when a bespoke control has to sit
  in the same `<form>` as these.
- **`group-by-recency` → `groupByRecency(items, options?)`** — buckets dated items into
  Today / Yesterday / Previous 7 Days / Older, on **local calendar-day boundaries** ("yesterday" is
  the previous calendar date, not 24–48 hours ago). Plain data in, plain data out — no DOM.
  `getTimestamp` extracts the date (default: the item *is* a `Date`; a returned number is epoch
  **milliseconds**), `now` fixes the reference instant for deterministic tests or an "as of" report,
  and `labels` overrides any of the four English defaults — the strings are yours, so localize them
  through your own catalog. Empty buckets are omitted, order within a bucket is the input's, a
  future timestamp lands in Today and an unparseable one in Older. Exposed because an application
  rendering its own list beside `lr-thread-list` needs bucketing that agrees with the component's;
  reimplementing "this week" is how two lists on one page start disagreeing about what day it is.
- **`layered-layout` → `layeredLayout()`** — the deterministic, dependency-free layered-DAG
  ("Sugiyama-lite") layout `lr-flow-canvas` draws with: cycle handling, longest-path layering,
  barycenter crossing reduction, and coordinates assigned along the block axis so the result is
  RTL-neutral. `fixedPositions` entries keep their given coordinates while still occupying a slot
  for spacing. It returns raw box centers with layer 0 at `y = 0`; centering the drawing in your own
  canvas is yours.
- **`overlay-manager` → `activateOverlay(options): OverlayHandle`** — per-`Document` coordination
  for `lr-dialog`, overlay-mode `lr-responsive-panel`, the three tool dialogs, mobile `lr-app-rail`,
  and fullscreen `lr-widget`. All overlays share one topmost stack: only the top entry handles
  Escape, Tab trapping, and backdrop dismissal. Content outside the active modal's composed path is
  inert, including lower overlays and page content added while it is open. Focus traversal crosses
  slots and open shadow roots; activation preserves focus already inside but pulls outside focus in,
  and closing restores the still-connected opener. Nested closes restore into the surviving overlay
  before returning to the original trigger.
- **`announcer` → `Announcer`** — throttled live-region announcements, paired with
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
