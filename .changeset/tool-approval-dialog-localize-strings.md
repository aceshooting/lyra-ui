---
"@aceshooting/lyra-ui": minor
---

`lyra-tool-approval-dialog`'s heading text, generic tool-name fallback, args-editor accessible
name, invalid-JSON fallback error, and its Deny/Edit/Approve button labels now route through
`this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Default English output is
unchanged when no override is set.
