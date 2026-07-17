---
"@aceshooting/lyra-ui": minor
---

`lyra-table` gains heat-tint mode: a per-column `heatValue(row)` accessor drives a `color-mix()`-based
cell background computed from a shared min/max scale across the whole grid (auto-derived from the
data, or overridden via the new `heatTintScale` property), matching `lyra-heatmap`'s own
`--lyra-heatmap-scale-lo`/`-hi` ramp-token convention via new `--lyra-table-heat-tint-lo`/`-hi` custom
properties. Previously a consumer needing a value-driven cell background had to hand-compute a color
string themselves via the existing `cellStyle` escape hatch.
