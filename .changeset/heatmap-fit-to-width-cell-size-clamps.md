---
"@aceshooting/lyra-ui": minor
---

`<lr-heatmap>` gained `maxCellSize` (`max-cell-size`) and `minCellSize` (`min-cell-size`), bounding
the cell size `fit-to-width` derives from the host's measured width in **both** calendar and matrix
mode. Without a ceiling, a 5-week calendar or a 3-column matrix in a wide pane inflates into a few
giant blocks; without a raisable floor, a year-long calendar in a narrow pane collapses onto the
built-in 4px minimum.

Both are ignored while `fit-to-width` is unset — an explicit `cell-size` is an exact request and is
never clamped — and both default to unset, so an untouched consumer's geometry is byte-identical.
`min-cell-size` can only raise the built-in 4px floor, never lower it; when both are set and
`max-cell-size < min-cell-size` the ceiling wins. A non-finite or empty attribute means unset rather
than `0`.

Note that the canvas is sized from the *clamped* cell size, so a capped grid leaves the host's
remaining width unfilled instead of stretching to it — align it with normal CSS on the host.
