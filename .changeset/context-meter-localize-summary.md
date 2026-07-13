---
"@aceshooting/lyra-ui": minor
---

`lyra-context-meter`'s accessible summary ("{used} of {total} used" / "{used} used") now routes
through `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Default English
output is unchanged when no override is set.
