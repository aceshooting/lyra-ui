---
'@aceshooting/lyra-ui': patch
---

Fixed a hydration mismatch in `lr-locale-picker`, `lr-phone-input`, `lr-token-input`, `lr-code-editor`, `lr-button`, `lr-checkbox-group`, `lr-radio-group`, `lr-slider`, and `lr-time-input`: declaratively slotted label/hint/error/adornment content is now revealed correctly instead of briefly disagreeing with the server-rendered markup on the very first client render.
