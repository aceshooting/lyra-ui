---
'@aceshooting/lyra-ui': patch
---

Preserve ordinary font-family records when snapshotting map styles so the full MapLibre engine accepts native font declarations on initial load and style replacement. Font descriptors remain detached and immutable, including family names that match inherited object properties.
