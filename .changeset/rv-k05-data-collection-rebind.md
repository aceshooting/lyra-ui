---
"@aceshooting/lyra-ui": major
---
lr-data-grid, lr-table, lr-tree, lr-file-tree: assigning the same collection array (or key set) a property last received is now a no-op, so a parent re-render no longer re-renders the component, resets lr-data-grid's shift-range anchor, re-runs its pipeline or drops its row measurements. Migration: after changing a collection, assign a new array (for example `grid.data = [...rows]`); to re-render after editing row objects in place, call `requestUpdate()`.
