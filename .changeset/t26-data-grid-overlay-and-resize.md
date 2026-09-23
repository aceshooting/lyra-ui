---
'@aceshooting/lyra-ui': patch
---

`lr-data-grid`'s per-column menu now closes on Escape exclusively through the shared overlay stack, so it correctly defers to a genuinely topmost overlay instead of always intercepting the key press first. Its ResizeObserver-driven row/gutter measurement pass is also coalesced into a single scheduled read per animation frame instead of running once per observer tick, reducing jank while an ancestor container animates or resizes.
