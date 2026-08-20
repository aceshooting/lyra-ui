---
"@aceshooting/lyra-ui": patch
---

`<lr-heatmap>`'s `matrixGeometry` now returns the geometry the last matrix-mode draw actually
painted with, instead of recomputing from current layout on every read.

It is documented as "the gutter/cell geometry the last matrix-mode draw actually painted with", and
11.2.0's notes claimed it "can never disagree" with the canvas because it reuses the same internal
getters `drawMatrix()` calls. Reusing those getters is precisely what made it disagree: they read
*current* layout, not the last paint, so any interval where layout has moved but no draw has
happened made the getter describe a canvas that does not exist. Two such intervals are routine —
full redraws pause while the host is outside the viewport (documented behaviour of this component),
and `rowLabelWidth`/`colLabelHeight` are not redraw-triggering properties at all, so assigning one
moved the getter *permanently* ahead of the canvas rather than for a transient window.

That landed squarely on the use case the property was added for: a light-DOM sticky-header mirror
for a tall matrix — i.e. exactly the component most likely to be scrolled out of view. A mirror
synced from the getter while the grid was off-screen lined up with geometry the canvas was not
using, which is the same misalignment the property exists to eliminate. It also silently disagreed
with `lr-matrix-geometry-change`, which fires only from the draw path and was always correct.

The getter now returns the frozen object the draw stored and the event carried, so the two are
equal by construction. The returned object is frozen, so a consumer cannot corrupt the component's
own change detection by mutating it.
