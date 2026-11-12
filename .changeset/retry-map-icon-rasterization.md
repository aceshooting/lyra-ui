---
'@aceshooting/lyra-ui': patch
---

Retry incomplete map point icon rasterization on later declarative paint updates. Failed recoloring keeps the previous palette intact and no longer caches an unapplied color, allowing icons to recover when canvas allocation becomes available again.
