---
"@aceshooting/lyra-ui": patch
---

Fix `<lr-select>` marking a field touched from a blur the platform forces when the trigger becomes disabled while focused, which could trip a Lit dev-mode reentrancy warning.
