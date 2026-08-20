---
"@aceshooting/lyra-ui": minor
---

Two consumer-filed `<lr-heatmap>` gaps:

- **`matrixGeometry` readback + `lr-matrix-geometry-change` event.** Matrix mode's resolved gutter/
  cell geometry (`padLeft`, `padTop`, `cellSize`) was entirely private, so a consumer building a
  sticky light-DOM header mirror for a tall matrix had to hardcode numbers that `row-label-width`/
  `col-label-height`'s `"auto"` resolution could silently change out from under them. `matrixGeometry`
  now exposes exactly what the last matrix-mode draw painted with (reusing the same internal getters
  `drawMatrix()` itself calls, so it can never disagree), and `lr-matrix-geometry-change` fires
  whenever a redraw actually changes it.
- **`HeatmapLegendStop.partOfRamp`.** The dev-mode ramp/legend-mismatch warning had no way to
  express a legend swatch that is intentionally outside `colorSteps` — e.g. a calendar heatmap's
  fixed neutral "no data" color shown alongside an N-step sequential ramp. Set `partOfRamp: false`
  on that stop to exclude it from the comparison; every other stop (and every existing consumer
  that never sets this) keeps today's exact behavior.
