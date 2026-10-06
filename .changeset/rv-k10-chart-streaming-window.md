---
"@aceshooting/lyra-ui": patch
---
lr-chart, lr-lite-chart, lr-histogram and lr-box-plot: streaming past 10,000 points with `appendData()`/`appendSamples()` no longer freezes the chart on its oldest data or blanks it — appends keep a rolling window of the newest values — and a directly assigned series longer than the input bound now keeps its first values instead of disappearing together with every later series.
