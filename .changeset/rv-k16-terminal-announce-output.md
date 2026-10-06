---
"@aceshooting/lyra-ui": patch
---
lr-terminal: with `announce-output`, a carriage-return rewrite or a write past `max-scrollback` announces only the text that write produced, and a write no longer rebuilds the whole buffer's text or re-searches the whole log.
