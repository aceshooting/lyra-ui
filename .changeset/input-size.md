---
"@aceshooting/lyra-ui": minor
---

`lyra-input` gains a `size: 'xs' | 's' | 'm' | 'l' | 'xl' = 'm'` property (reflected), the same scale
`lyra-select`/`lyra-combobox` already use — `--lyra-input-padding-block`/`-padding-inline`/
`-font-size` swap per size, the same pattern as `lyra-select`'s own size tokens. Unset (the default,
`'m'`) reproduces today's exact sizing.
