---
"@aceshooting/lyra-ui": minor
---

`<lr-swatch-picker>` gains a wrapping hook, and the selected-gemstone presentation becomes
importable so a trigger outside the picker can match it.

- `--lr-swatch-picker-wrap` (default `wrap`) sets `flex-wrap` on the swatch row. The row's wrapping
  was hardcoded while `--lr-swatch-picker-gap` and `--lr-swatch-picker-hit-size` were already
  themeable, so a picker inside a fixed-width popover — where a second row changes the panel height
  and moves the popover under its trigger — had to reach past the API with a
  `::part(base) { flex-wrap: nowrap; }` rule. A custom property rather than an attribute, so it
  inherits through wrappers like the gap and hit-size hooks beside it. The default reproduces
  today's rendering byte-identically.
- New `gemstoneSelectedGlyphStyles` export (a `CSSResult`, alongside `gemstoneGlyph()`) carries the
  treatment that makes a gemstone read as *selected*: the looping brightness shine, the coloured
  drop-shadow halo, and the reduced-motion rule. Until now only the glyph markup was exported and
  the presentation lived inside the picker's own stylesheet, so an application header showing the
  active accent on its own trigger button — two views of one piece of state, a few pixels apart —
  had to re-implement the keyframes, the halo and the reduced-motion behaviour and could then drift
  from the picker at the next release. Opt in by importing the stylesheet and setting the documented
  `data-lr-gemstone-selected` attribute on the element wrapping the glyph; it is themeable through
  `--lr-gemstone-selected-color`, `--lr-gemstone-selected-blur` and
  `--lr-gemstone-selected-shine-duration`.

The reduced-motion branch hand-writes `animation: none` rather than relying on the ambient duration
token collapsing: that token shortens the loop to an imperceptible 0.001ms but leaves it *infinite*,
which is not a stopped animation. Anything forking this treatment had to know that; now nothing has
to.
