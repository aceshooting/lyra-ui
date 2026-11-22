---
'@aceshooting/lyra-ui': patch
---

The text fields and other controls built on the shared form-associated base now document the six validity custom states they already publish (`required`, `optional`, `valid`, `invalid`, `user-valid`, `user-invalid`) in the component manifest. This covers `lr-input`, `lr-number-input`, `lr-native-time-input`, `lr-textarea`, `lr-date-input`, `lr-time-input`, `lr-phone-input`, `lr-chat-composer`, `lr-known-date`, `lr-code-editor`, `lr-color-picker`, `lr-emoji-picker` and the country, currency, unit and time-zone pickers. With the states in the manifest, `lyra-ui-migrate` rewrites Shoelace selectors such as `sl-input[data-user-invalid]` to `lr-input:state(user-invalid)` instead of reporting them for review.
