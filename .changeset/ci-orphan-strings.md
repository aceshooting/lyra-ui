---
'@aceshooting/lyra-ui': patch
---

The unused `memoryPanelAddWithContext` message is removed; `lr-memory-panel` names its add action with `memoryPanelAddAccessibleName`, so move any override of the old key to that message.
