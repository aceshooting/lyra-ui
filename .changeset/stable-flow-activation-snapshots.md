---
'@aceshooting/lyra-ui': patch
---

Preserve the current scene's selection when a flow node or edge activation listener replaces the scene. The original action now retires before applying selection to the replacement, while later actions continue normally.
