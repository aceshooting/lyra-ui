---
"@aceshooting/lyra-ui": major
---
lr-histogram: assigning more than 10,000 `values` now keeps the newest 10,000 samples (with a development-mode warning) instead of silently keeping the first 10,000, matching how `appendSamples()` streams. Migration: if you pass a longer array and need its leading samples, slice it yourself (`values.slice(0, 10_000)`) or pre-aggregate.
