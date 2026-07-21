---
"@aceshooting/lyra-ui": patch
---

Fix `lr-icon-button`'s bare-SVG-geometry fallback rendering slotted stroke-style icon path data
(no fill/stroke of its own) as a solid black shape instead of an outline, by giving
`[part="fallback"]` the same `fill`/`stroke`/`stroke-width`/`stroke-linecap`/`stroke-linejoin`
defaults `lr-icon`'s own wrapper svg already has.
