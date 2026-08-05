---
"@aceshooting/lyra-ui": patch
---

Fix `<lr-token-input>` marking a field touched (and committing a pending draft) from a blur the platform forces when the control becomes disabled while focused, which could trip a Lit dev-mode reentrancy warning.
