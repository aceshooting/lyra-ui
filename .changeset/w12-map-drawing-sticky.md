---
'@aceshooting/lyra-ui': patch
---

`lr-map` reads `drawingSticky` when a completion edit ends rather than when it opened: an edit opened by `drawingCompleteBehavior = 'edit'` while `drawingSticky` was set no longer re-arms the previous `drawMode` after Finish, cancel, Escape or `cancelDrawing()` once `drawingSticky` has been cleared, so `drawMode` stays `'none'` as documented.
