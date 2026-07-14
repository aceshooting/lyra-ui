---
"@aceshooting/lyra-ui": minor
---

`lyra-combobox` gains a `size` property (`'xs'|'s'|'m'|'l'|'xl'`, default `'m'`) mirroring `lyra-select`'s existing scale, including matched sizing for the "+N" overflow tag so it stays visually consistent with the trigger at every size. Async `ComboboxSourceRow` results can now carry a decorative `icon`, trailing `badge`, richer `accessibleLabel`, and opaque `data`; the read-only `selectedRows` getter retains the structured rows and payloads for the current selection. The new visuals are exposed through `option-icon` and `option-badge` CSS parts.
