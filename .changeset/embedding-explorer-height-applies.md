---
"@aceshooting/lyra-ui": minor
---

`<lr-embedding-explorer>`'s `height` property now actually sizes the plot. It was rendered as an
SVG `height` presentation attribute while the component's own stylesheet declared
`[part='plot'] { block-size: auto }` — and any stylesheet declaration outranks a presentation
attribute, so the property was inert at every value, including its documented `360px` default: the
plot always sized itself from the `viewBox` aspect ratio instead.

`height` is now published on the host as the new `--lr-embedding-explorer-height` custom property,
which `[part='plot']`'s `block-size` reads. Consequences worth knowing before upgrading:

- The default `height="360px"` now takes effect, so a plot wider than 640px is no longer as tall as
  its allocation implies. Set `height="auto"` to keep the previous aspect-ratio-preserved sizing.
- A value the browser cannot parse as a `block-size` is dropped rather than applied, leaving the
  `auto` behavior instead of collapsing the plot.
- A consumer's own `::part(plot) { block-size: ... }` rule still overrides `height`, and the
  narrow-allocation `min-block-size` floor still raises it.
