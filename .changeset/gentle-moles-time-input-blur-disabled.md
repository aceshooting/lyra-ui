---
"@aceshooting/lyra-ui": patch
---

Fix `<lr-time-input>` marking a segment touched from a blur the platform forces when the focused segment becomes disabled (its tabindex drops below zero while it still holds focus), which could trip a Lit dev-mode reentrancy warning.
