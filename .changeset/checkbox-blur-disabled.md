---
"@aceshooting/lyra-ui": patch
---

Fix `<lr-checkbox>` marking a field touched/interacted from a blur the platform forces when the control (or an ancestor `<fieldset>`) becomes disabled while it is focused, which could leave the control primed to show as invalid immediately on re-enable, or trip a Lit dev-mode reentrancy warning.
