---
"@aceshooting/lyra-ui": patch
---
lr-dock-panel: at the top of a shadow root (or slotted) it now sizes against its real layout container, the shadow host, and re-clamps when that container resizes, instead of falling back to the viewport.
