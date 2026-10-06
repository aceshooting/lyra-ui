---
"@aceshooting/lyra-ui": patch
---
lr-data-grid: the client pipeline (row projection, filtering, search, sorting, paging and display rows) now runs once per update instead of about ten times, scrolling a virtualized body no longer re-runs it at all, and sorting reads each row's sort value once per sort instead of twice per comparison, so large sorted grids scroll and respond without stalls.
