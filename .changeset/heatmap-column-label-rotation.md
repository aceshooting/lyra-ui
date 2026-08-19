---
"@aceshooting/lyra-ui": minor
---

`<lr-heatmap>` matrix mode gains `colLabelRotation` (`col-label-rotation`) and an `'auto'` value for
`colLabelHeight` (`col-label-height`), giving column labels the escape hatch the row gutter got in
10.0.0.

Column labels were horizontal-only in a fixed 20px band, so in a dense matrix — where every column
is far narrower than a typical label — adjacent labels collided and the axis became unreadable,
with no rotation or angle property anywhere in the surface. Each label now rotates about an anchor
at its own column's centre with the label's end at that anchor, so it leans back over the columns
to its left and the last column's label cannot overflow the canvas. `col-label-height="auto"`
measures the labels and projects their width through the rotation, so the band sizes itself.

Unset, both are inert and painting is unchanged. Values outside `[0, 90]` clamp and non-finite
values normalize to `0`. Rotation is deliberately not mirrored under `dir="rtl"`, matching the
documented rule that both grid modes retain physical LTR geometry.
