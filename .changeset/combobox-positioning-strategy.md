---
"@aceshooting/lyra-ui": minor
---

`<lr-combobox>` now takes part in the library's positioning-strategy contract. It exposes
`positioningStrategy` (attribute `positioning-strategy`), spelled the same as on `<lr-select>`,
`<lr-popover>`, `<lr-dropdown>`, `<lr-tooltip>` and `<lr-color-picker>`, and when the instance sets
nothing it honours the cascading `--lr-positioning-strategy` custom property ahead of its own
default.

Previously the listbox was always `fixed` through an undocumented internal default: an app that set
`--lr-positioning-strategy` once on `:root` to retune every floating surface silently left comboboxes
behind, and no instance could opt out. The default stays `fixed` — what the listbox has always
rendered, and the right choice for a typeahead list that usually sits inside a scrollable region — so
existing layouts do not move.

There is deliberately no `hoist` alias on this control. On `<lr-select>` it is Shoelace's established
spelling; here it would be a boolean defaulting to `true`, whose attribute could only ever express
the value the control already has. Use `positioning-strategy="absolute"` to opt out.
