---
"@aceshooting/lyra-ui": minor
---

`<lr-table>` columns gain `editLabel?: (row: T) => string`, mirroring the existing `editValue`/
`cellTitle` row callbacks: when defined, it becomes the inline cell editor's accessible name for
that row instead of the interpolated `tableEditCell` default (`Edit {column}`). The default is
identical for every row in a column, which is adequate for `editTrigger: 'double-click'` (only one
editor is ever open at a time) but not for `editTrigger: 'always'`, where every row's editor is a
permanent, individually focusable Tab stop -- a 50-row column with no `editLabel` exposed 50
identically named controls to keyboard and screen-reader users (WCAG 2.4.6, 1.3.1). A column that
omits `editLabel` renders byte-identical output to before.
