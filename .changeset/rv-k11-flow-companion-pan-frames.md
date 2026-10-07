---
"@aceshooting/lyra-ui": patch
---
lr-flow-canvas, lr-flow-minimap, lr-flow-controls: panning and zooming reuse the frozen companion node/edge snapshot, so the minimap no longer re-renders its node layer or re-reads styles and the controls no longer re-render on every frame.
