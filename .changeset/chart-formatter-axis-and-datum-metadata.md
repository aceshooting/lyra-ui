---
"@aceshooting/lyra-ui": minor
---

Chart formatters now know which axis, series and datum they are formatting, and `<lr-lite-chart>`
can label its category axis for display only.

- `LyraChartFormatterContext` gains `axis?: 'x' | 'y' | 'y2' | 'r'`, and every tick call names the
  scale it is building. Two value axes usually exist precisely because they carry different units,
  which one formatter previously could not tell apart: `x`, `y`, `y2` and the radial `r` scale all
  received an identical context, so a dual-axis or scatter chart had to escape into
  `config.options.scales.<id>.ticks.callback` — and the accessible table, the CSV export and the
  spoken announcement then lost the unit text the typed formatter exists to keep consistent.
- `<lr-chart>`'s tooltip, DOM legend and data-label (`visual`) calls now spread `datasetIndex`,
  `index`, `label` and `seriesLabel` the way the table, export and spoken calls already did. Each
  call site already resolved that metadata and dropped it, so a tooltip formatter could not treat a
  percentage series differently from a value series in the same chart. Indexes are reported in
  source space, matching the data table, the CSV export and `lr-point-click`. The `axis` field
  reaches the table, export and spoken surfaces too, so one formatter renders one unit everywhere.
  A `stackTotals`/`tableTotals` stack total is deliberately the one context with no `datasetIndex`
  and no `seriesLabel`: it sums across the stack, so naming its topmost series would make a
  unit-switching formatter render that series' unit for a cross-series number. It keeps the
  category `index`/`label`, the stack's `axis`, and `statistic: 'total'`, matching
  `<lr-lite-chart>`'s total cells.
- Same gap, same fix, in the two siblings: `<lr-lite-chart>` names its value axis on every surface
  and now tells the `visual` formatter which category a mark is, not only which series;
  `<lr-box-plot>` names its value axis on ticks and passes the hovered datum's
  `datasetIndex`/`index`/`label`/`seriesLabel`/`statistic` to tooltip formatting instead of
  discarding what the callback was handed.
- `<lr-lite-chart>` gains `axisLabelText?: (label, index) => string | null`, a display-only
  override for one category tick's text. Returning `null` renders no tick there at all, which makes
  boundary-aligned ticks (a month, a release, a shift change) expressible without the even stride
  `maxLabels` imposes. `labels` stays authoritative for the accessible table's row headers, the
  per-mark title and accessible name, the announcement and the CSV export, so blanking a tick never
  blanks the same category where a reader or a spreadsheet needs it. The returned text is
  ellipsized to its own slot exactly like a source label, keeps its full text as the tick's
  accessible name, and a return value that is neither a string nor `null` falls back to the source
  label.

Every field is additive: it was `undefined` before, so no existing formatter changes behaviour.
