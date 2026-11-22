---
'@aceshooting/lyra-ui': minor
---

`lr-pdf-viewer` adds a reflected `fill` boolean, like `lr-heatmap`'s: inside a parent with a definite block size (a dialog body, a sized flex column) the viewer takes the parent's height, the toolbar keeps its row, and the page list takes the rest and becomes the single scroller. Without it the page list keeps its fixed `--lr-pdf-viewer-height`.
