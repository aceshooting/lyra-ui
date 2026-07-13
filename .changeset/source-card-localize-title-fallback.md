---
"@aceshooting/lyra-ui": minor
---

`lyra-source-card`'s "Untitled source" fallback and its " — p. N" page-suffix format now route
through `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Default English output
is unchanged.
