---
'@aceshooting/lyra-ui': minor
---

`lr-lite-chart` no longer fits axis titles and category labels against stale pre-render geometry inside its `ResizeObserver` callback, removing a redundant, doubled layout pass on every resize. `lr-heatmap.exportData()` gains a `'csv'` format alongside `'png'`, matching `lr-chart`/`lr-lite-chart`/`lr-box-plot`. `lr-chart`, `lr-lite-chart` and `lr-box-plot`'s `[part='base']` now stretches to fill a CSS-Grid- or flex-stretched host instead of leaving blank space below the plot. `lr-box-plot` gains an `xLabel` property for its category axis, mirroring the existing `yLabel`. `lr-heatmap` and `lr-flag` now gate their diagnostic `console.warn` calls behind the shared development-mode signal, so they no longer log in production.
