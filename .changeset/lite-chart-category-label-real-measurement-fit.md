---
"@aceshooting/lyra-ui": patch
---

`<lr-lite-chart>`: category-axis tick labels no longer overlap each other, or clip past the
plot's own boundary, on a font whose glyphs are wider than the library's internal size estimate.

Ellipsizing a category-axis label used a fixed per-character pixel estimate
(`APPROX_LABEL_CHARACTER_WIDTH`) to decide how much of a label's text fits in its slot. That
estimate is only ever a guess: real glyph widths vary by platform and font, so on a browser whose
default font renders wider than the estimate assumed, a label kept more characters than its slot
actually had room for and visibly overlapped its neighbor -- most reproducibly with `maxLabels`
decimating a long category list at a narrow chart width. The character estimate now only sizes a
label before the chart has any real layout to measure (server rendering, the pre-hydration paint);
once the chart is in the DOM, each tick is re-fit against the browser's own measured text width
(`SVGTextContentElement.getComputedTextLength()`), the same technique the x/y axis title already
used. The per-tick budget this fit targets is also now each survivor's REAL distance to its actual
rendered neighbor rather than an evenly-averaged decimation stride, so a boundary tick (the first
or last surviving label, which already anchors toward the plot's interior) can still render a long
label in full when there's room, without starving the interior neighbor it borders.
