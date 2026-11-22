# Native styles and CSS utilities

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
[`tokens-root.css`](./styles-and-tokens.md#reading-the-resolved-tokens-from-your-own-components--tokens-rootcss), is not a
style sheet in the same sense — it declares custom properties only: the document token layer that
the first connected Lyra element would otherwise adopt, available before any component connects.

### Utility class inventory

| Group                       | Exact classes                                                                                                                                                     |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Display and composition     | `lr-block`, `lr-inline-block`, `lr-flex`, `lr-inline-flex`, `lr-grid`, `lr-flow-root`, `lr-stack`, `lr-cluster`, `lr-grid-auto`                                   |
| Static 12-column grid       | `lr-grid-12`, `lr-span-1` – `lr-span-12`, `lr-row-span-2` – `lr-row-span-4`                                                                                         |
| Flex direction and wrapping | `lr-row`, `lr-column`, `lr-wrap`, `lr-wrap-reverse`, `lr-nowrap`, `lr-grow`, `lr-grow-0`, `lr-shrink`, `lr-shrink-0`                                                                 |
| Item alignment              | `lr-items-start`, `lr-items-center`, `lr-items-end`, `lr-items-stretch`, `lr-items-baseline`, `lr-self-baseline`, `lr-self-start`, `lr-self-center`, `lr-self-end`, `lr-self-stretch` |
| Distribution                | `lr-justify-start`, `lr-justify-center`, `lr-justify-end`, `lr-justify-between`, `lr-justify-around`, `lr-justify-evenly`                                                              |
| Gaps                        | `lr-gap-0`, `lr-gap-2xs`, `lr-gap-xs`, `lr-gap-s`, `lr-gap-m`, `lr-gap-l`, `lr-gap-xl`, `lr-gap-2xl`, `lr-gap-3xl`, `lr-gap-4xl`                                  |
| Compositions                | `lr-flank`, `lr-flank-end`, `lr-split`, `lr-split-column`, `lr-frame`, `lr-frame-square`, `lr-frame-landscape`, `lr-frame-portrait`, `lr-span-grid`, `lr-container` |
| Plain-element helpers       | `lr-link-plain`, `lr-list-plain`, `lr-placeholder`, `lr-scroll-lock`, `lr-cloak`                                                                                  |
| Radius and case             | `lr-radius-none`, `lr-radius-xs`, `lr-radius-m`, `lr-radius-container`, `lr-radius-pill`, `lr-radius-circle`, `lr-uppercase`, `lr-lowercase`, `lr-capitalize`, `lr-normal-case` |
| Variant and size            | `lr-neutral`, `lr-brand`, `lr-success`, `lr-warning`, `lr-danger`; `lr-size-2xs`, `lr-size-xs`, `lr-size-s`, `lr-size-m`, `lr-size-l`, `lr-size-xl` (`lr-size-full` stays the 100% box) |
| Logical sizing              | `lr-inline-full`, `lr-block-full`, `lr-size-full`, `lr-min-inline-0`, `lr-min-block-0`, `lr-max-inline-full`, `lr-max-inline-prose`, `lr-center`                  |
| Overflow                    | `lr-overflow-auto`, `lr-overflow-hidden`                                                                                                                          |
| Text alignment and size     | `lr-text-start`, `lr-text-center`, `lr-text-end`, `lr-text-justify`, `lr-text-xs`, `lr-text-sm`, `lr-text-base`, `lr-text-lg`, `lr-text-xl`, `lr-text-2xl` – `lr-text-5xl`, `lr-text-quiet`                         |
| Font                        | `lr-font-normal`, `lr-font-medium`, `lr-font-light`, `lr-font-semibold`, `lr-font-bold`, `lr-font-mono`, `lr-tabular-nums`                                                                            |
| Table rows                  | `lr-zebra-rows`, `lr-hover-rows` (on the `table`; tint `tbody` rows from `--lr-color-text` and `--lr-color-mix-hover`)                                          |
| Text flow                   | `lr-text-break`, `lr-text-nowrap`, `lr-truncate`, `lr-text-balance`, `lr-text-pretty`, `lr-prose`                                                                 |
| Typography                  | `lr-typography`, `lr-not-typography`, `lr-heading-1`, `lr-heading-2`, `lr-heading-3`, `lr-heading-4`, `lr-heading-5`, `lr-heading-6`, `lr-inline-code`                                           |
| Visibility and focus        | `lr-visually-hidden`, `lr-visually-hidden-focusable`, `lr-fouce-hidden`, `lr-hidden`                                                                              |
| Page allocation             | `lr-page-mobile-only`, `lr-page-desktop-only`                                                                                                                     |

`lr-grid-12` lays its direct children on 12 equal tracks for static tile dashboards; use
`lr-dashboard-grid` when users rearrange or resize tiles. A child with `lr-span-n` spans n tracks
and `lr-row-span-n` spans n rows. The grid is its own inline-size container and responds to its
allocated width, not the viewport: below 56rem spans count on a 6-column grid (`lr-span-3` takes half
the row, `lr-span-6` and wider the full row, an unspanned child one sixth), and below 32rem every
child takes the full row and a single row track. Container query conditions cannot read custom
properties, so these two widths are fixed. Source order is reading order at every width.

```html
<section class="lr-grid-12">
  <lr-card class="lr-span-8 lr-row-span-2">Revenue</lr-card>
  <lr-card class="lr-span-4">Orders</lr-card>
  <lr-card class="lr-span-4">Refunds</lr-card>
  <lr-card class="lr-span-12">Recent activity</lr-card>
</section>
```

### Compositions and small utilities

All spacing here reads `--lr-layout-gap` (default `--lr-space-m`).

- **`lr-flank` / `lr-flank-end`** — a flex row where the first (or, for `-end`, the last) child keeps
  its own width (`--lr-flank-inline-size`, default `auto`) and the other fills the rest. The filling
  child wraps onto its own row below `--lr-flank-content-min-inline-size` (default `50%`).
- **`lr-split` / `lr-split-column`** — items pushed to the two ends of a wrapping row, or of a
  column. Logical, so the ends swap under `dir="rtl"`.
- **`lr-frame`, `lr-frame-square` (1/1), `lr-frame-landscape` (16/9), `lr-frame-portrait` (3/4)** —
  a clipped aspect-ratio box; a direct `img`, `picture`, `video`, `canvas`, `svg` or `iframe` child
  fills it with `object-fit: cover`. A bare `lr-frame` reads `--lr-frame-ratio` (default `1 / 1`).
- **`lr-span-grid`** — takes the whole row of its grid parent, including inside `lr-grid-12` at every
  container width. **`lr-container`** makes an element an inline-size query container.
- **`lr-link-plain`** — inherited colour, no underline until hover. **`lr-list-plain`** — no
  marker, no indent, no margin (an `ul`/`ol` that keeps `role="list"` stays announced as a list).
- **`lr-placeholder`** — a quiet neutral block (`--lr-placeholder-block-size`, default `1em`) that
  pulses only when `prefers-reduced-motion: no-preference`.
- **`lr-radius-*`** read the radius tokens; `lr-radius-circle` is `50%`. **`lr-uppercase`,
  `lr-lowercase`, `lr-capitalize`, `lr-normal-case`** set `text-transform`.
- **Variants** `lr-neutral|brand|success|warning|danger` (the `variant` vocabulary) colour the
  element's text and native-control accent with that tone's loud fill and publish
  `--lr-variant-fill-quiet`, `--lr-variant-fill-loud`, `--lr-variant-on-quiet` and
  `--lr-variant-border` for your own rules. **Sizes** `lr-size-2xs … lr-size-xl` (the `size` ladder;
  `small`/`medium`/`large` spellings are not classes) set the type size and scale the native control
  block size and padding that `.lr-native` reads.
- **`lr-scroll-lock`** is pure CSS (`overflow: hidden`, `overscroll-behavior: contain`, plus a stable
  scrollbar gutter on `html`). Put it on `html`, `body` or a scroll container. It is independent of
  the lock a modal component takes: both can be active, and the component's lock sees the stable
  gutter and adds no padding.
- **`lr-cloak`** on `html`/`body` (or any root) hides the root with `visibility: hidden` while any
  custom element beneath it still matches `:not(:defined)`, then reveals it as soon as they are
  all defined. It fails open: after `--lr-cloak-timeout` (default `3s`) the root becomes visible
  regardless, so a script that never loads cannot leave a blank page. The fail-open is a
  visibility switch, not motion, so it needs no reduced-motion branch. Only light-DOM descendants
  are seen; for a single element use `lr-fouce-hidden`.

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
`--lr-*` tokens exist at document scope once a Lyra element has connected or `tokens-root.css` is
loaded; the chain covers the moment before):

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
   child, `lr-prose` applies on its own. Plain `lr-prose` output is unchanged.
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
| Tracking              | `normal` unless the hook or theme input sets it; `looks/shadcn.css` sets -0.025em | tight              |
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

