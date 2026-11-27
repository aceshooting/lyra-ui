---
"@aceshooting/lyra-ui": patch
---

`lr-map` point image thumbnails no longer affect map readiness: a failure while placing thumbnails keeps the fallback circles instead of failing the map, and `whenIdle()` no longer waits for thumbnail downloads. Thumbnails are rasterized at the display's pixel density, up to 4×, so they stay sharp on high-density screens.
