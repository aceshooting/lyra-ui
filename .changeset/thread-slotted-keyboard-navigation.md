---
'@aceshooting/lyra-ui': patch
---

Restore ArrowUp, ArrowDown, Home and End navigation between slotted thread-list rows, skipping unavailable rows and respecting keys handled by row actions.

Keep rows assigned to named slots out of default-list navigation and `itemElement()` lookup until they join the default slot.

The default-slot filtering and keyboard listener add 13 gzip bytes to the component measurement. The full-library entry measures 1,483,084 gzip bytes, 12 bytes above its prior ceiling; its reviewed ceiling advances by 64 bytes to 1,483,136. Other bundle limits and optional-peer exclusions are unchanged.
