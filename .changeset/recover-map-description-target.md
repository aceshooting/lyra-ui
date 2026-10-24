---
'@aceshooting/lyra-ui': patch
---

Keep map drawing failure handling responsive when the renderer temporarily cannot provide its canvas. Accessibility descriptions release the unavailable canvas and reconnect after the renderer recovers.
