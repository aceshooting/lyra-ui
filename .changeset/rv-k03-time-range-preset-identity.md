---
"@aceshooting/lyra-ui": major
---
`lr-time-range`'s `presets` and `appliedPreset` now hold the caller's own preset objects instead of frozen copies, like `lr-date-picker`. Migration: compare `appliedPreset` with your own preset objects, and stop relying on the exposed entries being frozen.
