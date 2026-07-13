---
"@aceshooting/lyra-ui": minor
---

`lyra-menu`'s `role="menu"` popup default accessible name ("Menu") now routes through
`this.localize()`, overridable via `.strings`/`registerLyraLocale()`. An explicit `label` value
still wins verbatim. Default English output is unchanged when no override is set.
