---
'@aceshooting/lyra-ui': patch
---

`lr-tool-call-chip`'s hover/focus tooltip and `lr-citation-badge`/`lr-entity-chip`'s floating preview popover now register with the shared overlay stack, so Escape correctly defers to a genuinely topmost overlay (e.g. a dialog opened on top) instead of always closing the preview first, and an open preview now also dismisses on Escape while only hovered, not only while focused.
