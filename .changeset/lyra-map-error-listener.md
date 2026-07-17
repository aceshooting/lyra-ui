---
"@aceshooting/lyra-ui": patch
---

Fix `<lyra-map>` throwing an unhandled error when the underlying maplibre-gl `Map` emits an `'error'` event (e.g. a tile/style source request failing) with no listener attached — maplibre-gl's `Evented` base rethrows in that case. The error is now caught and logged via `console.error` instead of surfacing as an uncaught exception.
