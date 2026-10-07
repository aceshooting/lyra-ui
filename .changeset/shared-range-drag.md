---
"@aceshooting/lyra-ui": patch
---

Share slider and time-range drag state, pointer geometry, nearest-handle selection, and capture cleanup. Concurrent gestures retain their own handles, while cancellation, disconnection, and adoption release captured pointers without committing a change.
