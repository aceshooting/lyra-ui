---
"@aceshooting/lyra-ui": minor
---

`lyra-heatmap` gains a `selectedCell` property (`{ row, col }` in matrix mode, `{ date }` in
calendar mode) — a controlled, consumer-owned marker (mirroring `lyra-lite-chart`'s
`selectedIndex`) that draws a persistent canvas ring independent of keyboard focus, appends a
"Selected: ..." description to the host's own `aria-label` so it stays discoverable after focus
moves elsewhere, and appends a "(selected)" suffix to the keyboard live-region announcement. Unset
(the default, `null`) reproduces today's exact output.
