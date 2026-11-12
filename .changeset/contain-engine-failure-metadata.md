---
'@aceshooting/lyra-ui': patch
---

Keep the fallback renderer available when a 3D engine rejects with an object whose failure code cannot be read, including a throwing accessor or revoked proxy. Classify that rejection as an engine error without throwing again while handling the original failure.
