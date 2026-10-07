---
"@aceshooting/lyra-ui": patch
---
lr-csv-viewer, lr-dataset-viewer, lr-spreadsheet-viewer: `highlights` are resolved once per change instead of for every rendered row on every scroll frame, and at most 1,000 are painted (the active one always included), like the other viewers.
