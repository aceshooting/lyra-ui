---
'@aceshooting/lyra-ui': patch
---

`lr-dock-panel`: the resize handle's hit area no longer swallows clicks on content beside the panel's inner edge. Precise pointers now get exactly `--lr-dock-panel-handle-hit-area` (default `var(--lr-space-s)`, shrinkable to the visible line); coarse or hover-less pointers keep the `--lr-icon-button-size` floor.
