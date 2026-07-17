---
"@aceshooting/lyra-ui": minor
---

Adds `<lyra-sequence-strip>`: a compact, one-thin-cell-per-item strip visualizing a sequence of
categorical states with an optional secondary per-cell marker (e.g. a CI build-step strip, a
log-severity strip, or — the motivating case — a per-turn conversation-history strip). Pure CSS/flex,
zero dependencies, `role="img"` with an auto-generated per-category "label: count" `aria-label`
summary (matching `lyra-sparkline`'s accessibility model), plus a pointer-hover tooltip showing each
item's own label.
