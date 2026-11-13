---
'@aceshooting/lyra-ui': patch
---

Ignore queued spatial graph visibility and resize deliveries after their observer is retired. Reconnecting a graph or switching between list and 3D views can no longer let an old hidden notification suspend the replacement renderer. The current observers still suspend and restore rendering as visibility changes.

The ownership checks add 246 runtime bytes. The unpacked UI package estimate is 22,549,986 bytes, so its exceeded ceiling advances to the next 64-byte boundary, 22,550,016 bytes. The SSR aggregate measures 1,729,615 gzip bytes, with its exceeded ceiling advancing to 1,729,664 bytes. The packed graph consumer measures 460,762 raw bytes across the same 14 files, so its exceeded ceiling advances to 460,800 bytes. Passing limits and measurement inputs stay unchanged.
