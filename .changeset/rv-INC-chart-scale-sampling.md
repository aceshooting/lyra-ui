---
"@aceshooting/lyra-ui": patch
---
`sampleLyraChartScale()` interpolates hex and `rgb()` stops in JavaScript, so sampling a resolved scale per data point no longer forces a style recalculation each time.
