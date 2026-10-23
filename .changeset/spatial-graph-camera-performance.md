---
'@aceshooting/lyra-3d': patch
---

Move spatial graph projection, clipping and stroke expansion to vertex shaders so camera movement reuses geometry buffers. Opaque graphs use depth testing, while translucent graphs reuse painter order during small rotations and restore exact depth order once rotation settles. Keep mixed glyph and stroke batches visible across consecutive frames. Avoid empty label texture uploads and keep camera updates from animation callbacks rendering on consecutive frames.

Resolve translucent CSS self-loop segment painter order from the current camera and viewport, including pan, zoom and resize.
