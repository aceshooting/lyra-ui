---
"@aceshooting/lyra-ui": major
---
lr-data-grid: Alt+Arrow on a column header no longer resizes the column, because Alt+Arrow is the browser's back/forward shortcut on Windows and Linux; it is now left to the browser. Migration: Tab to the column's resize separator and use ArrowLeft/ArrowRight (Shift for 50px steps, Home/End for the minimum/authored maximum).
