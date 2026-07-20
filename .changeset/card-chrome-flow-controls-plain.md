---
"@aceshooting/lyra-ui": minor
---

`lr-flow-controls` gains `appearance="plain"` (reflected, `'card' | 'plain'`, default `'card'`), for
clusters placed in a host toolbar or panel that already draws its own surface. `plain` drops
`[part="base"]`'s border, background, padding, corner radius **and** its floating-surface
`box-shadow` — a lift shadow with no surface under it reads as a stray smudge — matching what
`lr-flow-run-overlay`'s `plain` already does.

The cluster keeps its layout, its `orientation` axis, every button's shared minimum hit area
(`--lr-icon-button-size`) and their hover/focus rings. No `compact` is offered: the padding is
already the smallest spacing step, and the only remaining room is that hit-area floor.

The existing `for`, `orientation` and `hideLock` properties are now documented too. An unset cluster
renders byte-identically to before.
