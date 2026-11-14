---
'@aceshooting/lyra-ui': patch
---

Refresh cached message widgets when updated action payloads change which fields share an object. Widget actions now emit the current reference relationships, while equivalent shared or cyclic payloads keep their widget document stable across unrelated text updates.

The fix adds 68 runtime bytes to the unchanged package inventory and 44 raw bytes to the packed core bundle. Only those exceeded ceilings advance to the next 64-byte boundaries; compressed bundle ceilings remain unchanged.
