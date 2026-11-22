---
'@aceshooting/lyra-ui': minor
---

Spacing and type scales grow: `--lr-space-xl`, `--lr-space-3xl`, `--lr-space-4xl`, `--lr-font-size-4xl`
and `--lr-font-size-5xl` (derived from the existing theme inputs, so density and re-theming carry
through). `utilities.css` adds `lr-gap-2xs`, `lr-gap-xl` to `lr-gap-4xl`, `lr-text-2xl` to
`lr-text-5xl`, `lr-heading-5`/`lr-heading-6`, the `lr-flank`, `lr-split`, `lr-frame-*`, `lr-span-grid`
and `lr-container` compositions, `lr-link-plain`, `lr-list-plain`, `lr-placeholder`, `lr-scroll-lock`,
a fail-open `lr-cloak`, radius and text-transform utilities, and variant (`lr-brand`, `lr-danger`, ...)
and size (`lr-size-2xs` to `lr-size-xl`) classes for plain elements. `native.css` now styles
checkbox, radio, range, colour and file inputs, `progress`, `meter`, `details`, `dialog`, `mark` and
lists inside `.lr-native`. The new opt-in `palette.css` declares static hue ramps
(`--lr-color-<hue>-<step>`).
