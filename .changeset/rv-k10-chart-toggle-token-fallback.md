---
"@aceshooting/lyra-ui": major
---
lr-box-plot and lr-lite-chart: `--lr-box-plot-data-table-toggle-hover-bg`/`-active-bg` and `--lr-lite-chart-data-table-toggle-hover-bg`/`-active-bg` now fall back to the chart family's shared `--lr-chart-data-table-toggle-hover-bg`/`-active-bg` before the brand defaults, so one pair of tokens themes the data-table toggle of every chart. Migration: if you set the shared `--lr-chart-data-table-toggle-*` tokens on a container and relied on box plots or lite charts inside it keeping the default toggle colors, set their own `--lr-box-plot-…`/`--lr-lite-chart-…` toggle tokens explicitly.
