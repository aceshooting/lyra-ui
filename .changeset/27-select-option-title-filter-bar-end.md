---
'@aceshooting/lyra-ui': patch
---

`lr-option`'s `title` now reaches the option row rendered by `lr-select` and `lr-combobox` (and the multiple-mode tag) as a tooltip, without changing the accessible name; `ComboboxSourceRow` accepts a `title` too. `lr-filter-bar` slotted `end` actions now reserve the same trailing validation spacer as the fields and Reset, so they share the field frames' bottom edge, and Reset and the end actions wrap together as one group.
