---
"@aceshooting/lyra-ui": patch
---

Corrects `--lr-chart-tick-font-size`'s unset default on `<lr-chart>` (and its eight typed
subclasses, `<lr-histogram>`, and `<lr-box-plot>`) so it once again renders byte-identically to
before the token existed.

The token's own canvas default had briefly resolved an unset `--lr-chart-tick-font-size` to
`var(--lr-font-size-2xs)` (about 10px). These canvas charts never had a font-size token before,
so Chart.js's own built-in 12px tick font size was what actually rendered; `--lr-font-size-2xs` is
correct only for `<lr-lite-chart>`'s SVG axis labels, which already used it before this token
existed and still do. `<lr-chart>`/`<lr-box-plot>` ticks now default to `var(--lr-font-size-xs)`
(12px), matching Chart.js's own default again.

The radar/polarArea `r`-scale `pointLabels` (the spoke labels) follow the same rule but land on a
different pre-existing number: Chart.js's `RadialLinearScale` gives `pointLabels` its own built-in
10px default, distinct from its 12px global tick default, so `pointLabels` now stays unset (and
therefore at that 10px) until `--lr-chart-tick-font-size` is explicitly set, at which point both
the ticks and the point labels adopt the same size together, as documented.

Setting `--lr-chart-tick-font-size` explicitly is unaffected by any of this and continues to work
as already documented.
