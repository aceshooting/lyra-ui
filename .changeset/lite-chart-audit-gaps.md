---
"@aceshooting/lyra-ui": minor
---

`lyra-lite-chart`: add a `minBarHeight`/`min-bar-height` pixel floor for near-zero stacked
segments, fix `scale="sqrt"` proportionality for stacked bars (previously compressed each
segment's absolute cumulative stack position independently instead of the bar's total height
split linearly by segment share), and add a `chartLabel`/`chart-label` override for the chart's
auto-derived `aria-label`.
