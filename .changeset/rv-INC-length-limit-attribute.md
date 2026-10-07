---
"@aceshooting/lyra-ui": patch
---
`lr-input`, `lr-textarea`, `lr-code-editor`, `lr-chat-composer` and `lr-prompt-input`: an empty `minlength`/`maxlength` attribute now means no limit (it parsed as 0 and blocked typing), and fractional limits truncate the same way everywhere.
