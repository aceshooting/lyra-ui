---
"@aceshooting/lyra-gen": minor
---

New `@aceshooting/lyra-gen/data-export.js` extracts the data of every data-bearing node of a view (tables, charts, data grids, heatmaps, funnels, stats, gauges, sparklines, treemaps, sankeys, word clouds) as named tables with `exportViewData()`, writes them as RFC 4180 CSV with spreadsheet formula protection, an optional byte order mark and a size bound with `toCsv()`, and builds a standalone, script-free, print-styled HTML document for printing to PDF or rasterizing with `exportPrintableHtml()`. New `@aceshooting/lyra-gen/dashboard-copy.js` adds `copyDashboardPanel()`, which copies one saved panel subtree into another view as a validated patch insertion with collision-free ids, dropping bindings, reads and actions the target catalog does not allow.
