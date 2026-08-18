---
"@aceshooting/lyra-ui": minor
---

Five consumer-reported gaps, several of them follow-ups to the charts/timeline work in this release.

**`<lr-chart>`: the formatter now receives the `export` and `spoken` surfaces.** `LyraChartFormatSurface`
has always declared both and `<lr-lite-chart>` has always emitted them, but `lr-chart` only ever
passed `visual` and `table` — so one formatter written against the documented contract behaved
differently depending on which chart rendered it, silently, in exactly the places unit formatting
matters most. CSV cells now route through `export` and the live announcement through `spoken`. With
no formatter installed, CSV cells stay the raw machine-readable number (no locale grouping a
spreadsheet would misparse) and announcements keep their locale format.

**`<lr-map>`: choropleth interpolation is selectable.** The fill expression was hard-coded to
`['interpolate', ['linear'], …]`, so a heavy-tailed quantity — price, population, income — put every
value below the maximum into the first colour band. `LyraMapChoroplethLayer.interpolation`
(`'linear' | 'logarithmic'`, default `'linear'`) emits maplibre's own
`['interpolate', ['exponential', 0.25], …]`, exposing an existing capability rather than adding one.
**`stops` stay in the data's own units**, so the legend keeps reading in real values instead of log
units.

**`<lr-heatmap>`: a dev-mode warning when `legendStops` and `colorSteps` disagree.** Both are
deliberate and independent — that independence is what lets a `cellColor` consumer describe a ramp
the grid no longer uses — but nothing checked they described the same thing, and a legend that
confidently labels colours the cells never use is worse than no legend. Warning rather than deriving
one from the other: deriving would silently change what an existing `colorSteps`-only consumer sees
and would break that escape hatch. Caption-only stops (the `less ▢▢▢▢ more` shape) claim no colour
and never warn.

**`<lr-timeline>`: `collision="stack"` for dense `scale="time"` chronologies.** Coincident items
overlapped, which is the common case rather than the exception at realistic density. `'stack'` steps
each colliding item one lane along the cross axis (`--lr-timeline-collision-offset`); an isolated
item returns to lane 0 rather than inheriting a preceding run's depth. No `'cluster'` mode: collapsing
items into one expandable marker needs a selection model and click events this deliberately passive
component does not have.

**`<lr-sequence-strip>`: activation and a controlled selection.** The strip read as pickable but had
no click handling and no event to hook. `lr-item-activate` (`detail: { index, id, item }`) fires on
click and on Enter/Space at the roving-tabindex focus, and `selectedIndex` marks the current item
with `aria-current` and `data-selected`. Controlled on purpose: activation does not move the
selection itself, so the strip cannot drift from a playback index it does not own. The selection is
drawn as a ring, not a tint — a cell's background is data (its category colour).

All five are additive; unset, every component renders as before.
