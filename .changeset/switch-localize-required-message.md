---
"@aceshooting/lyra-ui": minor
---

`lyra-switch`'s built-in required-field validation message ("Please turn this on.") now routes
through `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Default English
output is unchanged when no override is set.
