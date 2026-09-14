---
"@aceshooting/lyra-ui": minor
---

`<lr-table>`: `columns[].editType` gains `'select'`, so a closed-set column (status, priority,
owner, ...) can use the built-in inline-editing path instead of hand-rendering a full `lr-select`
plus its options inside `cell()` for every row -- a workaround that mounted one live component per
rendered row and re-mounted on every filter change.

- `editType: 'select'` renders a native `<select>` in place of the existing text/number `<input>`,
  populated from the new `columns[].editOptions: { value: string; label: string }[]`, one
  `<option>` per entry in order. A column with no `editOptions` renders an empty, valueless
  `<select>` instead of throwing.
- The select editor reuses the existing `lr-cell-edit` event, `editTrigger: 'double-click'` /
  `'always'` lifecycle, and the documented Enter-commits / Escape-cancels key contract unchanged —
  no new event, no new trigger, and no general `renderEditor(row)` seam. Exactly one editor is
  still mounted at a time under `'double-click'`; a resting cell renders plain text with no control
  mounted at all, which is the whole point of routing a closed-set column through this path instead
  of `cell()`.
- Each select editor keeps the same interpolated `tableEditCell` accessible name (`Edit {column}`)
  as the text/number editors, and the same automatic focus-on-open behavior.
- Unlike the `'text'`/`'number'` editors, a persistent (`editTrigger: 'always'`) select editor does
  not protect an in-progress, uncommitted selection from an out-of-band `rows` update to that cell
  — `<select>`/`<option>` carry no native dirty-value flag the way `<input>` does.
