---
"@aceshooting/lyra-ui": patch
---

`lyra-poll-status`'s pause/resume button aria-label, due-state countdown text ("Refreshing…"), and its
three live-region announcements ("Paused."/"Resumed."/"Refreshing now.") now route through
`this.localize()`, overridable via `.strings`/`registerLyraLocale()` — the one component the 2.3.0/2.4.0
localization pass missed. Default English output is unchanged.
