---
'@aceshooting/lyra-ui': minor
---

Add `label-display="hidden"` (`labelDisplay: 'visible' | 'hidden'`, type `LyraLabelDisplay`) to the form controls that render the shared label chrome: `lr-select`, `lr-combobox`, `lr-input`, `lr-time-input`, `lr-textarea`, `lr-locale-picker`, `lr-date-input`, `lr-phone-input`, `lr-token-input`, the catalog pickers, `lr-model-select` and `lr-voice-picker`. The label stays the accessible name while it is removed visually, for compact toolbars, so consumers no longer restyle the `form-control-label` part. Hint and error text are unaffected, and an unset control renders as before.
