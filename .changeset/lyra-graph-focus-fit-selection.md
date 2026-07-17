---
"@aceshooting/lyra-ui": minor
---

`lyra-graph` gains a programmatic camera (`focusNode(id, { zoom? })`, `fit({ padding? })`, both
reduced-motion-aware rAF tweens that keep d3-zoom's own state consistent), a declarative
`focusId` twin (centers once, renders a persistent `focus-halo` ring), and a controlled selection
model (`selectionMode: 'none' | 'single' | 'multiple'`, `selectedNodeIds`/`selectedLinkIds`,
`lyra-selection-change`) mirroring `lyra-heatmap.selectedCell`'s controlled contract — the
component only ever emits intent, never assigns the selection props itself. Fully additive: default
`selectionMode: 'none'` and unset `focusId` reproduce today's behavior exactly.
