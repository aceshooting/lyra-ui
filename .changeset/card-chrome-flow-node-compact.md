---
"@aceshooting/lyra-ui": minor
---

`lr-flow-node` now exposes its card as a CSS part and gains a density escape:

- The bordered, filled card is reachable as `::part(card)` (it keeps its `.card` class, so nothing
  that already targeted it changes).
- New reflected `compact` boolean tightens the card padding for dense canvases and palette previews,
  tunable via `--lr-flow-node-compact-padding` (default `var(--lr-space-xs)`) and
  `--lr-flow-node-compact-gap` (default `var(--lr-space-2xs)`). The border, background, shadow and
  the `selected`/`status="running"` treatments all stay.

Two documentation/CSS bugs are fixed in passing: the `base` part is documented as what it actually
is (the row wrapping the handles and the card, carrying no chrome of its own), and a duplicated
`min-inline-size: 0` that overrode the card's own minimum width is removed — the documented
`--lr-flow-node-min-inline-size` custom property was dead until now and once again sets the card's
minimum inline size (default `11rem`).

An unset node renders as before apart from that restored minimum width.
