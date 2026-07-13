---
"@aceshooting/lyra-ui": minor
---

`lyra-graph`'s visually-hidden data-list `aria-label` ("Graph data") now routes through
`this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Default English output is
unchanged when no override is set.
