---
"@aceshooting/lyra-ui": minor
---

`lyra-conversation-item` gains a `meta` slot (small, non-focusable structured fields below the
title/excerpt — e.g. a day label, project name, cost) and an `excerpt` slot that wins over the
existing `excerpt` property whenever it has assigned content, mirroring `lyra-timeline-item`'s own
`timestamp` slot-wins-over-property pattern. Previously a consumer needing a rich excerpt (e.g. a
search-hit snippet with `<mark>` highlighting) or a multi-field meta line had to flatten that
structure into the plain-text `excerpt` property or hand-roll the row entirely.
