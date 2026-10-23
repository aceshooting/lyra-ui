---
'@aceshooting/lyra-ui': minor
---

`lr-map` gains `hashFormat` (attribute `hash-format`). `'unnamed'` makes `hash = true` read and write the raw engine's unnamed `#zoom/lat/lng[/bearing[/pitch]]` fragment, so existing deep links keep working, while preserving named fields after it. Only a valid camera in the owned field or token suppresses the initial fit; an unrelated or malformed fragment leaves the fit to run and is not overwritten.
