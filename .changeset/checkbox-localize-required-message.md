---
"@aceshooting/lyra-ui": minor
---

`lyra-checkbox`'s built-in required-field validation message ("Please check this box if you want
to continue.") now routes through `this.localize()`, overridable via `.strings`/
`registerLyraLocale()`. Default English output is unchanged when no override is set.
