---
'@aceshooting/lyra-ui': minor
---

Add a `pressed` property to buttons so toggle state reaches the native control without placing ARIA toggle attributes on the custom-element host. The property supports true, false and mixed state; existing host `aria-pressed` values remain the fallback when it is unset.
