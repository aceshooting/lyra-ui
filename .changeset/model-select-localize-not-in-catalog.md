---
"@aceshooting/lyra-ui": minor
---

`lyra-model-select`'s synthetic stale-value row badge ("not in catalog") now routes through
`this.localize('notInCatalog')`, so it can be overridden via `.strings`/`registerLyraLocale()` like
the component's other built-in message (`noMatches`). Default English text is unchanged.
