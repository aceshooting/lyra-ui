---
"@aceshooting/lyra-ui": minor
---

Added `lr-chart` (and every chart tag built on it -- `lr-bar-chart`, `lr-line-chart`,
`lr-scatter-chart`, `lr-bubble-chart`, `lr-pie-chart`, `lr-doughnut-chart`, `lr-radar-chart`,
`lr-polar-area-chart`, `lr-histogram`) three additive surfaces so a mixed dashboard chart no longer
needs to drop to raw Chart.js: `LyraChartSeries.stack` (a per-series Chart.js dataset `stack` group
id -- two groups on the same stacked axis are summed independently and drawn side by side);
`stackedAxes` (a per-value-axis override of `stacked`, so a stacked bar series on the primary axis
can sit next to an unstacked overlay series on `y2`); and `tooltipTitleFormatter`/
`tooltipFooterFormatter` (tooltip title/footer hooks receiving every hovered item's context at
once, in the same `LyraChartFormatterContext` shape `formatter`'s `'tooltip'` surface already
produces). `computeStackTotals()` is now computed per stack group as well as per axis, and the
canvas `stack-totals` data-label draws once per (axis, group) rather than once per axis. All three
additions are opt-in and unset by default: a chart that only sets the legacy `stacked` boolean
renders byte-identically to before. `lr-lite-chart` has no counterpart for any of the three --
documented as a deliberate omission (its single-value-scale, single-stack SVG bar-geometry model
and native per-mark `<title>` tooltip have no equivalent shape for a second value axis, a
per-series stack group, or a multi-item tooltip title/footer) rather than implemented.
