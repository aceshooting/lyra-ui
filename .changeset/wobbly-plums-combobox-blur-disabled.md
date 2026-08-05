---
"@aceshooting/lyra-ui": patch
---

Fix `<lr-combobox>` marking its field touched from a blur the platform forces when the internal input becomes disabled while focused, which could trip a Lit dev-mode reentrancy warning.
