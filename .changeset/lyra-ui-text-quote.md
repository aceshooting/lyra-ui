---
"@aceshooting/lyra-ui": minor
---

Adds `internal/text-quote.ts`: dependency-free `text-quote` anchor resolution (quote/prefix/suffix ->
DOM `Range`, and the reverse — a selection `Range` -> a `text-quote` anchor with captured context).
Internal module with no public tag; used by the `DocumentAnchorTarget` mixin's default selection
handling and by `lyra-pdf-viewer`'s anchor/highlight resolution. No behavior change for any existing
component.
