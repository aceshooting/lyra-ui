---
"@aceshooting/lyra-ui": minor
---

`lyra-heatmap` calendar mode gains a `weekdayLabelText?: (jsWeekday: number) => string | undefined` hook to override the weekday-axis label text (e.g. for a consumer with its own locale/translation state independent of the browser's runtime locale).
