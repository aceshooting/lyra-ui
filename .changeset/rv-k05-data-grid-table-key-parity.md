---
"@aceshooting/lyra-ui": minor
---
lr-data-grid: `rowKey` now also accepts a `(row) => key` callback like lr-table (a function previously made every row disappear behind "No data"), and `selectedRowKeys`/`expandedRowKeys` accept any iterable such as lr-table's `Set` instead of silently clearing; the sort-event documentation no longer claims the commit event is identical to lr-table's.
