---
"@aceshooting/lyra-ui": minor
---

`lr-icon`'s `fixed-width` attribute (`fixedWidth` property) and its `--lr-icon-fixed-width` custom property are deprecated, with removal no earlier than 23.0.0; both keep working unchanged until then. Setting `fixed-width` logs one development-mode warning per page. The default canvas already gives every icon the same 1.25em box, so a column of icons lines its labels up without it. For the wider 1.5em box, set `lr-icon { inline-size: var(--lr-size-1-5em); }` on the host. One geometry difference: `fixed-width` squeezes every glyph's svg to 1em wide, while under a host `inline-size` a glyph wider than 1em keeps its intrinsic width (up to the box). Square glyphs, including every built-in one, render identically.
