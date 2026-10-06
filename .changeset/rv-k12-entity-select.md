---
"@aceshooting/lyra-ui": major
---
lr-path-strip and lr-community-card now emit the canonical `lr-entity-select` (path strip keeps `occurrenceIndex`), followed by the deprecated alias `lr-entity-activate`; listen for `lr-entity-select` only, since a listener on both names now runs twice. Held Enter/Space on lr-path-strip no longer re-activates.
