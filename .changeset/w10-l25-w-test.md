---
'@aceshooting/lyra-ui': major
---

- `lr-graph`'s `lr-viewport-change` detail no longer carries `k`; read `zoom`, which holds the same
  scale. `npx lyra-ui-migrate --origin=lyra-v31 --check src` reports each listener to review.
- `lr-filter-bar`, `lr-data-grid`, `lr-message-feedback` and `lr-eval-dataset` drop listeners for
  the removed `lr-menu-item-change` and `lr-chip-select` events, which no component dispatches.
- `lr-flow-canvas` documents `lr-edge-activate` without the removed `source`/`target` fields.
- `lr-file-tree` forwards its `.strings` overrides to the inner tree, so a `noData` override
  reaches the empty state of object data.
