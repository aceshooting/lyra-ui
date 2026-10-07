---
"@aceshooting/lyra-ui": patch
---
lr-popup no longer tears down and re-places itself, emitting extra `lr-reposition` events, when only its own internal paint state changes.
