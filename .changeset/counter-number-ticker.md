---
'@aceshooting/lyra-ui': minor
---

Add `<lr-counter>`, a countdown and count-up clock with locale-aware unit labels, per-unit and
`finished` slots, `paused`, `delimiter`, `largest-unit`/`smallest-unit` and an `lr-finish` event, and
`<lr-number-ticker>`, a number that counts to its value when scrolled into view with `Intl.NumberFormat`
options, `eager`, `restart()` and an `lr-finish` event. Both honor reduced motion and keep the animated
text out of the accessibility tree.
