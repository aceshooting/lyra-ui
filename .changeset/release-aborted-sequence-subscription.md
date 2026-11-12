---
'@aceshooting/lyra-ui': patch
---

Release the clock subscription when a sequence playback binding is aborted during synchronous catch-up, so a retired binding cannot keep scheduling animation frames.
