---
"@aceshooting/lyra-ui": minor
---

Adds `<lyra-mind-map>`: a radial expandable topic tree (NotebookLM-style Mind Maps) — zero-dependency
SVG, closed-form arc-subdivision layout in its own `mind-map-layout.ts` module, single-tab-stop
keyboard roving (mirroring `lyra-word-cloud`), and `lyra-topic-select`/`lyra-topic-toggle` events.
Multiple root topics hang off an implicit center hub; expansion state is keyed by topic id and
survives streaming `topics` reassignment.
