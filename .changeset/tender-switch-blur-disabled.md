---
"@aceshooting/lyra-ui": patch
---

Fix `<lr-switch>` marking a field touched from a blur the browser forces when the control (a form-associated custom element) becomes disabled while focused, which could trip a Lit dev-mode reentrancy warning and could flash `user-invalid` styling on a later re-enable for an interaction the user never had.
