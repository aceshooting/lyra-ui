---
"@aceshooting/lyra-ui": minor
---

`lyra-tool-call-chip`'s visible status labels (Pending/Running/Success/Error/Denied, shared with
`lyra-tool-result-dialog`'s identical vocabulary) and its unnamed-tool fallback ("Tool call") now
route through `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Default English
output is unchanged when no override is set.
