---
"@aceshooting/lyra-ui": minor
---

`lyra-app-rail-item` gains an opt-in `tooltip` property: a hover/focus flyout showing the item's
label text while `icon-only` hides it from view, using the library's existing Floating-UI-backed
`place()` positioner -- an explicit, documented alternative to hand-rolling a `::part()`+`::after`
tooltip composition.
