---
"@aceshooting/lyra-ui": patch
---

Fix `<lr-chat-composer>` marking a field touched from a blur the platform forces when the control becomes disabled while focused, which could trip a Lit dev-mode reentrancy warning.
