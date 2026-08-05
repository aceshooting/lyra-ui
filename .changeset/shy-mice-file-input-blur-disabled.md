---
"@aceshooting/lyra-ui": patch
---

Fix `<lr-file-input>` marking its dropzone touched from a blur the platform forces when the focused `[part="base"]` button becomes disabled, which could trip a Lit dev-mode reentrancy warning.
