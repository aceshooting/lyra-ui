---
"@aceshooting/lyra-ui": minor
---

Add accessible-table totals and a knowledge-graph selection event:

- `<lr-chart>`: `stackTotals` now also feeds the generated accessible data table with a per-axis
  total column (localized `chartTotal`/`chartAxisTotal` header), and only activates when `stacked`
  is set (previously it could draw totals on unstacked bar/line charts). `valueFormatter` gains a
  `'table'` context so callers can format the new total cells and existing value cells consistently.
- `<lr-lite-chart>`: new `tableCellFormatter` property formats the built-in multi-series accessible
  table's numeric cells (including its new opt-in `tableTotals` total column for stacked bar
  charts), via the new `LyraLiteChartTableCellFormatter`/`LyraLiteChartTableCellContext`/
  `LyraLiteChartTableCellKind` types.
- `<lr-knowledge-graph-explorer>`: emits a new `lr-selection-change` event whenever its
  self-managed `selectedNodeId` changes from search, graph, neighbor, path, entity-card,
  invalidation, or popover-close interactions (direct host assignment stays silent).
