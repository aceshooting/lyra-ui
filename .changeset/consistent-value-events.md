---
"@aceshooting/lyra-ui": major
---

Standardize form value notifications on native input/change events and typed lr-input/lr-change details. Combobox and checkbox-group native events now use Event without custom detail; migrate detail readers to their prefixed events. Add missing typed pairs, aggregate form commit events, time-range detail.value, and color-picker input values. Data-grid now emits lr-request alongside the supported request event.
