---
"@aceshooting/lyra-ui": patch
---

`lr-avatar`'s `image`, `lr-attachment-chip`'s `thumbnail-src` and file-object preview URL, and
`lr-flag`'s pre-resolved `src` are now validated through the shared `safeMediaSrc()` helper before
reaching an `<img src>` sink, rejecting `javascript:`/other unsafe schemes. Each falls back to its
existing placeholder state (initials, the generic file glyph, or an empty render) instead of
rendering an unsafe URL.
