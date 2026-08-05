---
"@aceshooting/lyra-ui": patch
---

Fix `<lr-date-input>` marking the field touched from a blur the platform forces when the internal date text input becomes disabled while focused, which could trip a Lit dev-mode reentrancy warning.
