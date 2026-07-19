---
"@aceshooting/lyra-ui": minor
---

`lr-combobox` now emits `lr-filter` (`detail: { value: string }`) on every user-driven change to its
in-progress filter text, so consumers that need the live as-you-typed string — a "no matches for
“x”" empty state, a debounced side effect — no longer have to reach into the component's shadow DOM
for `[part="combobox-input"]`.

The name is deliberately not `lr-input`: on `lr-combobox` the host's `value` is the *committed
selection*, so reusing `lr-input`'s event name would make one event name carry a different string on
different components. `lr-filter` fires for user input only — picking a row, the clear button,
`form.reset()`, dismissing the listbox, a programmatic `value` write and `setRangeText()` all blank
the filter silently, mirroring how `<lr-input>`'s `lr-input` only reports user edits.

The `ComboboxFilterDetail` detail type is exported and `LyraComboboxEventMap` carries the new entry,
so `addEventListener('lr-filter', …)` is typed.
