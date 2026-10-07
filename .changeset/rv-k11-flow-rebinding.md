---
"@aceshooting/lyra-ui": major
---
lr-flow-canvas, lr-flow-run-status, lr-flow-node: assigning the same `nodes`, `edges`, `selectedNodeIds`, `selectedEdgeIds`, `decorations`, `inputs` or `outputs` value a property last received is now a no-op, so a parent re-render no longer cancels an in-progress drag or connection, re-runs auto-layout or resets the selection. Migration: after changing a collection or record, assign a new one (for example `canvas.nodes = [...nodes]`).
