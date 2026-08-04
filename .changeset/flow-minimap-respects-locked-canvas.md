---
"@aceshooting/lyra-ui": patch
---

Fix `<lr-flow-minimap>` not respecting a paired `<lr-flow-canvas>`'s `locked` state. Click-to-center,
wheel-zoom, viewport-rectangle drag, and the viewport rectangle's keyboard controls now check the
linked canvas's `locked` property before calling `setViewport()`/`zoomIn()`/`zoomOut()`/`fit()`,
mirroring the same guard `<lr-flow-canvas>` already applies to each of its own gesture handlers.
Previously the minimap relied entirely on the paired canvas separately gating those calls itself;
a locked canvas now stays locked even if a `FlowCanvasLike` companion does not also guard its own
methods. The `FlowCanvasLike` structural interface gained a read-only `locked` accessor to support
this.
