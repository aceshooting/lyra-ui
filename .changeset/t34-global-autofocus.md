---
'@aceshooting/lyra-ui': patch
---

Honored the native `autofocus` attribute on `lr-combobox`, `lr-time-input`, `lr-date-input`, `lr-date-picker`, `lr-locale-picker`, `lr-color-picker`, `lr-emoji-picker`, `lr-swatch-picker`, `lr-time-range`, `lr-token-input`, `lr-rubric-form`, `lr-checkbox`, `lr-checkbox-group`, `lr-radio`, `lr-radio-button`, `lr-radio-group`, `lr-switch`, `lr-button`, and `lr-icon-button`, which previously silently ignored it; `lr-input`, `lr-textarea`, `lr-select`, `lr-slider`, and `lr-otp-input` already supported it and keep working unchanged.
