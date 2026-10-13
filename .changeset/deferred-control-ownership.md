---
'@aceshooting/lyra-ui': patch
---

Keep textarea auto sizing, page allocation frames, and initial menu, popover, dropdown, and accordion ownership inactive while disconnected. Restore current content and geometry on reconnect, and ignore callbacks retired by reconnection or document adoption.

The lifecycle guards add 81 gzip bytes to the complete registration bundle and 30 bytes to the menu's initial route. Only breached bundle ceilings advance to their exact measured sizes, with no added allowance.
