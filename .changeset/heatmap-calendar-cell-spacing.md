---
"@aceshooting/lyra-ui": minor
---

`lr-heatmap` calendar mode now honours explicitly set `cell-gap-x`, `cell-gap-y` and `cell-radius`, so a GitHub-style contribution graph with rounded, visibly spaced cells no longer needs a hand-built matrix. Painting, hit-testing, labels, selection and `lr-cell-click` all follow the spacing; calendars that leave these unset are unchanged. A new read-only `calendarGeometry` getter reports the painted calendar layout (exported type `LyraHeatmapCalendarGeometry`).
