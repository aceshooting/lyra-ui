---
"@aceshooting/lyra-gen": minor
---

New opt-in `dashboardCatalog()` overlay and `liveDashboardCatalog` preset add reviewed live-dashboard roles — `gauge`, `sparkline`, `progress-bar`, `progress-ring`, `budget-meter`, `number-ticker`, `funnel`, `poll-status`, `tabs`/`tab`/`tab-panel`, `details`, `timeline`/`timeline-item`, `series-chart`, `treemap`, `sankey`, `word-cloud`, `heatmap`, `data-grid`, `time-range` and `filter-bar` — each rendering from plain bounded JSON with host-owned formatters and callbacks. `mapCatalog(base, { mapStyle })` adds a `map` role with bounded markers and camera over a host-owned basemap, plus choropleth values keyed to a host-declared region set when `regions` is supplied.
