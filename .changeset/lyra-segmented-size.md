---
"@aceshooting/lyra-ui": minor
---

`lyra-segmented` gains a `size: '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl' = 'm'` property, matching
`lyra-select`/`lyra-combobox`'s compact-form-control scale (`xs`-`xl`) plus `lyra-input`'s `2xs`
tier. `size="s"` now renders at the same control height as `lyra-select size="s"`/
`lyra-combobox size="s"`, so a segmented metric switcher can sit flush beside a compact select or
combobox in the same toolbar without consumer CSS reaching into `::part(base)`. The default `m`
tier is pixel-identical to this component's previous, only rendering.
