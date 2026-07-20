---
"@aceshooting/lyra-ui": minor
---

Add `lr-virtual-list` position queries: `offsetForIndex(index)` returns the pixel top row `index`
renders at (clamped to `0…items.length`, so `offsetForIndex(items.length)` is the total content
height), and `indexAtOffset(px)` returns the row whose box contains that offset (`-1` for an empty
list). Both work in the same coordinate space as the scroll container's `scrollTop`, so a host can
do scroll-linked layout without duplicating the windowing math; in `row-height="auto"` mode an
unmeasured row's offset stays estimate-based until its `ResizeObserver` measurement lands.
