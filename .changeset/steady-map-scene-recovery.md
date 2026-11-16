---
'@aceshooting/lyra-map': patch
---

Prevent a scene replacement from reporting an installed state after a failed native callback retires its layer. Validate the native installation lifetime during reconciliation and commit so later accepted input can recover with a drawable scene.

The lifetime guards add 204 unpacked runtime bytes to the map archive. Its unpacked size ceiling moves to the next 64-byte boundary above the measured 4,308,548 bytes; compressed size and file-count limits stay unchanged.
