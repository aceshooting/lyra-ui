---
"@aceshooting/lyra-ui": patch
---
`lr-graph` and `lr-flow-canvas` layered layouts allocate one waypoint chain per node pair, so parallel or reciprocal long edges no longer widen the intermediate layers.
