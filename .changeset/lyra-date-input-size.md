---
"@aceshooting/lyra-ui": minor
---

`lyra-date-input` gains a `size: '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl' = 'm'` property, matching
`lyra-input`/`lyra-select`/`lyra-combobox`'s shared control-size scale. `size="s"` now renders the
field at the same height/density as `lyra-input size="s"`, so a date field can sit flush beside a
compact input or select in the same form row or toolbar. The calendar-toggle and clear buttons
keep their existing minimum touch target at every tier instead of shrinking below it. The default
`m` tier is pixel-identical to this component's previous, only rendering.
