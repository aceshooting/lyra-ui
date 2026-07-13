---
"@aceshooting/lyra-ui": minor
---

`lyra-dock-panel`'s resize-handle and collapse-toggle `aria-label`s ("Resize panel",
"Collapse panel"/"Expand panel") now route through `this.localize()`, overridable via
`.strings`/`registerLyraLocale()`. Default English output is unchanged when no override is set.
