# Styles and tokens

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
`padding-inline`, `padding-block`, `gap`, `radius`. Only `height` and `radius` chain to a matching
`--lr-theme-form-control-*` input (`--lr-theme-form-control-height-2xs`…`-xl` and
`--lr-theme-form-control-radius`); `font-size`, `padding-inline`, `padding-block` and `gap` read the
shared `--lr-font-size-*`/`--lr-space-*` scale directly and have no per-control theme input of their
own. So a button, an input, a select and a combobox at the same tier line up in a toolbar row, and
an application can retune the whole control scale's height and corner radius from one place without
touching a component; retuning font size or padding means changing the shared type/space tokens
instead.

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
   built-in fallback when it is unset. Aliases and computed tokens may instead
   resolve through another internal token or a fixed contract value. See
   [the colour ramp and the semantic grid](#the-colour-ramp-and-the-semantic-grid) for how a colour
   resolves through this layer.
3. **`--lr-<component>-*`** — per-component properties, for one element at a time. Listed in each
   component's own section.

**Layer 2 (`--lr-*`) is declared once per document, not on each component** (since 28.0.0). The
_document token layer_ declares every shared output on `:root` and re-derives it only at
[theme scopes](#theme-scopes). `theme.css` carries it, so a page that imports `theme.css` has it from
first paint; on a page without `theme.css`, registering the first `lr-*` element adopts the same text
as a constructed stylesheet. Components inherit the result, and so do your own elements —
`body { color: var(--lr-color-text) }` resolves everywhere the layer applies.
[`tokens-root.css`](#reading-the-resolved-tokens-from-your-own-components--tokens-rootcss) is the
layer alone, for pages that do not use `theme.css`. Retheme through layer 1 (`--lr-theme-*`) **on a theme scope**: `:root`, a
mode scope, a style-axis boundary, or any element marked `data-lr-theme-scope`.
See [Where an override actually reaches](#where-an-override-actually-reaches) below for the full
inheritance rules, including per-component `--lr-<component>-*` hooks (layer 3), which inherit
through wrappers.

### Lyra signature starter

Lyra's built-in profile is Shadcn, Glass, Emerald, System mode and comfortable density. Plain
component imports receive these defaults and a host-level Solid opt-out; `theme.css` provides the
full look/accent/mode resolver and the same profile for document scopes, including native chrome.
Explicit saved choices remain independent and win over missing or invalid fields. Use the existing style API to opt into Solid, the Lyra look, another accent or
mode; `accent: null` explicitly clears the accent, while `resetLyraStyle()` restores Emerald.

```css
@layer lr-base, lr-theme, lr-theme-preset, lr-utilities, lr-overrides;
@layer lr-theme-preset.look, lr-theme-preset.density, lr-theme-preset.surface, lr-theme-preset.accent, lr-theme-preset.mode;
@import "@aceshooting/lyra-ui/theme.css";
```

Keep both layer-order statements before these imports. Bundlers can hoist statements from imported
stylesheets; the declarations preserve the order when imports are flattened. See
[Cascade layers](#cascade-layers). Separate Shadcn, Glass and Emerald imports remain compatible,
but are unnecessary for this profile. Import other optional looks, accents and densities when
exposing those choices.

For first paint, run the synchronous `lyraThemeBootstrap` before blocking stylesheets, using the
[CSP-safe embedding or classic-script asset](#style-runtime--aceshootinglyra-uithemejs). It restores
valid saved axes and fills missing or invalid choices with the built-in profile. Keep the
application's legacy-key precedence in an application adapter, and retain saved Solid, Lyra,
custom accents, runtime looks, overrides and historical records. Do not reconstruct a saved record
from the normalized `parseLyraStyleRecord()` snapshot: it is not a lossless persistence format.
`getLyraStyle()` reads the same choices at runtime; user changes use `setLyraStyle()`. An application
Reset can call `resetLyraStyle()` and restore any separate application preferences. Selectable
alternate looks and an explicitly cleared accent require `theme.css`; the intrinsic component
profile does not replace that scope resolver.

Keep spotlights in application CSS, independent of the chosen control look. The public root-token
stylesheet makes this static recipe follow both light/dark mode and the current accent:

```css
body { isolation: isolate; min-block-size: 100svh; background: var(--lr-color-surface); }
body::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background:
    radial-gradient(ellipse 46rem 30rem at 8% 4%, color-mix(in srgb, var(--lr-color-brand) 16%, transparent), transparent 60%),
    radial-gradient(ellipse 40rem 30rem at 96% 22%, color-mix(in srgb, var(--lr-color-brand) 12%, transparent), transparent 58%),
    radial-gradient(ellipse 44rem 32rem at 78% 96%, color-mix(in srgb, var(--lr-color-brand) 9%, transparent), transparent 60%),
    var(--lr-color-surface);
}
html[data-lr-contrast='more'] body::before { background: var(--lr-color-surface); }
@media (forced-colors: active) { body::before { background: Canvas; } }
```

Keep an existing application's multicolor spotlight palette when adopting a control look. For
example, an accent/violet/pink canvas should retain all three gradient colors across Lyra, Shadcn,
and Material; changing `look` must not replace those colors with the same-accent starter above.
Keep application background rules outside look selectors, while letting mode and accent update
their own inputs.

These are decorative application backgrounds, not an `accentBackground` value: that style field
accepts absolute colors used as contrast reference surfaces, not gradients or image URLs. Use
semantic surface/text pairings for content and keep the decorative layer behind it.

Use the existing [gemstoneAccentPicker composition](../components/lr-swatch-picker.md#gemstoneaccentpicker--the-signature-accent-selector),
with its single localized “Selected accent: {name}” heading, nine canonical gemstones, and shared
selected-glyph treatment. Update the name when selection changes. Use the same interpolated label
for the trigger's accessible name and hover title, dialog, radiogroup, and visible heading; do not
add a second selected-name row. Pass localized names as each swatch item's `label`, which supplies
its accessible name and title. Keep `--lr-swatch-picker-wrap: nowrap`: desktop hit size `1.75rem` and
gap `.25rem`; at widths up to `30rem`, hit size `1.5rem` and gap `.125rem` (28/4px and 24/2px at a
16px root). Leave its fill size unset. Bound the palette to the viewport and provide horizontal
overflow for unusually narrow allocations or enlarged text; keyboard focus must bring every swatch
into view. Do not shrink below the component's 24px floor or replace its Arrow/Home/End and RTL
behavior. For an independent Shine preference, set `--lr-gemstone-selected-animation: none` on the scope shared by the trigger
and picker; remove that declaration for Shine ON. OFF preserves the halo and selected accent.
Application and OS reduced motion still take precedence; persist Shine independently from motion.
See the composition guide for the controlled picker and preference wiring.

The four separate topbar controls—gemstone, mode, design, language—stay square `2.75rem` targets
(44px at a 16px root), with localized names and tooltips. Use gemstone, sun/moon and horizontal-slider
icons, and a country flag for language. Dense gemstone options do not reduce
those launcher targets. Size icon launchers directly and keep their slotted glyphs bounded:

```css
.appearance-launcher { --lr-icon-button-size: 2.75rem; }
.appearance-launcher::part(button) { inline-size: 2.75rem; block-size: 2.75rem; }
.appearance-launcher > svg,
.appearance-launcher > lr-icon { inline-size: 1.125rem; block-size: 1.125rem; }
```

Apply `appearance-launcher` to each `lr-icon-button`, including buttons slotted through a popover.
Keep the mode action separate from the design fields. Set the locale picker's
`--lr-locale-picker-trigger-height: 2.75rem` and
use its public flag-only trigger with readable menu entries:

```ts
import '@aceshooting/lyra-ui/components/lr-locale-picker.js';
import '@aceshooting/lyra-ui/components/media/flag/flag-peer.js';
```

```html
<lr-locale-picker top-layer trigger-display="flag" option-display="label"
  aria-label="Localized language action"></lr-locale-picker>
```

Install the optional `@aceshooting/lyra-flags` peer; the granular resolver import loads requested
flags without a bulk flag import. Leave `withoutFlags` false. Assign `locales` as a property with
`{ tag, label, country? }` entries: provide readable localized language names and an explicit ISO
country for regional entries when known, such as `en-US` → `US`. Keep flags as supplementary cues,
never the only accessible names, and preserve a valid saved locale in the controlled `value`.
Use the component's flag resolver rather than emoji, invented flag SVGs, or guessed display APIs.
Verify 320px and desktop, light/dark, RTL, enlarged text, keyboard focus, and saved preferences.

#### Two-column design panel

Compose a settings form inside `lr-popover`; use its dialog behavior rather than assigning menu or
ARIA grid roles to form fields. Import the existing native utility stylesheet and granular controls:

```css
@import "@aceshooting/lyra-ui/utilities.css";

.design-popover { --lr-overlay-max-inline-size: min(29rem, calc(100dvw - 1rem)); }
.design-popover::part(content) { padding: 0; }
.design-panel {
  box-sizing: border-box;
  inline-size: 29rem;
  max-inline-size: calc(100dvw - 1rem);
  padding: var(--lr-space-l);
  max-block-size: min(75dvh, 40rem);
  overflow: auto;
  overflow-wrap: anywhere;
}
.design-fields { --lr-grid-min-inline-size: 12rem; }
.design-fields > * { min-inline-size: 0; max-inline-size: 100%; }
.design-reset { inline-size: 100%; margin-block-start: var(--lr-space-l); }
```

```ts
import '@aceshooting/lyra-ui/components/lr-popover.js';
import '@aceshooting/lyra-ui/components/lr-icon-button.js';
import '@aceshooting/lyra-ui/components/lr-select.js';
import '@aceshooting/lyra-ui/components/lr-option.js';
import '@aceshooting/lyra-ui/components/lr-button.js';
```

```html
<lr-popover class="design-popover" top-layer placement="bottom-end" aria-label="Design settings">
  <lr-icon-button slot="trigger" class="appearance-launcher" label="Design settings">
    <!-- Application's decorative horizontal-slider glyph -->
  </lr-icon-button>
  <section class="design-panel">
    <div class="design-fields lr-grid-auto lr-gap-s">
      <lr-select label="Look" value="shadcn">
        <lr-option value="shadcn">Shadcn</lr-option>
        <lr-option value="lyra">Lyra</lr-option>
        <lr-option value="material">Material</lr-option>
      </lr-select>
      <lr-select label="Surface" value="glass">
        <lr-option value="glass">Glass</lr-option>
        <lr-option value="solid">Solid</lr-option>
      </lr-select>
      <lr-select label="Density" value="comfortable">
        <lr-option value="compact">Compact</lr-option>
        <lr-option value="comfortable">Comfortable</lr-option>
        <lr-option value="touch">Touch</lr-option>
      </lr-select>
      <!-- Further independent settings in their reading order -->
    </div>
    <lr-button class="design-reset" type="button">Reset appearance</lr-button>
  </section>
</lr-popover>
```

Localize the example's labels and options, bind values to the current application state, and handle
each select's `lr-change` through the relevant public style or preference API. Reset restores the
application profile and any separate application preferences.

`lr-grid-auto` already uses `auto-fit` with a `min(100%, minimum)` track floor. A bounded `29rem`
panel and `12rem` minimum give two columns when both fit, then one in narrow allocations; a third
column would need at least `36rem` before gaps. Keep those bounds together when customizing the
recipe. The existing `lr-gap-s` supplies the gap; no extra grid component or layout controller is
needed. The minimum is measured in rem, so enlarged text can also reduce the column count.

Keep every field in one row-major source list. Default grid placement and native Tab order then
agree: first row, second row, and so on; inherited RTL starts each row on the right. Do not split
fields into separate column wrappers, reorder with CSS, or add positive tabindex values. Leave the
full-width Reset action outside the field grid. Verify two columns at desktop allocation, one at
320px and enlarged text, long translated labels, RTL reading order, and Escape/focus return to the
design launcher. Keep these layout rules shared across application headers and administrative views.

### Reading the resolved tokens from your own components — `tokens-root.css`

Since 28.0.0 the resolved layer lives in the document, so your own elements read it like any
component does: `var(--lr-color-border)` inside **your** component resolves wherever the layer
applies. `theme.css` carries the layer, so importing `theme.css` is enough, including for
server-rendered pages and for application elements that paint before any Lyra element exists.
`tokens-root.css` is the same layer alone, as a static stylesheet, for pages that do not use
`theme.css`:

- **Server-rendered pages.** Declarative shadow roots no longer carry the layer, so link
  `theme.css` (or `tokens-root.css`) for a correct first paint before hydration (see
  [Theme scopes](#theme-scopes) for application shadow roots).
- **Application elements that paint before the first Lyra element is registered**, for example
  ahead of a lazily loaded route; otherwise they change value when the layer is adopted.
- **Large pages that load Lyra late.** Without a static copy, the layer is adopted when the first
  Lyra element is registered, which usually happens while the document is still small. A route that
  imports Lyra only after the page already holds a large DOM pays a one-off, whole-document style
  invalidation then. A document whose root already resolves the layer (it links `theme.css` or
  `tokens-root.css`) keeps the static copy and adopts no constructed one.

Link one of the two, not both: the second copy changes no value, but every scope matches the layer
twice.

```css
@import "@aceshooting/lyra-ui/theme.css"; /* the --lr-theme-* inputs, Lyra's layer order, and the resolved --lr-* layer */
/* or, without theme.css: */
@import "@aceshooting/lyra-ui/tokens-root.css"; /* the resolved --lr-* layer alone */
```

```css
/* Valid in your own component's stylesheet, in plain application CSS, anywhere. */
.app-panel {
  padding: var(--lr-space-m);
  border: var(--lr-border-width-thin) solid var(--lr-color-border);
  border-radius: var(--lr-radius);
  background: var(--lr-color-surface-raised);
  color: var(--lr-color-text);
  font-family: var(--lr-font);
}
.app-panel:focus-visible {
  outline: var(--lr-focus-ring);
  outline-offset: var(--lr-focus-ring-offset);
}
```

**Every output is visible on `:root`; only a subset is public API.** `--lr-*` is internal precisely
so it can change without a major version. The stable subset is what an application's own component
needs to sit inside a Lyra UI without looking foreign, and the file's header lists it:

| Family                | Names                                                                                                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ambient colour        | `--lr-color-surface`, `--lr-color-surface-raised`, `--lr-color-surface-overlay`, `--lr-color-overlay`, `--lr-color-text`, `--lr-color-text-quiet`, `--lr-color-border`, `--lr-color-border-strong`, `--lr-color-border-subtle` |
| The semantic grid     | all 45 `--lr-color-{brand,success,warning,danger,neutral}-{fill,border,on}-{quiet,normal,loud}` slots                                                                                                                       |
| Flat colour aliases   | `--lr-color-{brand,success,warning,danger,neutral}`, `--lr-color-{brand,success,warning,danger}-quiet`, `--lr-color-on-{brand,success,warning,danger,neutral}`                                                              |
| Spacing               | `--lr-space-2xs`, `--lr-space-xs`, `--lr-space-s`, `--lr-space-m`, `--lr-space-l`, `--lr-space-2xl`                                                                                                                        |
| Geometry              | `--lr-radius-xs`, `--lr-radius`, `--lr-radius-pill`, `--lr-border-width-thin`, `--lr-border-width-medium`, `--lr-border-width-thick`                                                                                       |
| Elevation             | `--lr-shadow-color`, `--lr-shadow-xs`, `--lr-shadow-s`, `--lr-shadow-m`, `--lr-shadow-l`, `--lr-shadow-xl`, `--lr-shadow`                                                                                                  |
| Typography            | `--lr-font`, `--lr-font-mono`, the ten `--lr-font-size-*` steps, the four `--lr-font-weight-*` steps                                                                                                                        |
| State and motion      | `--lr-focus-ring`, `--lr-focus-ring-color`, `--lr-focus-ring-width`, `--lr-focus-ring-offset`, `--lr-opacity-disabled`, `--lr-opacity-muted`, `--lr-duration-fast`, `--lr-duration-base`, `--lr-easing-standard`, `--lr-easing-emphasized`, `--lr-transition-fast`, `--lr-transition-base`, `--lr-transition-interactive` |

The grid is stable as a whole because its contrast guarantee is **per tier** — a `fill-quiet`
background is only guaranteed legible under the matching `on-quiet` foreground.

**Visible but internal** (read them at your own risk; they may change in any release): `--lr-size-*`,
`--lr-layer-*`, `--lr-color-mix-*`, `--lr-hover-brightness`, `--lr-line-height-*`,
`--lr-otp-input-segment-size`, `--lr-scroll-fade-size`, `--lr-popover-viewport-clamp`,
`--lr-mask-opaque`, `--lr-color-no-data`, and the private `--_lr-*` names. **Not in the layer at all:**
`--lr-ramp-*` (tooling-only), the chart, graph and terminal palettes (per host, on the components that
draw with them), the form-control ladder, and the per-element names `--lr-icon-button-size`,
`--lr-radius-button` and `--lr-safe-area-*`. If you need one of these, ask for it to be added to the
stable subset rather than reading it from the document.

**Stability promise.** Every name in the table is public API from the release that introduced it: it
will not be renamed or removed outside a major version, and its meaning will not change. Its _value_
may change in a minor exactly as it may inside a component — a palette retune moves your elements
and the kit's together, which is the point.

**Modes follow the nearest mode scope.** The layer follows the OS preference at the root and accepts
`.lr-light` / `.lr-dark`, `data-lr-theme` and `data-lr-mode` scopes, in every engine, with or without
`theme.css`. When `theme.css` is installed its requested mode owns the switches. A mode-neutral
scope keeps its ancestor's mode. Forced colours, increased contrast and reduced motion apply at every
scope and again on every component host.

Public outputs sit in the `lr-theme` cascade layer (the fallback mode switches in `lr-base`), so any
unlayered application rule beats them regardless of load order, and the file declares custom
properties only — notably not `color-scheme` — so importing it paints nothing by itself.

### Theme scopes

A **theme scope** is an element that re-derives the whole token layer from the `--lr-theme-*` inputs
and the mode it sees. The list is closed: `:root`; the mode scopes `.lr-light`, `.lr-dark` and
`[data-lr-theme]` (any value); the style-axis boundaries `[data-lr-mode]`, `[data-lr-look]`,
`[data-lr-accent]`, `[data-lr-density]`, `[data-lr-contrast]`, `[data-lr-motion]`; a look's scoped
`.light` / `.dark` aliases; the design-token fixture scopes `.lr-token-light`, `.lr-token-dark`,
`[data-lr-design-token-mode]`; and the mode-neutral marker **`data-lr-theme-scope`**.

```html
<!-- Re-theme one region: mark it, then set inputs on it. -->
<section data-lr-theme-scope style="--lr-theme-color-brand-fill-loud: #7c3aed">
  <lr-button variant="brand">Save</lr-button>
</section>

<!-- Mode scopes are already scopes; a marked region inside one keeps its mode. -->
<aside class="lr-dark"><div data-lr-theme-scope style="--lr-theme-space-m: 1rem">…</div></aside>

<!-- A single re-themed component. -->
<lr-button data-lr-theme-scope style="--lr-theme-color-brand-fill-loud: #7c3aed">Save</lr-button>
```

- **The marker follows HTML presence semantics:** `data-lr-theme-scope="false"` still marks. React
  renders `data-*={false}` as `"false"`, so write `data-lr-theme-scope=""` (or omit the attribute);
  the development build warns on the literal `"false"`.
- **Nesting** works like inheritance: a scope re-derives from what it inherits plus what it sets, and
  its descendants inherit the result until the next scope. The marker only re-derives the `--lr-*`
  outputs, so an input set on `:root` (inline, in your stylesheet, or by `setLyraStyle()`) or on an
  outer scope reaches a marked region exactly as it reaches an unmarked one, and adding a marker
  where nothing needs it changes nothing. With `theme.css`, mode scopes and the style-axis
  boundaries also re-resolve the inputs from the selected look, accent and mode, so an input set
  above one of them stops there (set it on that boundary, or below it). A scope costs a little less
  than one component did before 28.0.0, so put inputs on a common ancestor rather than marking every
  row of a list.
- **`applyLyraStyleScope()`** writes the marker whenever it writes inline inputs.
- **Brand regions in the default look.** The marker re-derives outputs but is not a style boundary,
  so the roles that follow brand in the default Shadcn look (the neutral loud tier) keep the brand
  of the nearest boundary inside the first example above. For a brand region call
  `applyLyraStyleScope(el, { accent: '#7c3aed' })`, which writes the `data-lr-accent="custom"`
  boundary, or set the `--lr-theme-color-neutral-*-loud` inputs on the region too.
- **Which inputs need a scope.** Only the `--lr-theme-*` inputs the layer consumes (listed in
  `llms/tokens.md`). Inputs read on the host itself keep working on any element: the chart,
  graph and terminal palettes, the form-control heights and radius, the icon-button size, the
  button radius, scrollbar and progress-ring inputs.

**Application shadow roots.** Custom properties inherit across shadow boundaries; selectors do not.
A scope _inside_ your own component's shadow root therefore needs the layer adopted in that root.
Lyra does that on demand: when a Lyra element connects inside an application shadow root and it is,
or sits below, a scope in that root, the layer is appended to the root's `adoptedStyleSheets`.
"Below" follows the flat tree, so a Lyra element slotted into your component (directly, or through
forwarded slots) counts as below the scopes around its slot, also when your component renders its
slots right after connecting, as Lit does. A Lyra element inside a slotted non-Lyra wrapper does not
trigger it. Library components' own shadow roots never receive it. Call
`adoptLyraTokens(root)` (from `@aceshooting/lyra-ui/utilities/tokens.js`, or the package root) for a
root whose scopes appear after its Lyra elements connected, a root that has scopes but no Lyra
element yet, or an iframe that holds application elements only. Server-rendered application roots
that contain scopes include `<link rel="stylesheet" href="…/tokens-root.css">`.

```js
// An application component whose shadow root holds scopes before any Lyra element connects in it.
import { adoptLyraTokens } from "@aceshooting/lyra-ui/utilities/tokens.js";
adoptLyraTokens(this.shadowRoot); // adoptLyraTokens(root: Document | ShadowRoot): void, idempotent
```

**Append, never replace.** Lyra appends its sheet to `document.adoptedStyleSheets` and to an
application root's. An application that later assigns a new array wholesale removes it until the next
Lyra element connects there; append to the existing array instead.

**Layer order.** On a page with no Lyra stylesheet, the adopted sheet's layer statement is the last
the browser sees, so Lyra's layers sort after yours. Declare Lyra's order first (import `theme.css`,
or repeat `@layer lr-base, lr-theme, lr-theme-preset, lr-utilities, lr-overrides;` before your own
layers), or leave application overrides of `--lr-*` outputs unlayered.

**Finding unscoped inputs.** `findUnscopedThemeInputs(root?)` (from
`@aceshooting/lyra-ui/utilities/theme-scopes.js`; `findUnscopedThemeInputs(root?: Document |
DocumentFragment | Element): Element[]`) returns, without logging, every element under `root`
(through open shadow roots) whose inline style sets a layer-consumed input and that is not a scope. `lyra-ui-migrate --rule=theme-scopes`
adds the marker in HTML, Lit and JSX templates and reports dynamic inputs and stylesheet rules;
`lyra-ui-migrate --origin=lyra-v26` runs the same rule together with the other Lyra 27 moves (relocated
locale and editor-data specifiers, `ToolStatus`) and reports removed localization keys.

### The colour ramp and the semantic grid

Colour uses a tooling ramp to generate the semantic `--lr-*` tokens you normally read.

**The ramp — `--lr-ramp-<variant>-<step>`.** Five variants (`brand`, `success`, `warning`,
`danger`, `neutral`) × eleven steps (`05 10 20 30 40 50 60 70 80 90 95`). The step number is
approximate perceptual lightness: `-05` is nearly black, `-95` nearly white, `-50` the mid tone. The
ramp is generated in OKLCH and retained in canonical token data, so the same step number reads as the same _apparent_ lightness across
every variant — which is what makes the grid above it predictable rather than 45 separate
decisions.

**Never reference a ramp step directly — from application CSS or from a component's own styles.**
A step encodes a light-mode choice: `-50` can be comfortable on white and unreadable on a dark
surface. The ramp values are tooling data, not CSS properties declared on component hosts. Read
the semantic grid instead; it picks the right value per mode and supports theme overrides.

**The grid — `--lr-color-<variant>-<role>-<emphasis>`.** `{brand|success|warning|danger|neutral}` ×
`{fill|border|on}` × `{quiet|normal|loud}` = 45 slots. This is the layer components consume and the
layer to build on. Its _shape_ is identical in light and dark; the generator resolves different
ramp steps into each mode's literal fallback, so a rule written against it is mode-independent.

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
rows, a hairline inside an already-bounded card — so never use it as a control's only boundary.
These guarantees apply in both modes.

**Every slot has its own `--lr-theme-*` override**, named after the slot, so one decision can be
rethemed without forking anything beneath it:

```css
/* Both the grid slot and the flat alias below now resolve to this, for every component inside
   the panel (mark the panel <div class="invoice-panel" data-lr-theme-scope>, or use :root). */
.invoice-panel[data-lr-theme-scope] {
  --lr-theme-color-brand-fill-loud: #7c3aed;
}
```

The full runtime chain for one colour is your `--lr-theme-*` input, else the grid slot's generated
fallback. To move a whole tone, set its nine `--lr-theme-color-<variant>-*` inputs; the ramp remains
a design-tool input rather than a consumer override point.

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
--lr-color-mix-partner  /* what it moves toward; defaults to #737373 */
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

`theme.css` declares its layer order up front, with base inputs in `lr-theme` and built-in profile
rules in the `lr-theme-preset` sublayers:

```css
@layer lr-base, lr-theme, lr-theme-preset, lr-utilities, lr-overrides;
```

- **`lr-base`** — contains the explicitly scoped native-element rules only when the optional
  `native.css` asset is imported.
- **`lr-theme`** — contains the base theme inputs and token resolvers.
- **`lr-theme-preset`** — the compatibility layer name for look, density, surface, accent and mode
  rules. `theme.css` already supplies the built-in Shadcn, Glass and Emerald profile here; optional
  look stylesheets add their own rules to the same sublayers.
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

Lyra's styles use five named cascade layers. Layer order is fixed by the first order statement the
browser sees, so an application layer declared before Lyra's names can lose even when it appears
later in the stylesheet. Either leave overrides unlayered, which outranks the named layers, or
declare the complete Lyra order before your application layer:

```css
/* 1. Unlayer them — an unlayered rule outranks all five Lyra layers unconditionally,
      whatever the load order. This is the one that cannot be broken by an import move. */
:root {
  --lr-theme-color-brand-fill-loud: #7c3aed;
}

/* 2. Or keep your layer and pin it after Lyra's, once, before anything else loads. */
@layer lr-base, lr-theme, lr-theme-preset, lr-utilities, lr-overrides, app-theme;
@layer app-theme {
  :root {
    --lr-theme-color-brand-fill-loud: #7c3aed;
  }
}
```

The second form is the one to reach for when the application already has a layer architecture:
re-declaring the order is additive, and the first occurrence of each name is what fixes its
position — so stating all six names yourself pins `app-theme` last no matter when `theme.css`
loads. Name **every** Lyra layer when you do, `lr-theme-preset` included: a name missing from the
first statement the browser sees is appended at the end, so an older four-name statement (without
`lr-theme-preset`) would rank an imported look preset above `lr-overrides` and your own layer. Every Lyra stylesheet that declares an order repeats the same five names for exactly this
reason.

The same rule decides application **fallback fills**. A page that keeps plain `background` rules
for dialogs or panels (so it also renders without the component bundle) and uses an unlayered rule
on an `.lr-surface-chrome` element overrides the Glass fill; declare a low-priority layer before
Lyra's names (`@layer app-base, lr-base, lr-theme, lr-theme-preset, lr-utilities, lr-overrides;`)
for those fallbacks, or set `--lr-surface-background`. See
[Application fallback fills and cascade layers](native-styles-and-utilities.md#application-fallback-fills-and-cascade-layers).

<a id="the-shadcn-look--themesshadcncss"></a>

### The shadcn look — looks/shadcn.css

`theme.css` already installs Shadcn as the built-in default and supports explicit
`data-lr-look="shadcn"` scopes. Import it once; the separate Shadcn sheet is unnecessary for this
profile:

~~~ts
import "@aceshooting/lyra-ui/theme.css";
import { setLyraStyle } from "@aceshooting/lyra-ui/theme.js";

setLyraStyle({ look: "shadcn" });
~~~

Shadcn composes with the independent mode, surface, density and accent axes. For a local region,
set data-lr-look="shadcn" on that region or use applyLyraStyleScope(). A nested data-lr-mode="dark"
still changes mode without changing the look.

The separate `looks/shadcn.css` sheet remains compatible. Besides the same scoped look values, it
adds legacy `.light` and `.dark` mode aliases inside a Shadcn scope. Import that sheet only when
those aliases are needed; prefer `data-lr-mode`, `data-lr-theme` or `.lr-light`/`.lr-dark` for new
code. Explicit Lyra mode selectors on the same element take precedence over the compatibility aliases.

The look sets --lr-theme-* inputs, so no component API changes. Its rules use Lyra's named cascade layers: unlayered application rules still win, and runtime accent ramps still take precedence over look values for the roles they paint. Import order between theme.css and looks/shadcn.css does not change the layer order.

The shadcn look uses Neutral for primary and secondary controls. Its default button appearance is primary; filled is secondary, outlined is outline, plain is ghost, and danger remains destructive. The measured palette keeps control borders at least 3:1, uses an opaque focus color, keeps chart series contrast-qualified, and mixes hover and press toward mid grey so the monochrome primary still has a visible interaction state. Code-fence syntax colors continue to use the built-in light/dark Shiki themes.

Accents are independent from the look. A named accent such as emerald recolors the default button, checked controls, and focus ring while secondary and muted neutral tiers stay grey. Select mode with setLyraStyle({ mode: "system" }) or an explicit light/dark choice so the runtime resolves the accent ramp and updates data-lr-theme. Toggling an application class alone does not update an accent ramp managed by the runtime.

Override the look through an unlayered application rule or the lr-overrides layer:

~~~css
@layer lr-overrides {
  [data-lr-look="shadcn"] {
    --lr-theme-color-brand-fill-loud: #4f46e5;
  }
}
~~~

The former global themes/shadcn.css facade and its data-lr-theme-preset behavior have been removed.
Use theme.css and the data-lr-look axis for new styling; looks/shadcn.css is needed only for the
compatibility aliases above.

### Where an override actually reaches

**Shared computed `--lr-*` outputs are resolved at theme scopes and inherited everywhere else.** That
includes palette, spacing, radius, typography and motion outputs such as `--lr-color-brand`,
`--lr-space-m` and `--lr-radius`. No component re-declares them on its host (since 28.0.0), so:

- **A `--lr-theme-*` input** retunes everything below it **when it is set on a theme scope**. Set on a
  plain wrapper, a component's inline style, or an application component's own `:host` rule, it no
  longer re-derives the components below; add `data-lr-theme-scope` to that element.
- **A `--lr-*` output** set on an ancestor now reaches every component below it, until the next theme
  scope (which re-derives every output). The outputs _derived_ from it (`--lr-focus-ring` from
  `--lr-focus-ring-color`, `--lr-color-brand` from `--lr-color-brand-fill-loud`,
  `--lr-transition-interactive` from `--lr-transition-fast`) keep the scope's values unless the
  element is itself a scope.
- **Border outputs stop at an opaque content interior.** The bodies of `lr-card`, `lr-details` and
  `lr-accordion-item` restore the nearest scope's unqualified `--lr-color-border` and
  `--lr-color-border-strong` for their content (inside a glass surface the surface would otherwise
  hand its translucency-qualified borders to opaque content). A `--lr-color-border` set on such a
  component, or above it, still applies to the chrome that reads it, but not to the content; set
  `--lr-theme-color-surface-border` on a theme scope, or a component hook such as
  `--lr-input-border-color`, to reach the content.

```css
/* Reaches everything in the subtree, however deeply nested: the element is a theme scope. */
.invoice-panel[data-lr-theme-scope] {
  --lr-theme-color-brand-fill-loud: #7c3aed;
}

/* An output reaches the subtree down to the next scope; its dependants do not follow it. */
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

**Diagnostic:** if a `--lr-theme-*` input has no effect on a nested component, check that the element
carrying it is a theme scope (the development build warns once per page about an inline input on an
element that is not, and `findUnscopedThemeInputs()` lists them). If a documented component-specific hook
fails when inherited from a wrapper, that is a component bug; setting the same hook directly on
every host should not be necessary.

**There is no way to tell a live `--lr-*` declaration from a dead one without rendering.** A dead
declaration is byte-identical to a working one in the stylesheet; a stylesheet-text check cannot
distinguish it. Verify with `getComputedStyle` on the real element in the real state, and perturb
the value deliberately to confirm the assertion actually bites.

The same trap has a second form inside a component's own styles: a _declared_ value always wins
over a `var()` fallback arm, and `auto` is a declared value. That is why the exact-height escape
hatches (`--lr-input-control-height`, `--lr-select-trigger-height`, `--lr-chip-height`, …) are
undeclared by default rather than set to `auto`. Setting one _to_ `auto` is therefore not the same
as leaving it alone: it wins over the fallback arm and makes the per-size minimum-height floor dead
code. See each control's own reference page for its exact pair.

### Tokens with a contract attached

- **`--lr-theme-icon-button-size`** (default `2.25rem`) backs `--lr-icon-button-size`, the tappable
  box of **every** icon-only control in the library — `lr-icon-button` itself, and the
  expand/clear/toggle affordances inside `lr-date-input`, `lr-combobox`, `lr-input`, and
  `lr-select`. It is a _floor_, not a fixed size. Keep the resolved value **at or above 24px**
  (WCAG 2.2 SC 2.5.8 target size); the default leaves headroom. Lowering it below that shrinks
  every affordance in the library at once.
- **`--lr-icon-button-size-scope`** resizes icon buttons for **one subtree** instead of the whole
  application. Set it on any wrapper; it inherits past intervening components and reaches every
  icon-only control below it. Three names, three scopes — pick by how far you want the change to
  reach:

  | Property | Scope | Set it on |
  | --- | --- | --- |
  | `--lr-theme-icon-button-size` | application-wide | `:root`, or any ancestor |
  | `--lr-icon-button-size-scope` | one subtree | the wrapper you want affected |
  | `--lr-icon-button-size` | one element | the icon-only control itself |

  `--lr-icon-button-size-scope` wins wherever both ancestor inputs are set — the narrower scope
  takes precedence, and it has to: the shipped `design-tokens.css` declares
  `--lr-theme-icon-button-size` on `:root`, and a `var()` chain only falls through for a property
  that is unset *everywhere*, not merely shadowed nearer the element. Reading the theme tier first
  therefore made this knob inert for anyone loading that stylesheet (a real 18.1.0 defect, fixed in
  18.2.0). `--lr-icon-button-size`
  is **element-scoped on purpose** and is not a wrapper knob: every component re-declares it on its
  own host so the touch-target floor can apply per element, so a value set on a wrapper is replaced
  at the first component in between and never reaches anything nested inside one. That behaviour is
  unchanged — use `--lr-icon-button-size-scope` for the wrapper case.

  ```css
  /* A dense toolbar, without touching the rest of the app. */
  .message-toolbar {
    --lr-icon-button-size-scope: 1.75rem;
  }
  ```

  The coarse-pointer floor still applies to both ancestor inputs: on a touch device (`hover: none`
  or `pointer: coarse`) a resolved value below `2.75rem` is raised back to it, so the new subtree
  knob is not a way around WCAG 2.2 SC 2.5.8 — a deliberately dense desktop toolbar still becomes
  tappable on a phone.
- **Optional shape and heading inputs.** `--lr-theme-border-radius-button` feeds the button radius;
  unset, it falls through `--lr-radius` to `--lr-theme-border-radius-m`. Native buttons follow the
  same input when the optional `native.css` sheet is imported inside `.lr-native`.
  `--lr-theme-border-radius-container` sets card, disclosure, table, grid and floating-panel
  corners; unset, these keep their existing radius.
  Component hooks such as `--lr-button-radius`, a card's `--border-radius`, and
  `--lr-overlay-radius` still win. Explicit circle, pill, plain and edge-attached presentations
  keep their geometry. `--lr-theme-font-family-heading` changes semantic heading wrappers, the
  light-DOM heading utilities, and native headings inside `.lr-native` when `native.css` is imported;
  unset, headings inherit their surrounding font as before.
  Body, code and locally styled heading text keep their own fonts.
- **Optional row minimum.** `--lr-theme-table-row-height` supplies a minimum for `lr-table` and
  `lr-data-grid`. It has no global baseline: a table remains content-driven, and a grid keeps its
  own size ladder. Density scales this minimum together with each grid size baseline; row content
  can grow beyond it. A table's `--lr-table-row-height` or a grid's `--row-height` overrides that
  calculation, subject to density target floors. These inputs inherit through component boundaries.
- **`--lr-color-border-subtle`** is the decorative border tier
  (`#e5e5e5` in light, white at 10% in dark by default). Components draw only purely
  decorative edges with it — a divider or rule, a card, panel, table or section edge, a separator
  between items, a gutter line — never the only visible boundary of an interactive control or of a
  meaningful graphic, which WCAG 2.2 SC 1.4.11 holds to 3:1 and which therefore stay on
  `--lr-color-border`. Form controls never read it (a build gate enforces that). Set
  `--lr-theme-color-surface-border-subtle` to retune decoration without weakening a single control
  boundary — it may be well below 3:1, or translucent. To change control borders, set
  `--lr-theme-color-surface-border` instead and keep it at 3:1 against both the page and the raised
  surface. Forced-colours mode maps both tokens to the same system colour. Use the same split in your
  own components: `tokens-root.css` publishes `--lr-color-border-subtle` at `:root`.
- **`--lr-color-surface-overlay` is its own input.** It is the panel colour behind every floating
  surface — dropdowns, listboxes, menus, toasts, popovers, dialogs, and the `lr-app-rail` mobile
  drawer — and defaults to `#ffffff` in light and `#171717` in dark. It does not follow
  `--lr-theme-color-surface-default`: when you re-skin the page surface, set
  `--lr-theme-color-surface-overlay` (or `--lr-theme-color-surface-container-high`) to match.
- **Aligning your own content next to a checkbox or radio.** `--lr-checkbox-label-indent` /
  `--lr-radio-label-indent` publish the label offset, but custom properties inherit _down_, not
  sideways, so a sibling node in your tree cannot read them off the control. Compute the same
  formula from the `--lr-theme-*` inputs you control:
  ```css
  padding-inline-start: calc(
    min(var(--lr-theme-icon-button-size, 2.25rem), 1.75rem) + var(--lr-theme-space-s, 0.5rem)
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

Switch modes by putting `class="lr-light"`/`class="lr-dark"` (or `data-lr-theme="light"`/`"dark"`,
or `data-lr-mode`) on any element, including a component itself; with `theme.css` imported it also
sets `color-scheme`. **Every engine follows the nearest mode scope, with or without `theme.css`:** the
document layer carries mode to every scope through two inherited private switches, so a `.lr-light`
island inside a `.lr-dark` region is light, a mode-neutral scope keeps its ancestor's mode, and the
OS preference decides the root unless the root carries an explicit mode. A real `--lr-theme-*` value
still wins over the built-in light or dark default. (Before 28.0.0 an ancestor mode reached
components without `theme.css` only in Chromium, through `:host-context()`.)

Each component host also keeps `:host([hidden]) { display: none !important; }` and an inherited
`box-sizing: border-box` reset.

### Style runtime — @aceshooting/lyra-ui/theme.js

The standalone style runtime has no Lit or component dependency and does not touch the document or storage when imported. It stores the selected style under localStorage['lyra-theme'], applies it to the document root, and announces changes through lr-style-change.

~~~ts
import {
  defineLyraLook,
  getLyraStyle,
  resetLyraStyle,
  setLyraStyle,
  startLyraStyle,
} from "@aceshooting/lyra-ui/theme.js";

startLyraStyle(); // adopt the saved style and follow the OS without writing storage

setLyraStyle({ mode: "dark" }); // unspecified axes keep their current value
setLyraStyle({ accent: "sapphire" }); // named palette accent
setLyraStyle({ accent: "#7c3aed" }); // absolute CSS color
setLyraStyle({ accentBackground: "#0b0f1a" }); // reference surface for accent ramps
setLyraStyle({ mode: "system" }); // follows prefers-color-scheme
setLyraStyle({ look: "shadcn", surface: "glass", density: "compact" });
const style = getLyraStyle();
resetLyraStyle(["look"]); // reset only the look axis
setLyraStyle({ mode: "unset", accent: null, accentBackground: null, overrides: null });
~~~

setLyraStyle() accepts independent choices for look, surface, density, mode, accent, accentBackground, and overrides. Omitted axes keep their current selection. Null restores the built-in value for look, surface, density and mode; `accent: null` explicitly clears the accent, and null clears accentBackground or overrides. `resetLyraStyle()` restores Shadcn/Glass/Emerald/System/comfortable; a field list resets only those fields. The returned LyraStyle snapshot includes the selected values, a resolved mode when the choice is system, and lookForm to distinguish a stylesheet look from a runtime look.

mode is light, dark, system, or unset. Explicit modes set both data-lr-theme and data-theme; system follows the operating system and updates both attributes when it changes; unset removes Lyra's mode attributes. The lr-style-change event carries { style, changed }, where changed lists the affected fields. Applications can listen to this one event for document style changes.

accent accepts one of Lyra's named palettes or an absolute CSS color. A custom color is shorthand for a brand color; an object can set colors for brand, success, warning, danger, and neutral independently. Each role can use a { light, dark } pair. Lyra derives quiet, normal, and loud fill, border, and on-color ramps. Foregrounds meet 4.5:1 contrast against their fills; normal and loud borders and the brand focus color meet 3:1 against the selected reference surface. Invalid colors fail closed.

accentBackground is an absolute CSS color used as the accent ramps' reference surface. surface is a separate visual treatment: solid or glass. density selects compact, comfortable, or touch. These axes remain independent, so changing the look does not reset mode, accent, surface, or density.

A LyraLook is a named token definition. Define an application look with defineLyraLook({ id, tokens }), then pass it as the look choice. A look supplies --lr-theme-* inputs; overrides applies an independent map of those inputs to the document root. Both accept CSS strings or per-mode { light, dark } values. Overrides replace the previous map wholesale; compose them with object spread. Values are validated, trimmed, and deep-frozen. Invalid entries are ignored, and maps are limited to 512 entries.

The token grammar rejects CSS-wide keywords, control characters, unsafe punctuation, unbalanced functions or quotes, and functions outside the documented color and layout set. Color families checked by the static contrast gate are corrected to meet their contrast floor before painting. The snapshot and stored record retain the normalized requested values. Inline style ownership records only properties Lyra wrote and restores an earlier author value when a choice is cleared.

**Saved styles and the no-flash bootstrap.** getLyraStyle() re-reads storage on each call, so a value written by another tab is visible. If storage is unavailable, the runtime reports its last applied style and continues applying changes without persistence. lyraThemeBootstrap is a self-contained IIFE string for a script in head before stylesheets; it restores the saved style before first paint. createLyraThemeBootstrap({ storageKey }) produces the same string for an application-owned key. Both runtime and bootstrap safely read v1 records using mode: "auto", surface, and tokens, translating them to the current style axes. Keep this reader when migrating old saved preferences; new writes use the current style record.

Inline the bootstrap after an early UTF-8 declaration and before stylesheets, with the application's
CSP nonce or hash. Keep the complete charset declaration within the HTML document's first 1024
bytes; build plugins must not prepend the bootstrap ahead of it.

~~~html
<head>
  <meta charset="utf-8" />
  <script>
    /* server-inlines lyraThemeBootstrap here */
  </script>
  <link rel="stylesheet" href="/theme.css" />
</head>
~~~

For a strict CSP that disallows inline scripts, the package also publishes theme-bootstrap.js, a classic script asset with identical bytes. Load it synchronously after the charset declaration and before stylesheets. Its optional data-lr-theme-storage-key and data-lr-theme-attributes attributes select an application-owned storage key or mode-attribute list; values are validated and fall back to defaults when invalid.

**Fixed host axes with saved mode.** Set `data-lr-theme-restore="mode"` on the classic
bootstrap to restore only light, dark, or System while keeping the host's look, surface,
density, accent, and inline styles. Declare those fixed axes on `<html>`:

~~~html
<html data-lr-look="shadcn" data-lr-surface="solid" data-lr-accent="none">
  <head>
    <meta charset="utf-8" />
    <script src="/theme-bootstrap.js" data-lr-theme-restore="mode"></script>
    <link rel="stylesheet" href="/theme.css" />
  </head>
</html>
~~~

Serve the package's `@aceshooting/lyra-ui/theme-bootstrap.js` asset at the script URL.
Keep it synchronous, before stylesheets; no import of the full `theme.js` runtime is required.
For server-generated inline scripts, use `createLyraThemeBootstrap({ restore: 'mode' })`.
`restore: 'all'` is the default and retains whole-profile restoration. A valid script attribute
(`all` or `mode`) overrides the factory option; an absent or invalid attribute keeps that option.
The existing `data-lr-theme-storage-key` and `data-lr-theme-attributes` configuration also applies.

Mode-only restoration ignores saved visual axes and token maps without changing the saved record.
Missing, invalid, or inaccessible saved mode defaults to System, resolved against the current
`prefers-color-scheme` before paint. Legacy `auto` maps to System; saved `unset` leaves mode
selection unset and clears the configured resolved-mode attributes. The bootstrap applies an
initial snapshot; it does not install a live system-mode listener. This option configures only
the bootstrap. Later runtime calls such as `setLyraStyle()` follow their own style and persistence
policy, so choose that policy explicitly if the application initializes the runtime afterward.

**Starting the runtime after the bootstrap — `startLyraStyle()`.** A page that inlines only the
bootstrap and loads `theme.js` later in a deferred bundle calls `startLyraStyle()` once. It adopts
the saved style (the defaults when nothing is saved) on the document root and, while the mode is
System, attaches the live `prefers-color-scheme` listener. It never writes storage: no record is
created, a v1 record is not migrated, and an operating-system flip afterwards repaints without
saving. Repeated calls do not stack listeners. The call emits no `lr-style-change`; a later
operating-system flip emits `changed: ["resolvedMode"]`. The first `setLyraStyle()` takes over the
same listener. Do not call `setLyraStyle({})` for this: it persists the current record.

~~~ts
// deferred bundle, after <script>lyraThemeBootstrap</script> in <head>
import { startLyraStyle } from "@aceshooting/lyra-ui/theme.js";

startLyraStyle(); // adopts the saved style, follows the OS while mode is System, never writes
~~~

`startLyraStyle()` always reads the runtime's own `localStorage['lyra-theme']` record and applies
the whole profile in it. A page whose bootstrap uses `data-lr-theme-restore="mode"` or an
application-owned storage key does not pair with it: the start would apply axes or a record the
bootstrap deliberately ignored. Such pages call `setLyraStyle()` with the policy they want.

**Migrating the retired theme facade.** New code uses setLyraStyle() and getLyraStyle(). Map old auto mode to system, an old surface reference color to accentBackground, and an old token map to overrides; review custom CSS colors that share a gemstone name before choosing a named accent. Replace preset definitions with a LyraLook plus explicit style choices. Replace selectors for data-lr-theme-preset with the actual axis they need, such as data-lr-look="shadcn". Import theme.css in place of the removed fixed themes/shadcn.css facade and select the look with setLyraStyle({ look: "shadcn" }) or a scoped data-lr-look attribute. Listen for lr-style-change and read event.detail.style and event.detail.changed; the old theme and preset events are no longer emitted. For the complete project-by-project sequence, see [Upgrading from v23 to v24](v23-to-v24-migration.md).

Historical v1 stored records remain readable by the runtime and bootstrap. The removed JavaScript functions, preset subpaths, preset event, root marker, and fixed stylesheet are not available in the current API.

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

<!-- focused-native-styles:start -->
### Optional native styles and CSS utilities

The complete native CSS and utility contract is in the [native styles guide](./native-styles-and-utilities.md#optional-native-styles-and-css-utilities).

#### Utility class inventory

[Read the utility classes](./native-styles-and-utilities.md#utility-class-inventory).

#### Typography

[Read the light-DOM typography rules](./native-styles-and-utilities.md#typography).

#### Using the light-DOM stylesheets with a CSS reset (Tailwind v4 preflight and similar)

[Read the CSS reset guidance](./native-styles-and-utilities.md#using-the-light-dom-stylesheets-with-a-css-reset-tailwind-v4-preflight-and-similar).

#### Bundle-specific override hooks

[Read the override hooks](./native-styles-and-utilities.md#bundle-specific-override-hooks).
<!-- focused-native-styles:end -->

### Composing looks, surfaces and density

`@aceshooting/lyra-ui/theme.js` exports the API. Each scope selects one look, surface, density,
mode and accent; the axes compose independently.

```js
import '@aceshooting/lyra-ui/theme.css';
import '@aceshooting/lyra-ui/looks/material.css';
import '@aceshooting/lyra-ui/density.css';
import '@aceshooting/lyra-ui/accents.css';
import { setLyraStyle, resetLyraStyle, applyLyraStyleScope } from '@aceshooting/lyra-ui/theme.js';

setLyraStyle({ look: 'shadcn', mode: 'system', accent: 'sapphire' });
setLyraStyle({ surface: 'glass' }); // keeps others
applyLyraStyleScope(tableRegion, { density: 'compact' }); // others inherit
applyLyraStyleScope(previewRegion, { look: 'material', mode: 'dark' });
resetLyraStyle(['look']); // resets look only
applyLyraStyleScope(tableRegion, null); // restores authored values
```

`setLyraStyle()` persists supplied fields and retains omitted ones; null resets profile axes, while
`accent: null` clears it. `applyLyraStyleScope()` replaces an element's selection (omitted fields
inherit), without persistence or global events; clearing preserves later author changes. `getLyraStyle()`
reports requested axes and resolved mode.

Set `data-lr-look`, `data-lr-surface`, `data-lr-density`, `data-lr-mode` and `data-lr-accent`
directly if needed. Shadcn and Lyra are included in `theme.css`; other stylesheet look ids need
their optional sheet. Arbitrary ids neither load nor register.
`defineLyraLook({ id, tokens })` defines a validated immutable runtime look;
`lyraLookCss()` from `theme/look-css.js` creates CSS without DOM access. In app-owned shadow roots
with local boundaries, install `theme.css` and selected sheets; selectors stop at roots, inheritance
crosses.

`@aceshooting/lyra-ui/design-tokens.json` exports `$extensions['com.aceshooting.lyra.looks']`
(schemaVersion 1, base `lyra`), definitions `lyra`, `material`, `shadcn`, `data`, `terminal`,
`high-contrast`, and `defaultStyle`: Shadcn/Glass/Emerald/System/comfortable. The original token tree remains
authoritative; empty `lyra` restores it. Runtime CSS/editor/preview project the default separately.
Portable `{ id, tokens }` works with `defineLyraLook()`; sparse/null branches stay sparse. Load its
resolver to apply a look.

The [theme builder](https://www.lyra-ui.com/docs/?path=/story/theming-theme-builder--editor) previews
modes and edits contrast/motion, fonts, shape, elevation and chart palettes. It is documentation only,
not an entry point or element; component imports do not load it.

Import/export uses `LyraLook`, `LyraThemeTokens`, version-2 saved-style records and separate
`LyraPreferences`. Preserve runtime look tokens; `getLyraStyle()` snapshots omit them. Imports are
atomic (256 KiB max), reject network-bearing/executable CSS and preserve the last preview on error.
Group reset removes its writes; resetting a token to its look value removes it from every group.

`lyraLookCss()` exports only look CSS (requires `theme.css`, selected sheets and axis attributes).
Use the runtime recipe for custom accent derivation or separate style/preference files. SSR helpers
`lyraStyleAttributes()` and `lyraPreferenceAttributes()` leave system mode unresolved. Install CSS
in every app-owned shadow root with a local boundary.

Diagnostics measure specimens, not certify accessibility; dynamic backgrounds are unmeasured. Keep
chart text/non-color cues. See [contrast guidance](#scoped-contrast-and-motion-preferences).

### Optional shape, typography and elevation presets

These granular modules export immutable token maps. Combine selected maps in `overrides` to retain
the selected look, surface, density, mode and accent:

```js
import '@aceshooting/lyra-ui/theme.css';
import { setLyraStyle } from '@aceshooting/lyra-ui/theme.js';
import { LYRA_SHAPE_PRESETS } from '@aceshooting/lyra-ui/theme/options/shape.js';
import { LYRA_TYPOGRAPHY_PRESETS } from '@aceshooting/lyra-ui/theme/options/typography.js';
import { LYRA_ELEVATION_PRESETS } from '@aceshooting/lyra-ui/theme/options/elevation.js';

setLyraStyle({ overrides: {
  ...LYRA_SHAPE_PRESETS.rounded,
  ...LYRA_TYPOGRAPHY_PRESETS.arabic,
  ...LYRA_ELEVATION_PRESETS.raised,
} });
```

The same maps work with `applyLyraStyleScope(element, { overrides })`. An override map replaces the
previous map as a whole, so rebuild it from the options still selected when changing one option.
`resetLyraStyle(['overrides'])` removes all application overrides and returns to the selected look's
values. For a scoped preview, `applyLyraStyleScope(element, null)` restores its previous authored
values. No preset is imported or applied automatically.

| Module | Presets | Effect |
| --- | --- | --- |
| `theme/options/shape.js` | `square`, `rounded` | Shared control, button and container corners; explicit circle and pill geometry stays intact |
| `theme/options/typography.js` | `system`, `arabic`, `urdu`, `hebrew`, `devanagari`, `thai`, `japanese`, `korean`, `simplified-chinese`, `traditional-chinese` | Body/heading font stacks, compact/snug/normal/loose line heights and line/word-breaking policies; code fonts and font sizes stay unchanged |
| `theme/options/elevation.js` | `flat`, `raised`, `tonal` | Five shadow levels; raised shadows adapt to mode, while tonal uses neutral container steps with no shadows |

Each module also exports its name union: `LyraShapePresetName`, `LyraTypographyPresetName`, or
`LyraElevationPresetName`. Component hooks such as `--lr-button-radius`, a card's `--border-radius`
and `--lr-overlay-shadow-modal` remain authoritative. Elevation presets affect consumers of the
shadow scale; a card whose default shadow is `none` remains flat unless the application opts in,
for example with `--lr-card-shadow: var(--lr-shadow-m)`. Flat and raised change only shadows.
Tonal also sets neutral light/dark container colors and matching quiet text so all five levels
retain readable secondary content. It does not derive a palette from the accent.
No elevation preset changes z-index or positioning.

The optional `--lr-theme-color-surface-container-lowest`, `-low`, the unsuffixed
`--lr-theme-color-surface-container`, `-high` and `-highest` inputs provide five surface levels.
Their shared aliases omit `theme-`. With these inputs unset, lowest and low retain the page surface,
the middle step retains the raised surface, and high/highest retain the overlay surface. Existing
page and overlay theme hooks therefore keep working. Outlined cards consume low, anchored overlay
surfaces consume high, and dialog/drawer panels consume highest. Material supplies warm tonal
steps in both stylesheet and runtime forms. Component hooks such as `--lr-card-outlined-bg` and
`--lr-overlay-surface` still win. Forced colors uses system surfaces and visible boundaries.

Typography presets name installed local fonts and end with system fallbacks; they perform no font
downloads. Choose the preset appropriate to the content and set the application's `lang` and `dir`
normally. Font availability and glyph metrics vary by platform. The presets do not change language,
direction, character shaping or the content itself. Applications should still inspect long text,
combining marks and mixed scripts with their actual fonts and text-zoom settings.

The `urdu` preset prefers Noto Nastaliq Urdu, Jameel Noori Nastaleeq and Urdu Typesetting before
Naskh/system fallbacks. Its compact, snug, normal and loose line heights are 2, 2.25, 2.5 and 2.75
to leave room for Nastaliq's vertical forms. These are adjustable starting values; the installed
font still determines glyph metrics.

`--lr-theme-line-break` and `--lr-theme-word-break` feed the inherited `--lr-line-break` and
`--lr-word-break` aliases. Shared component hosts, `.lr-prose`, typography headings/text and
`.lr-native` text/control descendants consume them. With both inputs unset, authored line/word
breaking continues to inherit. Component-specific overflow and wrapping rules remain authoritative,
and preformatted code retains its own whitespace behavior. Japanese and Chinese presets select
`strict` line breaking with `normal` word breaking; Korean selects `auto` with `keep-all`; the other
presets select `auto` with `normal`. Each preset sets both inputs, so switching scripts replaces
the previous policy. Thai word segmentation depends on the browser's dictionary support and the
content's `lang`; these tokens do not implement a dictionary or insert break characters.

Portable copies are included in `design-tokens.json` at
`$extensions['com.aceshooting.lyra.options']`, with `schemaVersion: 1` and
`presets.{shape,typography,elevation}`. Each named entry is the same token map as the corresponding
runtime export. The modules contain no runtime imports, font assets or chart engines.

### Scoped contrast and motion preferences

Accessibility preferences are independent of the five style axes. Import the optional stylesheet
and use attributes directly, or let the small optional helper manage one scope:

```js
import '@aceshooting/lyra-ui/preferences.css';
import {
  applyLyraPreferences, getLyraPreferences, lyraPreferenceAttributes,
} from '@aceshooting/lyra-ui/theme/preferences.js';

applyLyraPreferences(document.documentElement, { contrast: 'more', motion: 'reduce' });
applyLyraPreferences(preview, { contrast: 'system', motion: 'system' });
const { increasedContrast, reducedMotion } = getLyraPreferences(preview);
const attributes = lyraPreferenceAttributes({ motion: 'reduce' });
// attributes is { 'data-lr-motion': 'reduce' }; escape values through the template renderer.
```

`data-lr-contrast` accepts `system` or `more`; `data-lr-motion` accepts `system` or `reduce`.
Omitted preferences inherit independently through ordinary ancestors, shadow hosts and assigned
slots. A local `system` scope follows its own document's operating-system setting. It can reset an
explicit parent choice, but cannot turn off operating-system reduction or increased contrast.
Invalid attribute values inherit; invalid helper values throw before changing the scope.

Increased contrast promotes quiet component text and borders to the local foreground, keeps focus
rings at least 3px wide, and uses opaque chrome instead of glass. It works with every built-in look
and both modes. It strengthens existing semantic colors; it does not certify arbitrary author
colors or every possible foreground/background pairing. Component-specific color and focus hooks
remain available. Forced-colors mode continues using system colors.

Reduced motion reaches shared CSS transitions and looping indicators, registered animations,
autoplay, canvas animation and smooth scrolling. Running animation/autoplay components respond to
changes in the inherited scope. The explicit `respectReducedMotion: false` escape hatch on
animation utilities and the `ignoreReducedMotion` component properties keep their meaning. Preferences do
not pause an application's audio or video playback.

`applyLyraPreferences()` replaces only its own two attributes. Omitted fields and `null` restore the
previous authored values; later writes made by the application are preserved. It does not write
storage, change the selected look, or dispatch a global event. `getLyraPreferences(element?)`
returns requested `contrast`/`motion` and effective `increasedContrast`/`reducedMotion` booleans;
without an element it reads the document root when available. During SSR the default requests are
`system` and effective booleans are false; render known user choices with
`lyraPreferenceAttributes()`. Importing the helper does not access the DOM or storage.

Adopt `preferences.css` inside each application-owned shadow root that contains local preference
attributes. An inherited choice crosses a shadow boundary without reinstalling the sheet.
Components follow operating-system preferences even when the optional sheet is not imported.
Application-owned elements can import `@aceshooting/lyra-ui/tokens-root.css` and use the same
`--lr-color-text-quiet`, `--lr-color-border`, `--lr-focus-ring` and motion outputs. These outputs
resolve again at each preference boundary, including a nested look or a local `system` reset.

### Compatibility and saved preferences

When upgrading from v21, these component rendering changes also apply without opting into a style
axis. `lr-button-group` sizes to its content in narrow allocations and no longer reserves an
artificial intrinsic width. An explicit host width remains respected; set
`lr-button-group::part(base) { inline-size: 100%; }` when the internal row should fill that width.
The attachment menu inside `lr-prompt-input` now follows its explicit surrounding light/dark mode;
WebKit previously could use operating-system colors when that scheme disagreed with the surrounding
mode. Remove any application workaround that depended on that mismatch.
Menus also clamp their minimum width to the containing allocation and viewport, and positioned
submenus respect the positioner's available width. This prevents the former minimum from forcing
overflow in narrow spaces or with enlarged text; it remains effective when sufficient space exists.
The default Lyra dark control boundary changes from `#6b6b74` to `#787881` so it clears 3:1 on the
dark overlay `#2b3038` (3.034:1); the previous value failed on raised and overlay surfaces. This
changes `--lr-theme-color-surface-border` and its shared fallback only, keeping light boundaries,
other looks and semantic palettes intact. Plain chromatic button text moves toward body text on
hover/press, and selected tree rows use on-quiet text in those states, retaining 4.5:1 as their fills
change. Resting plain-button/selected-row text and explicit component foreground overrides remain
unchanged. Step numbers and interactive context-meter legend rows use matching semantic fill/text
pairs; control-border colors no longer act as their text backgrounds. Material uses 8% hover and
12% press state layers with its `currentColor` mix partner, keeping filled-action labels at 4.5:1.

Runtime custom accents, including `setLyraStyle({ accent })` and legacy gemstone presets, now
floor the loud fill to 4.5:1 against its quiet fill and the built-in reference surfaces because the
same token paints accent text. Its on-loud foreground follows the corrected fill. For example,
light shadcn emerald changes from `#34d399` with black on-loud text to `#1a6a4d` with white text
(6.537:1). Checked controls, brand text and streaming accents follow that loud token; secondary
neutral controls stay unchanged. The requested and persisted accent color is retained.

The runtime and no-flash bootstrap still read v1 records written by the retired theme API. On
read, auto becomes system and the old accent reference surface becomes accentBackground. A saved
`tokens` map remains runtime-look tokens (`lookForm: 'runtime'`), separate from public `overrides`;
without a valid saved look id, the runtime look is named `custom`. A CSS color such as aquamarine
remains a CSS color and is not converted into the named gemstone. New writes use the current style
record while retaining those runtime-look tokens. parseLyraStyleRecord() and
lyraStyleAttributes() provide DOM-free server-rendering helpers; render the returned attributes
through the framework's normal HTML escaping.

Glass is a treatment for eligible navigation and floating chrome. It does not make content panels,
editing controls, charts or base map layers translucent. Dialog and drawer panels, menus and
control-owned listboxes share the chrome treatment; their input interiors stay opaque. Unsupported blur, reduced transparency, increased contrast and
forced colors retain solid fills. Solid surfaces use `backdrop-filter: none`; forced colours paint
`Canvas`. Offer a solid choice wherever the application offers glass, since reduced-transparency
media-query support varies between browsers.

Regular glass defaults to 60% opacity with a 12px blur clamped to 16px.
The public `--lr-theme-surface-opacity` input accepts 0 through 1. Lower opacity exposes more
of the backdrop; the default foreground qualification covers 60%, while a custom lower setting
cannot guarantee contrast against every backdrop. Solid and accessibility preferences retain
opaque fills regardless of this input.
Dark Glass deepens the selected fill at opacity below 70% so light foregrounds remain readable
against bright backdrops; at 70% and above, the selected fill keeps its original color. The
deepening blends toward a darkened `--lr-color-surface` (10% of the surface, the rest black), not
pure black, so a lifted dark palette (for example a neutral grey `--lr-theme-color-surface-default`
and overlay tokens) lifts its Glass chrome with it. That share is small on purpose: the stock
palettes are qualified for 4.5:1 text over a pure white backdrop at 60% opacity, which caps how
light the pane can get. To paint a lifted palette's own overlay colour, set `--lr-theme-surface-opacity`
to 0.7 or higher.
Necessary control borders use the effective painted opacity: their glass adjustment grows as
transparency increases and disappears at 100% opacity. Ordinary and strong borders share this
adjustment; decorative borders and explicit component border overrides keep their own tokens.
Quiet text, focus indicators and transparent actions retain their separate local
contrast-qualified foreground; opaque accent fills retain their own on-colours. Supported chrome
includes app rails, navigation menus, menubars, menus and their context-menu composition, popovers,
selection toolbars, toast items and the owned playback-rate toolbar of `lr-av-player`. Nested glass
chrome is opaque, preventing repeated blur. Independently promoted menus and modal panels start a
new material root. Surface-colored outlined card and disclosure interiors let nested Lyra
controls use their solid border colors while preserving the enclosing edge against glass.
Filled accent interiors retain qualification. Native descendants retain inherited public color
aliases. Custom translucent content fills require the author to choose suitable control borders.
A design panel can offer a Glass opacity range from 0–100%, shown when the selected surface is
Glass. Start and reset it at 60%; convert the displayed percentage to the public token's 0–1 range.
Apply this CSS input independently of look overrides: `setLyraStyle()` does not accept surface
inputs in its `overrides` allowlist. Persist the percentage in the application's own settings and
apply it before first paint, including after restoring those settings. Reset the app setting to 60
and reapply it. Native `.lr-surface-chrome` wrappers and eligible component chrome consume the
same input:

```js
function applyGlassOpacity(percent) {
  if (!Number.isFinite(percent)) return;
  const opacity = Math.min(100, Math.max(0, percent)) / 100;
  document.documentElement.style.setProperty('--lr-theme-surface-opacity', String(opacity));
}

applyGlassOpacity(60); // Default and reset value; apply saved app settings before first paint.
```

Scrolling rail, popup, modal-panel and selection-toolbar surfaces keep a stationary decorative blur layer;
the public surface continues to own scrolling, focus and author overflow hooks.

`lr-av-player` additionally offers `controls-surface="clear"`, restricted to its owned toolbar and
backed by its own dark gradient scrim. It requires the glass stylesheet for translucency; without
that stylesheet it retains an opaque scrim. Native audio/video controls stay browser-owned.
