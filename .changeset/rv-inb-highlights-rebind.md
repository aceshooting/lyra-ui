---
"@aceshooting/lyra-ui": patch
---
Document viewers no longer re-copy and repaint their highlights when the same `highlights` array is assigned again, which a parent template does on every render.
