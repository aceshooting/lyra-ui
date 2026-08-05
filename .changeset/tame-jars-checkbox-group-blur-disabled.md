---
"@aceshooting/lyra-ui": patch
---

Fix `<lr-checkbox-group>` marking the group touched from a blur the platform forces when a focused child `<lr-checkbox>` becomes disabled -- either directly or via an ancestor `<fieldset disabled>` cascading down -- which could trip a Lit dev-mode reentrancy warning.
