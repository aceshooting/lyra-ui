---
'@aceshooting/lyra-ui': minor
---

`lr-chart` and its line and area family accept a custom dash pattern on `LyraChartSeries.dash` (`true` keeps the default `[4, 4]` dash; an array is a canvas `setLineDash()` pattern, an empty array draws solid) and a per-band `bandOpacity` on `type: 'band'` series, which overrides `--lr-chart-band-opacity` for that band's fill and legend swatch. Defaults are unchanged.