Layer order cannot protect a component's own host box. Any page rule that matches the element
outranks the `:host` rule inside its shadow root, whatever layer either sits in, so a reset's
`* { margin: 0; padding: 0; border: 0 solid }` strips the panel padding and border of
`<lr-callout>`, the border of `<lr-zoomable-frame>` and of a standalone `<lr-menu>`, and the
viewport gutter of `<lr-dialog>`, `<lr-lightbox>`, `<lr-tool-approval-dialog>`,
`<lr-tool-result-dialog>` and `<lr-tool-select-dialog>`. Roll those three properties back inside the
reset's **own** layer; `revert-layer` there returns each host to the component's defaults while your
later-layer or unlayered rules still win:

```css
/* after the reset, in the same layer */
@layer base {
  :where(lr-callout, lr-zoomable-frame, lr-menu, lr-dialog, lr-lightbox, lr-tool-approval-dialog,
    lr-tool-result-dialog, lr-tool-select-dialog) {
    margin: revert-layer;
    padding: revert-layer;
    border: revert-layer;
  }
}
```

The same rule in a later layer, or unlayered, does not work: it reverts only to the reset's value.

### Bundle-specific override hooks

The bundles consume the ordinary shared color, typography, spacing, border, radius, focus, size,
and opacity tokens first. These additional hooks customize only the light-DOM bundle behavior:

