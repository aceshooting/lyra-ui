---
"@aceshooting/lyra-ui": minor
---

`lr-chat-composer` gains `appearance="plain"` (reflected, `'card' | 'plain'`, default `'card'`), so a
composer docked inside a chat panel, dialog footer or toolbar that already draws its own border
doesn't double the frame. `plain` drops `[part="base"]`'s border, background, padding and corner
radius; the row layout, disabled treatment and the send/stop button's own chrome are unaffected.

Focus stays visible either way. The card's only focus affordance is a border-color shift, and there
is no border left to recolor under `plain` (the internal textarea sets `outline: none`), so `plain`
swaps in an underline across the input row instead — drawn as an inset box-shadow from
`--lr-focus-ring-width`/`--lr-focus-ring-color`, so it costs no layout.

An unset composer renders byte-identically to before.
