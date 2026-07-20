---
"@aceshooting/lyra-ui": minor
---

Make the focus-ring and icon-button-size tokens themeable from an ancestor, and fill out
`theme.css` with the inputs it was missing.

`--lr-focus-ring-width`, `--lr-focus-ring-offset` and `--lr-icon-button-size` were the only
three tokens declared as bare literals instead of chaining through a `--lr-theme-*` input.
That made them the only tokens genuinely unreachable for subtree theming: a `--lr-*` token is
re-declared on **every** `LyraElement`'s `:host`, so a value set on an ancestor is shadowed at
the first intervening lyra host and never reaches anything nested inside it. `--lr-theme-*`
inputs are declared only at `:root` (in `theme.css`) and never in component shadow styles, so
they *do* inherit through nested shadow roots — which is why the bridge is the supported route.
The three tokens now read `--lr-theme-focus-ring-width`, `--lr-theme-focus-ring-offset` and
`--lr-theme-icon-button-size`, with their existing values as fallbacks, so nothing renders
differently by default.

Keep a resolved `--lr-theme-icon-button-size` at or above 24px: it backs the hit area of
`lr-date-input`, `lr-combobox`, `lr-input` and `lr-select`, and anything smaller fails
WCAG 2.2 SC 2.5.8 (Target Size (Minimum)).

`src/theme.css` also gains the type scale, spacing scale, stacking layers, chart palette,
the 16 ANSI terminal slots, the raised surface and both overlay scrims as real inputs — every
one set to the exact value it already fell back to, so importing the sheet changes no computed
value. Two fixes came with that:

- `.lr-dark` never set `--lr-theme-color-surface-raised`, so a `.lr-dark` page rendered raised
  surfaces at the light `#f6f8fa` while `prefers-color-scheme: dark` rendered them at `#22272e`.
  The dark block now mirrors the raised surface and the eight chart colors.
- `--lr-color-overlay` and `--lr-color-overlay-strong` both read a single
  `--lr-theme-color-overlay` input, so defining that input flattened the strong scrim's `0.92`
  onto the plain scrim's value. `--lr-color-overlay-strong` now has its own
  `--lr-theme-color-overlay-strong` input, chained through the old one so a theme that sets only
  `--lr-theme-color-overlay` still tints both exactly as before.
