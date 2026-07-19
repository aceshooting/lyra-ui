---
"@aceshooting/lyra-ui": minor
---

`lr-sequence-strip`: add `showLegend` for a persistent category key.

The strip colors each cell by category, but the only way to read that mapping was to hover every
cell one at a time — consumers were hand-rolling a swatch key underneath instead. `showLegend`
(attribute `show-legend`, reflected, default `false`) now renders that key from the `categories`
array the component already receives, as `legend` / `legend-item` / `legend-swatch` /
`legend-label` CSS parts, with `--lr-sequence-strip-legend-swatch-size` to resize the chips.

The legend is deliberately static — it lists every `categories` entry whether or not any item uses
it, and toggles nothing (`lr-graph-legend` remains the interactive, filtering legend). Because it
only repeats the category names the strip already announces through `[part="base"]`'s `role="img"`
summary, the whole legend is `aria-hidden`: visible on screen, announced exactly once. Left unset,
rendering is unchanged.
