---
"@aceshooting/lyra-ui": minor
---

Add themeable `--*-gap`/`--*-radius` CSS custom properties to `lr-input`, `lr-select`, and
`lr-combobox` (gap + radius), `lr-chip`/`lr-badge`/`lr-tag` (radius), and `lr-icon-button`
(radius) — extending the pattern `lr-button` already shipped, so these values can be retuned
without a `::part()` override. Every default is unchanged.
