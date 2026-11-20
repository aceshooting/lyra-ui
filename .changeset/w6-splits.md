---
'@aceshooting/lyra-ui': patch
---

- Internal restructuring of `lr-heatmap`, `lr-chart`, `lr-data-grid`, `lr-table` and `lr-document-library`: configuration, pure helpers and rarely used modes moved into colocated modules. Public properties, events, parts, slots and exported types are unchanged.
- `lr-heatmap` matrix-source mode and `lr-chart` spatial mode now load their interaction code together with the existing lazy source modules, so the initial route of a heatmap or chart without those sources is smaller.
