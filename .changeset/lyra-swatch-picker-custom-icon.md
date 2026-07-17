---
"@aceshooting/lyra-ui": minor
---

`lyra-swatch-picker` options gain an optional `icon` field (`SwatchOption.icon`, mirroring
`lyra-segmented`'s `SegmentedItem.icon`): a consumer-supplied shape (e.g. a brand glyph) rendered in
place of the plain filled circle, exposed as `::part(swatch-icon)`. A `currentColor`-based SVG picks up
the option's `color` automatically through the swatch's `color` custom property, so consumers who
previously hand-rolled a row of colored icon buttons (rather than plain color circles) can now use the
picker directly.

The selected swatch also gains two new opt-in, off-by-default custom properties for a more emphatic
selected state: `--lyra-swatch-picker-selected-blur` (0 by default, a crisp ring; set a real length for
a soft glow tinted by the swatch's own color -- works for both a plain color circle and an icon swatch,
via a `box-shadow`/`drop-shadow` split so the glow follows the icon's actual silhouette rather than an
invisible transparent box) and `--lyra-swatch-picker-shine-duration` (0s by default, static; set a real
duration for a rhythmic brighten-and-settle pulse, disabled under `prefers-reduced-motion: reduce`).
Together they cover a "shining" gemstone-style accent-theme picker without changing the default look
for any existing consumer.
