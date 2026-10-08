---
'@aceshooting/lyra-ui': patch
---

Internal cleanup: the unused `restoreFromStorage()` helper is removed from the internal persisted-restore module (it was never part of the public API); popover and tooltip share one anchor-identity tracker and trigger resolver.
