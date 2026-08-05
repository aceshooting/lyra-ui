---
"@aceshooting/lyra-ui": patch
---

Fix `<lr-known-date>` marking a field touched from a blur the platform forces when the field becomes disabled while focused, which could trip a Lit dev-mode reentrancy warning.
