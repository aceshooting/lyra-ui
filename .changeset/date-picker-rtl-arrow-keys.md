---
"@aceshooting/lyra-ui": patch
---

Fix `lyra-date-picker`'s day-grid keyboard navigation to swap ArrowLeft/ArrowRight under `dir="rtl"`, matching the grid's own visual mirroring (the day cells use unset `direction`, so the browser already lays them out right-to-left). ArrowUp/ArrowDown (by week) are unaffected.
