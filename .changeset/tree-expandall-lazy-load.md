---
"@aceshooting/lyra-ui": patch
---

Fix `<lr-tree>`'s `expandAll()` bypassing lazy-loading. It used to set `expanded = true` directly
on every node, skipping `<lr-tree-item>`'s own `expand()` -- the only code path that emits
`lr-lazy-load` and calls `beginLazyLoad()` for a `lazy` node whose children have not been fetched
yet. A tree containing lazy nodes would render them visually expanded but empty after
`expandAll()`, with their content never actually requested. `expandAll()` now calls each node's
`expand()` directly, so a lazy node triggers the same load request whether it was expanded by a
click or by `expandAll()`.
