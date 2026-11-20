---
'@aceshooting/lyra-ui': patch
---

- `lr-spreadsheet-viewer` with a `dataSource` reads a revealed sheet's first rows once: a search hit or anchor on another sheet no longer re-reads that sheet's opening window while its list scrolls to the target.
- `lr-xml-viewer` and `lr-json-viewer` keep their single tree tab stop without copying the tree's controls into a new array after every render.
