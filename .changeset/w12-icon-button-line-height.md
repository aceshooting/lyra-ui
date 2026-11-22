---
'@aceshooting/lyra-ui': patch
---

`lr-icon-button` keeps its exact `--lr-icon-button-size` square when the slotted glyph sits inside an inline wrapper (a `<span>` around an `<svg>`): the native button now sets `line-height: 1`, so a large root font size or a tall inherited line-height no longer grows the box past the token.
