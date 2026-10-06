---
"@aceshooting/lyra-ui": patch
---
lr-data-grid: `date-range` filters now read `YYYY-MM-DD` bounds and cell values as calendar days in the user's time zone, so outside UTC a "Jan 2 to Jan 2" filter no longer hides most of Jan 2 or admits the previous evening.
