---
"@aceshooting/lyra-ui": minor
---

`<lr-heatmap>`: support signed data via new `domain` and `midpoint` properties, and stop dropping
the negative half of a signed dataset.

Two related reports. The ramp always spanned the data's own `min`…`max`, so two heatmaps of
comparable data could not share a scale — each silently normalized to its own extremes — and a
diverging palette could not be centred: with data running -4.93 to +28.8, the neutral colour landed
at 15% of the range rather than on zero, painting "no change" onto a substantial decrease.
Separately, the cell-fill guard was `value < 0 || !Number.isFinite(value)`, so *every* negative
rendered as no-data, not just the documented `-1` sentinel — indistinguishable from a genuinely
missing cell, and silent (32.7% of cells in the reporter's dataset).

- `domain?: [number, number]` pins the ramp's input domain, so comparable charts can share a scale.
  A reversed pair is normalized; a degenerate or non-finite one falls back to the derived range.
- `midpoint?: number` anchors a diverging ramp's neutral colour, scaling the two halves
  independently (`lo`→0, `midpoint`→0.5, `hi`→1). A midpoint outside the domain degrades to plain
  normalization rather than distorting the ramp.
- Setting either one opts into **signed data**, where only a non-finite value is no-data. That
  gating is deliberate: `-1` is the long-documented sentinel and a matrix of counts has no
  meaningful negative, so declaring a domain or midpoint is what disambiguates the two. With
  neither set, behavior is byte-identical to before — covered by an explicit unset-regression test.
- A structurally absent matrix cell now reads as `NaN` in signed mode (non-finite is no-data in
  both modes), so it stays a hole while a real `-1` beside it renders on the ramp. The default
  mode still resolves an absent cell to `-1`, keeping `valueAt()` and the `lr-cell-click` payload
  unchanged.
- The accessible cell labels track the painted contract, so a rendered negative is announced with
  its value instead of "no data".
- `scale="sqrt"` continues to reject negatives — a square root of a negative has no meaning — now
  explicitly rather than as a side effect of the shared guard.

Reported as lyra-admin requests `fr_Gr36iF5hz-1PPwGecRlq2g` (negative values) and
`fr_srwB8_slHoEwqYAWq9nFsg` (domain/midpoint).
