---
"@aceshooting/lyra-ui": minor
---

`<lyra-heatmap>`: fixed `role="img"` conflicting with the canvas's own focusable, keyboard-interactive
descendant (arrow-key roving focus, Enter/Space activation) — now `role="group"`, matching
`lyra-lite-chart`/`lyra-word-cloud`'s existing pattern. Added `cellText?: (pos, value) => string`, a
formatter hook for the per-cell hover tooltip and keyboard live-region announcement (both draw from the
built-in English template by default; this is additive, not breaking). Also fixed calendar mode's date
label formatting, which hardcoded the literal `'en'` locale instead of the runtime locale.