| Hook                                      | Default/fallback and use                                                     |
| ----------------------------------------- | ---------------------------------------------------------------------------- |
| `--lr-layout-gap`                         | `--lr-space-m`; default gap for `lr-stack`, `lr-cluster`, `lr-grid-auto` and `lr-grid-12` |
| `--lr-grid-12-intrinsic-inline-size`      | `--lr-size-20rem`; placeholder inline size of an `lr-grid-12` container that sizes to its content, such as a flex item without a set width |
| `--lr-grid-min-inline-size`               | `--lr-size-14rem`; minimum auto-grid item inline size                        |
| `--lr-content-max-inline-size`            | `--lr-size-48rem`; `lr-center` content measure                               |
| `--lr-prose-max-inline-size`              | `65ch`; `lr-prose` and `lr-max-inline-prose` measure                         |
| `--lr-prose-flow-space`                   | `--lr-space-l`; flow spacing between direct blocks of `lr-prose` and `lr-typography`; the space before an `lr-typography` heading is twice this value |
| `--lr-prose-quote-padding`                | `--lr-space-l`; logical quote inset in `lr-prose` and `lr-typography`        |
| `--lr-prose-quote-border-width`           | `--lr-border-width-thick` in `lr-prose`, `--lr-border-width-medium` in `lr-typography`; logical quote edge |
| `--lr-heading-letter-spacing`             | `--lr-theme-heading-letter-spacing`, then `normal`; heading tracking for `lr-heading-1`–`4` and `lr-typography` headings |
| `--lr-theme-heading-letter-spacing`       | unset; theme input for heading tracking (no resolved `--lr-*` token); `looks/shadcn.css` sets it |
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


### Native navigation and floating chrome

The opt-in `.lr-surface-chrome` class uses the same protected Glass material as Lyra navigation,
menus and modal panels. It is shipped by `theme.css` for the built-in profile and by the separate
`surfaces/glass.css` asset for applications composing their own stylesheet set:

```css
@import "@aceshooting/lyra-ui/theme.css";
@import "@aceshooting/lyra-ui/tokens-root.css";
```

```html
<nav class="lr-surface-chrome" aria-label="Primary navigation">…</nav>
<section class="lr-surface-chrome" aria-labelledby="settings-title">
  <h2 id="settings-title">Settings</h2>
  <div class="settings-scrollport">…</div>
</section>
```

