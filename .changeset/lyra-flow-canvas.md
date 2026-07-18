---
"@aceshooting/lyra-ui": minor
---

Adds `<lyra-flow-canvas>`: a dependency-free, pannable/zoomable DAG workflow canvas — HTML card
nodes with typed connection handles, SVG Bézier edges with arrowheads and labels, a shared layered
auto-layout for unpositioned nodes, and controlled selection/drag/connect gestures behind three
independent opt-in flags (`nodes-draggable`, `connectable`, `droppable`). Readonly viewer by default;
never mutates `nodes`/`edges` itself. Ships a `registerCompanion()` hook so `lyra-flow-minimap`,
`lyra-flow-controls`, and `lyra-flow-run-overlay` (following in subsequent releases) can attach
without reaching into its shadow DOM.
