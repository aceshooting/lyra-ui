---
'@aceshooting/lyra-ui': patch
---

Fix `lr-checkbox-group`, `lr-reorder-list`, `lr-menu`/`lr-dropdown-item`, `lr-accordion` and `lr-tree`/`lr-file-tree` to coalesce bursts of per-child metadata notifications (bulk value assignment or form reset, framework re-renders re-keying every row, several items changing `disabled` together, staggered descendant attribute mutations) into a single reconciliation pass instead of one full-collection pass per notification, removing a quadratic-cost pattern on moderately sized lists and trees. Fix `lr-reorder-list` to use the same guarded active-element helper as its sibling components, so a move no longer risks an uncaught error under a DOM implementation whose `ShadowRoot.activeElement` getter throws when nothing is focused.
