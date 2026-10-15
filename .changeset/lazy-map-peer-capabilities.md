---
'@aceshooting/lyra-ui': patch
---

Reduce unused MapLibre exports retained by the lazy map loader while preserving constructor bindings, worker configuration, version access, and default-export compatibility. This is a small payload reduction; the peer's large renderer remains a separate optimization concern.
