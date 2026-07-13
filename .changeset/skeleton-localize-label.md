---
"@aceshooting/lyra-ui": minor
---

`lyra-skeleton`'s default accessible name ("Loading…") now routes through `this.localize()`
(reusing the shared `loading` key), overridable via `.strings`/`registerLyraLocale()`. An
explicit `label` still wins verbatim. Default English output is unchanged when no override is set.
