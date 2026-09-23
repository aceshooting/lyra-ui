---
'@aceshooting/lyra-ui': major
---

`lr-xml-viewer`'s `source`, `lr-pdf-viewer`'s and `lr-pptx-viewer`'s `pageViewerSnapshot`, and `lr-heatmap`'s `matrixGeometry` now accept a documented no-op setter, matching `lr-chart.chartArea` and `lr-notebook-viewer.source`: a lit-html property binding (`.source=${x}`, `.pageViewerSnapshot=${x}`, `.matrixGeometry=${x}`) on these read-only, derived properties no longer throws from inside lit-html's property-commit machinery. The getter's value and type are unchanged. Migration: no consumer action required; a template that was avoiding these bindings defensively may use them, and the assignment remains a silent no-op.
