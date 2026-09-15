---
"@aceshooting/lyra-ui": minor
---

`<lr-chart>`: a legend can now show a value AND its share; `<lr-chart>`/`<lr-lite-chart>`/
`<lr-box-plot>` (and the eight typed subclasses, and `<lr-histogram>`, which all inherit
`<lr-chart>`'s canvas ticks) get a tick-label font-size hook, all byte-identical when unset.

- **New:** `legendDisplay` accepts `'value-percentage'`, appending both as `label: value
  (percentage)`, alongside the existing mutually-exclusive `'value'`/`'percentage'`. The
  `formatter`/`valueFormatter` callback backing `'value'` and `'value-percentage'` now also
  receives that same share as `percentage` in its `surface: 'legend'` context
  (`LyraChartFormatterContext`), so a custom formatter can build its own combined text without
  recomputing the share from raw data -- it was computed and then discarded before this change.
- **New:** `--lr-chart-tick-font-size` (default `var(--lr-font-size-2xs)`, any CSS length unit)
  retunes axis tick-label text size independently of the rest of the application, mirroring the
  existing `--lr-chart-tick-color` hook's naming and resolution. `<lr-chart>`'s canvas ticks
  previously had no font-size token at all (a bare Chart.js default); `<lr-lite-chart>`'s SVG
  ticks and `<lr-box-plot>`'s canvas ticks previously read the global `--lr-font-size-2xs` token
  directly, with no per-component override.
