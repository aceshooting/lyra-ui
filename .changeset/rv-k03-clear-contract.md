---
"@aceshooting/lyra-ui": major
---
`lr-clear` now fires only for an explicit clear (button or `clear()`), after `input` and `change`, on `lr-date-input`, `lr-otp-input` and `lr-date-picker`; `clear()` is inert while blank, disabled or readonly and never moves focus. Migration: detect an emptied `lr-otp-input` from `input` with `value === ''`, and call `focus()` yourself after `clear()` if needed.
