---
"@aceshooting/lyra-ui": minor
---

`lr-heatmap` gains a `legendStops` property so the built-in legend can describe a custom
`cellColor` domain. Because `cellColor` overrides a cell's color entirely, the legend's
`--lr-heatmap-scale-lo`/`-hi` gradient bar could describe a ramp the grid no longer used, leaving a
consumer to hide `::part(legend)` and hand-roll swatches.

`legendStops: HeatmapLegendStop[]` (`{ value, color, label? }`, `attribute: false`) renders a
discrete key **instead of** that gradient bar — one `[part="legend-stop"]` per entry in array order,
each a `[part="legend-swatch"]` in the entry's color plus a `[part="legend-stop-label"]`. Labels
default to the component's own locale-aware numeric formatting of `value`, so an explicit `label` is
only needed when the number isn't the right caption. `[part="legend-lo"]`/`[part="legend-hi"]` and
the bar are omitted while stops are supplied; labeled `annotations` still render their
`[part="legend-annotation"]` entries alongside them.

The stops are presentation only — they never feed back into the color ramp, the bucket math, the
tooltip or the accessible name. Left unset (or empty), the legend renders exactly as before.
