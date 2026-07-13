---
"@aceshooting/lyra-ui": patch
---

Fix `lyra-chip-group`'s "+N"/"Show less" overflow toggle hardcoding English strings instead of using
the library's own existing `localize()`/`strings` override mechanism, which every other component
with translatable text already uses (including the identical `showMore`/`showLess` keys, already
consumed by `lyra-source-card`).
