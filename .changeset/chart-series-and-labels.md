---
"@aceshooting/lyra-ui": minor
---

Round out the chart components so app code stops reaching into raw `config` passthrough.

- `data-labels` and `stack-totals` boolean attributes on `<lr-chart>` and its subclasses render
  value and stacked-total labels using themed tick colors and `--lr-font-*`, replacing hand-rolled
  `afterDatasetsDraw` painters with hardcoded colors. These require the new optional peer
  `chartjs-plugin-datalabels` (see the separate peer-dependency note); the plugin registers
  per chart instance, never globally.
- `Series.pointRadius` accepts an array for per-point sizing, and `Series.segmentColors` maps to
  Chart.js segment coloring.
- `seriesPalette()` is now public, so app code can read the resolved, dark-aware chart ramp instead
  of re-resolving `--lr-theme-color-chart-N` through `getComputedStyle` itself.
- Charts re-theme automatically via a shared `ThemeWatcher` controller when the ambient theme
  changes.
- `<lr-lite-chart>` renders a real `<table part="data-table">` screen-reader alternative when there
  is more than one series; the previous flat `<ul>` degenerated for multi-series data.
