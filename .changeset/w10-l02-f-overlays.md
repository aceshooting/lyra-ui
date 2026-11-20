---
'@aceshooting/lyra-ui': minor
---

- `lr-alert`: the leading icon and the countdown bar follow the appearance's ink, so `appearance="accent"` paints them on-loud instead of in the panel's own fill colour.
- `lr-callout`: the close button's default hover fill is a translucent mix toward the mix partner again, so non-brand variants and `appearance="accent"` keep a legible glyph; `--lr-callout-close-hover-bg` still overrides it.
- `lr-badge` / `lr-tag`: the `start` slot wrapper is inert and `aria-hidden`, like the leading icon of `lr-chip`, `lr-alert` and `lr-callout`; `end` stays exposed because it often carries a count. Move meaningful `start` content into the label.
- `lr-empty`: new `--lr-empty-padding`, `--lr-empty-gap`, `--lr-empty-icon-size` and `--lr-empty-compact-icon-size` tokens; the compact density (`size="s"` and below) now shrinks the icon to the m font size by default.
