---
"@aceshooting/lyra-ui": patch
---

`<lr-chart>` no longer tracks its resolved Chart.js draw-time chart-area geometry as a reactive
`@state()` field — recording it during Chart.js's own draw pass could trigger a second synchronous
Lit update mid-draw. It's now a plain private field with a microtask-coalesced `requestUpdate()`,
so repeated geometry updates within the same draw pass collapse into a single re-render.
