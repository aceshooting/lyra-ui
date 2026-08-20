---
"@aceshooting/lyra-ui": minor
---

New component `<lr-funnel>`: a conversion funnel — an ordered set of stages, each drawn as a bar
whose length is that stage's share of the FIRST stage, read top-to-bottom as progressive drop-off.

Nothing in the catalogue expressed this. A funnel is not a sorted bar chart: it normalizes to the
first stage rather than the data maximum, its value axis carries no information worth drawing, and it
is read as stage-to-stage retention rather than category comparison. Reaching one through
`lr-bar-chart` meant switching off axes, grid and legend, hand-computing every percentage, and still
pulling the Chart.js peers for what is a handful of rectangles. `lr-span-waterfall` encodes time
offset, not share; `lr-flow-canvas` draws a graph, not a quantitative comparison; `lr-stepper` and
`lr-progress-bar` express position or completion, not per-stage magnitude.

It lives in the `data` family beside `lr-heatmap` and `lr-gauge` as an analytics primitive, and pulls
no peer at all.

Each stage carries both its absolute value and its share, because the interesting question is usually
the percentage but the credibility check is the count. `comparison` draws a second series behind each
bar, normalized to ITS OWN first stage, so a cohort's funnel *shape* can be read against a baseline
whose absolute volumes are not comparable — comparing one entity against a many-entity peer group is
the common case, and per-series normalization is what makes it legible. `dropoff` (on by default)
renders the consecutive-stage change.

The chart is plain HTML — an ordered list of stages with real text and a percentage-width bar — so
the accessible representation *is* the chart rather than a transcript bolted onto a sighted-only
drawing.

Degenerate cases are defined and tested rather than left to chance: an empty series renders a
localized empty state, a single stage renders one bar and no drop-off, a zero or negative first stage
suppresses shares instead of dividing by it, a stage larger than its predecessor (real in funnels
with re-entry) is not clamped, and a comparison series of a different length is matched by position.
