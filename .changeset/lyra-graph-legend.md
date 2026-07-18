---
"@aceshooting/lyra-ui": minor
---

Adds `<lyra-graph-legend>`: a node-type legend for a paired `lyra-graph`, rendering one swatch +
label + count row per §3.4 node type and doubling as a visibility filter. Event-decoupled from any
graph instance — a host forwards `graph.nodeTypes` in as `types` and forwards
`lyra-visibility-change`'s `hiddenTypes` back out to `graph.hiddenTypes`.
