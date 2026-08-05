---
"@aceshooting/lyra-ui": patch
---

Fix `<lr-model-select>` marking a field touched from a blur the platform forces when the trigger button or combobox input becomes disabled while focused, which could trip a Lit dev-mode reentrancy warning.
