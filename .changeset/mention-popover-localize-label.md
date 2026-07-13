---
"@aceshooting/lyra-ui": minor
---

`lyra-mention-popover`'s default listbox accessible name ("Suggestions") now routes through
`this.localize()`, overridable via `.strings`/`registerLyraLocale()` — matching the already-shared
`noMatches` key its empty-state row uses. An explicit `label`/`empty-text` value still wins
verbatim. Default English output is unchanged when no override is set.
