---
"@aceshooting/lyra-ui": patch
---
lr-chunk-inspector, lr-memory-panel and lr-grounding-summary fall back to the default tiers when `thresholds` is not an object instead of throwing from render, and the retrieval entries that type a property with `LyraScoreThresholds` re-export it.
