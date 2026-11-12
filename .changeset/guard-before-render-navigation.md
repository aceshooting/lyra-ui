---
'@aceshooting/lyra-ui': patch
---

Allow file-tree expansion and collapse and thinking-panel and transcript-feed scrolling methods to be called before the first connection without throwing. Scrolling still re-engages follow without emitting a user transition, and the methods remain usable after rendering.
