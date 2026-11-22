---
'@aceshooting/lyra-ui': patch
---

`lr-table` in stacked mode: the `caption` now spans the cards instead of wrapping into a narrow column, and a `cellStyle` that preserves white space (`pre`, `pre-wrap`) no longer opens a blank line before a cell's `cell-label` caption. Body cell content is now bound flush to the cell, so the same style no longer adds blank lines in grid mode either.
