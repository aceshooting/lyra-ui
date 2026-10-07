---
"@aceshooting/lyra-ui": patch
---
`lr-combobox` now closes immediately, without a vetoable `lr-hide`, when it becomes disabled, readonly or fieldset-disabled, so a veto can no longer leave a closed control holding the Escape key and its overlay.
