---
'@aceshooting/lyra-ui': patch
---

Long text adornments now truncate with a real ellipsis instead of being hard-clipped. Slotted `start`/`end` (and `prefix`/`suffix`) content in `lr-button`, `lr-option` and `lr-date-input` carries its own shrinkable block, as `lr-input` already did, so the ellipsis fires at the logical end; `lr-option` adornments were previously clipped on both sides. The cloned `option-start`/`option-end` adornments in the `lr-select` and `lr-combobox` popups get the same treatment, and `lr-combobox` async `source` rows now wrap a string or number `start`/`end` in a span so it truncates from its start edge instead of centre-clipping. Element and template adornments (such as an `lr-icon`) render unwrapped as before.
