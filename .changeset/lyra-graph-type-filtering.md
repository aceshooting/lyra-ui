---
"@aceshooting/lyra-ui": minor
---

`lyra-graph` gains `hiddenTypes: string[]`, hiding every node whose `type` is listed (plus incident
links) from rendering, the simulation, the keyboard roving ring, and the accessible data list/
counts. Positions round-trip via a new remembered-position cache, so toggling a type off and back
on restores each node where it was instead of re-randomizing. Fully additive — an empty
`hiddenTypes` (the default) renders every node/link exactly as before.
