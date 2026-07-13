---
"@aceshooting/lyra-ui": minor
---

`lyra-graph` now renders a link whose `target` isn't a real node as a short dashed stub off the
source's position, instead of silently dropping it -- for a wiki-style `[[link]]`/broken-reference
visualization where "this edge exists but its endpoint doesn't" is a meaningful state, not noise.
A dangling `source` is still dropped (no position to draw a stub from).
