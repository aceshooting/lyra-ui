---
"@aceshooting/lyra-ui": minor
---

`lyra-stream-status`'s built-in stalled-message default ("Taking longer than usual…") and its
three live-region announcements ("Connection stalled."/"Connection restored."/"No longer
stalled.") now route through `this.localize()`, overridable via `.strings`/`registerLyraLocale()`.
Default English output is unchanged when no override is set.
