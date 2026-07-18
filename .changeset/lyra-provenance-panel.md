---
"@aceshooting/lyra-ui": minor
---

Adds `<lyra-provenance-panel>`: the grounding breakdown for one answer — a four-section disclosure
panel (Entities / Relationships / Communities / Text chunks) composing `lyra-entity-chip`,
`lyra-path-strip`, compact `lyra-community-card`s, and a compact `lyra-chunk-inspector`. Every child
event bubbles straight through unmodified; its own `lyra-toggle` event tracks per-section
expand/collapse state, which survives streaming `provenance` reassignment.
