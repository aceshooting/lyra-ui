---
'@aceshooting/lyra-ui': minor
---

`<lr-select>` and `<lr-combobox>` can show an out-of-list value as a re-selectable listbox row

A committed value that matches no option has always rendered on the trigger with a dashed "not in
catalog" badge — but it appeared nowhere in the listbox, so a user who opened the listbox had no
way back to the value they arrived with.

`show-unknown-option` appends that value to the end of the listbox as a synthetic, badged row: the
policy `<lr-model-select>` already ships. It is a real row, so it is keyboard-reachable, type-ahead
reachable and re-selectable, it toggles like any other row in `multiple` mode, and it disappears
the moment a real option claims the value. Off by default, because it adds a row to a listbox that
has only ever rendered authored options.

`getUnknownLabel(value)` renders the label for such a value wherever it appears — the trigger, a
`multiple` tag, and the synthetic row. The existing `getTag` hook cannot serve this case: it is
handed a matched option, and by definition there is none. A blank return falls back to the raw
value, and the hook is never consulted for a value a real option does claim.
