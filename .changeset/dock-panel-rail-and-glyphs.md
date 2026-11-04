---
"@aceshooting/lyra-ui": minor
---

`lr-dock-panel` gains a `rail` slot shown only while `collapsed`: its items (typically one icon button per section) stack after the collapse toggle, in a column on `start`/`end` and a row on `top`/`bottom`, and the rail grows past `--lr-dock-panel-collapsed-size` to fit them. New `collapse-icon` and `expand-icon` slots replace the toggle's chevron with consumer glyphs while keeping its localized name. New `expand()`, `collapse()` and `toggle()` methods drive the fold through the same cancelable `lr-toggle-request`/`lr-toggle` pair as the built-in toggle, so a consumer-owned control can replace it; collapsing moves focus to the built-in toggle, else the first focusable rail item, else the host.
