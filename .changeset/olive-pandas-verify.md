---
"@aceshooting/lyra-ui": patch
---

Gate the accuracy of the published API reference's property defaults. The package ships its own
`llms/` reference, and nothing compared a documented `name: type = default` (or `name?: type`)
against the declaration recorded in `custom-elements.json` — so a property could change between
optional and defaulted while the shipped reference kept describing the old shape. That misleads
concretely: `label: string = ''` tells you an unset read is `''`, so `el.label.trim()` is safe and
`?? fallback` is dead code, when the real readback is `undefined`. The 13.0.0 corrections fixed
fifteen such entries; this adds the check that keeps them fixed, in both directions. No runtime
change.
