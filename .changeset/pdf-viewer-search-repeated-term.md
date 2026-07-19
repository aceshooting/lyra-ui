---
"@aceshooting/lyra-ui": patch
---

Fix `<lr-pdf-viewer>`'s `search()` throwing an uncaught `IndexSizeError` when a search term occurs
more than once inside a single PDF.js text-layer node (e.g. a repeated substring within one text
item's `<span>`). `paintSearchMatches()` computed every match's DOM range against a pristine,
pre-painting snapshot of each text node, but wrapping the first match with `Range.surroundContents()`
splits/shrinks that node out from under the second match's precomputed offset, so `setStart()`/
`setEnd()` threw before the existing `surroundContents()` try/catch ever ran. Offsets for a node are
now tracked against the node as it actually stands after each prior match is painted, so every
repeated occurrence within one text-layer node is now correctly highlighted instead of crashing
`search()`.
