---
"@aceshooting/lyra-ui": minor
---

`lyra-widget` gains a leading `icon` slot, rich `label`/`sublabel` slot overrides (mirroring
`lyra-stat`'s `caption`/`sub` pattern), and a `views` property driving a built-in header toggle
group plus one named slot per entry -- for a chart/table (or similar) toggle inside the same card
chrome, so a consumer no longer has to hand-roll that shell around a bare default slot.
