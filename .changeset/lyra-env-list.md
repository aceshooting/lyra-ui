---
"@aceshooting/lyra-ui": minor
---

Adds `<lyra-env-list>`: a masked key/value list for environment variables and secrets
(`<dl>`/`<dt>`/`<dd>` semantics), defaulting every entry to masked (a fixed eight-bullet run,
length-independent so value length is never leaked) with per-row reveal (`lyra-reveal-change`, state
keyed by name and position, and reset for a row whose name shifts position) and copy (`lyra-copy`,
always copies the real value). `revealable=false` for screen-share-safe hosts. Masking is
presentational, not a security boundary.
