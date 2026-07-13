---
"@aceshooting/lyra-ui": minor
---

`lyra-tool-select-dialog`'s dialog title, search placeholder, "use default tools" switch label
and hint, category count/"Other" fallback, tools-enabled summary, no-matches message, and the
no-tools-available empty state now route through `this.localize()`, overridable via
`.strings`/`registerLyraLocale()`. Default English output is unchanged when no override is set.
