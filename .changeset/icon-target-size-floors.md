---
"@aceshooting/lyra-ui": patch
---

`lr-xml-viewer` treats `--lr-icon-button-size` as a floor

`lr-xml-viewer`'s node `[part='toggle']` is an interactive button that pinned the shared
minimum-target token as a fixed `inline-size`/`block-size` with `padding: 0` and no floor — the
opposite of what the token's own definition documents ("components pad out to this via
`min-inline-size`/`min-block-size`, not by growing the glyph itself"). It now sizes its glyph box at
`--lr-size-1-25rem` with `min-inline-size`/`min-block-size: var(--lr-icon-button-size)`, mirroring
`lr-code-block`'s equivalent toggle, so lowering the token shrinks the hit area but never squashes
the chevron.
