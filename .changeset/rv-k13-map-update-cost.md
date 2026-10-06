---
"@aceshooting/lyra-ui": patch
---
lr-map: unchanged `legend`, `legendGradient` and `hiddenCategories` re-assignments and a re-assigned, already admitted GeoJSON object are no longer re-projected, re-pushed or repainted, and camera settles no longer rewrite every marker; pass a new GeoJSON object after changing its data, as documented.