Localize the example's names. Keep the material wrapper non-scrolling and put overflow on an inner
scrollport. The decorative pseudo-element filters the backdrop without changing fixed descendant
coordinates. The wrapper reserves `::before` and supplies a low-specificity `position: relative`;
application fixed, sticky or absolute positioning still wins. Avoid an extra opaque wrapper inside
an already treated Lyra popup.

`--lr-surface-background` optionally supplies this native wrapper's base fill. It falls back to the
local high container surface, then the overlay surface, and resolves on the painted wrapper, so nearer
theme inputs work.
The existing `--lr-theme-surface-opacity`, `--lr-theme-surface-blur`,
`--lr-theme-surface-saturation` and `--lr-theme-surface-highlight` controls apply. Glass uses 60%
opacity by default, 12px blur with a 16px ceiling, and qualified text, edges and focus.
At opacity below 70%, dark Glass deepens the fill to keep light foregrounds readable against
bright backdrops; higher opacity keeps the selected fill color.
The public opacity input accepts 0–1; lower custom opacity may expose backdrops that need
stronger foreground contrast. Solid and accessibility preferences still force opaque fills.
Explicit `data-lr-surface="solid"`, unsupported backdrop filtering, reduced transparency, increased
contrast and forced colors retain opaque fills. Load `preferences.css` for explicit inherited
contrast/motion choices. Nested chrome suppresses repeated blur; independently presented top-layer
surfaces begin their own material root. Keep cards, data tables, charts, map layers and editing
fields outside the automatic chrome class.

#### Application fallback fills and cascade layers

Lyra paints the `.lr-surface-chrome` fill from a rule inside its cascade layers
(`lr-theme-preset.surface`). An **unlayered** application rule that sets `background` on the same
element — a generic `dialog { background: … }`, a `.panel` class — beats every layered rule
whatever its specificity, so the element keeps the application's opaque fill and the Glass
treatment disappears without a warning. No `revert-layer` workaround is needed; put the
application's fallback where it ranks below Lyra:

```css
/* 1. A low-priority application layer named before Lyra's. This order statement must be the first
      the browser sees: put it at the top of the entry stylesheet, before the theme.css import. */
@layer app-base, lr-base, lr-theme, lr-theme-preset, lr-utilities, lr-overrides;
@import "@aceshooting/lyra-ui/theme.css";

@layer app-base {
  dialog,
  .panel {
    background: #fff; /* still paints when the Lyra stylesheets are absent */
  }
}

/* 2. Or choose the chrome's base fill through its token; Glass mixes it at the surface opacity. */
.panel.lr-surface-chrome {
  --lr-surface-background: #fff;
}
```

