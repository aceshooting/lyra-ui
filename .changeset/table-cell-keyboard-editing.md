---
"@aceshooting/lyra-ui": minor
---

`<lr-table>`'s `editTrigger: 'double-click'` inline cell editor is now reachable by keyboard, closing
a WCAG 2.1.1 gap: a `'double-click'` column's resting cell is its own `tabindex="-1"` roving-focus
stop, reachable with ArrowRight/ArrowLeft once the row itself has focus, and `F2` or `Enter` on that
focused cell opens its editor exactly as a double-click would. `Enter` on the row itself still only
activates the row. Closing the editor, by commit or by cancel, returns focus to the cell that opened
it. A new public `editCell(rowKey, columnKey)` method opens the same editor programmatically, for a
consumer's own key binding or menu action. A table with no `editTrigger: 'double-click'` column
renders byte-identical markup. `TableColumn.cell` is now optional for an `editTrigger: 'always'`
column, whose persistent editor renders unconditionally and never falls back to it; every other
column still requires `cell`.
