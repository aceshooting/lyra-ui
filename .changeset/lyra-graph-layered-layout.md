---
"@aceshooting/lyra-ui": minor
---

`lyra-graph` gains `layout: 'force' | 'layered'` (default `'force'`, unchanged). `'layered'`
computes a deterministic Sugiyama-lite layout instead of running d3-force — longest-path layering,
barycenter crossing reduction, cycle-safe (back edges reversed internally, the caller's data is
never mutated). The algorithm itself lives in a new shared, dependency-free
`src/internal/layered-layout.ts`, a standalone util suitable for any future layered-diagram
consumer. Node drag is disabled in layered mode; pan/zoom, keyboard, focus/fit, hulls, edge labels,
and type filtering all work identically to force mode. Fully additive — the default `layout:
'force'` reproduces today's simulation-driven layout exactly.
