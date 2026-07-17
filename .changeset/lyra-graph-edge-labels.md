---
"@aceshooting/lyra-ui": minor
---

`lyra-graph` gains `showEdgeLabels` (default `false`) to draw each link's `label` as visible SVG
text at the segment midpoint, and `edgeLabelMinZoom` (default `0.6`) to hide all edge labels below
that zoom scale. A per-label length gate also hides a label whose measured text width exceeds 85%
of its edge's current on-screen length. Labels are `aria-hidden` (the accessible name already
carries `label` via the existing link announcement) and fully opt-in — a graph that never sets
`showEdgeLabels` renders no edge-label DOM at all.
