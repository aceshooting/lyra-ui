---
"@aceshooting/lyra-ui": minor
---

`<lr-calendar-viewer>` accepts already-loaded plain events through a new `events` property (`LyraCalendarViewerEventRecord[]`: `id`, `title`, ISO 8601 `start`/`end`, `allDay`, `location`, `description`). Records render as text, in array order, through the same model and bounds as a parsed `.ics` document, and need no `ical.js` peer. Invalid dates are ignored for that field only. While `events` is non-null it takes precedence over `src`.

`<lr-geojson-viewer>` accepts an already-parsed GeoJSON `FeatureCollection`, `Feature` or geometry through a new `data` property. It is validated and bounded exactly like a fetched document, rendered from a private copy, and rejected with the same localized messages. While `data` is non-null it takes precedence over `src`.
