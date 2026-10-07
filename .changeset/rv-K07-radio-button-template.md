---
"@aceshooting/lyra-ui": major
---
lr-radio's protected `groupTabbable` getter is removed (lr-radio-button now shares lr-radio's `renderButtonControl()` template). Migration: a subclass that read `groupTabbable` should track its own tab-stop state.