An application layer declared after Lyra's (or unnamed until after `theme.css` loads) ranks above
the surface layer and disables Glass in the same way as an unlayered rule. Keep unlayered
`background` rules off `.lr-surface-chrome` elements, or exclude them with
`:not(.lr-surface-chrome)`. See [Cascade layers](styles-and-tokens.md#cascade-layers) for the full
order.


### Native control extensions

Inside `.lr-native`, `native.css` also styles: **checkbox, radio and range** (`accent-color` from the
brand token, a `--lr-native-check-size` box, hover shifts to the loud border tone); **colour and file
inputs** (control border and radius, a styled `::file-selector-button`, pointer cursor with hover);
**`progress` and `meter`** (a pill track of `--lr-native-meter-block-size`, brand bar, semantic
optimum/sub-optimum/even-less-good meter colours); **`details`/`summary`** (subtle bounded block, open
rule under the summary); **`dialog`** (overlay surface, container radius, `--lr-color-overlay` scrim);
**`mark`** (quiet warning fill and its paired foreground); and **lists** (`--lr-native-list-indent`
logical start inset, quiet markers). Disabled controls use `not-allowed`, every control shows the
shared focus ring, and `forced-colors: active` maps accents and bars to system colours. Dark mode
follows the tokens.

### Migrating Web Awesome and Shoelace classes and stylesheets

`lyra-ui-migrate` (no `--origin`) rewrites the upstream utility and theme classes that have a Lyra
counterpart, and only whole class tokens in class positions: `class`/`className` values,
`:class`, `[class]` and `[ngClass]` bindings, `className={...}`, `classMap()`, `classList.add/remove/
toggle/contains/replace()`, `.className =` and `setAttribute('class', ...)`. Selectors, prose, other
attributes and `${}`/`{{}}` interpolations are never read. A name the tool does not list is left alone,
because it is as likely your own class as an upstream one.

| Upstream | Lyra |
| -------- | ---- |
| `wa-stack`, `wa-cluster`, `wa-flank`, `wa-split`, `wa-frame` (with `:end`, `:column`, `:square`, `:landscape`, `:portrait`) | `lr-stack`, `lr-cluster`, `lr-flank`/`lr-flank-end`, `lr-split`/`lr-split-column`, `lr-frame`/`lr-frame-*` |
| `wa-grid`, `wa-span-grid` | `lr-grid-auto`, `lr-span-grid` |
| `wa-gap-<step>` | `lr-gap-<step>`, mapped by resolved length: the two spacing scales are offset by one step, so `wa-gap-m` (1rem) is `lr-gap-l` |
| `wa-align-items-*`, `wa-align-self-*`, `wa-justify-content-*`, `wa-flex-wrap`/`wa-flex-nowrap` | `lr-items-*`, `lr-self-*`, `lr-justify-*`, `lr-wrap`/`lr-nowrap` |
| `wa-text-*`, `wa-font-weight-*`, `wa-color-text-quiet`, `wa-link-plain`, `wa-list-plain`, `wa-prose`, `wa-visually-hidden`, `wa-cloak`, `wa-placeholder`, `wa-scroll-lock` | the same helper under `lr-`; see the inventory above |
| `wa-brand`, `wa-neutral`, `wa-success`, `wa-warning`, `wa-danger`, `wa-size-*` | `lr-brand`, `lr-neutral`, `lr-success`, `lr-warning`, `lr-danger`, `lr-size-*` |
| `wa-dark`, `wa-light`, `sl-theme-dark`, `sl-theme-light` | `lr-dark`, `lr-light` |

`wa-font-size-*`, `wa-body-*` and `wa-border-radius-s`/`-m` rewrite to the nearest class
(`lr-text-*`, `lr-radius-*`) and report `UPSTREAM_CLASS_APPROXIMATE_REVIEW`: the type and radius scales
are not value-aligned. `wa-heading-*`, `wa-caption-*`, `wa-longform-*`, the hue-pinned variants
(`wa-brand-blue`), `wa-theme-*`, the `native.css` opt-ins (`wa-button`, `wa-zebra-rows`, ...), the
`wa-form-control-*` classes and the gaps Lyra has no step for are reported as `UPSTREAM_CLASS_REVIEW`
with the nearest alternative and are not rewritten.

Stylesheet and loader imports (`import '...'` and CSS `@import`) map to real package subpaths:
`dist/styles/webawesome.css` becomes `theme.css`, `native.css` and `utilities.css`;
`styles/native.css`, `styles/utilities.css`, `styles/themes/default.css` and Shoelace
`themes/light.css`/`dark.css` become the matching one. `native.css` styles only inside `.lr-native`, and
`dark.css` is mode switching with `lr-dark`, so both carry an `UPSTREAM_ASSET_REVIEW` note. The
self-starting loaders (`webawesome.loader.js`, `shoelace-autoloader.js`) become
`@aceshooting/lyra-ui/autoloader-cdn.js` and, like the all-components entries (`webawesome.js`,
`shoelace.js`), are rewritten only when the scanned files have no manual uses left. `setBasePath` and
`utilities/base-path`, `layers.css`, the `awesome` and `shoelace` themes and the colour palettes have no
Lyra counterpart and are reported as `UPSTREAM_ASSET_REVIEW`.

### Hue palette

```css
@import "@aceshooting/lyra-ui/palette.css";
```

Declares static `--lr-color-<hue>-<step>` ramps on `:root` and every `[data-lr-theme-scope]`, for
hues `gray`, `red`, `orange`, `yellow`, `green`, `cyan`, `blue`, `purple` and `pink` and steps `05 10
20 30 40 50 60 70 80 90 95` (near-black to near-white). `gray`, `red`, `orange`, `green` and `blue`
are the neutral, danger, warning, success and brand tooling ramps; the others are the brand ramp
rotated in hue at the same lightness. The values do not change with light/dark mode: use them for
tags, charts, avatars and illustrations, and keep UI chrome on the semantic grid. To recolour the
semantic roles themselves, use `setLyraStyle({ accent: { success, warning, danger, neutral } })`.
