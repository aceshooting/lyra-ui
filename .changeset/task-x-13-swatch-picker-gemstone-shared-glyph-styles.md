---
"@aceshooting/lyra-ui": minor
---

`<lr-swatch-picker mode="gemstone">`'s checked swatch now paints its automatic gemstone glyph
through `theme/gemstones.js`'s exported `gemstoneSelectedGlyphStyles` stylesheet -- the same
`CSSResult` a consumer can import and apply to a bare `gemstoneGlyph()` rendered anywhere else on
the page (for example a header trigger button showing the current selection before it opens the
picker in a popover) via the shared `data-lr-gemstone-selected` boolean attribute. Previously the
picker kept its own private copy of the halo/shine treatment, so a glyph rendered outside a picker
had to be hand-matched and could silently drift from it; now both consume the identical
stylesheet and keyframe, so they cannot.

Theme the automatic glyph's halo/shine through `--lr-gemstone-selected-color`/`-blur`/
`-shine-duration` (unchanged defaults, so an unstyled picker looks identical to before).
`--lr-swatch-picker-gemstone-selected-blur`/`--lr-swatch-picker-gemstone-shine-duration` still
theme a plain color-fill swatch or a consumer-supplied `icon` override while `mode="gemstone"`,
and their own defaults are now aliased onto the shared tokens above so the two families cannot
drift from each other either -- but a consumer who was previously setting one of these two
picker-specific properties specifically to restyle the automatic glyph's halo should switch to the
shared `--lr-gemstone-selected-*` property instead, since that override no longer reaches the
automatic glyph.
