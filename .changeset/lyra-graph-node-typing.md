---
"@aceshooting/lyra-ui": minor
---

`lyra-graph` gains `GraphNode.type` and a new `nodeTypes` property declaring each type's legend
label, fill color, and shape (`circle`/`square`/`diamond`). Fill resolution precedence is
`node.color` > the type's own color > an ordered categorical fallback palette
(`--lyra-graph-cat-1`…`--lyra-graph-cat-8`, new tokens) by the type's index in `nodeTypes` >  the
existing untyped default. Typed nodes also gain richer spoken text ("{label} ({type})"). Fully
additive — a graph with no `type`/`nodeTypes` set renders identical circles, unchanged.
