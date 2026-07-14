---
"@aceshooting/lyra-ui": patch
---

Fix `lyra-skeleton` rendering as an invisible 0×0 box everywhere: `[part='base']` was a bare `<span>` (UA default `display: inline`), so its own `inline-size`/`block-size` were CSS no-ops per spec. Adds `display: block`.
