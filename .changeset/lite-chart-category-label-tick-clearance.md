---
"@aceshooting/lyra-ui": patch
---

Fix `<lr-lite-chart>`'s first category label colliding with the bottom y-axis tick.

A line chart centres its first category label on `plotX`, so that label always reaches left into the
y-axis tick column — a measured 5.7px horizontal overlap on both Chromium and Firefox. The only thing
holding the two apart is the vertical gap between the label row and the bottom tick, which is
`dominant-baseline="middle"` on the plot floor and therefore hangs half its line box below that floor
into the label row.

That gap was 1.3px on Chromium and **-0.7px on Firefox**, whose line box for the same 10px
`system-ui` font is 16px against Chromium's 14px. Firefox therefore painted the first x-axis label
overlapping the `0` tick. Raising `CATEGORY_LABEL_OFFSET` 18 → 24 and `PAD_BOTTOM` 24 → 30 together
leaves ~5px clear on both engines, comfortably past that 2px cross-engine variation.

Because both constants moved by the same amount, the category-label row does not shift: the plot
floor rises instead, so a chart's labels stay where they were and its plot area is 6px shorter. Charts
with an `x-label` axis title are unaffected beyond that, since `AXIS_TITLE_SPACE` is measured from
`padBottom`.

Note the truncation width model is unchanged: `displayCategoryLabel()` still estimates fit from
`APPROX_LABEL_CHARACTER_WIDTH`, so a label's *horizontal* extent remains an approximation rather than
a measurement. This change makes the label row robust to that approximation being wrong rather than
making the approximation exact.
