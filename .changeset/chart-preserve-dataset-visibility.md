---
"@aceshooting/lyra-ui": patch
---

Fix `lyra-chart` losing a user's legend-toggled hidden-dataset state on every data-driven redraw --
`draw()` now snapshots each dataset's `isDatasetVisible()` state before reassigning `chart.data` and
restores it via `setDatasetVisibility()` afterward, since Chart.js's own dataset-object identity
changes on every reactive update from a live-polling consumer.
