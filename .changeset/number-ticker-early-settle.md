---
'@aceshooting/lyra-ui': minor
---

`lr-number-ticker` settles early: on the first frame whose formatted text equals the formatted final
value, it shows that value, leaves `:state(counting)` and emits `lr-finish`, instead of repainting the
same text until `duration` ends. With the default ease-out curve, `lr-finish` now fires when the number
visibly stops. A `value` change during a count still counts on from the number shown, and reduced
motion turning on mid-count still settles at once.
