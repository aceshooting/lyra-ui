---
"@aceshooting/lyra-ui": minor
---

Adds `<lyra-suggestion-chips>`: starter prompts (empty thread) and follow-up suggestions (after a
response) as a horizontally scrollable chip row (or a wrapping grid via `wrap`), each with an optional
secondary detail line. Fires `lyra-suggestion-select` (`{ id, label }`) on activation — never writes
into a composer or sends anything itself. Keyed `repeat()` on `id` preserves focus across a mid-stream
suggestions replacement.
