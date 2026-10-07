---
"@aceshooting/lyra-ui": patch
---
confirm(): the dialog now plays its exit animation and emits `lr-after-hide` before it is removed, and the docs point close vetoes at `lr-hide`/`lr-close-request` (`lr-close` is not cancelable).
