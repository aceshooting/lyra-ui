---
'@aceshooting/lyra-ui': patch
---

Remove an unpositioned date-input calendar from layout when its positioning runtime fails, including openings through a property binding or after reconnection. Failed openings settle without reporting a successful show, release the rendered calendar, and remain retryable. An obsolete placement cannot close a newer calendar.
