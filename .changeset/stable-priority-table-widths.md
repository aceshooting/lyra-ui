---
'@aceshooting/lyra-ui': patch
---

Fix a table rendering loop near responsive column-hiding thresholds when expansion controls or row totals are present. Include those columns in the measured grid width so priority columns remain stable during loading, resizing, and reveal toggles.
