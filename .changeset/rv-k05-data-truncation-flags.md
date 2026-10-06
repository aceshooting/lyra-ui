---
"@aceshooting/lyra-ui": minor
---
lr-data-grid and lr-table: new read-only `dataTruncated` (grid) and `rowsTruncated` (table) getters report when rows beyond the 10,000-row budget were omitted, and lr-data-grid no longer silently prunes controlled `selectedRowKeys` whose rows lie beyond that budget.
