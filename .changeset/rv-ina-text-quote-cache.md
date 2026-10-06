---
"@aceshooting/lyra-ui": patch
---
Text viewers painting more than 64 text-quote highlights no longer re-scan the whole document for every highlight on each repaint (for example when `activeHighlightId` changes), which on large documents also let the per-pass work budget leave some highlights unpainted: quote lookups are cached for a full paint pass and kept in least-recently-used order, and a lookup no longer allocates an 80 KB buffer up front.
