---
"@aceshooting/lyra-ui": patch
---

`<lr-dashboard-grid>` no longer starts a cell drag when the pointer lands on a button, link, or
input inside the cell. The guard compared a slotted light-DOM control against a shadow-root wrapper
with `contains()`, which never crosses the slot boundary, so it could never fire and every control
click inside a draggable cell dragged the cell instead of activating the control.

`<lr-tree>` no longer throws on the first arrow key when a `<lr-tree-node>` is written declaratively
into its documented slot. `item` is `attribute: false`, so such a node has none until a host assigns
one, and the keyboard handler read `item.id` unguarded.
