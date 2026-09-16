---
"@aceshooting/lyra-ui": minor
---

`<lr-app-rail>`'s `[part="panel"]` gains four direction-aware per-corner radius tokens
(`--lr-app-rail-panel-radius-start-start`/`-start-end`/`-end-start`/`-end-end`), each defaulting to
the existing uniform `--lr-app-rail-panel-radius` so an unset override still rounds all four
corners exactly as before. Because the mobile drawer is always flush against its own logical
inline-start edge, the two `-end` corner tokens are the ones a flush-against-one-edge drawer
typically rounds, and both mirror to the opposite physical side under `dir="rtl"` with no second
consumer rule. `[part="nav"]` gains `--lr-app-rail-nav-padding` and `--lr-app-rail-nav-gap`,
defaulting to the values that rule previously hard-coded. `<lr-app-rail-item>`'s icon-only square
gains `--lr-app-rail-item-icon-only-size`, which — when set — sizes `[part="base"]`'s icon-only
square (and its `min-block-size` floor) directly, independent of
`--lr-app-rail-item-min-block-size`, so a taller expanded row and an icon-only square pinned to
`--lr-icon-button-size` can coexist. Unset, all three continue to reproduce their prior rendering
exactly.
