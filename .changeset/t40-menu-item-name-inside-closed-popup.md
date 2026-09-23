---
'@aceshooting/lyra-ui': patch
---

Fix `lr-menu-item`/`lr-dropdown-item` losing an element-wrapped row's accessible name (`aria-label`/`getTextLabel()`) once its owning dropdown popup or `lr-menu` submenu settles fully closed, restoring the name regardless of the panel's open/closed state.
