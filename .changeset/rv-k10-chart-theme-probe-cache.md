---
"@aceshooting/lyra-ui": patch
---
lr-chart, its typed subclasses, lr-histogram and lr-box-plot: a data-only redraw (for example each `appendData()` of a stream) no longer forces 15-30 synchronous style recalculations to re-resolve unchanged theme colors and lengths; resolved values are reused until the theme changes, and changing only `label` or `description` no longer rebuilds the canvas.
