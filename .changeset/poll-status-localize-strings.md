---
"@aceshooting/lyra-ui": minor
---

`lyra-poll-status`'s pause/resume button aria-label, due-state countdown text ("Refreshing…"), and its
three live-region announcements ("Paused."/"Resumed."/"Refreshing now.") now route through
`this.localize()`, overridable via `.strings`/`registerLyraLocale()`. It also now shows a distinct
"Paused" countdown state while `paused`, instead of freezing on whatever value it last displayed.
Default English output is unchanged when no override is set.
