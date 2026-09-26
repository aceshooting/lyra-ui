---
"@aceshooting/lyra-ui": patch
---

`lr-tree-item`'s disclosure toggle, `lr-flow-controls`' toolbar and slotted buttons, and `lr-node-palette`'s draggable items now fall an unset hover/press fill back to `--lr-color-neutral-fill-quiet` instead of `--lr-color-border`. The internal `--lr-color-surface-hover` override point is unchanged and, once set, still wins as before; this only changes the color painted when it is left unset, matching the `lr-avatar`/`lr-skeleton`/`lr-empty` fill fix shipped earlier this release.
