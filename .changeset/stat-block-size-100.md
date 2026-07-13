---
"@aceshooting/lyra-ui": patch
---

Fix `lyra-stat`'s `[part='base']` not stretching to fill its host in a CSS Grid -- a stat tile with
a longer `sub`/breakdown-rows line rendered visibly taller than its row-mates. `block-size: 100%` on
`[part='base']` now matches the convention `lyra-word-cloud`/`lyra-context-meter` already use.
