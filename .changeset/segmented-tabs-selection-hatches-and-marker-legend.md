---
"@aceshooting/lyra-ui": minor
---

Selected-state styling hooks for `lr-segmented` and `lr-tabs`, an exact-height hatch for the
`lr-segmented` track, and a marker legend row for `lr-sequence-strip`.

- `lr-segmented` gains `--lr-segmented-selected-bg`, `--lr-segmented-selected-color`,
  `--lr-segmented-selected-font-weight`, `--lr-segmented-selected-shadow` and
  `--lr-segmented-hover-color`. Recoloring the checked pill previously required hijacking
  library-wide `--lr-color-surface`/`--lr-color-text`, which necessarily repainted hovered
  *unselected* segments too (they read the same tokens); `::part(segment)[aria-checked='true']` is
  not valid CSS, so there was no other route. The hover color is now its own hook, so the two states
  are independent.
- `lr-segmented` also gains `--lr-segmented-track-height`, pinning the track to an exact height at
  every `size` tier for a row that must line up with a hard-sized toolbar control. It is genuinely
  unset by default, so each tier keeps its `--lr-segmented-track-min-height` floor until you set it.
- `lr-tabs` gains `--lr-tabs-selected-color`, `--lr-tabs-indicator-color` and
  `--lr-tabs-hover-color` for the same reason: the selected tab's text/underline and the hovered
  tab's text no longer share `--lr-color-brand`/`--lr-color-text` with the rest of the library.
- `lr-sequence-strip` gains `markerLabel` (`marker-label`). When set alongside `show-legend` it adds
  one trailing legend row — `[part="legend-marker-swatch"]`, a neutral chip (themeable via the new
  `--lr-sequence-strip-legend-marker-bg`) carrying the cell's own bottom bar in
  `--lr-sequence-strip-marker-color` — and the marker's count joins the strip's auto-generated
  `aria-label` summary, so the visual legend keeps no entry without a spoken counterpart.

Every new custom property is an inline `var()` fallback resolving to the token the rule already
used, so an unset consumer renders exactly as before.
