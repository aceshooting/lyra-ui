---
"@aceshooting/lyra-ui": patch
---
lr-chart and its typed subclasses: under forced colors, a series with per-point colors no longer creates a new canvas pattern tile (and a color probe) for every data point on every draw; one tile is built per encoding and color.
