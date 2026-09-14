---
"@aceshooting/lyra-ui": patch
---

`<lr-lite-chart>`: the first and last category-axis tick labels no longer overhang the plot's own
clipped edge.

Both boundary ticks previously centered (`text-anchor="middle"`) at the plot's own left/right
boundary, with only a small fixed inline padding beyond it — half of a sufficiently wide label
(a typical date string, for example) painted past that edge and was clipped by the `svg`'s
`overflow: hidden`, most visibly on the trailing tick (e.g. "Sep 14" rendering as "Sep 1"). Label
decimation (`maxLabels`) only reasons about label-to-label collision, so nothing previously
accounted for the plot's own boundary. The two boundary ticks now anchor toward the plot's
interior (`text-anchor="start"` for the first, `"end"` for the last) instead of centering; every
other tick still centers, unchanged. Because SVG's `start`/`end` anchors already mirror with an
inherited `direction: rtl`, and the plot's own small-padding side swaps with it too, this stays
correct under RTL without inverting which rendered category gets which keyword.
