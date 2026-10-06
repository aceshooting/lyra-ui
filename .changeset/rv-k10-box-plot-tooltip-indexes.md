---
"@aceshooting/lyra-ui": patch
---
lr-box-plot: once more than 1,000 boxes are sampled, a tooltip `formatter`/`valueFormatter` now receives the hovered box's own series and category (`datasetIndex`, `index`, `label`, `seriesLabel`) instead of those at its position in the sample.
