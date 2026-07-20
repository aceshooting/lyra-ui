---
"@aceshooting/lyra-ui": minor
---

`lr-stat` gains two layout axes and stops reserving space for an absent label.

- `appearance="card" | "plain"` (default `card`, reflected). `plain` removes the border,
  background, padding, corner radius and the `block-size: 100%` stretch, so a stat can sit inline
  in prose, a toolbar or a table cell instead of only as a card. A `plain` stat with a safe `href`
  underlines its `[part="value"]` on hover/focus, since the card's border-color-shift affordance is
  invisible with no border; the focus ring is unchanged. `plain` also wins over `compact` when both
  are set, and drops `emphasis`'s accent edge (card chrome) while keeping its brand value tint.
- `orientation="vertical" | "horizontal"` (default `vertical`, reflected). `horizontal` lays label,
  value + unit, trend, sub and caption out on a single wrapping baseline row; `[part="spark"]` and
  `[part="rows"]` stay stacked on their own full-width line beneath it.
- `[part="label"]` is now `hidden` whenever `label` is empty, so a label-less stat no longer leaves
  a blank gap above its value. A non-empty label is never hidden and its `aria-labelledby` pairing
  with `[part="value"]` is unchanged.
