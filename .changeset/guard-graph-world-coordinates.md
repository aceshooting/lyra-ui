---
'@aceshooting/lyra-ui': patch
---

Validate optional graph renderer world positions before returning immutable coordinates. Failed or malformed queries and results from a retired view or data model now return no position; coordinate and unrelated metadata accessors are never evaluated. A later valid query recovers without recreating the renderer.

The shared ownership checks and world-coordinate validation add 83 gzip bytes to the standalone graph entry. The packed optional graph consumer grows by 360 raw bytes to 460,563 across the same 14 files; only its exceeded raw ceiling advances to the next 64-byte boundary, 460,608 bytes.

The CDN autoloader, autoloader and SSR aggregate measure 1,706,900, 1,706,743 and 1,728,332 gzip bytes. The unpacked UI archive measures 22,542,461 bytes. Their exceeded ceilings also advance only to the next 64-byte boundary; passing limits and the archive inventory stay unchanged.
