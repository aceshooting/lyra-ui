---
"@aceshooting/lyra-ui": patch
---

`lr-virtual-list` no longer traps a popup opened from inside a row underneath the rows that follow
it. `[part="row"]` sets `will-change: transform`, which makes every row its own stacking context, and
rows carried no `z-index` — so they painted in DOM order and each row painted over the previous one.
A `lr-menu` dropdown rendered in a row (for example through `lr-thread-list`'s `renderActions`) was
positioned, visible and hit-testable, yet painted *under* the next rows: its own `z-index: 900` only
orders siblings inside its row's context. The last row always looked correct, so small fixtures never
caught it.

`[part="row"]:focus-within` now lifts the row to `var(--lr-layer-content)` — the same layer
`[part="group"]` already uses — for exactly as long as something inside it holds focus. This also
stops outward focus rings on a row being clipped by later rows. Nothing changes when no row holds
focus.
