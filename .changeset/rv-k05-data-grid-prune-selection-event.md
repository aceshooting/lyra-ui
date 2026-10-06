---
"@aceshooting/lyra-ui": major
---
lr-data-grid: when a client `data` refresh drops selected keys whose rows are gone, the grid now emits `lr-row-select` with the pruned selection instead of changing `selectedRowKeys` silently. Migration: a listener that treats every `lr-row-select` as a user action should allow for refresh-driven updates.
