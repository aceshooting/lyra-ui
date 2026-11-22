---
'@aceshooting/lyra-ui': minor
---

Form controls: `lr-slider`, `lr-radio-group` and `lr-checkbox-group` take `label-placement="start"` like the other fields, sharing the existing label-column layout and tokens. `lr-checkbox-group` adds `--lr-checkbox-group-option-row-gap` and `--lr-checkbox-group-option-column-gap` for wrapped options, `lr-input` (and `lr-number-input`) adds `--lr-input-font-variant-numeric`, every form-control label reads `--lr-form-control-label-line-height`, and `lr-locale-picker` adds `--lr-locale-picker-trigger-radius` for the trigger alone. Each token defaults to the current rendering.
