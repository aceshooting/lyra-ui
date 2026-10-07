---
"@aceshooting/lyra-ui": patch
---
lr-csv-viewer, lr-dataset-viewer, lr-spreadsheet-viewer: `clearSearch()` no longer leaves the last match marked as the current row; lr-spreadsheet-viewer also keeps its query across a disconnect and re-runs it after reloading, like its siblings.
