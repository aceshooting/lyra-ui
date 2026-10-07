---
"@aceshooting/lyra-ui": major
---
`--lr-model-select-radius` now defaults to `var(--lr-form-control-radius)`, so lr-model-select follows `--lr-theme-form-control-radius` and the size tiers like lr-select and lr-voice-picker. Migration: set `--lr-model-select-radius: var(--lr-radius)` to keep the previous corners.
