---
'@aceshooting/lyra-map': patch
---

Prevent a scene replacement from reporting an installed state after a failed native callback retires its layer. Validate the native installation lifetime during reconciliation and commit so later accepted input can recover with a drawable scene.
