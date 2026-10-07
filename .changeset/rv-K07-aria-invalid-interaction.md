---
"@aceshooting/lyra-ui": patch
---
lr-checkbox, lr-switch, lr-checkbox-group, lr-slider, lr-rating and standalone lr-radio/lr-radio-button: `aria-invalid` (and the `data-invalid` hook) now turns on after the user toggles, blurs, reports validity or submits, like `:state(user-invalid)`, rather than on blur only, from first render, or never; visible error text is still immediate.
