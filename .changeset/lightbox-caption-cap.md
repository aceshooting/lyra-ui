---
"@aceshooting/lyra-ui": patch
---

Fix `<lr-lightbox>`'s caption starving the stage when it's unusually long.

`[part='stage']` is `flex: 1 1 auto; min-block-size: 0` — the one part designed to shrink — but
`[part='caption']` had no size cap, so an unusually long caller-supplied caption could floor at
its full multi-line content height and squeeze the stage's allocation. `[part='caption']` now
caps at `var(--lr-size-8rem)` and scrolls internally past that. Same mechanism, same fix shape, as
`<lr-knowledge-graph-explorer>`'s composed-legend fix in this same release.
