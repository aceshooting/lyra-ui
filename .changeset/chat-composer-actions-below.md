---
'@aceshooting/lyra-ui': minor
---

`lr-chat-composer` gains `actions-layout="below"`: the textarea takes its own full-width line and the `start` and `end` slots share one row beneath it, `start` at the inline start and `end` at the inline end (also while `start` is empty, and mirrored under RTL). `min-rows`/`max-rows` growth and inner scrolling are unchanged, `lr-prompt-input` forwards the new value, and `reservations.css` (and `reservationStyles`) reserves the layout's taller resting footprint before upgrade.
