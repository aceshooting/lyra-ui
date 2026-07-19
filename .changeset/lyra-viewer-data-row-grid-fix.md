---
"@aceshooting/lyra-ui": patch
---

Fixed `lr-csv-viewer` and `lr-spreadsheet-viewer`: data rows rendered as unstyled stacked text
instead of a proper grid, because their styling lived in a `[part='data-row']`/`[part='cell']`
CSS selector scoped to the wrong shadow root (data rows render inside the nested
`<lr-virtual-list>`'s own shadow tree via its `renderItem` callback, not the viewer's own). Only
the header row, rendered directly by the viewer, was ever actually styled. Fixed with
`lr-virtual-list::part(data-row)`/`::part(cell)` rules that correctly reach across that shadow
boundary.
