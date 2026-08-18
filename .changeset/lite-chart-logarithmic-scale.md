---
"@aceshooting/lyra-ui": minor
---

`<lr-lite-chart>`: add a base-10 `scale="logarithmic"` value axis.

The dependency-free SVG chart does not extend `LyraChart`, so it did not inherit the `scaleType`
support added for the Chart.js-backed charts, leaving no way to plot data spanning several orders of
magnitude honestly — a linear axis collapses everything below the maximum into the baseline.

- `scale` now accepts `'logarithmic'` alongside `'linear'` and `'sqrt'`, defaulting to `'linear'`.
- Unlike `'sqrt'` (which compresses bars only, by long-standing design), the logarithmic axis
  applies to **bars, line points and gridlines alike** — a log axis whose gridlines stayed linear
  would misrepresent the plot. All three now resolve through one `valueFraction()` dispatcher so the
  scale can never apply to some marks and not others.
- Its lower bound is the smallest *positive* datum, not the linear `lo`. `beginAtZero` defaults to
  true, so `lo` is normally `0`, which has no logarithm; deriving the floor from the data is what
  makes a 1…1000 series span three even decades instead of collapsing onto one. Measured: decade
  gaps of 80.7/80.6/80.7px versus linear's 2.2/21.8/217.8px on the same data.
- Zero and negative values pin to the axis floor rather than reaching the SVG as `-Infinity`, which
  would blank the series — this renderer has no Chart.js-style "drop the point" fallback. A
  degenerate domain falls back to the linear fraction.

`'linear'` and `'sqrt'` render exactly as before, covered by an explicit unchanged-default test.
