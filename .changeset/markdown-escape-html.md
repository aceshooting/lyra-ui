---
"@aceshooting/lyra-ui": minor
---

`lyra-markdown` gains `escapeHtml`, an opt-in property overriding `marked`'s `html` renderer hook
to emit escaped text instead of parsed/sanitized markup -- for a consumer rendering arbitrary
already-written content (transcripts, logs) where a stray angle bracket should render as visible
text rather than a real DOM element, without giving up GFM tables/lists/etc.
