---
'@aceshooting/lyra-ui': patch
---

Arrow/Home/End navigation in `lr-radio-group`, `lr-toggle-group`, `lr-sequence-strip` and `lr-tree` now resolves through one shared list-move helper: Ctrl/Alt/Meta-modified arrows in the radio and toggle groups are left to the platform instead of moving selection. `lr-checkbox-group` coalesces the render-driven child syncs of one task into a single reconciliation.
