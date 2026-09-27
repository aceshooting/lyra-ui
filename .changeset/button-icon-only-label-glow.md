---
"@aceshooting/lyra-ui": patch
---

An icon-only `lr-button` no longer clips a glow around its glyph. When the default slot holds a single text-free element, such as a `gemstoneGlyph()` inside a `data-lr-gemstone-selected` wrapper, the button is detected as icon-only, but its `label` part kept the `overflow: hidden` that truncates text labels. A `filter: drop-shadow()` halo, including `gemstoneSelectedGlyphStyles`' own, was cut to the label's rectangle and showed as a square behind the gem. In the detected icon-only state the label now leaves paint overflow visible. A text label keeps its clip and ellipsis, including one beside a glowing glyph. The `start`/`end` adornment wrappers still clip, so put a glowing glyph in the default slot on its own. Hit area, focus ring, label box and RTL layout are unchanged. `lr-icon-button` already left a slotted glyph's glow unclipped; a regression test now covers it. There is no new option or token.
