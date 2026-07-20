---
"@aceshooting/lyra-ui": minor
---

`<lr-tree>` gains a `reorderable` opt-in for keyboard reordering. With it set, Ctrl/Cmd+ArrowUp /
Ctrl/Cmd+ArrowDown on the focused row emits `lr-reorder` with
`detail: { id, parentId, fromIndex, toIndex }` — sibling-scoped indices within the node's own
parent's child list (`parentId` is `null` for a top-level item), so a reorder can never turn into
a reparent at a subtree boundary. The keybinding matches `<lr-dashboard-grid>`'s existing
`cells-draggable` keyboard move; Alt+Arrow was avoided because it is browser back/forward on
Windows and Linux. `data` stays host-owned — the event is a request, and the move is announced
through an internal `<lr-live-region>` (new `treeNodeMoved` message key).

Also fixes a pre-existing focus bug this surfaced: reassigning `data` in a way that merely
*re-indexes* the focused node (rather than removing it) dropped real DOM focus to `<body>`.
Focus now follows the node, including for nested rows several shadow roots down.

`reorderable` is `false` by default — unset, markup and keyboard behaviour are unchanged and no
`lr-reorder` is ever emitted. `<lr-file-tree>` deliberately does not forward it: its tree items are
derived from `nodes` and keyed by filesystem path, an order it does not own.
