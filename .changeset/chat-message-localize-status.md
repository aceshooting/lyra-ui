---
"@aceshooting/lyra-ui": minor
---

`lyra-chat-message`'s visible status text ("Sending…"/"Responding…"/"Failed to send") and its two
live-region status-change announcements ("Message failed to send."/"Message complete.") now route
through `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Default English text is
unchanged.
