---
"@aceshooting/lyra-ui": minor
---

`lyra-conversation-item`'s "Untitled conversation" fallback title now routes through
`this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Default English output is
unchanged when no override is set.
