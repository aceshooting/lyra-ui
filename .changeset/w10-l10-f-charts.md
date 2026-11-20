---
'@aceshooting/lyra-ui': minor
---

- `lr-chart-3d` updates a live WebGL renderer in place when `data`, `type`, an axis title or `hiddenCategories` changes, instead of disposing and re-creating the context. `hiddenCategories` now returns a cached read-only snapshot; assign a new `Set` to change it.
- `lr-lite-chart` no longer leaves stray row gaps for empty grid tracks, and its legend uses the shared `--lr-font-size-xs` and `--lr-radius-xs` tokens.
- `lr-chart` reuses computed legend values between renders.
