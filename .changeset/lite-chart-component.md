---
"@aceshooting/lyra-ui": minor
---

Added `<lyra-lite-chart>` — a dependency-free bar/line chart (plain SVG/DOM rendering, zero peer
dependencies) for projects whose architecture forbids a charting dependency outright. Covers
grouped/stacked bars, multi-series lines, per-point click (`lyra-point-click`, same detail shape as
`lyra-chart`'s), and hover tooltips via native SVG `<title>`. Not a full `lyra-chart` replacement —
no zoom/pan, no pie/doughnut/radar/scatter/bubble types, no horizontal/dual-y-axis, no raw-config
passthrough. Reuses `lyra-chart`'s `--lyra-chart-*` theme token names for free cross-component
theming.
