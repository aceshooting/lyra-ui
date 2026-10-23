---
'@aceshooting/lyra-ui': patch
---

Keep image catalog updates and lazy image-provider changes in the same map resource transaction. Updating both after initialization, or replacing a provider while images are preparing, now preserves the live map and waits for the current resources.
