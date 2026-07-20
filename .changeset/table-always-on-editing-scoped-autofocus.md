---
"@aceshooting/lyra-ui": patch
---

`lr-table`: focus the cell editor that was actually just opened by a double-click. The autofocus
looked up `[part="cell-editor"]` across the whole grid and focused whichever one came first in the
DOM — indistinguishable from correct while only one editor could ever exist at a time, but wrong as
soon as a column renders persistent (`editable: 'always'`) editors of its own. It is now scoped to
the opening cell's own row and column.
