---
"@aceshooting/lyra-ui": minor
---

Add `<lyra-swatch-picker>`, a single-select picker over a small, fixed set of color swatches — the row-of-round-accent-color-buttons pattern apps hand-roll, generalized into a first-party component. It carries the WAI-ARIA APG `radiogroup` contract (`role="radiogroup"`/`role="radio"`, roving tabindex, automatic activation on click or arrow-key move, cyclic Arrow/Home/End navigation), takes an `options: { value; color; label }[]` array plus a controlled `value`, and emits `lyra-change` (`detail: { value }`) only when the selection actually changes. It is distinct from `<lyra-color-picker>`'s freeform native color input: this picks exactly one of N designer-chosen named colors.

Notable design choice: the selection ring uses a dedicated `--lyra-swatch-picker-selected-color` token (defaulting to `--lyra-color-brand`) so it retheme independently of the focus ring, mirroring `<lyra-heatmap>`'s `--lyra-heatmap-selected-color`; each swatch's fill comes from its option's `color`, applied through a per-swatch custom property so a consumer's `::part(swatch)` background rule can still override it.
