---
"@aceshooting/lyra-ui": minor
---

Add `lyra-poll-status`: a "next scheduled refresh" countdown with a built-in pause control -- a
ticking M:SS display, a "Refreshing…" due state, and an internal live region announcing phase
transitions, mirroring `lyra-stream-status`'s own composition for a different concern (a scheduled
interval, not transport/connection health).
