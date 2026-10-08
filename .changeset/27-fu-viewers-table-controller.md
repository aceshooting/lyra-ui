---
'@aceshooting/lyra-ui': patch
---

`lr-csv-viewer`, `lr-dataset-viewer` and `lr-spreadsheet-viewer` share one table-viewer controller, and `lr-docx-viewer`/`lr-pdf-viewer` share one search-state helper; `lr-archive-viewer`, `lr-html-viewer` and `lr-svg-viewer` adopt the shared viewer frame styles. No public API or rendered output changes.
