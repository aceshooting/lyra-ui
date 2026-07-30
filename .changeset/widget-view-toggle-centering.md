---
"@aceshooting/lyra-ui": patch
---

Center the glyph in an icon-only `<lr-widget>` view toggle. `[part="view-toggle"]` set
`align-items: center` but no `justify-content`, unlike the sibling `collapse-button` /
`fullscreen-button` rules, which set both. `min-inline-size` floors the pill at the square
icon-button size, so a 13px glyph inside a 40px pill has slack that the default
`justify-content: normal` (→ `flex-start`) dumps entirely on the trailing side — measured 4.5px off
true center once the asymmetric inline padding is counted, and plainly visible as an off-center
icon in a round toggle. A labeled toggle was never affected: its content already fills a pill that
sizes to fit.
