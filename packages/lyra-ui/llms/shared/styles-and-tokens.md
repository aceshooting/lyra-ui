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
   built-in fallback when it is unset. Aliases, computed tokens, and the colour ramp may instead
   resolve through another internal token or a fixed contract value. See
   [the colour ramp and the semantic grid](#the-colour-ramp-and-the-semantic-grid) for how a colour
   resolves through this layer.
3. **`--lr-<component>-*`** — per-component properties, for one element at a time. Listed in each
   component's own section.

**Layer 2 (`--lr-*`) is declared only on each `lr-*` element's own shadow `:host`.** It never
reaches plain application CSS, and it never reaches your own custom elements, since neither is a
descendant of an `lr-*` shadow root — `body { color: var(--lr-color-text) }` in application CSS
resolves to nothing, silently, not an error. Retheme through layer 1 (`--lr-theme-*`), which
`theme.css` supplies at document scope and which inherits normally into every nested shadow root.
To _read_ (not retheme) the resolved values from your own components, import the opt-in
[`tokens-root.css`](#reading-the-resolved-tokens-from-your-own-components--tokens-rootcss), which
declares a curated subset of layer 2 at `:root`.
See [Where an override actually reaches](#where-an-override-actually-reaches) below for the full
inheritance rules, including the one documented exception (per-component `--lr-<component>-*`
hooks, layer 3, which do inherit through wrappers).

### Reading the resolved tokens from your own components — `tokens-root.css`

The paragraph above is a real problem for any application that has custom elements of its own: they
are not descendants of an `lr-*` shadow root either, so `var(--lr-color-border)` inside **your**
component resolves to nothing, and `var(--lr-space-m, 0.5rem)` quietly runs on its literal fallback
forever. Both failures are invisible without reading computed styles in a browser.

Import one optional stylesheet and the curated part of layer 2 exists at document scope:

```css
@import "@aceshooting/lyra-ui/theme.css"; /* the --lr-theme-* input layer */
@import "@aceshooting/lyra-ui/tokens-root.css"; /* the resolved --lr-* layer, at :root */
```

```css
/* Now valid in your own component's stylesheet, in plain application CSS, anywhere. */
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

**It is opt-in, and it is a curated subset — not all of layer 2.** `--lr-*` is internal precisely so
it can change without a major version; publishing all of it at `:root` would freeze several hundred
internal decisions as permanent API. What ships is what an application's own component needs to sit
inside a Lyra UI without looking foreign:

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

The grid ships whole because its contrast guarantee is **per tier** — a `fill-quiet` background is
only guaranteed legible under the matching `on-quiet` foreground — so shipping the flat aliases
alone would hand you a pairing with nothing behind it.

**Deliberately not published**, and each for a reason that makes reading it a bug rather than a
convenience: `--lr-ramp-*` (a step encodes a light-mode choice and has no theme hook),
`--lr-size-*` (value-named geometry constants, frozen internals), the chart, graph and terminal
palettes (generated ramps that move with the palette tooling), `--lr-layer-*` (stacking order is
your decision), `--lr-color-mix-*` and `--lr-hover-brightness` (inputs to the library's own
interaction recipe), `--lr-line-height-*`, the per-control internals (`--lr-icon-button-size`,
`--lr-otp-input-segment-size`, `--lr-scroll-fade-size`, `--lr-popover-viewport-clamp`,
`--lr-safe-area-*`, `--lr-mask-opaque`, `--lr-color-no-data`), and the nine variant-following slots
(`--lr-color-fill-loud` and friends), which mean "the variant _this_ element is set to" and are
meaningless on `:root`. If you need one of these, ask for it to be added rather than reading it out
of a component's shadow root.

**Stability promise.** Every name in the table is public API from the release that introduced it: it
will not be renamed or removed outside a major version, and its meaning will not change. Its _value_
may change in a minor exactly as it may inside a component — a palette retune moves your elements
and the kit's together, which is the point. Names absent from the file stay internal and may change
in any release.

**Modes follow the inherited style context.** Standalone `tokens-root.css` follows the OS at the
root and accepts `.lr-light` / `.lr-dark`, `data-lr-theme` and `data-lr-mode` scopes. When `theme.css`
is also installed, its requested mode owns the switches instead. Shared outputs re-resolve on style
and contrast/motion preference boundaries; forced-colors and reduced-motion overrides use those
same boundaries, including under a dark OS. Each output reads the local `--lr-theme-*` input before
its built-in fallback. A preference-only boundary never overwrites inherited theme inputs.

**One caveat, and it is the same shape as layer 2's rule everywhere else.** A `--lr-theme-*` input
set on a mid-tree element retunes every `lr-*` component below it, because each component re-derives
the resolved layer on its own `:host`. The document-scope copy cannot: it is substituted where it is
declared, and what inherits past that point is the finished value. So if an application element
carries a subtree override and expects its **own** descendants to follow, give that element a mode
scope too — `data-lr-mode`, `data-lr-theme-scope`, or the compatibility `lr-light`/`lr-dark`
classes — so the whole subset resolves again there:

```html
<!-- Both the lr-* components and the app's own elements below follow the override. -->
<section class="lr-light" style="--lr-theme-color-brand-fill-loud: #7c3aed">…</section>
```

Public outputs sit in the `lr-theme` cascade layer, like `theme.css`, so any unlayered application rule
beats it regardless of load order, and the file declares custom properties only — notably not
`color-scheme` — so importing it paints nothing by itself. `--lr-focus-ring` and its three parts are
also declared at document scope by `theme.css`; both spell the same chain, so importing both is a
no-op either way round.

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
rows, a hairline inside an already-bounded card — so never use it as a control's only boundary.
These guarantees apply in both modes.

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
@layer lr-base, lr-theme, lr-theme-preset, lr-utilities, lr-overrides;
```

- **`lr-base`** — contains the explicitly scoped native-element rules only when the optional
  `native.css` asset is imported.
- **`lr-theme`** — where every `--lr-theme-*` token `theme.css` ships is declared.
- **`lr-theme-preset`** — an optional look preset layered over those tokens, such as
  [`themes/shadcn.css`](#the-shadcn-look--themesshadcncss). Empty unless one is imported.
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

### The shadcn look — `themes/shadcn.css`

One more import restyles every component after [shadcn/ui](https://ui.shadcn.com)'s
"new-york" style on its Neutral base colour:

```ts
import "@aceshooting/lyra-ui/theme.css";
import "@aceshooting/lyra-ui/themes/shadcn.css";
```

The preset sets only `--lr-theme-*` inputs, so no component API changes. Every rule sits in the
`lr-theme-preset` layer, and the file repeats `theme.css`'s layer statement, so:

- **load order does not matter** — the preset beats `theme.css` whichever is emitted first;
- **any unlayered rule of yours beats both**, exactly as it beats `theme.css` alone;
- **`setLyraTheme({ accent })` still wins** — the runtime writes inline style on `<html>`, which beats
  every layer.

**Modes.** The light block applies to `:root, .lr-light, [data-lr-theme='light'], .light` and the
dark block to `.lr-dark, [data-lr-theme='dark'], .dark` (declared after light, same specificity). An
application that toggles `.dark` on `<html>` the shadcn way gets Lyra's dark mode with no extra
wiring, and a nested `.dark` (or `.light`) region is themed on its own, native `color-scheme`
included. Only the preset knows `.dark`/`.light`: `theme.css` never reads those class names, since an
application may already use them for something else. That is why each preset block also repeats
`theme.css`'s own value, for that mode, of every input the preset does not restyle — the success,
warning and remaining danger slots, the scrims, and the chart, graph and terminal ramps — so a bare
`.dark` switches those too instead of leaving light status tints and light chart colours on a dark
page.

| Input | Light | Dark | Notes |
| --- | --- | --- | --- |
| `color-surface-default` / `-raised` / `-overlay` | `#ffffff` / `#fafafa` / `#ffffff` | `#0a0a0a` / `#171717` / `#171717` | page, card/sidebar, popover |
| `color-text-normal` / `-quiet` | `#0a0a0a` / `#737373` | `#fafafa` / `#a1a1a1` | |
| `color-surface-border`, `color-border-strong` | `#919191` | `#646464` | control boundaries, 3:1 on page and raised surface |
| `color-surface-border-subtle` | `#e5e5e5` | `rgb(255 255 255 / 0.1)` | decorative edges only |
| `color-brand-*`, `color-neutral-*` | quiet `#f5f5f5`, normal `#e5e5e5`, loud `#171717` | quiet `#262626`, normal `#404040`, loud `#e5e5e5` | monochrome: primary and secondary are one family |
| `color-danger-fill-loud` / `-on-loud` | `#d6000a` / `#ffffff` | `#ff6467` / `#0a0a0a` | other danger, success and warning slots keep Lyra's values |
| `color-focus`, `focus-ring-width`, `focus-ring-offset` | `#8b8b8b`, `3px`, `0px` | `#787878`, `3px`, `0px` | |
| `color-mix-partner` | `#737373` | `#737373` | hover/press mix toward a mid grey |
| `border-radius-m` / `-xs` | `0.5rem` / `0.25rem` | same | |
| `font-family-body` / `-mono` | `'Geist', 'Inter', ui-sans-serif, system-ui, sans-serif` / `'Geist Mono', ui-monospace, …` | same | fonts are named, not shipped |
| `font-size-m` | `0.875rem` | same | shadcn UI text is `text-sm` |
| `form-control-height-s` / `-m` / `-l`, `icon-button-size` | `2rem` / `2.25rem` / `2.5rem`, `2.25rem` | same | the 44px coarse-pointer floor still applies |
| `shadow-xs` … `shadow-xl` | Tailwind geometry, alpha 0.05 / 0.1 | same geometry, alphas ×3 | `--lr-theme-shadow-color` still tints them |

Every name in the first column is `--lr-theme-` plus the cell. The default `<lr-button>`
(`variant="neutral" appearance="accent"`) is shadcn's primary; `appearance="filled"` is secondary,
`"outlined"` outline, `"plain"` ghost, `variant="danger"` destructive, `appearance="link"` link.

**Deliberate deviations from shadcn**, each keeping a contrast guarantee shadcn does not make — the
repository's contrast gate re-measures every value in both modes:

- **Control borders** use the control grey above, not shadcn's `#e5e5e5` hairline (1.26:1 on white).
  The hairline survives as `--lr-color-border-subtle`, for decoration only.
- **Focus** is an opaque grey, 3.41:1 / 4.48:1 against the page. shadcn's half-transparent ring
  measures about 1.5:1 / 1.9:1.
- **Danger.** Components set text in the loud danger colour — error messages on the page, the body of
  a danger callout on the quiet danger tint. shadcn's `#e7000b` measures 4.10:1 on that tint, so the
  preset uses `#d6000a`, the same red a notch darker. Dark danger is a light red under near-black
  text, not white on a dark red, for the same reason.
- **Charts** keep Lyra's validated series ramp: two of shadcn's chart colours fall below 3:1 on
  white, and the ramp is also checked for colour-blind separation.
- **Hover and press** mix toward a mid grey. The default mixes toward the text colour, and shadcn's
  primary _is_ the text colour, so the default button would show no hover or press state at all.
- **Code-fence syntax colouring** (`lr-code-block` / `lr-markdown`'s keyword/string/comment tokens)
  is the one surface the preset does not repaint: it stays GitHub's light/dark Shiki theme pair in
  both modes, with no property yet to substitute a different pair. Only which of the two fixed
  themes paints (light or dark) tracks the preset, through the same light/dark switch every other
  surface here reads. Unlike charts, above, this one carries no `--lr-theme-*` input at all — a
  deliberate scope line, not an oversight.

**Accents.** `lr-button`'s default renders the `neutral` role, and a bare accent only re-derives
`brand`, so the preset aliases neutral's loud slots to brand's in both modes
(`--lr-theme-color-neutral-fill-loud: var(--lr-theme-color-brand-fill-loud)`, and likewise
`on-loud` and `border-loud`). With no accent that is the brand literal, so nothing changes; with
`setLyraTheme({ accent: GEMSTONES.emerald.fill })` the default button, checked checkboxes and
radios, and the focus ring follow the accent, while neutral's quiet and normal tiers — shadcn's
secondary and muted — stay grey. **Switch modes through `setLyraTheme({ mode })`** (or the
no-flash bootstrap) in an application that uses accents: the runtime derives the accent ramp for the
mode it resolved and writes `data-lr-theme`, which the preset honours. Toggling `.dark` alone would
leave a light-mode accent ramp on a dark page. Tailwind users can point `dark:` at
`[data-lr-theme=dark]` to share that one switch.

**Overriding the preset.** An unlayered `:root { --lr-theme-… }` wins, as always. A mode-specific
override must name the mode selectors, because the preset re-declares every input it sets on each of
them — so a nested `.dark` region re-applies the preset's dark value over one you set on `:root`:

```css
:root, .lr-light, [data-lr-theme="light"], .light { --lr-theme-color-brand-fill-loud: #4f46e5; }
.lr-dark, [data-lr-theme="dark"], .dark { --lr-theme-color-brand-fill-loud: #818cf8; }
```

Two document-scope conveniences re-derive only on Lyra's own mode selectors
(`.lr-light`/`.lr-dark`/`data-lr-theme`), not on `.dark`/`.light`: the resolved layer published by
[`tokens-root.css`](#reading-the-resolved-tokens-from-your-own-components--tokens-rootcss) and the
`--lr-focus-ring` composite `theme.css` declares for your own `outline: var(--lr-focus-ring)` rules.
A nested region whose _own_ light-DOM elements read either should carry `data-lr-theme="dark"`
alongside `.dark`. Components are unaffected; they re-derive both on their own `:host`.

**Component hooks are not part of the preset** — it sets theme inputs only. For shadcn's raised
sidebar tone, opt `lr-app-rail` in with one line:

```css
lr-app-rail { --lr-app-rail-bg: var(--lr-color-surface-raised); }
```

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

- **`--lr-theme-icon-button-size`** (default `2.5rem`) backs `--lr-icon-button-size`, the tappable
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
- **`--lr-color-border-subtle`** is the decorative border tier:
  `var(--lr-theme-color-surface-border-subtle, var(--lr-color-border))`. Components draw only purely
  decorative edges with it — a divider or rule, a card, panel, table or section edge, a separator
  between items, a gutter line — never the only visible boundary of an interactive control or of a
  meaningful graphic, which WCAG 2.2 SC 1.4.11 holds to 3:1 and which therefore stay on
  `--lr-color-border`. Form controls never read it (a build gate enforces that). The theme input is
  unset by default, `theme.css` included, so the token is exactly `--lr-color-border` and nothing
  renders differently until you opt in; set `--lr-theme-color-surface-border-subtle` to give
  decoration a lighter tone without weakening a single control boundary — it may be well below 3:1,
  or translucent (the shadcn preset uses white at 10% in dark). To change control borders, set
  `--lr-theme-color-surface-border` instead and keep it at 3:1 against both the page and the raised
  surface. Forced-colours mode maps both tokens to the same system colour. Use the same split in your
  own components: `tokens-root.css` publishes `--lr-color-border-subtle` at `:root`.
- **`--lr-color-surface-overlay` follows `--lr-theme-color-surface-default` in both modes.** It is
  the panel colour behind every floating surface — dropdowns, listboxes, menus, toasts, popovers,
  dialogs, and the `lr-app-rail` mobile drawer. In light mode it resolves straight to
  `--lr-color-surface`, so a re-skinned page surface carries them all with it. Dark mode cannot
  resolve to the page surface — panel and page would be the same near-black, and an open dialog
  would read as a scrim with text floating on it and no panel at all — so it is **derived** from
  the page surface instead: `color-mix(in srgb, var(--lr-color-surface) 85%, #8bade2)`, which lifts
  the panel a fixed amount above whatever the base happens to be. One
  `--lr-theme-color-surface-default` override therefore re-skins every floating surface in dark
  mode too, and the elevation delta survives the re-skin. At the built-in dark base the pair still
  resolves to the same panel colour it always has, so no existing dark theme moves.
  `--lr-theme-color-surface-overlay` still wins outright when you set it — reach for it only when
  you want a panel colour unrelated to the page surface.
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

### Theme mode/accent/surface runtime (`@aceshooting/lyra-ui/theme.js`)

Flipping the mode class/attribute above is something every app ends up hand-rolling — persist a
choice, apply it on load, avoid the flash of wrong theme before the app boots. `theme.js` is that
runtime, published as its own subpath: **zero dependencies, no Lit, no component imports, and no
side effects on import**, so an app can persist and apply a theme without pulling the component
graph into its first-paint bundle.

```ts
import { setLyraTheme, getLyraTheme } from "@aceshooting/lyra-ui/theme.js";

setLyraTheme({ mode: "dark" }); // unspecified fields keep their current value
setLyraTheme({ accent: "#7c3aed" }); // mode stays 'dark'; brand-only shorthand
getLyraTheme(); // → { mode: 'dark', accent: '#7c3aed', surface: null }
setLyraTheme({ accent: { danger: "#dc2626", success: "#16a34a" } }); // per-role, brand untouched
setLyraTheme({ accent: { brand: { light: "#2563eb", dark: "#f59e0b" } } }); // per-mode base color
setLyraTheme({ surface: "#0b0f1a" }); // mixes every ramp against this instead of the mode default
setLyraTheme({ mode: "auto" }); // follows the OS, including later changes
setLyraTheme({
  tokens: {
    "--lr-theme-border-radius-m": "0.5rem", // both modes
    "--lr-theme-color-surface-default": { light: "#ffffff", dark: "#0a0a0a" }, // per mode
  },
}); // replaces any previous token map wholesale
setLyraTheme({ tokens: null }); // back to whatever the stylesheets say
setLyraTheme({ mode: "unset", accent: null, surface: null, tokens: null }); // removes Lyra's overrides
```

- **`setLyraTheme({ mode?, accent?, surface?, tokens? })`** persists to `localStorage['lyra-theme']`,
  applies to `document.documentElement`, and dispatches `lr-theme-change` on `window` with
  `detail: { mode, accent, surface, tokens? }`. Fields you omit keep their current value; pass `null` to
  clear a field. It **never throws** — when `localStorage` is unavailable (private browsing,
  quota, a sandboxed iframe) it degrades to apply-without-persist, and the "fields you omit keep
  their current value" rule still holds across calls in that state: the merge falls back to the
  last theme applied in this session rather than to the default.
- **`getLyraTheme()`** returns `{ mode, accent, surface }`, defaulting to
  `{ mode: 'auto', accent: null, surface: null }` when nothing is stored or the stored value is
  malformed. Storage is re-read on every call — no in-memory cache — so a value written by another
  tab or a previous session is picked up cold. Where storage is unreadable or unwritable it
  reports the theme last applied, so the return value always describes what the document is
  actually showing and a toggle UI bound to it stays in sync.
- **`mode`** is `'light' | 'dark' | 'auto' | 'unset'`. `'light'`/`'dark'` set **both
  `data-lr-theme`** (the
  attribute `theme.css` actually keys its palette blocks on) **and `data-theme`** (the generic
  attribute canvas-rendered components watch, so `lr-chart`/`lr-heatmap`/`lr-qr-code` repaint on
  the switch rather than keeping stale colors — see `llms/components/lr-chart.md`). `'auto'`
  resolves `prefers-color-scheme` immediately and keeps following changes. `'unset'` removes both
  attributes; use it when the application owns mode selection through another cascade.
- **`accent`** is either an absolute CSS color — shorthand for `{ brand: <that color> }`, and the
  only shape prior to 16.0.0 — or a per-role record
  `{ brand?, success?, warning?, danger?, neutral? }`. Only the roles you supply are (re)derived;
  an omitted role keeps whatever the static palette (`llms/tokens.md`) already provides. For each
  supplied role, Lyra derives the complete quiet/normal/loud fill, border, and paired on-color
  ramp as inline `--lr-theme-color-<role>-*` inputs; `brand` additionally keeps `--lr-theme-accent`
  (a compatibility value holding the raw brand color, resolved for the active mode when the role
  is per-mode) and `--lr-theme-color-focus`, which no other role drives. Each paired foreground is
  selected for at least 4.5:1 contrast against its fill; normal/loud borders and the brand focus
  color are adjusted to at least 3:1 against the resolved surface (see `surface` below). Malformed
  values, CSS-wide keywords, `currentColor`, system colors, relative-color syntax, and unresolved
  `var()` expressions fail closed to `null` — at the whole `accent` field for a bare-string call,
  or at just that one role (or role/mode branch) for a per-role record, so one bad role does not
  take the others down with it. Pass `accent: null` to restore the palette supplied by
  `theme.css` entirely.
- **Per-mode accent.** Each role's value can itself be a bare color/`null` (applied to both
  resolved modes, as above) or a `{ light?, dark? }` map deriving that role's ramp from a
  genuinely *different base color* per resolved mode — not merely a different tint weight of the
  same hue — for example `{ brand: { light: "#2563eb", dark: "#f59e0b" } }`. An omitted branch
  (or a role/branch that fails validation) keeps that mode's inherited/palette default; the branch
  actually painted follows the *resolved* mode, so it updates automatically when `mode: 'auto'`
  follows a `prefers-color-scheme` change. The stored/returned/event-detail shape always mirrors
  what you supplied (bare color or `{ light, dark }`), never collapsed to a single resolved color.
- **`surface`** is an absolute CSS color used as every role's ramp mix base, instead of the
  shipped light/dark defaults (`#1a1a1a` dark / `#ffffff` light). It follows the same absolute
  CSS color and fail-closed-to-`null` rules as `accent`; an alpha channel is composited against
  the mode's own default surface before use. `null` (the default) keeps those shipped defaults.
  Supplying `surface` changes the quiet/normal/loud mix ratios and every border/focus contrast
  check for **every** currently-supplied role at once — it is one mix base per apply, not
  per-role.

  These are `--lr-theme-*` inputs, so they reach every nested shadow root — see "Where an override
  actually reaches" above for why setting a `--lr-*` token instead would not.
- **`tokens`** is a map of `--lr-theme-*` inputs written inline on `<html>`, persisted and restored
  before first paint like the other fields. Each value is a CSS string for both modes or a
  `{ light?, dark? }` pair; a `null` or omitted branch leaves that mode to the stylesheets. A map
  always **replaces** the previous one wholesale — compose with object spread
  (`{ ...LYRA_SHADCN_THEME_PRESET.theme.tokens, "--lr-theme-border-radius-m": "0" }`) — and
  `tokens: null`, `{}` or a map with no valid entry removes it; omitting `tokens` keeps the current
  map. Per-mode branches apply only while Lyra resolves a mode, so `mode: "unset"` writes the bare
  values only (use the `themes/*.css` stylesheet instead when an application-owned `.dark` class
  decides the mode). Inline `--lr-theme-*` values your application sets itself on `<html>` and that
  are not in a map are never touched; a name that *is* in the map is owned by the runtime while the
  map is applied, and an earlier inline value for it is not restored on removal.

  **Grammar and limits.** Invalid entries are dropped one by one (`setLyraTheme()` never throws;
  `defineLyraThemePreset()` throws `TypeError` for the same cases). A name must match
  `--lr-theme-[a-z0-9]+(-[a-z0-9]+)*`, be at most 80 characters, and not be `--lr-theme-accent`
  (owned by `accent`). A value is trimmed and must be 1–256 characters; it may not contain a
  control character or line break, a backslash, a backtick, any of
  `; { } ! < > @ [ ] $ ^ | ~ = ? & :`, U+2028/U+2029, or a
  comment delimiter; it may not be a CSS-wide keyword (`inherit`, `initial`, `unset`, `revert`,
  `revert-layer`); every function must be one of `rgb rgba hsl hsla hwb lab lch oklab oklch color
  color-mix light-dark calc min max clamp var cubic-bezier steps linear` (so `url()`, `image-set()`,
  `attr()`, `env()` and unknown functions are rejected); and parentheses and quotes must balance. A
  map holds at most 512 entries (more normalizes to no map at all). The check is DOM-free, so
  `defineLyraThemePreset()`, the runtime, the bootstrap and the preset generator apply it
  identically.

  **Contrast floor.** With a resolved mode, colour families the static contrast gate checks are
  measured before they are written; a failing value is replaced by the nearest passing mix toward
  black or white, serialized as `rgb(r g b)`, and a passing value is written verbatim. The snapshot
  and the stored record always keep the value you supplied. The references are the explicit
  `surface`, else the map's `--lr-theme-color-surface-default`, else the mode default (**S**:
  `#ffffff` / `#1a1a1a`); the map's `color-surface-raised` else `#f6f8fa` / `#22272e` (**R**); the
  painted `color-text-normal` else `#1a1a1a` / `#f2f2f2` (**T**); and the map's
  `color-overlay-strong` else black at 0.92 / 0.95 over S (**O**). Names below omit `--lr-theme-`:

  | Tokens | Against | Floor |
  | --- | --- | --- |
  | `color-text-normal`, `color-text-quiet` | S and R | 4.5 |
  | `color-<role>-on-<tier>`, when its `color-<role>-fill-<tier>` is in the map (a missing on-* is synthesized) | its fill | 4.5 |
  | `color-on-strong-overlay` (synthesized when only `color-overlay-strong` is in the map) | O | 4.5 |
  | `color-<role>-border-normal`/`-loud`, `color-surface-border`, `color-border-strong`, `color-focus` | S | 3 |
  | `color-chart-<n>` | S | 3 |
  | `terminal-color-<name>` | R | 4.5 |
  | `terminal-bg-<name>` | T | 4.5 |

  **Unchecked, written verbatim:** `*-border-quiet` and `color-surface-border-subtle` (decorative by
  contract); `color-<role>-fill-*` (measured through their on-* partner); an on-* whose fill-* is not
  in the same map; `color-surface-default`, `-raised` and `-overlay` (references, not foregrounds —
  text on `color-surface-overlay` is not measured); `color-overlay`, `color-no-data` and
  `color-mix-partner`; chart-series colour-vision separation (the static gate only); every
  non-colour token (fonts, radii, sizes, shadows, durations — including
  `--lr-theme-icon-button-size`, whose target-size floor is yours to keep); and any value or
  reference that does not resolve to a colour — `var()`, `light-dark()`, relative colours,
  `currentColor`, system colours, and **every** value when a canvas is unavailable (no 2D context,
  or pixel reads blocked). An unresolved row is written verbatim and synthesizes nothing; the accent
  still fails closed as it always has. The runtime never reads computed styles, so a reference an
  application stylesheet changes without the map carrying it is not seen.

  **Precedence.** accent ramp (for the roles it paints) > runtime tokens (inline on `<html>`) >
  your unlayered CSS > `lr-theme-preset` (`themes/shadcn.css`) > `lr-theme` (`theme.css`) >
  component fallbacks. Runtime tokens therefore beat an unlayered `:root { --lr-theme-*: … }`
  override, like the accent does; put your override in the map instead. An element that re-declares
  a `--lr-theme-*` input itself — a `.lr-dark`/`data-lr-theme` island, a `data-lr-theme`-pinned
  component, app-scoped CSS — keeps its own value inside that subtree (the accent ramp has the same
  limitation).

  **Snapshots.** `getLyraTheme()`, the stored record and the `lr-theme-change` /
  `lr-theme-preset-change` details carry `tokens` **only while a map is applied** — the key is
  absent, not `null`, otherwise, on every path including unwritable storage and the automatic mode
  flip. The map is normalized and deep-frozen: trimmed strings, and every per-mode entry carries
  both `light` and `dark` (`null` for a missing branch).
- **Unbalanced colours fail closed.** An `accent` (any role or branch) or `surface` with an
  unclosed parenthesis or quote, such as `rgb(0 0 0`, is rejected to `null` like every other
  malformed value. The browser's own parser closes such a construct implicitly, but written raw
  into an inline `style` it swallows the declarations after it when that attribute is re-parsed.

**Theme presets.** `@aceshooting/lyra-ui/theme/presets.js` exports
`LYRA_THEME_PRESETS`, `defineLyraThemePreset()` and `applyLyraThemePreset()`. Built-in keys are
`system`, `light`, `dark`, `unset`, `emerald`, `ruby`, `amethyst`, and `sapphire`; the gemstone
presets use system-following mode plus the named brand accent. Application presets use a stable
lowercase kebab-case `id` and a `theme: { mode?, accent?, surface? }` record — the same shapes
`setLyraTheme()` accepts, including a per-role `accent` record. `defineLyraThemePreset()`
validates the id and field shapes, freezes both records, and leaves CSS color-syntax validation to
the production runtime when the preset is applied:

```ts
import {
  applyLyraThemePreset,
  defineLyraThemePreset,
} from "@aceshooting/lyra-ui/theme/presets.js";

applyLyraThemePreset("sapphire");
applyLyraThemePreset(
  defineLyraThemePreset({
    id: "application-ocean",
    theme: {
      mode: "dark",
      accent: { brand: "#22d3ee", danger: "#dc2626" },
      surface: "#0b0f1a",
    },
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

**Token presets: a look as its own axis.** A preset's `theme` may carry `tokens` (see `tokens`
above). `defineLyraThemePreset()` validates the whole map against the same grammar the runtime
applies and throws `TypeError` on any violation, so a map it accepts is never changed at run time and
the preset still claims its marker — even where a canvas is unavailable. A look is independent of
mode, accent and surface: a preset that omits those fields leaves them as they are, and the built-in
presets never mention `tokens`, so `applyLyraThemePreset("sapphire")` or `"dark"` keeps the current
look. Either order reaches the same state; only the marker (the last applied id) differs. The
shadcn look ships as a generated runtime preset, built from `themes/shadcn.css` so the two can never
drift:

```ts
import { applyLyraThemePreset, defineLyraThemePreset } from "@aceshooting/lyra-ui/theme/presets.js";
import { LYRA_SHADCN_THEME_PRESET } from "@aceshooting/lyra-ui/theme/presets/shadcn.js";

applyLyraThemePreset(LYRA_SHADCN_THEME_PRESET); // look on; mode, accent and surface kept
applyLyraThemePreset("sapphire"); // an accent on top of the look

// The exact stylesheet rendering (no accent ramp, default surface), keeping a marker:
applyLyraThemePreset(
  defineLyraThemePreset({
    id: "shadcn-exact",
    theme: { ...LYRA_SHADCN_THEME_PRESET.theme, accent: null, surface: null },
  })
);
```

Choose the carrier by need. The runtime preset persists, is restored by the no-flash bootstrap
before first paint, needs no stylesheet swap, and is written inline, so it beats unlayered `:root`
overrides. The `themes/shadcn.css` stylesheet is the one to use for light/dark **islands**, for an
application-owned `.dark`/`.light` class, or for a page with no theme runtime. The runtime preset
module is a separate subpath, so an application that only uses `presets.js` pays nothing for it.

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

Both variants read a stored `{ mode, accent, surface }` record, resolve `auto`, and derive the same
per-role ramp(s) from the same math — the bootstrap re-implements it inline (self-contained, so it
can run before any module loads) rather than importing the runtime, but the two are tested to never
drift. A missing or malformed record receives the runtime's
`{ mode: 'auto', accent: null, surface: null }` default; blocked `localStorage` leaves the document
untouched rather than throwing before your app loads.

The stored record also carries `tokens` while a map is applied, and the bootstrap restores it
before first paint: the same grammar, the same per-mode branch for the resolved mode, and the same
contrast floor as the runtime. It records the names it wrote on `<html>`, so the runtime's first
apply removes or rewrites exactly those. Token values are read from storage at run time and never
serialized into the script string. **The bootstrap's bytes change with library releases** — this
one included — so a deployment that pins a CSP hash for the inline script (or for
`theme-bootstrap.js`) must regenerate that hash when upgrading, or the browser blocks the bootstrap
and the first-paint flash returns.

**External-file delivery for a strict CSP.** `@aceshooting/lyra-ui/theme-bootstrap.js` is a
third, non-module way to ship the same bootstrap: a static script asset published alongside the
package, containing exactly `lyraThemeBootstrap`'s bytes (both are produced from the same build
step, so they can never drift apart). Reference it with a plain `<script src>` in `<head>`,
still before any stylesheet:

```html
<head>
  <script src="/vendor/theme-bootstrap.js"></script>
  <link rel="stylesheet" href="/theme.css" />
</head>
```

This exists for a Content-Security-Policy that forbids `unsafe-inline` and cannot mint a
per-response nonce — a static HTML entry, for example — where the documented inline-script
nonce/hash guidance above does not apply. Serving it same-origin (copy it into your build output,
or configure your bundler/static host to do so) needs no hash at all; hashing it for an even
stricter policy uses the same CSP `script-src` hash mechanism browsers already apply to any
external script resource.

**Configuring the static asset from its own `<script>` tag.** `theme-bootstrap.js` must be loaded
as a plain classic script — never `type="module"` and never `async` — because it reads its own
configuration synchronously through `document.currentScript` while it runs, and that property is
`null` for both of those loading modes (as well as for anything scheduled after the script has
already finished executing). Two optional attributes on that same `<script>` tag override the
defaults without regenerating the file:

```html
<head>
  <script
    src="/vendor/theme-bootstrap.js"
    data-lr-theme-storage-key="my-app-theme"
    data-lr-theme-attributes="data-lr-theme data-theme"
  ></script>
  <link rel="stylesheet" href="/theme.css" />
</head>
```

- `data-lr-theme-storage-key` — the `localStorage` key to read, in place of the default
  `'lyra-theme'`. Equivalent to `createLyraThemeBootstrap({ storageKey })`'s argument, but
  resolved by the static file itself at parse time rather than baked in ahead of time. This is
  what lets an application with its own pre-existing storage key use the static asset instead of
  inlining a per-app copy.
- `data-lr-theme-attributes` — a space-separated list of attribute names to set on
  `<html>` in place of the default `data-lr-theme data-theme` pair, replacing that list entirely
  rather than adding to it.

Both attributes are optional and independently validated; an absent, empty, oversized, or
malformed value falls back to the built-in default rather than throwing, so a `<script>` tag with
neither attribute — every existing deployment — behaves exactly as before. `data-lr-theme-storage-key`
must be a non-empty string of at most 200 characters (its content is otherwise unrestricted — it is
only ever used as an opaque `localStorage` key, never written to the DOM). `data-lr-theme-attributes`
must parse to one to eight tokens, each unique and each matching `data-[a-z0-9]+(-[a-z0-9]+)*` —
which rejects an event-handler name (`onload`), a native attribute (`style`, `class`, `id`), any
token containing whitespace, a quote, `=`, or a control character, an empty list, and a duplicated
token — because these attribute names reach `setAttribute()`/`removeAttribute()` on the document
root. A `document.currentScript` of `null` (module/async misuse, or a script tag re-read after it
finished running) is treated the same as no configuration at all.

An application-owned key from `createLyraThemeBootstrap({ storageKey })` can still be inlined as
documented above; the static file's own script-tag attributes are the alternative for a strict-CSP
deployment that cannot inline that call.

**Migrating from 15.x.** `accent` used to be exactly an absolute CSS color or `null`; that shape
still works unchanged (`setLyraTheme({ accent: '#7c3aed' })` keeps deriving only the brand ramp).
What changed is `LyraTheme` gaining a `surface` field alongside it — a strict superset for every
caller that only ever read/wrote `mode`/`accent`, since `getLyraTheme()` now also returns
`surface: null` by default. Only code that structurally compares the whole returned record (for
example `assert.deepEqual(getLyraTheme(), { mode, accent })`) needs the extra field added.

**`tokens` is optional and absent unless used.** `LyraTheme` also gains an optional `tokens` field;
`getLyraTheme()`, the stored record and both event details omit the key entirely until a token map
is applied, so `assert.deepEqual(getLyraTheme(), { mode, accent, surface })` keeps passing.

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
assets repeat `@layer lr-base, lr-theme, lr-theme-preset, lr-utilities, lr-overrides`; an ordinary unlayered
application rule therefore beats them regardless of load order. A third opt-in asset,
[`tokens-root.css`](#reading-the-resolved-tokens-from-your-own-components--tokens-rootcss), is not a
style sheet in the same sense — it declares custom properties only, and exists so your own
components can read the resolved `--lr-*` tokens these two are written against.

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
| Typography                  | `lr-typography`, `lr-not-typography`, `lr-heading-1`, `lr-heading-2`, `lr-heading-3`, `lr-heading-4`, `lr-inline-code`                                           |
| Visibility and focus        | `lr-visually-hidden`, `lr-visually-hidden-focusable`, `lr-fouce-hidden`, `lr-hidden`                                                                              |
| Page allocation             | `lr-page-mobile-only`, `lr-page-desktop-only`                                                                                                                     |

`lr-fouce-hidden` hides only an opted-in custom element while it matches `:not(:defined)`, then
reveals it automatically after registration. `lr-visually-hidden-focusable` becomes visible on
focus or when a descendant receives focus, making it suitable for skip links.

The Page helpers key off the reflected `view` state of their containing `<lr-page>`:
`lr-page-mobile-only` is hidden for `view="desktop"`, and `lr-page-desktop-only` is hidden for
`view="mobile"`. Page derives that state from its own allocated inline size, not the viewport.

### Typography

`utilities.css` also carries an opt-in typography look for light-DOM content. Nothing changes for
markup that does not use these classes.

- **Scope** — `lr-typography` styles bare `h1`–`h6`, `p`, `a[href]`, `blockquote`, `ul`/`ol`/`li`,
  inline `code` (not `pre code`) and `table`/`th`/`td`/`tr` **descendants**, and spaces its direct
  children. Use it for CMS or Markdown-rendered HTML you cannot annotate element by element.
- **Roles** — `lr-heading-1` … `lr-heading-4` give any element a heading level's look without
  changing its semantic level; `lr-inline-code` gives one element the inline-code chip. Role classes
  apply anywhere, including inside a boundary, and an explicit role beats the element's own level
  inside the scope (`<h3 class="lr-heading-1">` renders heading-1).
- **Boundary** — `lr-not-typography` removes an element and its whole subtree from every element
  look. Use it around layout lists (`<ul class="lr-cluster">` tag rows, nav), embedded widgets and
  component clusters. A nested `lr-typography` inside a boundary is not re-enabled.
- **Named-slot children are skipped.** A child with a `slot` attribute (`<lr-card><h2
  slot="header">`) is component chrome and keeps the component's own styling; default-slot content
  is styled.
- **The scope element itself is never styled.** It sets no font, size, colour or margin, so it can
  sit on an app region. `<blockquote class="lr-typography">` does nothing: wrap single elements.
  Root font and colour come from the page, from `lr-prose` or from `lr-native`
  (`class="lr-prose lr-typography"` is the usual pairing).

Choose the element for the document outline and the class for the look: `<h2 class="lr-heading-1">`
for a visually dominant section heading, never `<div class="lr-heading-1">`.

| Element in `lr-typography` | Role class       | Look                                                                                   |
| -------------------------- | ---------------- | -------------------------------------------------------------------------------------- |
| `h1`                       | `lr-heading-1`   | `--lr-font-size-3xl`, bold, compact leading                                            |
| `h2`                       | `lr-heading-2`   | `--lr-font-size-2xl`, semibold, subtle bottom rule with `--lr-space-s` padding         |
| `h3`                       | `lr-heading-3`   | `--lr-font-size-xl`, semibold                                                          |
| `h4`                       | `lr-heading-4`   | `--lr-font-size-lg`, semibold                                                          |
| `h5` / `h6`                | —                | `--lr-font-size-m` / `--lr-font-size-sm`, semibold                                     |
| `p`                        | —                | `--lr-line-height-loose`                                                               |
| `a[href]`                  | —                | `--lr-color-brand`, always underlined; the underline thickens on hover                 |
| `blockquote`               | —                | italic, subtle `--lr-border-width-medium` inline-start edge, inherited colour          |
| `ul` / `ol`                | —                | `--lr-space-2xl` indent, markers restated (disc/circle/square, decimal), item rhythm   |
| inline `code`              | `lr-inline-code` | mono chip on `--lr-color-neutral-fill-quiet`, `0.875em`, semibold; inherits link colour |
| `table`                    | —                | full width, collapsed subtle cell borders, bold `th`, `--lr-color-surface-raised` zebra |

Headings, role classes and quotes inherit their colour, so a role class inside a banner or alert
keeps that surface's text colour. Heading tracking reads `--lr-heading-letter-spacing`, then the
`--lr-theme-heading-letter-spacing` theme input, then `normal`.

**Lead, large, small and muted** are compositions of existing utilities:

| Look  | Classes                         |
| ----- | ------------------------------- |
| Lead  | `lr-text-xl lr-text-quiet`      |
| Large | `lr-text-lg lr-font-semibold`   |
| Small | `lr-text-sm lr-font-medium`     |
| Muted | `lr-text-sm lr-text-quiet`      |

For an exact 0.875rem muted/small size, use a class of your own with the token chain (resolved
`--lr-*` tokens are undefined at document scope unless `tokens-root.css` is loaded):

```css
.app-muted {
  font-size: var(--lr-font-size-md-sm, var(--lr-theme-font-size-md-sm, 0.875rem));
}
.app-small {
  font-size: var(--lr-font-size-md-sm, var(--lr-theme-font-size-md-sm, 0.875rem));
  line-height: var(--lr-line-height-none, var(--lr-theme-line-height-none, 1));
}
```

Combine `.app-muted` with `lr-text-quiet`, and `.app-small` with `lr-font-medium`.

**Precedence.** Every selector has zero specificity, so source order and layers decide:

1. The typography element looks and role classes open the `lr-utilities` layer, so any other `lr-*`
   utility on the same element wins: `class="lr-heading-2 lr-text-quiet"` is a quiet heading, and a
   scope `<blockquote class="lr-center">` is centred.
2. An explicit heading role class beats the element's own scope look (`<h2 class="lr-heading-4">`
   has no bottom rule).
3. In `class="lr-prose lr-typography"`, `lr-prose` keeps the measure, root type and colour, and the
   typography element looks and heading-aware spacing win. Inside a boundary, or on a named-slot
   child, `lr-prose` applies exactly as before. Plain `lr-prose` output is unchanged.
4. `lr-utilities` beats `lr-base`, so the scope beats `lr-native` normalization, including its link,
   quote and heading colours.
5. A layered reset (such as Tailwind's `base` preflight) loses only when you declare the documented
   layer order first — see [Using the light-DOM stylesheets with a CSS
   reset](#using-the-light-dom-stylesheets-with-a-css-reset-tailwind-v4-preflight-and-similar).
   Authored `type` (lists) and `align` (cells) attributes are presentational hints that any author
   rule, including a reset, overrides.

Any unlayered application rule beats all of the above.

**Flow.** Every direct, non-slotted child of the scope has its block margins replaced by
`--lr-prose-flow-space` (default `--lr-space-l`), and a heading gets twice that space before it.
That includes wrappers, `hr`, `img`, `details`, `section` and `lr-*` elements, so a component's own
host margin is overridden at that position (wrap it in a `<div>` to keep it). Flow counts the
immediately preceding element sibling, including non-rendered ones (`<style>`, `<template>`,
`[hidden]`), so keep those out of the scope's direct children. Blocks nested inside `li` or
`blockquote` keep the page's own margins. Do not put `lr-stack`/`lr-cluster` on the scope element
itself — gap and flow margins would add up (set `--lr-prose-flow-space: 0` if you must).

**Wide tables** go in a focusable, labelled scroll region, labelled by the table's own caption:

```html
<div class="lr-overflow-auto" role="region" aria-labelledby="pricing-caption" tabindex="0">
  <table>
    <caption id="pricing-caption">Plans and prices</caption>
    …
  </table>
</div>
```

**Differences from the shadcn/ui look.** Values come from Lyra's scale:

| Element               | Lyra                                                          | shadcn/ui                               |
| --------------------- | ------------------------------------------------------------- | --------------------------------------- |
| Heading sizes         | 2 / 1.75 / 1.25 / 1.125rem                                    | 2.25 / 1.875 / 1.5 / 1.25rem            |
| h1 weight             | 700                                                           | 800                                     |
| Tracking              | `normal` unless the hook or theme input sets it; `themes/shadcn.css` sets -0.025em | tight              |
| Flow spacing          | 1rem (`--lr-prose-flow-space`)                                | 1.5rem                                  |
| Space before headings | 2 × flow = 2rem for every level                               | 2.5rem before h2, 2rem before h3        |
| Paragraph leading     | 1.6                                                           | 1.75rem                                 |
| Quote and list indent | 1rem and 2rem                                                 | 1.5rem each                             |
| Inline code size      | 0.875em (scales inside headings)                              | 0.875rem                                |
| Inline code padding   | 0.25rem inline / 0.125rem block                               | 0.3rem / 0.2rem                         |
| Table stripe          | `--lr-color-surface-raised` (matches `lr-data-grid`)          | muted fill                              |
| Links                 | brand colour, inherited weight, underline                     | primary colour, medium weight, underline |
| Muted and small size  | 0.8125rem via `lr-text-sm` (exact recipe above)               | 0.875rem                                |
| Small line-height     | inherited (exact recipe above)                                | 1                                       |

**Languages.** Only logical properties are used, so edges and indents mirror under `dir="rtl"`.
Blockquotes under `:lang()` `ar`, `fa`, `ur`, `ps`, `ckb`, `sd`, `ug`, `syr`, `he`, `yi`, `ja`, `ko`
and `zh` are not italic (those scripts have no true italic), and headings under `ar`, `fa`, `ur`,
`ps`, `ckb`, `sd`, `ug` and `syr` reset `letter-spacing` to `normal` (negative tracking breaks
cursive joins). To add a language to either list, or to opt back in, write an unlayered rule; it
wins.

**`lr-markdown`** renders into its own shadow root, which `utilities.css` cannot reach. For a
similar look, use its existing parts and hooks:

```css
lr-markdown::part(inline-code) {
  background: var(--lr-color-neutral-fill-quiet, var(--lr-theme-color-neutral-fill-quiet));
  font-weight: var(--lr-font-weight-semibold, var(--lr-theme-font-weight-semibold, 600));
}
lr-markdown {
  --lr-markdown-table-header-bg: transparent;
}
lr-markdown::part(blockquote) {
  font-style: italic;
}
```

The `blockquote` rule carries the same `:lang()` caveat as above.

### Using the light-DOM stylesheets with a CSS reset (Tailwind v4 preflight and similar)

A layered reset such as Tailwind v4's preflight lives in its own `base` layer. Layer order is fixed
by first appearance, so if the reset's layers are declared first they sort **after** Lyra's and
outrank `native.css` and `utilities.css`: headings shrink to body size, list markers and link
underlines disappear. Declare the full order as the **first** CSS the page loads — for example a
tiny `layers.css` imported before `tailwindcss` and before any Lyra CSS:

```css
/* layers.css — load first */
@layer theme, base, lr-base, lr-theme, lr-theme-preset, components, lr-utilities, utilities, lr-overrides;
```

The reset then sorts before Lyra's layers, and Tailwind's own utilities after `lr-utilities`. List
markers and link underlines inside `lr-typography` survive the reset because the scope restates
them. An authored `type` on a list or `align` on a cell does not: presentational hints lose to every
author rule, so under a reset set `list-style-type` (or `text-align`) with a class instead.

### Bundle-specific override hooks

The bundles consume the ordinary shared color, typography, spacing, border, radius, focus, size,
and opacity tokens first. These additional hooks customize only the light-DOM bundle behavior:

| Hook                                      | Default/fallback and use                                                     |
| ----------------------------------------- | ---------------------------------------------------------------------------- |
| `--lr-layout-gap`                         | `--lr-space-m`; default gap for `lr-stack`, `lr-cluster`, and `lr-grid-auto` |
| `--lr-grid-min-inline-size`               | `--lr-size-14rem`; minimum auto-grid item inline size                        |
| `--lr-content-max-inline-size`            | `--lr-size-48rem`; `lr-center` content measure                               |
| `--lr-prose-max-inline-size`              | `65ch`; `lr-prose` and `lr-max-inline-prose` measure                         |
| `--lr-prose-flow-space`                   | `--lr-space-l`; flow spacing between direct blocks of `lr-prose` and `lr-typography`; the space before an `lr-typography` heading is twice this value |
| `--lr-prose-quote-padding`                | `--lr-space-l`; logical quote inset in `lr-prose` and `lr-typography`        |
| `--lr-prose-quote-border-width`           | `--lr-border-width-thick` in `lr-prose`, `--lr-border-width-medium` in `lr-typography`; logical quote edge |
| `--lr-heading-letter-spacing`             | `--lr-theme-heading-letter-spacing`, then `normal`; heading tracking for `lr-heading-1`–`4` and `lr-typography` headings |
| `--lr-theme-heading-letter-spacing`       | unset; theme input for heading tracking (no resolved `--lr-*` token); `themes/shadcn.css` sets it |
| `--lr-visually-hidden-size`               | `--lr-size-1px` (1px); retained hidden box size                              |
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

### Composing looks, surfaces and density

The independent style API is exported from `@aceshooting/lyra-ui/theme.js`.
A scope selects one look, one surface, one density, one mode and one accent. These choices compose:
shadcn with glass and compact density is valid. Selecting another look replaces that scope's look;
it does not stack two competing look definitions.

```js
import '@aceshooting/lyra-ui/theme.css';
import '@aceshooting/lyra-ui/looks/shadcn.css';
import '@aceshooting/lyra-ui/looks/material.css';
import '@aceshooting/lyra-ui/density.css';
import '@aceshooting/lyra-ui/surfaces/glass.css';
import '@aceshooting/lyra-ui/accents.css';
import { setLyraStyle, resetLyraStyle, applyLyraStyleScope } from '@aceshooting/lyra-ui/theme.js';

setLyraStyle({ look: 'shadcn', mode: 'system', accent: 'sapphire' });
setLyraStyle({ surface: 'glass' }); // keeps the other choices
applyLyraStyleScope(tableRegion, { density: 'compact' }); // other axes inherit
applyLyraStyleScope(previewRegion, { look: 'material', mode: 'dark' });
resetLyraStyle(['look']); // restores the Lyra look, retaining the other fields
applyLyraStyleScope(tableRegion, null); // restores the element's previous authored values
```

`setLyraStyle()` merges omitted fields and persists the whole-page selection. `null` resets a field.
`applyLyraStyleScope()` replaces the element's complete selection: omitted fields inherit. It neither
persists nor dispatches global events. Author changes made after the helper's last write are preserved
when the scope is cleared. `getLyraStyle()` reports requested axes and the resolved mode.

Each attribute can also be authored directly: `data-lr-look`, `data-lr-surface`, `data-lr-density`,
`data-lr-mode` and `data-lr-accent`. A stylesheet look id requires its stylesheet; setting an arbitrary
id does not load or register a look. Use `defineLyraLook({ id, tokens })` for a validated, immutable
runtime definition, then pass it as `look`. `lyraLookCss()` from `theme/look-css.js` produces the
stylesheet form without accessing the DOM. Install `theme.css` and the selected optional sheets in
an application-owned shadow root that contains its own style boundaries; document selectors do not
cross shadow roots. Inherited values do cross them.

For design-tool interchange, `@aceshooting/lyra-ui/design-tokens.json` includes
`$extensions['com.aceshooting.lyra.looks']` with `schemaVersion: 1`, `base: 'lyra'`, and a
`definitions` map for the shipped looks, including `lyra`, `material`, `shadcn`, `data`, `terminal`
and `high-contrast`. Each entry is a portable `{ id, tokens }`
definition accepted by `defineLyraLook()`. Sparse and null branches remain sparse; omitted values
come from the canonical base token tree, and the empty Lyra definition restores that base. Load the
artifact explicitly only in tooling or flows that need it; ordinary components do not import it.

### Documentation theme builder

The optional [theme builder](https://www.lyra-ui.com/docs/?path=/story/theming-theme-builder--editor)
composes existing style APIs and portable token maps. It previews both modes, supports individual
and complete resets, and edits contrast/motion preferences, local-font pairing, shape, elevation
and categorical/sequential/diverging palettes. The editor is documentation code, not a package
entry point or a new custom element; importing components never imports the builder.

Import/export uses the existing `LyraLook`, `LyraThemeTokens`, version-2 saved style record and
`LyraPreferences` formats. Preferences remain separate from the saved style record. Runtime look
tokens are retained explicitly; `getLyraStyle()` snapshots alone do not contain those tokens.
Imports validate atomically, are bounded to 256 KiB, and reject network-bearing or executable CSS.
Errors leave the last valid preview intact. A group reset removes that group's writes; resetting
one token to its look value removes it from every override group.

Exported look CSS comes from `lyraLookCss()` and requires `theme.css`, the selected optional sheets
and axis attributes. It is not an export of every axis or preference. Use the complete runtime
recipe for custom accent derivation, or the separate style/preference files to retain those choices.
Server-rendered attributes use `lyraStyleAttributes()` and `lyraPreferenceAttributes()`; system mode
is not falsely resolved on the server. Install the required CSS in each application-owned shadow
root that contains a local style boundary.

Diagnostics describe measured specimen colors and states, not universal accessibility
certification. Unknown/dynamic backgrounds remain unmeasured. Chart series keep text and non-color
cues; color-vision simulation does not replace them. Font availability, physical blur and native
platform accessibility settings still require evidence on the relevant platform.

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

Runtime custom accents, including `setLyraTheme({ accent })` and legacy gemstone presets, now
floor the loud fill to 4.5:1 against its quiet fill and the built-in reference surfaces because the
same token paints accent text. Its on-loud foreground follows the corrected fill. For example,
light shadcn emerald changes from `#34d399` with black on-loud text to `#1a6a4d` with white text
(6.537:1). Checked controls, brand text and streaming accents follow that loud token; secondary
neutral controls stay unchanged. The requested and persisted accent color is retained.

The compatibility `setLyraTheme()` API shares the same stored selection. Its `surface` remains an
accent reference color (the new API calls that `accentBackground`), and its `auto` mode corresponds
to `system`. A stored legacy CSS color such as `aquamarine` stays that color; it is not silently
converted into the gemstone of the same name. `parseLyraStyleRecord()` and `lyraStyleAttributes()`
provide DOM-free server-rendering helpers. Render attributes through the framework's normal HTML
escaping; the returned object is not an HTML string.

Glass is a treatment for eligible navigation and floating chrome. It does not make content panels,
forms, charts or dialogs translucent. Unsupported blur, reduced transparency, increased contrast and
forced colors retain solid fills. Solid surfaces use `backdrop-filter: none`; forced colours paint
`Canvas`. Offer a solid choice wherever the application offers glass, since reduced-transparency
media-query support varies between browsers.

Regular glass defaults to 90% opacity, with a 90% minimum and a 12px blur clamped to 16px.
Quiet text, necessary control edges, focus indicators and transparent actions gain a local
contrast-qualified foreground; opaque accent fills retain their own on-colours. Supported chrome
includes app rails, navigation menus, menubars, menus and their context-menu composition, popovers,
selection toolbars, toast items and the owned playback-rate toolbar of `lr-av-player`. Nested glass
chrome is opaque, preventing repeated blur. Content cards and modal dialogs remain solid.
Scrolling rail, popover and selection-toolbar surfaces keep a stationary decorative blur layer;
the public surface continues to own scrolling, focus and author overflow hooks.

`lr-av-player` additionally offers `controls-surface="clear"`, restricted to its owned toolbar and
backed by its own dark gradient scrim. It requires the glass stylesheet for translucency; without
that stylesheet it retains an opaque scrim. Native audio/video controls stay browser-owned.
