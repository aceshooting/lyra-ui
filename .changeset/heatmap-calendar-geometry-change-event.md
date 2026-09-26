---
"@aceshooting/lyra-ui": minor
---

`lr-heatmap` calendar mode now fires `lr-calendar-geometry-change` whenever the painted `calendarGeometry` snapshot changes (e.g. after `cellGapX`/`cellGapY`/`cellRadius` changes or a `fitToWidth` resize), mirroring matrix mode's `lr-matrix-geometry-change`. This closes the parity gap that made aligning a sibling chart with a calendar harder than with a matrix: a consumer no longer has to poll `calendarGeometry` on its own resize cadence.
