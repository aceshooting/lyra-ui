---
'@aceshooting/lyra-ui': patch
---

Keep synchronized compare-panel scroll positions stable when panes have different content heights. Native scroll events that differ only by pixel rounding no longer feed back into the other pane after the animation frame completes.

The fix adds 45 unpacked UI bytes (22,539,085 total); the exceeded package ceiling advances to 22,539,136 bytes. The autoloader measures 1,706,255 gzip bytes, so its exceeded ceiling advances to 1,706,304 bytes. Both limits use the next 64-byte boundary; other passing limits and measurement inputs remain unchanged.
