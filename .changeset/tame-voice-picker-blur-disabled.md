---
"@aceshooting/lyra-ui": patch
---

Fix `<lr-voice-picker>` marking a field touched from a blur the platform forces when the trigger button or free-text combobox input becomes disabled while focused, which could trip a Lit dev-mode reentrancy warning.
