---
"@aceshooting/lyra-ui": minor
---

`<lr-chart>`: add a logarithmic value axis via a new `scaleType` property.

The core loader registered `LinearScale`, `CategoryScale` and `RadialLinearScale` but never
Chart.js's `LogarithmicScale`, so a logarithmic axis was unreachable — there was no property for it,
and the raw `config` passthrough could not supply one either, because Chart.js rejects an
unregistered scale type at construction. Any dataset spanning several orders of magnitude (prices,
growth, population, latency percentiles, file sizes) could not be charted honestly, since a linear
axis collapses everything below the maximum into the baseline.

- `scaleType: 'linear' | 'logarithmic' = 'linear'` (attribute `scale-type`, type
  `LyraChartScaleType`, exported from the root barrel) targets the **value** axis; the categorical
  axis is never affected. Inherited by `lr-line-chart`, `lr-scatter-chart` and `lr-bar-chart`, and
  applied to the secondary `y2` axis when one is present.
- `beginAtZero` is not forwarded on a logarithmic axis, since `log(0)` is `-Infinity` and Chart.js
  would otherwise be handed a bound it cannot place.
- `LogarithmicScale` is registered with the core rather than behind the feature loader: unlike the
  zoom and datalabels plugins it is not a separate package, so it already ships inside the
  `chart.js` module namespace the loader imports and costs no extra download weight.

Default is unchanged and covered by an explicit unset test.

Reported as lyra-admin request `fr_BsWWl0OWXi288ZIi1goa_w`.
