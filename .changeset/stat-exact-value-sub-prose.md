---
"@aceshooting/lyra-ui": minor
---

`<lyra-stat>`: added `exact-value` (shown as a hover/focus tooltip on the headline value, e.g.
`value="$1.2K" exact-value="$1,204.37"`), a `sub` property/slot (a secondary line distinct from
`caption`, e.g. a comparison-period label), a `prose` boolean (renders `value` as smaller/lighter text
with `unit` hidden, for a loading/status message in place of a numeric value), and a `compact` boolean
(tighter padding for constrained spaces — same convention as `lyra-empty`'s and `lyra-widget`'s
`compact`).
