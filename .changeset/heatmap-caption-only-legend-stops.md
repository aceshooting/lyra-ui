---
"@aceshooting/lyra-ui": minor
---

`<lr-heatmap>`: `HeatmapLegendStop.color` is now optional, so a `legendStops` entry can be a
**caption-only** stop. A stop with no `color` (or an empty-string `color`) renders its
`[part="legend-stop-label"]` with **no `[part="legend-swatch"]` element in the DOM at all**, rather
than an empty 0.6rem swatch box — the shape a GitHub-style "Less ▢▢▢▢ More" key needs for the bare
captions bracketing its colored ramp. Colored stops are unchanged, and an all-colored `legendStops`
array renders exactly as before.

The trailing `valueLabel` caption that closes the legend row also gained
`part="legend-value-label"` (it was the one unaddressable node in `[part='legend']`), in both the
gradient and the `legendStops` branch. Nothing else in the legend markup changed.
