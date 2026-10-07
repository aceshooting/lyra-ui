---
"@aceshooting/lyra-ui": major
---
`lr-activity-feed`'s `follow` now reflects like every `true`-defaulting boolean: no attribute while following and `follow="false"` once released (it was `follow=""` / no attribute). Migration: select `:not([follow="false"])` instead of `[follow]`.
