---
'@aceshooting/lyra-ui': patch
---

Preserve source-backed graph focus and entity-detail activation while the optional 2D rendering dependency loads. Wait for the renderer before moving the camera, and discard the pending focus if its source, view, or connection changes.

The fix adds 350 runtime/declaration bytes. The UI package measures 22,553,607 unpacked bytes; its exceeded ceiling advances to the next 64-byte boundary, 22,553,664 bytes.

The two exceeded aggregate gzip ceilings advance to the next 64-byte boundary: autoloader-cdn.js measures 1,708,609 bytes and ssr/all.js 1,730,137. Passing aggregate and initial-load ceilings remain unchanged.

The installed graph consumer measures 461,047 raw bytes across 14 files. Its exceeded raw ceiling advances to 461,056 bytes, the next 64-byte boundary; the core consumer and peer-loading constraints are unchanged.
