---
"@aceshooting/lyra-ui": major
---
lr-word-cloud: assigning the same `words`, `palette` or `legend` array it last received is now a no-op, and an equal `domain` pair no longer counts as a change, so a parent re-render no longer relays out the cloud, drops the keyboard cursor and focus ring, or re-rolls the rotations of a `word-rotation="mixed"` cloud. Migration: after changing a collection, assign a new array (for example `cloud.words = [...words]`).
