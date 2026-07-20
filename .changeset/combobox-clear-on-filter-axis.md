---
"@aceshooting/lyra-ui": patch
---

`lr-combobox`: the `clearable` button now covers the filter axis as well as the selection.

Typing a query that matches nothing left the user with no affordance to clear it — the button was
gated on a committed selection alone, and `clear()` early-returned on an empty selection. It now
renders whenever there is something to clear on either axis, and each axis announces only its own
change: clearing a selection still emits `input`/`change`/`lr-clear`, while clearing filter text
emits `lr-filter` with an empty `value` and no spurious selection events.

The query half of the gate is scoped to states where the query is actually visible — the open
listbox in single-select, or any time in `multiple` mode. A closed single-select shows the selected
label rather than the query, so a stale query alone never surfaces a button offering to clear text
the user cannot see.
