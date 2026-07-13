---
"@aceshooting/lyra-ui": minor
---

`lyra-thinking-panel`'s default header label ("Thinking") and its duration-display text ("Thought
for …"/"Thinking…") now route through `this.localize()`, overridable via
`.strings`/`registerLyraLocale()`. An explicit `label` still wins verbatim. Default English
output is unchanged when no override is set.
