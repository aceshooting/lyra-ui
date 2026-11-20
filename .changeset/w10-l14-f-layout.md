---
'@aceshooting/lyra-ui': minor
---

- `lr-app-rail`: the `resizable` drag handle now sits wholly outside the rail edge, so the rail's scrollbar and item edges stay clickable; new `--lr-app-rail-resizer-hit-area` (default 24px, at least the icon-button size for coarse pointers).
- `lr-dashboard-grid`: the corner resize handle keeps to a 24px target over the widget's corner; new `--lr-dashboard-grid-resize-handle-hit-area` (coarse pointers keep the icon-button size).
- `lr-multi-split`: Home/End/arrow keys on a divider that is already at its limit no longer scroll the page.
- `lr-multi-split`: an explicitly bound `collapsedPanels` (including `[]`) now wins over a collapsed set stored under `storage-key`.
- `lr-carousel`, `lr-app-rail`, `lr-responsive-panel`: `lr-slide-change`, `lr-mode-change` and the forced `lr-toggle` that a property change causes now fire after the render, so listeners see the updated DOM.
- `lr-breadcrumb-item`, `lr-app-rail-item`, `lr-card`: `focus()`/`blur()` (and `autofocus`) now forward to the internal link or button; `lr-navigation-menu-item` and `lr-accordion-item` gain `blur()`.
- `lr-command-palette`: a hotkey without a Ctrl/Cmd/Alt modifier (for example `/`) is ignored while typing in a text field, and no hotkey fires while the palette is in a hidden or inert subtree.
- `lr-segmented`, `lr-virtual-list`: reduced-motion programmatic scrolls use `behavior: 'instant'`, so a `scroll-behavior: smooth` stylesheet cannot animate them.
- `lr-carousel`: the scroll-container hover preview defaults to `--lr-color-border`, matching `lr-scroller` and `lr-tab-group`; `lr-scroller` and `lr-tab-group` drop that preview while the region shows its focus ring.
