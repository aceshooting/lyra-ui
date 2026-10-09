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
