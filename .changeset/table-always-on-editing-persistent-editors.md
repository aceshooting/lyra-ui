---
"@aceshooting/lyra-ui": minor
---

`lr-table`: widen `TableColumn.editable` to `boolean | 'always'`. `true` keeps today's
double-click-to-open editor unchanged; the new `'always'` renders a persistent editor in every body
cell of that column from first paint, for settings/rate-style grids where double-clicking each cell
to change a value is the wrong interaction. Persistent editors are plain tab stops (no `tabindex` of
their own), exactly like the existing row-expand toggle, so the roving header/row tabindex model is
untouched; each one keeps its individually interpolated `tableEditCell` accessible name, and
double-clicking an `'always'` cell no longer opens a second, competing editor inside it.
