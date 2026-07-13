---
"@aceshooting/lyra-ui": minor
---

`lyra-source-list`'s fallback header text ("Sources", used only when neither `label` nor
`label-plural` is set) now routes through `this.localize()`, overridable via
`.strings`/`registerLyraLocale()`. Default English output is unchanged when no override is set.
