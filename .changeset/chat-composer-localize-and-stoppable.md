---
"@aceshooting/lyra-ui": minor
---

`lyra-chat-composer`'s action button labels ("Send message"/"Stop generating") now route through
`this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Also adds `stoppable: boolean =
true` — when set to `false`, the button never renders as a Stop/cancel control while busy; it stays a
disabled Send button instead, for backends with no cancellation endpoint. Default behavior is
unchanged.
