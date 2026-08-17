---
"@aceshooting/lyra-ui": patch
---

Fix `<lr-button>`'s start/end adornments claiming a 40%-of-row flex-basis instead of just being
capped at 40%.

A 9.0.0 change gave `[part~="start"]`/`[part~="end"]` `flex: 0 1 40%`, which sets the flex
*basis* to 40% of the button's own internal row -- a preferred size the flex algorithm tries to
honor before shrinking -- not merely `max-inline-size: 40%`'s ceiling. Because the basis is
self-referential (relative to the button's own internal row, unrelated to its position in the
page), even a small icon claimed a 40% preferred share before shrinking, squeezing
`[part="label"]`'s `flex: 1 1 auto` below what its text needed and ellipsizing labels that had
room to spare, with visible unused space left in the row. Adornments now use `flex: 0 0 auto`
(content-sized); `max-inline-size: 40%` remains as the actual cap for a genuinely oversized
adornment.
